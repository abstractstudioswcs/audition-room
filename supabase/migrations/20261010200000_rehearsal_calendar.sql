-- A rehearsal calendar the team builds, shown to performers at check-in so
-- they can mark conflicts against real dates.

create table if not exists public.rehearsal_events (
  id uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions (id) on delete cascade,
  date date not null,
  -- "HH:MM", or blank when no time is set.
  start_time text not null default '' check (start_time = '' or start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time text not null default '' check (end_time = '' or end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  kind text not null default 'rehearsal' check (kind in ('rehearsal', 'tech', 'performance', 'other')),
  title text not null default '' check (length(title) <= 80),
  notes text not null default '' check (length(notes) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists rehearsal_events_production_date on public.rehearsal_events (production_id, date);

alter table public.rehearsal_events enable row level security;

drop policy if exists rehearsal_events_all on public.rehearsal_events;
create policy rehearsal_events_all on public.rehearsal_events for all to authenticated
  using (is_member(production_theatre(production_id)))
  with check (is_member(production_theatre(production_id)));

do $$ begin
  alter publication supabase_realtime add table public.rehearsal_events;
exception when duplicate_object then null;
end $$;

-- Performers get the calendar along with the show title and characters.
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
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'date', e.date, 'start_time', e.start_time, 'end_time', e.end_time,
        'kind', e.kind, 'title', e.title, 'notes', e.notes
      ) order by e.date, e.start_time)
      from rehearsal_events e where e.production_id = p.id
    ), '[]'::jsonb)
  )
  from sessions se
  join productions p on p.id = se.production_id
  join theatres t on t.id = p.theatre_id
  where se.checkin_code = lower(trim(code));
$$;

revoke all on function public.checkin_info(text) from public;
grant execute on function public.checkin_info(text) to anon, authenticated;
