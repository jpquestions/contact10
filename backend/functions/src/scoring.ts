import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentSnapshot, type QuerySnapshot, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { isLive, requireMember } from './games';
import { friendIds, notify } from './notify';
import { EDIT_WINDOW_MS, MAX_ENTRY, MILESTONES, MIN_ENTRY, crossedMilestones } from './shared';
import { db, id, input, int, oneOf, requireUid } from './util';

/**
 * After a member's game points drop, revoke their target if they fell below
 * it and, in first to reach mode, pass the win to whoever reached it next.
 */
export function recomputeTarget(
  tx: Transaction,
  game: DocumentSnapshot,
  members: QuerySnapshot,
  uid: string,
  newPoints: number,
) {
  const target = game.get('targetPoints') as number;
  const member = members.docs.find((m) => m.id === uid);
  if (!member || newPoints >= target || member.get('reachedTargetAt') === null) return;

  tx.update(member.ref, { reachedTargetAt: null });
  if (game.get('rewardMode') === 'first' && game.get('winnerId') === uid) {
    const next = members.docs
      .filter((m) => m.id !== uid && m.get('reachedTargetAt') !== null && (m.get('points') as number) >= target)
      .sort((a, b) => (a.get('reachedTargetAt') as Timestamp).toMillis() - (b.get('reachedTargetAt') as Timestamp).toMillis())[0];
    tx.update(game.ref, {
      winnerId: next ? next.id : null,
      wonAt: next ? next.get('reachedTargetAt') : null,
    });
  }
}

/** Tells friends about milestones and the game about its target. */
async function announce(
  uid: string,
  user: DocumentSnapshot,
  game: DocumentSnapshot | null,
  result: { unlocked: number[]; reachedTarget: boolean; wonGame: boolean },
) {
  const who = `@${user.get('username')}`;
  if (result.unlocked.length) {
    const friends = await friendIds(uid);
    for (const m of result.unlocked) {
      await notify(
        friends,
        {
          kind: 'friend_milestone',
          pref: 'friendMilestones',
          title: `${who} hit ${m.toLocaleString('en-US')}`,
          body: `${who} just reached the ${m.toLocaleString('en-US')} point milestone.`,
          data: { userId: uid, threshold: String(m) },
        },
        uid,
      );
    }
  }
  if (game && result.reachedTarget) {
    const everyone = game.get('rewardMode') === 'everyone';
    if (everyone || result.wonGame) {
      await notify(
        game.get('memberIds') as string[],
        {
          kind: 'game_target',
          pref: 'gameTargets',
          title: game.get('name') as string,
          body: everyone
            ? `${who} reached ${game.get('targetPoints')} and earned: ${game.get('rewardText')}`
            : `${who} reached ${game.get('targetPoints')} first and wins: ${game.get('rewardText')}`,
          data: { gameId: game.id },
        },
        uid,
      );
    }
  }
}

export const addPoints = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const amount = int(data, 'amount', MIN_ENTRY, MAX_ENTRY);
  const gameId = id(data, 'gameId', true);
  const entryId = id(data, 'entryId', true) ?? randomUUID();
  const source = data.source === undefined ? 'app' : oneOf(data, 'source', ['app', 'widget'] as const);

  const result = await db().runTransaction(async (tx) => {
    const entryRef = db().doc(`entries/${entryId}`);
    const userRef = db().doc(`users/${uid}`);
    const [existing, user] = await Promise.all([tx.get(entryRef), tx.get(userRef)]);
    if (!user.exists || !user.get('username')) throw new HttpsError('failed-precondition', 'Pick a username first.');

    let game: DocumentSnapshot | null = null;
    let member: DocumentSnapshot | null = null;
    if (gameId) {
      [game, member] = await Promise.all([
        tx.get(db().doc(`games/${gameId}`)),
        tx.get(db().doc(`games/${gameId}/members/${uid}`)),
      ]);
    }

    // Retried request (offline widget queue): report the current state.
    if (existing.exists) {
      if (existing.get('userId') !== uid) throw new HttpsError('already-exists', 'Entry id already used.');
      return {
        duplicate: true,
        lifetimePoints: user.get('lifetimePoints') as number,
        gamePoints: member?.exists ? (member.get('points') as number) : null,
        unlocked: [] as number[],
        reachedTarget: false,
        wonGame: false,
      };
    }

    if (game) {
      requireMember(game, uid);
      if (!isLive(game)) throw new HttpsError('failed-precondition', 'That game is not accepting points right now.');
    }

    const before = user.get('lifetimePoints') as number;
    const after = before + amount;
    const unlocked = crossedMilestones(before, after);

    tx.set(entryRef, {
      userId: uid,
      username: user.get('username'),
      gameId: gameId ?? null,
      amount,
      source,
      createdAt: FieldValue.serverTimestamp(),
      deletedAt: null,
      removedByFlag: false,
      flagStatus: null,
    });
    tx.update(userRef, { lifetimePoints: after });
    for (const m of unlocked) tx.set(db().doc(`users/${uid}/unlocks/${m}`), { reachedAt: FieldValue.serverTimestamp() });

    let gamePoints: number | null = null;
    let reachedTarget = false;
    let wonGame = false;
    if (game && member) {
      gamePoints = (member.get('points') as number) + amount;
      const memberUpdate: Record<string, unknown> = { points: gamePoints };
      if (member.get('reachedTargetAt') === null && gamePoints >= (game.get('targetPoints') as number)) {
        reachedTarget = true;
        memberUpdate.reachedTargetAt = FieldValue.serverTimestamp();
        if (game.get('rewardMode') === 'first' && game.get('winnerId') === null) {
          wonGame = true;
          tx.update(game.ref, { winnerId: uid, wonAt: FieldValue.serverTimestamp() });
        }
      }
      tx.update(member.ref, memberUpdate);
    }

    return { duplicate: false, lifetimePoints: after, gamePoints, unlocked, reachedTarget, wonGame, game, user };
  });

  if (!result.duplicate) {
    const { game, user } = result as typeof result & { game: DocumentSnapshot | null; user: DocumentSnapshot };
    await announce(uid, user, game, result);
  }

  return {
    entryId,
    duplicate: result.duplicate,
    lifetimePoints: result.lifetimePoints,
    gamePoints: result.gamePoints,
    unlocked: result.unlocked,
    reachedTarget: result.reachedTarget,
    wonGame: result.wonGame,
  };
});

/**
 * Changes the amount of your own entry, or deletes it when the new amount is
 * zero. Allowed for 24 hours after logging, even after its game has ended (the
 * same window others have to flag it), and never once the entry has been
 * flagged. Milestones and game targets follow the corrected total, so points
 * added by accident earn nothing.
 */
async function changeEntry(uid: string, entryId: string, newAmount: number) {
  const result = await db().runTransaction(async (tx) => {
    const entryRef = db().doc(`entries/${entryId}`);
    const entry = await tx.get(entryRef);
    if (!entry.exists || entry.get('userId') !== uid) throw new HttpsError('not-found', 'Entry not found.');
    if (entry.get('deletedAt') !== null) throw new HttpsError('failed-precondition', 'That entry was already removed.');
    if (entry.get('flagStatus') !== null) throw new HttpsError('failed-precondition', 'Flagged entries cannot be changed.');
    const created = (entry.get('createdAt') as Timestamp).toMillis();
    if (Date.now() - created > EDIT_WINDOW_MS) throw new HttpsError('failed-precondition', 'Entries can only be changed for 24 hours.');

    const gameId = entry.get('gameId') as string | null;
    const user = await tx.get(db().doc(`users/${uid}`));
    let game: DocumentSnapshot | null = null;
    let members: QuerySnapshot | null = null;
    if (gameId) {
      [game, members] = await Promise.all([tx.get(db().doc(`games/${gameId}`)), tx.get(db().collection(`games/${gameId}/members`))]);
    }

    const oldAmount = entry.get('amount') as number;
    const delta = newAmount - oldAmount;
    const before = user.get('lifetimePoints') as number;
    const lifetimePoints = Math.max(0, before + delta);

    if (newAmount === 0) {
      tx.update(entryRef, { deletedAt: FieldValue.serverTimestamp() });
    } else {
      tx.update(entryRef, {
        amount: newAmount,
        editedAt: FieldValue.serverTimestamp(),
        originalAmount: entry.get('originalAmount') ?? oldAmount,
      });
    }
    tx.update(user.ref, { lifetimePoints });

    const unlocked = delta > 0 ? crossedMilestones(before, lifetimePoints) : [];
    for (const m of unlocked) tx.set(db().doc(`users/${uid}/unlocks/${m}`), { reachedAt: FieldValue.serverTimestamp() });
    if (delta < 0) {
      for (const m of MILESTONES) if (m > lifetimePoints && m <= before) tx.delete(db().doc(`users/${uid}/unlocks/${m}`));
    }

    let gamePoints: number | null = null;
    let reachedTarget = false;
    let wonGame = false;
    const member = members?.docs.find((m) => m.id === uid);
    if (game?.exists && members && member) {
      gamePoints = Math.max(0, (member.get('points') as number) + delta);
      tx.update(member.ref, { points: gamePoints });
      if (delta < 0) {
        recomputeTarget(tx, game, members, uid, gamePoints);
      } else if (member.get('reachedTargetAt') === null && gamePoints >= (game.get('targetPoints') as number)) {
        reachedTarget = true;
        tx.update(member.ref, { reachedTargetAt: FieldValue.serverTimestamp() });
        if (game.get('rewardMode') === 'first' && game.get('winnerId') === null) {
          wonGame = true;
          tx.update(game.ref, { winnerId: uid, wonAt: FieldValue.serverTimestamp() });
        }
      }
    }
    return { lifetimePoints, gamePoints, unlocked, reachedTarget, wonGame, user, game };
  });

  await announce(uid, result.user, result.game, result);
  return {
    lifetimePoints: result.lifetimePoints,
    gamePoints: result.gamePoints,
    unlocked: result.unlocked,
    reachedTarget: result.reachedTarget,
    wonGame: result.wonGame,
  };
}

/** Delete your own entry (undo, or points added by accident). */
export const removePoints = onCall(async (request) => {
  const uid = requireUid(request);
  return changeEntry(uid, id(input(request), 'entryId')!, 0);
});

/** Correct the amount of your own entry. */
export const editPoints = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  return changeEntry(uid, id(data, 'entryId')!, int(data, 'amount', MIN_ENTRY, MAX_ENTRY));
});
