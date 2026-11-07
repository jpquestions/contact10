import type { Timestamp } from 'firebase/firestore';
import type { GameType, RewardMode } from './api';

export type NotificationPrefs = Partial<
  Record<'invites' | 'friendRequests' | 'friendMilestones' | 'gameTargets' | 'gameEnding' | 'flags', boolean>
>;

/** users/{uid}. Mirrors backend/firestore.rules. */
export type Profile = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lifetimePoints: number;
  activeGameId: string | null;
  seenWidgetIntroLaunch: boolean;
  seenWidgetIntroFirstScore: boolean;
  notificationPrefs?: NotificationPrefs;
  createdAt: Timestamp | null;
};

/** Profile fields the client is allowed to change (see the update rule). */
export type ProfilePatch = Partial<
  Pick<
    Profile,
    'displayName' | 'avatarUrl' | 'activeGameId' | 'seenWidgetIntroLaunch' | 'seenWidgetIntroFirstScore' | 'notificationPrefs'
  >
>;

export type Game = {
  id: string;
  name: string;
  type: GameType;
  startsAt: Timestamp;
  endsAt: Timestamp | null;
  targetPoints: number;
  rewardText: string;
  rewardMode: RewardMode;
  houseRules: string | null;
  createdBy: string;
  memberIds: string[];
  winnerId: string | null;
  wonAt: Timestamp | null;
  status: 'active' | 'ended';
  endedAt: Timestamp | null;
  createdAt: Timestamp | null;
};

export type Member = {
  id: string;
  role: 'admin' | 'member';
  points: number;
  reachedTargetAt: Timestamp | null;
  username: string;
  displayName: string | null;
};

export type Entry = {
  id: string;
  userId: string;
  username: string;
  gameId: string | null;
  amount: number;
  source: 'app' | 'widget';
  createdAt: Timestamp | null;
  deletedAt: Timestamp | null;
  removedByFlag: boolean;
  flagStatus: 'pending' | 'upheld' | 'dismissed' | null;
  editedAt?: Timestamp | null;
  originalAmount?: number;
};

/** How long after logging an entry its owner can still edit or delete it. */
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether you can still edit or delete your own entry. */
export function canEditEntry(entry: Entry, game: Pick<Game, 'status' | 'startsAt' | 'endsAt'> | null, now = Date.now()): boolean {
  if (entry.deletedAt || entry.flagStatus) return false;
  if (!entry.createdAt || now - entry.createdAt.toMillis() > EDIT_WINDOW_MS) return false;
  return entry.gameId === null || (game !== null && isLive(game, now));
}

export type Flag = {
  id: string;
  entryId: string;
  entryUserId: string;
  entryUsername: string;
  amount: number;
  flaggedBy: string;
  reason: string | null;
  status: 'pending' | 'upheld' | 'dismissed';
};

export type Friendship = {
  id: string;
  userA: string;
  userB: string;
  status: 'pending' | 'accepted' | 'blocked';
  actedBy: string;
};

export type Invite = {
  id: string;
  gameId: string;
  gameName: string;
  invitedBy: string;
  inviteeId: string | null;
  status: 'pending' | 'accepted' | 'declined';
  expiresAt: Timestamp;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, string>;
  readAt: Timestamp | null;
  createdAt: Timestamp | null;
};

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/** Whether a game is accepting points right now. */
export function isLive(game: Pick<Game, 'status' | 'startsAt' | 'endsAt'>, now = Date.now()): boolean {
  return (
    game.status === 'active' &&
    game.startsAt.toMillis() <= now &&
    (game.endsAt === null || game.endsAt.toMillis() > now)
  );
}
