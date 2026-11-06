import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

function fn<In extends Record<string, unknown>, Out = { ok: true }>(name: string) {
  const callable = httpsCallable<In, Out>(functions, name);
  return async (data: In): Promise<Out> => (await callable(data)).data;
}

export type GameType = 'night' | 'weekend' | 'ongoing';
export type RewardMode = 'first' | 'everyone';

export type AddPointsResult = {
  entryId: string;
  duplicate: boolean;
  lifetimePoints: number;
  gamePoints: number | null;
  unlocked: number[];
  reachedTarget: boolean;
  wonGame: boolean;
};

export const api = {
  claimUsername: fn<{ username: string }, { username: string }>('claimUsername'),
  addPoints: fn<{ entryId: string; gameId: string | null; amount: number; source: 'app' | 'widget' }, AddPointsResult>('addPoints'),
  removePoints: fn<{ entryId: string }, { lifetimePoints: number; gamePoints: number | null }>('removePoints'),
  createGame: fn<
    {
      name: string;
      type: GameType;
      targetPoints: number;
      rewardText: string;
      rewardMode: RewardMode;
      houseRules: string | null;
      startsAt: number;
      endsAt: number | null;
    },
    { gameId: string }
  >('createGame'),
  inviteFriends: fn<{ gameId: string; userIds: string[] }, { invited: number }>('inviteFriends'),
  createInviteLink: fn<{ gameId: string }, { code: string; expiresAt: number }>('createInviteLink'),
  respondToInvite: fn<{ inviteId: string; accept: boolean }, { gameId: string; joined: boolean }>('respondToInvite'),
  joinGameByCode: fn<{ code: string }, { gameId: string }>('joinGameByCode'),
  leaveGame: fn<{ gameId: string }>('leaveGame'),
  removeMember: fn<{ gameId: string; userId: string }>('removeMember'),
  endGame: fn<{ gameId: string }>('endGame'),
  flagEntry: fn<{ entryId: string; reason: string | null }>('flagEntry'),
  resolveFlag: fn<{ gameId: string; entryId: string; upheld: boolean }>('resolveFlag'),
  sendFriendRequest: fn<{ username: string }, { result: 'sent' | 'accepted' | 'already_friends' | 'already_sent'; userId: string }>(
    'sendFriendRequest',
  ),
  respondToFriendRequest: fn<{ userId: string; accept: boolean }>('respondToFriendRequest'),
  removeFriend: fn<{ userId: string }>('removeFriend'),
  blockUser: fn<{ userId: string }>('blockUser'),
  deleteAccount: fn<Record<string, never>>('deleteAccount'),
};

/** A readable message for a failed call. */
export function errorMessage(err: unknown): string {
  const e = err as { code?: string; message?: string };
  if (e.code === 'functions/unavailable' || e.code === 'functions/deadline-exceeded' || e.message === 'internal') {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return e.message ?? 'Something went wrong.';
}
