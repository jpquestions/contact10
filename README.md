# Contact 10

A social scoring app. Score points for approaching people, play games with friends, and unlock rewards as your totals climb. A full contact is worth 10 points.

See [docs/PLAN.md](docs/PLAN.md) for the product and build plan.

## Stack

Expo (React Native, TypeScript, Expo Router) for the app and Supabase (Postgres, Auth, Row Level Security) for the backend. Home screen widgets will be native WidgetKit and Glance targets.

## Setup

1. Install dependencies: `npm install`
2. Create a Supabase project, then apply the migrations in `supabase/migrations` in order (Supabase CLI `supabase db push`, or paste them into the SQL editor).
3. In Supabase, go to Authentication, Emails, and make sure the Magic Link template includes `{{ .Token }}` so sign in emails contain a code.
4. Copy `.env.example` to `.env` and fill in the project URL and publishable key from Project Settings, API.
5. Start the app: `npm start`, then open it in Expo Go or a development build.

## Checks

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests for scoring rules and milestones |
| `npm run test:db` | Applies every migration to a throwaway local Postgres and runs the RLS tests in `supabase/tests` |

`test:db` needs the Postgres server binaries (`initdb`, `pg_ctl`) installed locally.

## Layout

```
src/app/            screens (Expo Router: every file is a route)
src/app/(tabs)/     Home, Games, Friends, Rewards, Rules
src/components/     shared UI
src/lib/            Supabase client, auth, rules and milestone logic
supabase/migrations database schema and access rules
supabase/tests      RLS tests and a local stand in for Supabase auth
```

## Data access rule

Clients read through row level security and only write their own profile fields, rewards, notification read state and push tokens. Every other write (games, invites, points, flags, friendships) goes through database functions, so a client can never edit a score or total directly.
