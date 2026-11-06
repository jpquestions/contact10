# Contact 10

A social scoring app. Score points for approaching people, play games with friends, and unlock rewards as your totals climb. A full contact is worth 10 points.

See [docs/PLAN.md](docs/PLAN.md) for the product and build plan.

## Stack

Expo (React Native, TypeScript, Expo Router) for the app. Firebase for the backend: Auth, Cloud Firestore with security rules, and Cloud Functions. Home screen widgets will be native WidgetKit and Glance targets.

## Firebase project

The app runs on the Firebase project `contact-10-1c0fd` (Blaze plan). Email/Password sign in, the Firestore database (nam5), the security rules and the Cloud Functions are deployed. Container images from function builds are deleted after a day to avoid storage charges.

## Run the app

1. `npm install`
2. `npm start`, then open it in Expo Go or a development build.

The Firebase web config is built into `src/lib/firebase.ts`. To use a different project, copy `.env.example` to `.env` and fill it in.

## Deploy the backend

```
cd backend
npm install
npm --prefix functions install
npx firebase login
npm run deploy
```

This deploys the Email/Password sign in setting, the Firestore security rules and indexes, and the Cloud Functions.

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
