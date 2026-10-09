-- Access-rule tests. Run with scripts/test-db.sh (plain Postgres + shim).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'),  -- owner of theatre A
  ('00000000-0000-0000-0000-00000000000b'),  -- accompanist who joins A
  ('00000000-0000-0000-0000-00000000000c');  -- owner of unrelated theatre C

create function pg_temp.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', what; end if;
  raise notice 'ok - %', what;
end $$;
create function pg_temp.fails(stmt text, what text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok - % (%)', what, sqlerrm; return; end;
  raise exception 'FAIL: expected an error: %', what;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

create temp table ids (k text primary key, v text);
grant all on ids to anon, authenticated;

-- Owner A sets up a theatre, production, characters and a session.
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into ids select 'theatre', create_theatre('LSPA');
insert into productions (theatre_id, title) select v::uuid, 'Spring Musical' from ids where k = 'theatre';
insert into ids select 'production', id from productions;
insert into characters (production_id, name, voice, high_note)
  select v::uuid, 'Andy', 'Tenor', 'G4' from ids where k = 'production';
insert into characters (production_id, name, voice, high_note)
  select v::uuid, 'Jane', 'Soprano', 'B5' from ids where k = 'production';
insert into ids select 'andy', id from characters where name = 'Andy';
insert into sessions (production_id, name) select v::uuid, 'Saturday' from ids where k = 'production';
insert into ids select 'session', id from sessions;
insert into ids select 'code', checkin_code from sessions;
insert into ids select 'team', team_code from theatres;
select pg_temp.ok((select role from theatre_members) = 'owner', 'creator becomes owner');

-- A performer with no account checks in.
reset role; set role anon; set request.jwt.claim.sub = '';
select pg_temp.ok((checkin_info((select v from ids where k = 'code')) ->> 'production') = 'Spring Musical', 'performer sees show title');
select pg_temp.ok(jsonb_array_length(checkin_info((select v from ids where k = 'code')) -> 'characters') = 2, 'performer sees character names');
select pg_temp.ok(checkin_info('not-a-code') is null, 'bad code shows nothing');
select pg_temp.ok(check_in((select v from ids where k = 'code'), jsonb_build_object(
  'name', 'Maya', 'song', 'Corner of the Sky', 'music_type', 'sheet',
  'files', jsonb_build_array(jsonb_build_object('path', (select v from ids where k = 'session') || '/x1/cut.pdf', 'name', 'cut.pdf', 'type', 'application/pdf')),
  'first_note', 'Bb3', 'tempo', '112',
  'character_ids', jsonb_build_array((select v from ids where k = 'andy'), '11111111-1111-1111-1111-111111111111')
)) = 1, 'first check-in gets number 1');
select pg_temp.ok(check_in((select v from ids where k = 'code'), '{"name":"Devon","song":"Santa Fe","music_type":"link","track_link":"https://example.com/t"}') = 2, 'second check-in gets number 2');
select pg_temp.fails($$select check_in((select v from ids where k = 'code'), '{"name":"X","song":"Y","music_type":"sheet","files":[{"path":"someone-else/f.pdf"}]}')$$, 'upload from another session is rejected');
select pg_temp.fails($$select check_in((select v from ids where k = 'code'), '{"name":"  maya ","song":"Again","music_type":"phone"}')$$, 'same name cannot check in twice');
select pg_temp.fails($$select check_in((select v from ids where k = 'code'), '{"name":"Z","song":"Y","music_type":"phone","headshot_path":"elsewhere/me.jpg"}')$$, 'headshot from another session is rejected');
select pg_temp.ok(check_in((select v from ids where k = 'code'), jsonb_build_object('name', 'Priya   Nair', 'song', 'Astonishing', 'music_type', 'phone',
  'headshot_path', (select v from ids where k = 'session') || '/h1/me.jpg')) = 3, 'check-in with headshot gets the next number');
select pg_temp.fails($$select check_in((select v from ids where k = 'code'), '{"name":"PRIYA NAIR","song":"Y","music_type":"phone"}')$$, 'name match ignores case and spacing');
select pg_temp.ok(check_in((select v from ids where k = 'code'), '{"name":"Sam Ellis","song":"Santa Fe","music_type":"phone","tempo":"fast","first_note":"not sure",
  "conflicts":[{"date":"2026-11-03","start":"18:00","end":"21:00","note":"Work"},{"date":"2026-11-07"},{"date":"tomorrow"},{"date":"2026-02-30"},{"date":"2026-11-10","start":"25:00","note":"x"}],
  "conflict_notes":"Out of town Thanksgiving week"}') = 4, 'messy tempo, note and conflicts never block a check-in');
select pg_temp.ok(check_in((select v from ids where k = 'code'), '{"name":"Lena Ortiz","song":"Defying Gravity","music_type":"phone","no_conflicts":true}') = 5, 'performer can say they have no conflicts');
select pg_temp.ok((checkin_info((select v from ids where k = 'code')) ? 'rehearsal_info'), 'performer sees the rehearsal schedule field');
select pg_temp.fails($$select check_in('not-a-code', '{"name":"X","song":"Y","music_type":"phone"}')$$, 'bad code cannot check in');
select pg_temp.ok((select count(*) from auditioners) = 0, 'performer cannot read the auditioner list');
select pg_temp.ok((select count(*) from characters) = 0, 'performer cannot read character details');
select pg_temp.fails($$insert into auditioners (session_id, slot, name, song, music_type) values (gen_random_uuid(), 9, 'x', 'y', 'phone')$$, 'performer cannot write tables directly');

-- Owner sees the check-ins; unknown characters were dropped.
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select count(*) from auditioners) = 5, 'owner sees every check-in');
select pg_temp.ok((select tempo is null and first_note = 'not sure' from auditioners where slot = 4), 'unusable tempo is dropped, free-text note is kept');
select pg_temp.ok((select jsonb_array_length(conflicts) from auditioners where slot = 4) = 3, 'only real dates are kept as conflicts');
select pg_temp.ok((select conflicts -> 2 ->> 'start' from auditioners where slot = 4) = '', 'an impossible time becomes all day');
select pg_temp.ok((select no_conflicts from auditioners where slot = 5), 'no-conflicts answer is saved');
update productions set rehearsal_info = 'Mon to Thu, 6 to 9 pm';
select pg_temp.ok((select rehearsal_info from productions) <> '', 'team can post the rehearsal schedule');
delete from auditioners where slot in (4, 5);
select pg_temp.ok((select name from auditioners where slot = 3) = 'Priya Nair', 'extra spaces in names are tidied');
select pg_temp.ok((select headshot_path <> '' from auditioners where slot = 3), 'headshot is saved');
select pg_temp.ok((select cardinality(character_ids) from auditioners where slot = 1) = 1, 'unknown character ids are dropped');

-- Closing check-in blocks performers.
update sessions set checkin_open = false;
reset role; set role anon; set request.jwt.claim.sub = '';
select pg_temp.fails($$select check_in((select v from ids where k = 'code'), '{"name":"Late","song":"Y","music_type":"phone"}')$$, 'closed session refuses check-in');
reset role; set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update sessions set checkin_open = true;

-- Accompanist B sees nothing until joining with the team code.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from auditioners) = 0, 'outsider sees no check-ins');
select pg_temp.ok((select count(*) from theatres) = 0, 'outsider sees no theatres');
select pg_temp.fails($$select join_theatre('WRONG123')$$, 'wrong team code is refused');
select join_theatre((select v from ids where k = 'team'));
select pg_temp.ok((select count(*) from auditioners) = 3, 'team member sees check-ins after joining');
insert into scores (auditioner_id, low_note, high_note) select id, 'G3', 'E5' from auditioners where slot = 1;
insert into scores (auditioner_id, acting_rating, acting_notes) select id, 4, 'Great read' from auditioners where slot = 1
  on conflict (auditioner_id) do update set acting_rating = excluded.acting_rating, acting_notes = excluded.acting_notes;
select pg_temp.ok((select low_note = 'G3' and acting_rating = 4 from scores), 'acting notes save without wiping vocal notes');
delete from auditioners where slot = 2;
select pg_temp.ok((select count(*) from auditioners) = 2, 'team member can remove a stray check-in');
update sessions set current_auditioner_id = (select id from auditioners where slot = 1);
select pg_temp.ok((select current_auditioner_id is not null from sessions), 'team member can run the queue');
update theatres set name = 'Hijacked';
select pg_temp.ok((select name from theatres) = 'LSPA', 'staff cannot rename the theatre');

-- Owner C in another theatre cannot see or touch theatre A.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into ids select 'theatreC', create_theatre('Elsewhere Players');
insert into productions (theatre_id, title) select v::uuid, 'Other Show' from ids where k = 'theatreC';
insert into characters (production_id, name) select id, 'Lead' from productions where title = 'Other Show';
select pg_temp.ok((select count(*) from auditioners) = 0, 'other theatre sees no check-ins');
select pg_temp.ok((select count(*) from productions) = 1, 'other theatre sees only its own production');
select pg_temp.fails($$insert into castings (character_id, auditioner_id)
  select c.id, (select id from auditioners limit 1) from characters c$$, 'cannot cast another theatre''s auditioner');
select pg_temp.fails($$insert into productions (theatre_id, title) select v::uuid, 'Sneaky' from ids where k = 'theatre'$$, 'cannot add productions to another theatre');

-- Storage: staff of A can read A's files; C cannot.
reset role;
insert into storage.objects (bucket_id, name) select 'music', v || '/x1/cut.pdf' from ids where k = 'session';
insert into storage.objects (bucket_id, name) values ('music', 'junk-path/file.pdf');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select count(*) from storage.objects) = 1, 'team member reads own session files only');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select pg_temp.ok((select count(*) from storage.objects) = 0, 'other theatre reads no files');

-- Casting within theatre A works.
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into castings (character_id, auditioner_id)
  select (select v::uuid from ids where k = 'andy'), id from auditioners where slot = 1;
select pg_temp.ok((select count(*) from castings) = 1, 'owner can place a singer on a character');
update castings set status = 'callback';
select pg_temp.ok((select status from castings) = 'callback', 'a singer can be marked for callback');
select pg_temp.fails($$update castings set status = 'maybe'$$, 'unknown casting status is refused');

\echo 'all schema tests passed'
