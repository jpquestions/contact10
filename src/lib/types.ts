import type { Timestamp } from 'firebase/firestore';

/** users/{uid}. Mirrors backend/firestore.rules. */
export type Profile = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lifetimePoints: number;
  activeGameId: string | null;
  seenWidgetIntroLaunch: boolean;
  seenWidgetIntroFirstScore: boolean;
  createdAt: Timestamp | null;
};

/** Profile fields the client is allowed to change (see the update rule). */
export type ProfilePatch = Partial<
  Pick<Profile, 'displayName' | 'avatarUrl' | 'activeGameId' | 'seenWidgetIntroLaunch' | 'seenWidgetIntroFirstScore'>
>;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
