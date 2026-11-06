# Contact 10: Product and Build Plan

Contact 10 is a social scoring app. You earn points for approaching people, you play in games with friends, and every point you score in a game also counts toward your lifetime total. Games and personal milestones carry rewards, and friends get notified when you hit one.

The name comes from the rules: a full contact (bubble, talk, laugh, number) is worth 10 points.

## 1. Rules (in app Rules page)

| Step | Points | Running total |
| --- | --- | --- |
| Get in the bubble of a person | 1 | 1 |
| Talk to them | 2 | 3 |
| Make them laugh | 3 | 6 |
| Get a number or contact info | 4 | 10 |

The quick add buttons map onto this ladder: **1** (bubble only), **2** and **3** (single steps), **6** (bubble through laugh), **10** (full contact). Any custom amount from 1 to 100 is also allowed for bonus or house rules.

The Rules page is static content shipped with the app, reachable from the main tab bar and linked from the first run popup. Games can optionally add a short "house rules" note shown under the standard rules on that game's page.

## 2. Core concepts

**User.** Username, display name, avatar, lifetime points, personal milestone rewards.

**Game.** A container for scoring with a group. Each game has a type, a start, an optional end, a target point total, and a reward.

| Type | Default window | Notes |
| --- | --- | --- |
| Single night | Starts when created, ends 6:00 AM local next morning | Creator can adjust the end time |
| Weekend | Friday 5:00 PM to Sunday 11:59 PM local | Picks the upcoming or current weekend |
| Ongoing | No end | Creator can end it manually at any time |

Once a game ends it becomes read only: the leaderboard is frozen and visible in history.

**Point entry.** One logged score: user, amount (1 to 100), optional game, timestamp. This is the single source of truth. Game totals and lifetime totals are both sums of entries.

**Totals rule.** Every entry counts toward lifetime points. An entry tagged to a game also counts toward that game. Entries can also be logged with no game (solo play), which count only toward lifetime. This satisfies "all game totals get added to the user's total" without double counting.

**Game reward.** The creator sets a target (for example 50 points), a reward description (for example "loser buys breakfast"), and a reward mode:

| Mode | Behavior |
| --- | --- |
| First to reach | The first member to hit the target wins the reward and the game shows a winner banner |
| Everyone who reaches | Every member who hits the target earns the reward, and each one gets a badge on the leaderboard |

Scoring continues after the target is reached in either mode so the leaderboard stays live.

**Personal milestones.** Fixed thresholds on lifetime points: 10, 50, 100, 200, 300, 400, 500, 1,000, 2,500, 5,000, 10,000. Each user can attach their own reward text to any milestone ("new shoes at 500"). Milestones with no reward text still fire a celebration and notifications.

## 3. Features

### 3.1 Games

Create a game: name, type, start and end, target points, reward text, reward mode, optional house rules.

Invite to a game: from your friends list, or with a share link or code that works for anyone with the app. Invitees see a pending invite with accept and decline. The creator is the game admin and can remove members and end the game.

Game screen: live leaderboard of every member's points for that game, sorted high to low, with progress bars toward the target, a reward card, an activity feed ("Sam +6"), and the add points controls.

Users can be in several games at once. The one they opened most recently is their "active game", which is where the widget sends points by default.

### 3.2 Adding points

In app: a scoring panel on the Home screen and on each game screen with five quick add buttons (1, 2, 3, 6, 10) plus a "Custom" button that opens a 1 to 100 stepper or slider. A game picker sits above the buttons (defaults to active game, with a "No game" option).

Undo: every entry shows an undo toast for 10 seconds, and users can delete their own entries from a game's feed for 5 minutes after logging. After that the entry is locked.

Home screen widgets (the main convenience feature):

| Widget | Size | Contents |
| --- | --- | --- |
| Quick Add | Medium | Active game name, your game points, five quick add buttons |
| Score | Small | Lifetime points and progress to the next milestone; tap opens the app |
| Leaderboard | Large | Top 5 in the active game plus quick add row |

Widget buttons log points directly without opening the app (iOS 17+ interactive widgets via App Intents, Android via Glance actions). The widget can be configured to a specific game or to "follow my active game". The 1 to 100 custom amount opens the app's custom sheet since widgets cannot host free input.

### 3.3 Flagging false points

Any member of a game can flag another member's entry in that game's feed, with an optional reason. Solo entries are not flaggable since only the owner sees them.

The game creator reviews every flag and has the final say:

| Decision | Result |
| --- | --- |
| Upheld (points are false) | The entry is removed and its full amount comes off the person's game total and lifetime total |
| Dismissed | The entry stands and cannot be flagged again |

While a flag is pending the entry shows a "flagged" marker and its points still count. Flags can be raised while the game is active and for 24 hours after it ends, so a night game can be settled the next day. The creator gets a review queue on the game screen with a badge for pending flags.

If an upheld flag drops someone below a target they had reached, that achievement is revoked: their game target badge comes off, and in first to reach mode the win passes to whoever reached the target next, or reopens if no one else has. Personal milestones that only unlocked because of the false points are revoked too.

The creator's own entries can be flagged as well, and the creator still decides them. Everyone in the game can see each flag and its outcome in the feed, which keeps that honest.

### 3.4 Widget discovery popups

Two moments, each shown once per account (stored server side so reinstalling does not repeat them):

1. **First launch**, at the end of onboarding: a short card titled "Score without opening the app" with an illustration of the Quick Add widget and a "Show me how" button that walks through adding a widget on that platform.
2. **First points scored**, right after the first entry is saved: "Nice, that's your first point. Next time, tap it straight from your home screen." with the same how to steps and a "Maybe later" option.

If the app detects a widget is already installed (WidgetKit `getCurrentConfigurations`, Android `AppWidgetManager`), skip the second popup.

### 3.5 Rewards and milestones

Rewards tab: the eleven milestone thresholds as a vertical ladder, each with an editable reward field, a locked or unlocked state, and the date reached. Progress to the next milestone shows on Home.

When an entry pushes lifetime points across one or more thresholds, each crossed milestone fires its own unlock (a single 100 point entry from 0 crosses 10, 50 and 100). The user sees a full screen celebration with their reward text.

### 3.6 Friends

Add a friend by username search, share link, or from a game's member list. Friendship is mutual: one sends a request, the other accepts. Pending requests appear in a Friends tab with a badge. Either side can remove the friendship or block.

Friends list shows each friend's lifetime points and current milestone. Tapping a friend shows their profile and the games you share.

### 3.7 Notifications

| Event | Who is notified |
| --- | --- |
| Game invite received | Invitee |
| Friend request received or accepted | The other person |
| A member reaches the game target (wins in first to reach mode, earns it in everyone mode) | All members of that game |
| A user reaches a personal milestone | Their accepted friends only |
| A user passes you on a game leaderboard (optional, off by default) | You |
| Game ending in 1 hour | All members |
| An entry in your game is flagged | The game creator |
| Your entry is flagged, and later the decision | The flagged member |
| Your flag is decided | The member who flagged it |

Game members who are not your friends only hear about game milestones, never your personal ones. Each category can be toggled in Settings. Notifications arrive as push messages and also land in an in app inbox.

## 4. Screens

1. Welcome and sign in (Apple, Google, email magic link), choose username
2. Onboarding: two screens on how scoring works, link to Rules, widget popup #1
3. **Home**: lifetime total, next milestone bar, scoring panel, active games list, create or join buttons
4. **Game**: leaderboard, reward card, feed with flag buttons, scoring panel, invite button, flag review queue and game settings for the creator
5. Create game sheet
6. **Friends**: list, requests, add friend
7. **Rewards**: milestone ladder with editable rewards
8. **Rules**
9. Notifications inbox (bell icon on Home)
10. Profile and Settings: notification toggles, widget help, account

Tab bar: Home, Games, Friends, Rewards, Rules.

## 5. Technical approach

**App:** React Native with Expo (TypeScript) for one codebase on iOS and Android. Widgets are native targets: a Swift WidgetKit extension on iOS (added through `@bacons/apple-targets` or a config plugin) and a Kotlin Glance widget on Android. The app and widgets share the session token and a small cache (active game, totals) through an iOS App Group and Android shared preferences.

**Backend:** Supabase. Postgres for data, Supabase Auth, Row Level Security on every table, Realtime subscriptions for live leaderboards, and Edge Functions for push delivery through Expo Push (APNs and FCM underneath).

**Why this split:** widgets must be native regardless, and everything else is standard CRUD plus realtime, which Supabase covers without a custom server.

### 5.1 Data model

```
profiles          id (auth user), username unique, display_name, avatar_url,
                  lifetime_points int default 0, active_game_id,
                  seen_widget_intro_launch bool, seen_widget_intro_first_score bool

friendships       user_a, user_b (stored with user_a < user_b), status (pending|accepted|blocked),
                  requested_by, created_at, accepted_at

games             id, name, type (night|weekend|ongoing), starts_at, ends_at null,
                  target_points, reward_text, reward_mode (first|everyone), house_rules,
                  created_by, winner_id null, won_at null, status (active|ended)

game_members      game_id, user_id, role (admin|member), points int default 0,
                  reached_target_at null, joined_at

game_invites      id, game_id, invited_by, invitee_id null, code, status, expires_at

point_entries     id, user_id, game_id null, amount int check 1..100,
                  source (app|widget), created_at, deleted_at null,
                  removed_by_flag bool default false

user_rewards      user_id, threshold, reward_text      (user's custom reward per milestone)

milestone_unlocks user_id, threshold, reached_at       (unique on user_id + threshold)

notifications     id, recipient_id, kind, payload jsonb, read_at, created_at

entry_flags       id, entry_id, game_id, flagged_by, reason null,
                  status (pending|upheld|dismissed), decided_by, decided_at
                  (unique on entry_id, so an entry is only ever reviewed once)

push_tokens       user_id, token, platform, updated_at
```

### 5.2 Scoring flow

All scoring goes through one Postgres function, `add_points(game_id, amount, source)`, called by the app and the widgets. In a single transaction it:

1. Validates the amount (1 to 100), that the caller is a member of the game, and that the game is active.
2. Inserts the `point_entries` row.
3. Increments `game_members.points` and `profiles.lifetime_points` (cached totals so leaderboards are a simple indexed read).
4. If this member just crossed the target, sets `game_members.reached_target_at`. In first to reach mode it also sets `games.winner_id` and `won_at` if no one has won yet; in everyone mode each member who crosses gets the reward.
5. Inserts a `milestone_unlocks` row for each threshold crossed.
6. Returns the new totals and any unlocks so the client can celebrate immediately.

Undo calls `remove_points(entry_id)`, which soft deletes and decrements the cached totals. Milestones already unlocked stay unlocked when a user undoes their own entry.

Flags use two more functions. `flag_entry(entry_id, reason)` checks that the caller is a member of the game, is not the entry's owner, and is inside the flag window. `resolve_flag(flag_id, upheld)` can only be called by the game creator. When upheld, in one transaction it soft deletes the entry with `removed_by_flag`, decrements both cached totals, recomputes `reached_target_at` and the game winner if the member fell below the target, and deletes any `milestone_unlocks` the member no longer qualifies for.

A database webhook on `milestone_unlocks` and on `game_members.reached_target_at` triggers an Edge Function that computes recipients (accepted friends for personal milestones, game members for game targets, minus the actor, minus anyone who muted that category), writes `notifications` rows, and sends pushes.

### 5.3 Security

RLS rules in plain terms: you can read profiles of friends and fellow game members; you can read a game, its members and its entries only if you are a member; you can write entries only through `add_points`; only the game creator can resolve flags; you can only edit your own rewards and settings. Invite codes are random and expire. Usernames are searchable, but nothing else about a user is visible until a friendship or shared game exists.

### 5.4 Widgets and offline

Widget taps call `add_points` directly using the shared session. If the device is offline, the entry is queued in shared storage with a client generated id and flushed by the app or the next widget refresh; the id makes the insert idempotent so retries never double count. Widgets refresh their timeline after every tap and on a push silent update when someone in the active game scores.

## 6. Build phases

**Phase 1, foundation (about 2 weeks).** Expo project, Supabase project, auth, profiles and usernames, schema and RLS migrations, Rules page.

**Phase 2, scoring and games (about 2 weeks).** Create, join and invite flows, game screen with realtime leaderboard, `add_points` and undo, Home scoring panel with quick adds and custom amount, game type windows and auto ending.

**Phase 3, rewards and flagging (about 1.5 weeks).** Milestone ladder and custom reward editing, unlock detection, celebration screen, game winner banner, flag button, creator review queue, and point removal with target and milestone recompute.

**Phase 4, friends and notifications (about 2 weeks).** Friend requests and list, push token registration, notification Edge Function with recipient dedupe, inbox, Settings toggles.

**Phase 5, widgets (about 2 weeks).** iOS WidgetKit Quick Add, Score and Leaderboard widgets with App Intents; Android Glance equivalents; offline queue; both widget discovery popups.

**Phase 6, polish and launch (about 1 week).** Empty states, haptics and sounds on scoring, app icons and store listings, TestFlight and internal Android testing.

Roughly 10.5 weeks for one developer. Phases 4 and 5 can run in parallel with two people.

## 7. Decisions and open questions

Decided:

1. Game reward mode is chosen by the game creator (first to reach, or everyone who reaches).
2. Solo points with no game are allowed and count toward lifetime only.
3. Personal milestone notifications go to accepted friends only. Game members are notified only about game milestones.
4. The rules read "person".
5. Contact 10 gets its own repository; this plan moves there before Phase 1.
6. Everything is private. Profiles, totals and leaderboards are only visible to friends and fellow game members. There is no global leaderboard.
7. Game members can flag entries. The game creator decides, and upheld flags remove the full amount from the person's game and lifetime totals.

## 8. Privacy and store review

The app stores points and nothing about the people approached: no names, numbers or photos of third parties. Keeping it that way avoids collecting data on people who never consented and keeps App Store and Play review straightforward. Rules and onboarding copy should frame the game around confident, respectful conversation.
