/** Lifetime point thresholds. Must match src/lib/milestones.ts in the app. */
export const MILESTONES = [10, 50, 100, 200, 300, 400, 500, 1000, 2500, 5000, 10000] as const;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

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
