-- Headshots at check-in, an acting score next to the vocal score, and one
-- check-in per person per session.

alter table public.auditioners add column if not exists headshot_path text not null default '';

alter table public.scores add column if not exists acting_rating smallint check (acting_rating between 1 and 5);
alter table public.scores add column if not exists acting_notes text not null default '';

-- Casting gets a middle step: considering, callback, cast.
alter table public.castings drop constraint if exists castings_status_check;
alter table public.castings add constraint castings_status_check check (status in ('considering', 'callback', 'cast'));

-- Names compare without case or extra spaces: "Maya  Thompson" = "maya thompson".
create or replace function public.name_key(n text)
returns text language sql immutable as $$
  select lower(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.check_in(code text, entry jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  s sessions%rowtype;
  next_slot integer;
  existing integer;
  f jsonb;
  chars uuid[];
  headshot text := coalesce(entry ->> 'headshot_path', '');
begin
  -- Locking the session row makes check-ins for one session happen one at a time,
  -- so two taps on "Check in" can't both get through.
  select * into s from sessions where checkin_code = lower(trim(code)) for update;
  if not found then raise exception 'That check-in link isn''t valid'; end if;
  if not s.checkin_open then raise exception 'Check-in for this session is closed'; end if;

  select slot into existing from auditioners
  where session_id = s.id and name_key(name) = name_key(entry ->> 'name')
  limit 1;
  if existing is not null then
    raise exception 'Already checked in as number %', existing;
  end if;

  for f in select * from jsonb_array_elements(coalesce(entry -> 'files', '[]'::jsonb)) loop
    if position(s.id::text || '/' in coalesce(f ->> 'path', '')) <> 1 then
      raise exception 'Upload doesn''t belong to this session';
    end if;
  end loop;
  if headshot <> '' and position(s.id::text || '/' in headshot) <> 1 then
    raise exception 'Upload doesn''t belong to this session';
  end if;

  select coalesce(array_agg(c.id), '{}') into chars
  from characters c
  where c.production_id = s.production_id
    and c.id::text in (select jsonb_array_elements_text(coalesce(entry -> 'character_ids', '[]'::jsonb)));

  select coalesce(max(slot), 0) + 1 into next_slot from auditioners where session_id = s.id;

  insert into auditioners (
    session_id, slot, name, song, show, music_type, files, track_link,
    cut_start, cut_end, song_key, first_note, tempo, note, character_ids, headshot_path
  ) values (
    s.id, next_slot,
    left(regexp_replace(trim(entry ->> 'name'), '\s+', ' ', 'g'), 80),
    left(trim(entry ->> 'song'), 160),
    left(coalesce(trim(entry ->> 'show'), ''), 160),
    entry ->> 'music_type',
    coalesce(entry -> 'files', '[]'::jsonb),
    left(coalesce(trim(entry ->> 'track_link'), ''), 500),
    left(coalesce(trim(entry ->> 'cut_start'), ''), 40),
    left(coalesce(trim(entry ->> 'cut_end'), ''), 40),
    left(coalesce(trim(entry ->> 'song_key'), ''), 40),
    left(coalesce(trim(entry ->> 'first_note'), ''), 8),
    nullif(entry ->> 'tempo', '')::integer,
    left(coalesce(trim(entry ->> 'note'), ''), 500),
    chars,
    headshot
  );
  return next_slot;
end $$;

revoke all on function public.check_in(text, jsonb) from public;
grant execute on function public.check_in(text, jsonb) to anon, authenticated;
