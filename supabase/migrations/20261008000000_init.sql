-- Audition Room schema
-- Theatres (organizations) own productions; productions own characters and
-- audition sessions; sessions own check-ins. Staff access is by theatre
-- membership. Performers never get table access: they check in through
-- check_in(), which only accepts a valid, open session code.

create extension if not exists pgcrypto;

-- ---------- tables ----------

create table public.theatres (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  team_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.theatre_members (
  theatre_id uuid not null references public.theatres (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (theatre_id, user_id)
);

create table public.productions (
  id uuid primary key default gen_random_uuid(),
  theatre_id uuid not null references public.theatres (id) on delete cascade,
  title text not null check (length(title) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  voice text not null default '',
  low_note text not null default '',
  high_note text not null default '',
  notes text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  checkin_code text not null unique default lower(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  checkin_open boolean not null default true,
  current_auditioner_id uuid,
  created_at timestamptz not null default now()
);

create table public.auditioners (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  slot integer not null,
  name text not null check (length(name) between 1 and 80),
  song text not null check (length(song) between 1 and 160),
  show text not null default '',
  music_type text not null check (music_type in ('sheet', 'track', 'link', 'phone')),
  files jsonb not null default '[]'::jsonb,
  track_link text not null default '',
  cut_start text not null default '',
  cut_end text not null default '',
  song_key text not null default '',
  first_note text not null default '',
  tempo integer check (tempo between 30 and 300),
  note text not null default '',
  character_ids uuid[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'singing', 'done')),
  created_at timestamptz not null default now(),
  unique (session_id, slot)
);

alter table public.sessions
  add constraint sessions_current_fk foreign key (current_auditioner_id)
  references public.auditioners (id) on delete set null;

create table public.scores (
  auditioner_id uuid primary key references public.auditioners (id) on delete cascade,
  voice text not null default '',
  low_note text not null default '',
  high_note text not null default '',
  belt_note text not null default '',
  rating smallint check (rating between 1 and 5),
  notes text not null default '',
  callback_ids uuid[] not null default '{}',
  updated_by uuid default auth.uid() references auth.users (id),
  updated_at timestamptz not null default now()
);

create table public.castings (
  character_id uuid not null references public.characters (id) on delete cascade,
  auditioner_id uuid not null references public.auditioners (id) on delete cascade,
  status text not null default 'considering' check (status in ('considering', 'cast')),
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (character_id, auditioner_id)
);

create index on public.productions (theatre_id);
create index on public.characters (production_id);
create index on public.sessions (production_id);
create index on public.auditioners (session_id);
create index on public.castings (auditioner_id);

-- ---------- access helpers ----------

create or replace function public.is_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from theatre_members where theatre_id = t and user_id = auth.uid());
$$;

create or replace function public.is_owner(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from theatre_members where theatre_id = t and user_id = auth.uid() and role = 'owner');
$$;

create or replace function public.production_theatre(p uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select theatre_id from productions where id = p;
$$;

create or replace function public.session_theatre(s uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.theatre_id from sessions se join productions p on p.id = se.production_id where se.id = s;
$$;

create or replace function public.auditioner_theatre(a uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.theatre_id from auditioners au
    join sessions se on se.id = au.session_id
    join productions p on p.id = se.production_id
  where au.id = a;
$$;

create or replace function public.character_theatre(c uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.theatre_id from characters ch join productions p on p.id = ch.production_id where ch.id = c;
$$;

-- Theatre that owns a storage path music/<session_id>/..., or null.
create or replace function public.music_path_theatre(path text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare seg text := split_part(path, '/', 1);
begin
  if seg !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  return session_theatre(seg::uuid);
end $$;

-- ---------- row level security ----------

alter table public.theatres enable row level security;
alter table public.theatre_members enable row level security;
alter table public.productions enable row level security;
alter table public.characters enable row level security;
alter table public.sessions enable row level security;
alter table public.auditioners enable row level security;
alter table public.scores enable row level security;
alter table public.castings enable row level security;

create policy theatres_read on public.theatres for select to authenticated using (is_member(id));
create policy theatres_update on public.theatres for update to authenticated using (is_owner(id)) with check (is_owner(id));
create policy theatres_delete on public.theatres for delete to authenticated using (is_owner(id));

create policy members_read on public.theatre_members for select to authenticated using (is_member(theatre_id));
create policy members_remove on public.theatre_members for delete to authenticated
  using (is_owner(theatre_id) and user_id <> auth.uid() or user_id = auth.uid() and role <> 'owner');

create policy productions_all on public.productions for all to authenticated
  using (is_member(theatre_id)) with check (is_member(theatre_id));

create policy characters_all on public.characters for all to authenticated
  using (is_member(production_theatre(production_id))) with check (is_member(production_theatre(production_id)));

create policy sessions_all on public.sessions for all to authenticated
  using (is_member(production_theatre(production_id))) with check (is_member(production_theatre(production_id)));

create policy auditioners_all on public.auditioners for all to authenticated
  using (is_member(session_theatre(session_id))) with check (is_member(session_theatre(session_id)));

create policy scores_all on public.scores for all to authenticated
  using (is_member(auditioner_theatre(auditioner_id))) with check (is_member(auditioner_theatre(auditioner_id)));

create policy castings_all on public.castings for all to authenticated
  using (is_member(character_theatre(character_id)))
  with check (
    is_member(character_theatre(character_id))
    and character_theatre(character_id) = auditioner_theatre(auditioner_id)
  );

-- ---------- functions for people outside the theatre ----------

-- Create a theatre; the creator becomes its owner.
create or replace function public.create_theatre(theatre_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  insert into theatres (name, created_by) values (trim(theatre_name), auth.uid()) returning id into t;
  insert into theatre_members (theatre_id, user_id, role) values (t, auth.uid(), 'owner');
  return t;
end $$;

-- Join a theatre's audition team with its team code.
create or replace function public.join_theatre(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into t from theatres where team_code = upper(trim(code));
  if t is null then raise exception 'That team code doesn''t match any theatre'; end if;
  insert into theatre_members (theatre_id, user_id) values (t, auth.uid()) on conflict do nothing;
  return t;
end $$;

-- What a performer sees before checking in: show title and character names only.
create or replace function public.checkin_info(code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'session_id', se.id,
    'open', se.checkin_open,
    'production', p.title,
    'theatre', t.name,
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

-- Performer check-in. Assigns the next audition number atomically.
-- Files must already be uploaded under this session's folder.
create or replace function public.check_in(code text, entry jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  s sessions%rowtype;
  next_slot integer;
  f jsonb;
  chars uuid[];
begin
  select * into s from sessions where checkin_code = lower(trim(code)) for update;
  if not found then raise exception 'That check-in link isn''t valid'; end if;
  if not s.checkin_open then raise exception 'Check-in for this session is closed'; end if;

  for f in select * from jsonb_array_elements(coalesce(entry -> 'files', '[]'::jsonb)) loop
    if position(s.id::text || '/' in coalesce(f ->> 'path', '')) <> 1 then
      raise exception 'Upload doesn''t belong to this session';
    end if;
  end loop;

  select coalesce(array_agg(c.id), '{}') into chars
  from characters c
  where c.production_id = s.production_id
    and c.id::text in (select jsonb_array_elements_text(coalesce(entry -> 'character_ids', '[]'::jsonb)));

  select coalesce(max(slot), 0) + 1 into next_slot from auditioners where session_id = s.id;

  insert into auditioners (
    session_id, slot, name, song, show, music_type, files, track_link,
    cut_start, cut_end, song_key, first_note, tempo, note, character_ids
  ) values (
    s.id, next_slot,
    left(trim(entry ->> 'name'), 80),
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
    chars
  );
  return next_slot;
end $$;

revoke all on function public.check_in(text, jsonb) from public;
revoke all on function public.checkin_info(text) from public;
revoke all on function public.join_theatre(text) from public;
revoke all on function public.create_theatre(text) from public;
grant execute on function public.create_theatre(text) to authenticated;
grant execute on function public.check_in(text, jsonb) to anon, authenticated;
grant execute on function public.checkin_info(text) to anon, authenticated;
grant execute on function public.join_theatre(text) to authenticated;

-- ---------- music storage ----------
-- Files live at music/<session_id>/<random>/<filename>. Performers get a
-- one-time signed upload URL from the server; staff read through RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music', 'music', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
        'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do nothing;

create policy music_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'music' and is_member(music_path_theatre(name)));

create policy music_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'music' and is_member(music_path_theatre(name)));

-- ---------- realtime ----------

alter publication supabase_realtime add table public.sessions, public.auditioners, public.scores, public.castings, public.characters;
