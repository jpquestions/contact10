-- RLS and privilege tests for the initial schema. Runs in one transaction
-- that is rolled back, switching between users the way PostgREST does.

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAILED: %', label;
  end if;
end $$;

-- True when the statement raises an error (permission denied, check, unique).
create function tests.fails(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;

create function tests.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

grant execute on all functions in schema tests to anon, authenticated;

begin;

-- Fixtures, created as the superuser.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@test');

select tests.ok((select count(*) = 4 from public.profiles where username is null),
                'signup creates a profile with no username');

update public.profiles set username = 'bob' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol' where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave', lifetime_points = 42 where id = '00000000-0000-0000-0000-00000000000d';

insert into public.friendships (user_a, user_b, status, acted_by, accepted_at) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted',
   '00000000-0000-0000-0000-00000000000a', now()),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d', 'blocked',
   '00000000-0000-0000-0000-00000000000b', null);

insert into public.games (id, name, type, target_points, reward_text, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Friday', 'ongoing', 50, 'Breakfast',
   '00000000-0000-0000-0000-00000000000a');
insert into public.game_members (game_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'admin'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'member');

insert into public.point_entries (user_id, game_id, amount) values
  ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 6),
  ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000001', 10),
  ('00000000-0000-0000-0000-00000000000c', null, 3);

insert into public.milestone_unlocks (user_id, threshold) values
  ('00000000-0000-0000-0000-00000000000b', 10),
  ('00000000-0000-0000-0000-00000000000c', 10);

insert into public.notifications (id, recipient_id, kind) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'friend_accepted');

-- Alice: friend of Bob, game mate of Carol, stranger to Dave. -----------------
select tests.login('00000000-0000-0000-0000-00000000000a');

select tests.ok(not tests.fails($$update public.profiles set username = 'alice'
                                  where id = '00000000-0000-0000-0000-00000000000a'$$),
                'can set own username');
select tests.ok(tests.fails($$update public.profiles set username = 'Bad Name!'
                              where id = '00000000-0000-0000-0000-00000000000a'$$),
                'rejects invalid username');
select tests.ok(tests.fails($$update public.profiles set username = 'bob'
                              where id = '00000000-0000-0000-0000-00000000000a'$$),
                'rejects taken username');
select tests.ok(tests.fails($$update public.profiles set lifetime_points = 9999
                              where id = '00000000-0000-0000-0000-00000000000a'$$),
                'cannot edit own lifetime points');

update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000000b';
select tests.ok((select display_name is null from public.profiles
                 where id = '00000000-0000-0000-0000-00000000000b'),
                'cannot edit another profile');

select tests.ok((select count(*) = 3 from public.profiles), 'sees self, friend and game mate only');
select tests.ok(not exists (select 1 from public.profiles where username = 'dave'),
                'stranger profile is hidden');
select tests.ok(exists (select 1 from public.search_users('da') where username = 'dave'),
                'stranger is findable by username');
select tests.ok((select count(*) = 0 from public.search_users('%')), 'search ignores wildcards');

select tests.ok((select count(*) = 1 from public.games), 'sees own game');
select tests.ok((select count(*) = 2 from public.game_members), 'sees game members');
select tests.ok((select count(*) = 2 from public.point_entries), 'sees game entries, not solo entries of others');

select tests.ok(tests.fails($$insert into public.point_entries (user_id, amount)
                              values ('00000000-0000-0000-0000-00000000000a', 5)$$),
                'cannot insert points directly');
select tests.ok(tests.fails($$insert into public.games (name, type, target_points, reward_text, created_by)
                              values ('x', 'ongoing', 5, 'y', '00000000-0000-0000-0000-00000000000a')$$),
                'cannot create games directly');
select tests.ok(tests.fails($$insert into public.friendships (user_a, user_b, acted_by)
                              values ('00000000-0000-0000-0000-00000000000a',
                                      '00000000-0000-0000-0000-00000000000d',
                                      '00000000-0000-0000-0000-00000000000a')$$),
                'cannot write friendships directly');

select tests.ok((select array_agg(user_id) = array['00000000-0000-0000-0000-00000000000b'::uuid]
                 from public.milestone_unlocks),
                'sees friend milestones, not game mate milestones');

insert into public.user_rewards (user_id, threshold, reward_text)
  values ('00000000-0000-0000-0000-00000000000a', 500, 'New shoes');
select tests.ok(tests.fails($$insert into public.user_rewards (user_id, threshold, reward_text)
                              values ('00000000-0000-0000-0000-00000000000b', 500, 'x')$$),
                'cannot write rewards for others');
select tests.ok(tests.fails($$insert into public.user_rewards (user_id, threshold, reward_text)
                              values ('00000000-0000-0000-0000-00000000000a', 77, 'x')$$),
                'rewards only at defined milestones');

update public.notifications set read_at = now() where id = '20000000-0000-0000-0000-000000000001';
select tests.ok((select read_at is not null from public.notifications), 'can mark notification read');
select tests.ok(tests.fails($$update public.notifications set kind = 'x'$$),
                'cannot rewrite notifications');

reset role;

-- Carol: game mate of Alice only. -------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.ok((select count(*) = 3 from public.point_entries), 'sees game entries plus own solo entry');
select tests.ok(not exists (select 1 from public.user_rewards), 'cannot see others reward text');
select tests.ok(not exists (select 1 from public.profiles where username = 'bob'),
                'friend of a game mate stays hidden');
reset role;

-- Dave: blocked by Bob, in no games. ----------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.ok((select count(*) = 1 from public.profiles), 'sees only self');
select tests.ok(not exists (select 1 from public.search_users('bo')), 'blocked user missing from search');
select tests.ok(not exists (select 1 from public.games), 'sees no games');
select tests.ok(not exists (select 1 from public.point_entries), 'sees no entries');
reset role;

-- Anonymous: nothing at all. ------------------------------------------------
set local role anon;
select tests.ok(tests.fails('select 1 from public.profiles'), 'anon cannot read profiles');
select tests.ok(tests.fails($$select 1 from public.search_users('bo')$$), 'anon cannot search');
reset role;

rollback;
