-- Rehearsal schedule shown at check-in, and each performer's hard conflicts.

alter table public.productions add column if not exists rehearsal_info text not null default '';

-- conflicts: [{ "date": "2026-11-03", "start": "18:00", "end": "21:00", "note": "Work" }]
-- start and end are blank for an all-day conflict.
alter table public.auditioners add column if not exists conflicts jsonb not null default '[]'::jsonb;
alter table public.auditioners add column if not exists conflict_notes text not null default '';
alter table public.auditioners add column if not exists no_conflicts boolean not null default false;

-- Performers see the rehearsal schedule before they list conflicts.
create or replace function public.checkin_info(code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'session_id', se.id,
    'open', se.checkin_open,
    'production', p.title,
    'theatre', t.name,
    'rehearsal_info', p.rehearsal_info,
    'characters', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.sort, c.created_at)
      from characters c where c.production_id = p.id
    ), '[]'::jsonb)
  )
  from sessions se
  join productions p on p.id = se.production_id
  join theatres t on t.id = p.theatre_id
  where se.checkin_code = lower(trim(code));
$$;

-- Keeps only well-formed conflict entries, at most 60.
create or replace function public.clean_conflicts(raw jsonb)
returns jsonb language plpgsql immutable as $$
declare
  out jsonb := '[]'::jsonb;
  c jsonb;
  d text; s text; e text;
begin
  if raw is null or jsonb_typeof(raw) <> 'array' then return out; end if;
  for c in select * from jsonb_array_elements(raw) loop
    exit when jsonb_array_length(out) >= 60;
    continue when jsonb_typeof(c) <> 'object';
    d := coalesce(c ->> 'date', '');
    s := coalesce(c ->> 'start', '');
    e := coalesce(c ->> 'end', '');
    continue when d !~ '^\d{4}-\d{2}-\d{2}$';
    begin
      perform d::date;
    exception when others then
      continue;
    end;
    if s !~ '^([01]\d|2[0-3]):[0-5]\d$' then s := ''; end if;
    if e !~ '^([01]\d|2[0-3]):[0-5]\d$' then e := ''; end if;
    out := out || jsonb_build_array(jsonb_build_object(
      'date', d, 'start', s, 'end', e, 'note', left(coalesce(trim(c ->> 'note'), ''), 200)
    ));
  end loop;
  return out;
end $$;

create or replace function public.check_in(code text, entry jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  s sessions%rowtype;
  next_slot integer;
  existing integer;
  f jsonb;
  chars uuid[];
  headshot text := coalesce(entry ->> 'headshot_path', '');
  tempo_text text := coalesce(entry ->> 'tempo', '');
begin
  -- Locking the session row makes check-ins for one session happen one at a time.
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
    cut_start, cut_end, song_key, first_note, tempo, note, character_ids, headshot_path,
    conflicts, conflict_notes, no_conflicts
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
    left(coalesce(trim(entry ->> 'first_note'), ''), 12),
    -- Tempo is optional and never blocks a check-in: anything unusable is dropped.
    case when tempo_text ~ '^\d{2,3}$' and tempo_text::integer between 30 and 300 then tempo_text::integer end,
    left(coalesce(trim(entry ->> 'note'), ''), 500),
    chars,
    headshot,
    clean_conflicts(entry -> 'conflicts'),
    left(coalesce(trim(entry ->> 'conflict_notes'), ''), 1000),
    coalesce((entry ->> 'no_conflicts')::boolean, false)
  );
  return next_slot;
end $$;

revoke all on function public.check_in(text, jsonb) from public;
revoke all on function public.checkin_info(text) from public;
grant execute on function public.check_in(text, jsonb) to anon, authenticated;
grant execute on function public.checkin_info(text) to anon, authenticated;
