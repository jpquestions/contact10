# Contact 10

A social scoring app. Score points for approaching people, play games with friends, and unlock rewards as your totals climb. A full contact is worth 10 points.

See [docs/PLAN.md](docs/PLAN.md) for the product and build plan.

## Stack

Expo (React Native, TypeScript, Expo Router) for the app. Firebase for the backend: Auth, Cloud Firestore with security rules, and Cloud Functions. Home screen widgets will be native WidgetKit and Glance targets.

## Firebase setup (once)

1. Create a project at console.firebase.google.com.
2. Upgrade it to the Blaze plan (Cloud Functions need it) and add a budget alert under Billing, Budgets and alerts. Normal use of this app should stay inside the free allowance.
3. Build, Authentication: get started and enable Email/Password.
4. Build, Firestore Database: create a database in production mode.
5. Project settings, General, Your apps: add a Web app and copy its config values.
6. Put the project id in `backend/.firebaserc`.

## Run the app

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the web app config values.
3. `npm start`, then open it in Expo Go or a development build.

## Deploy the backend

```
cd backend
npm install
npm --prefix functions install
npx firebase login
npm run deploy
```

This deploys the Firestore security rules, indexes and Cloud Functions.

## Checks

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | TypeScript for the app |
| `npm test` | Unit tests for scoring rules and milestones |
| `npm run test:backend` | Starts the Firebase emulators and runs the security rules and Cloud Functions tests |

The backend tests need Java (for the Firestore emulator) and the backend dependencies installed (`npm --prefix backend install` and `npm --prefix backend/functions install`).

## Layout

```
src/app/              screens (Expo Router: every file is a route)
src/app/(tabs)/       Home, Games, Friends, Rewards, Rules
src/components/       shared UI
src/lib/              Firebase client, auth, rules and milestone logic
backend/firestore.rules   who can read and write what
backend/functions/    Cloud Functions (TypeScript)
backend/tests/        emulator tests for rules and functions
```

## Data access rule

Clients read through Firestore security rules and only write their own profile fields, rewards, notification read state and push tokens. Every other write (games, invites, points, flags, friendships, usernames) goes through Cloud Functions, so a client can never edit a score or total directly.
