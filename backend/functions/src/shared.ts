/** Lifetime point thresholds. Must match src/lib/milestones.ts in the app. */
export const MILESTONES = [10, 50, 100, 200, 300, 400, 500, 1000, 2500, 5000, 10000] as const;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const MIN_ENTRY = 1;
export const MAX_ENTRY = 100;
/** How long after logging you can still edit or delete your own entry. */
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FLAG_WINDOW_AFTER_END_MS = 24 * 60 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_GAME_LENGTH_MS = 8 * 24 * 60 * 60 * 1000;
/** Custom date range games can run up to a year and be scheduled up to a year ahead. */
export const MAX_CUSTOM_GAME_MS = 366 * 24 * 60 * 60 * 1000;
export const MAX_MEMBERS = 50;

export const NOTIFICATION_PREFS = [
  'invites',
  'friendRequests',
  'friendMilestones',
  'gameTargets',
  'gameEnding',
  'flags',
] as const;
export type NotificationPref = (typeof NOTIFICATION_PREFS)[number];

/** Fields every new profile starts with. Mirrors the create rule. */
export function newProfile() {
  return {
    username: null as string | null,
    displayName: null as string | null,
    avatarUrl: null as string | null,
    lifetimePoints: 0,
    activeGameId: null as string | null,
    seenWidgetIntroLaunch: false,
    seenWidgetIntroFirstScore: false,
  };
}

export function crossedMilestones(before: number, after: number): number[] {
  return MILESTONES.filter((m) => before < m && after >= m);
}

export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
