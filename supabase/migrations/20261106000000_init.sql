-- Contact 10: initial schema, row level security and profile bootstrap.
--
-- Clients read through RLS and write only where a policy below allows it
-- (own profile fields, own rewards, own notification read state, own push
-- tokens). Every other write (games, invites, points, flags, friendships)
-- goes through SECURITY DEFINER functions added in later migrations, so a
-- client can never edit a total or a score directly.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.game_type as enum ('night', 'weekend', 'ongoing');
create type public.game_status as enum ('active', 'ended');
create type public.reward_mode as enum ('first', 'everyone');
create type public.member_role as enum ('admin', 'member');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'revoked');
create type public.entry_source as enum ('app', 'widget');
create type public.flag_status as enum ('pending', 'upheld', 'dismissed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Null until the user picks one during onboarding.
  username text unique
    check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) <= 40),
  avatar_url text,
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  active_game_id uuid,
  seen_widget_intro_launch boolean not null default false,
  seen_widget_intro_first_score boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  -- Who sent the request, or who blocked when status is 'blocked'.
  acted_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (acted_by in (user_a, user_b))
);
create index friendships_user_b_idx on public.friendships (user_b);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  type public.game_type not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  target_points integer not null check (target_points between 1 and 100000),
  reward_text text not null check (char_length(reward_text) between 1 and 200),
  reward_mode public.reward_mode not null default 'first',
  house_rules text check (char_length(house_rules) <= 500),
  created_by uuid not null references public.profiles (id) on delete cascade,
  winner_id uuid references public.profiles (id) on delete set null,
  won_at timestamptz,
  status public.game_status not null default 'active',
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (type = 'ongoing' or ends_at is not null)
);
create index games_created_by_idx on public.games (created_by);

alter table public.profiles
  add constraint profiles_active_game_fk
  foreign key (active_game_id) references public.games (id) on delete set null;

create table public.game_members (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  points integer not null default 0 check (points >= 0),
  reached_target_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_members_user_idx on public.game_members (user_id);

create table public.game_invites (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  -- Null for an open share link that anyone with the code can use.
  invitee_id uuid references public.profiles (id) on delete cascade,
  code text not null unique default substr(md5(gen_random_uuid()::text), 1, 12),
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
create index game_invites_game_idx on public.game_invites (game_id);
create index game_invites_invitee_idx on public.game_invites (invitee_id)
  where invitee_id is not null;

create table public.point_entries (
  -- Clients may supply the id so offline widget retries stay idempotent.
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid references public.games (id) on delete cascade,
  amount integer not null check (amount between 1 and 100),
  source public.entry_source not null default 'app',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  removed_by_flag boolean not null default false
);
create index point_entries_game_idx on public.point_entries (game_id, created_at desc)
  where game_id is not null;
create index point_entries_user_idx on public.point_entries (user_id, created_at desc);

create table public.milestones (
  threshold integer primary key
);
insert into public.milestones (threshold) values
  (10), (50), (100), (200), (300), (400), (500), (1000), (2500), (5000), (10000);

create table public.user_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  threshold integer not null references public.milestones (threshold),
  reward_text text not null check (char_length(reward_text) between 1 and 200),
  primary key (user_id, threshold)
);

create table public.milestone_unlocks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  threshold integer not null references public.milestones (threshold),
  reached_at timestamptz not null default now(),
  primary key (user_id, threshold)
);

create table public.entry_flags (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.point_entries (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  flagged_by uuid not null references public.profiles (id) on delete cascade,
  reason text check (char_length(reason) <= 200),
  status public.flag_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index entry_flags_game_idx on public.entry_flags (game_id, status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.push_tokens (
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ---------------------------------------------------------------------------
-- RLS helpers. SECURITY DEFINER so policies can consult membership tables
-- without recursing through those tables' own policies.
-- ---------------------------------------------------------------------------

create function public.is_game_member(p_game_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.game_members
    where game_id = p_game_id and user_id = (select auth.uid())
  );
$$;

create function public.is_friend(p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and user_a = least((select auth.uid()), p_other)
      and user_b = greatest((select auth.uid()), p_other)
  );
$$;

-- True when the caller may see another user's profile: friends, a pending
-- request in either direction, or a game in common. Blocks hide everything.
create function public.can_see_profile(p_other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_other = (select auth.uid())
    or (
      not exists (
        select 1 from public.friendships
        where status = 'blocked'
          and user_a = least((select auth.uid()), p_other)
          and user_b = greatest((select auth.uid()), p_other)
      )
      and (
        exists (
          select 1 from public.friendships
          where status in ('pending', 'accepted')
            and user_a = least((select auth.uid()), p_other)
            and user_b = greatest((select auth.uid()), p_other)
        )
        or exists (
          select 1
          from public.game_members mine
          join public.game_members theirs on theirs.game_id = mine.game_id
          where mine.user_id = (select auth.uid()) and theirs.user_id = p_other
        )
      )
    );
$$;

revoke execute on function public.is_game_member(uuid) from public, anon;
revoke execute on function public.is_friend(uuid) from public, anon;
revoke execute on function public.can_see_profile(uuid) from public, anon;
grant execute on function public.is_game_member(uuid) to authenticated;
grant execute on function public.is_friend(uuid) to authenticated;
grant execute on function public.can_see_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.game_invites enable row level security;
alter table public.point_entries enable row level security;
alter table public.milestones enable row level security;
alter table public.user_rewards enable row level security;
alter table public.milestone_unlocks enable row level security;
alter table public.entry_flags enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- Nothing is public: anonymous visitors get no table access at all.
revoke all on all tables in schema public from anon;

-- Profiles: visible to yourself, friends, pending requests and game mates.
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_see_profile(id));

-- Only these profile columns are client editable; totals never are.
revoke insert, update, delete on public.profiles from authenticated;
grant update (username, display_name, avatar_url, active_game_id,
              seen_widget_intro_launch, seen_widget_intro_first_score)
  on public.profiles to authenticated;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy friendships_select on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy games_select on public.games
  for select to authenticated
  using (public.is_game_member(id));

create policy game_members_select on public.game_members
  for select to authenticated
  using (public.is_game_member(game_id));

create policy game_invites_select on public.game_invites
  for select to authenticated
  using (invitee_id = (select auth.uid()) or public.is_game_member(game_id));

-- Solo entries are private to their owner; game entries are visible to the game.
create policy point_entries_select on public.point_entries
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (game_id is not null and public.is_game_member(game_id))
  );

create policy milestones_select on public.milestones
  for select to authenticated
  using (true);

create policy user_rewards_own on public.user_rewards
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Friends can see which milestones you have reached, not your reward text.
create policy milestone_unlocks_select on public.milestone_unlocks
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_friend(user_id));

create policy entry_flags_select on public.entry_flags
  for select to authenticated
  using (public.is_game_member(game_id));

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));
revoke insert, update, delete on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_mark_read on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Profile bootstrap and username search
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usernames are the one thing strangers can look up, so friend requests and
-- invites can find people. Returns no totals or anything else.
create function public.search_users(p_query text)
returns table (id uuid, username text, display_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.username is not null
    and char_length(p_query) >= 2
    and p.username like replace(regexp_replace(lower(p_query), '[%\\]', '', 'g'), '_', '\_') || '%'
    and p.id <> (select auth.uid())
    and not exists (
      select 1 from public.friendships f
      where f.status = 'blocked'
        and f.user_a = least((select auth.uid()), p.id)
        and f.user_b = greatest((select auth.uid()), p.id)
    )
  order by p.username
  limit 20;
$$;

revoke execute on function public.search_users(text) from public, anon;
grant execute on function public.search_users(text) to authenticated;
