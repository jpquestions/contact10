import { randomBytes } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentSnapshot, type Transaction } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { notify } from './notify';
import { addSharedGame, removeSharedGame } from './peers';
import { INVITE_TTL_MS, MAX_CUSTOM_GAME_MS, MAX_GAME_LENGTH_MS, MAX_MEMBERS, pairId } from './shared';
import { bool, db, id, input, int, oneOf, requireUid, str } from './util';

const GAME_TYPES = ['night', 'weekend', 'ongoing', 'custom'] as const;
const REWARD_MODES = ['first', 'everyone'] as const;

/** Whether a game currently accepts points. */
export function isLive(game: DocumentSnapshot, now = Date.now()): boolean {
  if (!game.exists || game.get('status') !== 'active') return false;
  const startsAt = (game.get('startsAt') as Timestamp).toMillis();
  const endsAt = game.get('endsAt') as Timestamp | null;
  return startsAt <= now && (endsAt === null || endsAt.toMillis() > now);
}

function requireGame(game: DocumentSnapshot): void {
  if (!game.exists) throw new HttpsError('not-found', 'That game does not exist.');
}

function requireMember(game: DocumentSnapshot, uid: string): void {
  requireGame(game);
  if (!(game.get('memberIds') as string[]).includes(uid)) {
    throw new HttpsError('permission-denied', 'You are not in this game.');
  }
}

function requireCreator(game: DocumentSnapshot, uid: string): void {
  requireGame(game);
  if (game.get('createdBy') !== uid) throw new HttpsError('permission-denied', 'Only the game creator can do that.');
}

function inviteCode(): string {
  // Unambiguous characters only, so a code can be read aloud or typed.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export const createGame = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const name = str(data, 'name', { max: 60 })!;
  const type = oneOf(data, 'type', GAME_TYPES);
  const targetPoints = int(data, 'targetPoints', 1, 100000);
  const rewardText = str(data, 'rewardText', { max: 200 })!;
  const rewardMode = oneOf(data, 'rewardMode', REWARD_MODES);
  const houseRules = str(data, 'houseRules', { max: 500, optional: true });

  const now = Date.now();
  const startsAtMs = typeof data.startsAt === 'number' ? data.startsAt : now;
  const endsAtMs = typeof data.endsAt === 'number' ? data.endsAt : null;
  const maxLength = type === 'custom' ? MAX_CUSTOM_GAME_MS : MAX_GAME_LENGTH_MS;
  if (startsAtMs < now - 5 * 60 * 1000 || startsAtMs > now + maxLength) {
    throw new HttpsError('invalid-argument', 'Start time is not valid.');
  }
  if (type === 'ongoing') {
    if (endsAtMs !== null) throw new HttpsError('invalid-argument', 'Ongoing games have no end time.');
  } else if (endsAtMs === null || endsAtMs <= Math.max(now, startsAtMs) || endsAtMs - startsAtMs > maxLength) {
    throw new HttpsError(
      'invalid-argument',
      type === 'custom' ? 'The end date must be after the start and within a year.' : 'End time must be after the start and within 8 days.',
    );
  }

  const user = await db().doc(`users/${uid}`).get();
  const username = user.get('username') as string | null;
  if (!username) throw new HttpsError('failed-precondition', 'Pick a username first.');

  const gameRef = db().collection('games').doc();
  const batch = db().batch();
  batch.set(gameRef, {
    name,
    type,
    startsAt: Timestamp.fromMillis(startsAtMs),
    endsAt: endsAtMs === null ? null : Timestamp.fromMillis(endsAtMs),
    targetPoints,
    rewardText,
    rewardMode,
    houseRules,
    createdBy: uid,
    memberIds: [uid],
    winnerId: null,
    wonAt: null,
    status: 'active',
    endedAt: null,
    endingSoonNotified: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(gameRef.collection('members').doc(uid), {
    role: 'admin',
    points: 0,
    reachedTargetAt: null,
    joinedAt: FieldValue.serverTimestamp(),
    username,
    displayName: user.get('displayName') ?? null,
  });
  batch.update(db().doc(`users/${uid}`), { activeGameId: gameRef.id });
  await batch.commit();
  return { gameId: gameRef.id };
});

/** Adds uid to a game. Call inside a transaction after reading game and user. */
function joinInTx(tx: Transaction, game: DocumentSnapshot, user: DocumentSnapshot) {
  const uid = user.id;
  const members = game.get('memberIds') as string[];
  if (members.includes(uid)) return false;
  if (game.get('status') !== 'active') throw new HttpsError('failed-precondition', 'That game has ended.');
  if (members.length >= MAX_MEMBERS) throw new HttpsError('resource-exhausted', 'That game is full.');
  if (!user.get('username')) throw new HttpsError('failed-precondition', 'Pick a username first.');

  tx.update(game.ref, { memberIds: FieldValue.arrayUnion(uid) });
  tx.set(game.ref.collection('members').doc(uid), {
    role: 'member',
    points: 0,
    reachedTargetAt: null,
    joinedAt: FieldValue.serverTimestamp(),
    username: user.get('username'),
    displayName: user.get('displayName') ?? null,
  });
  for (const other of members) addSharedGame(tx, uid, other, game.id);
  tx.update(user.ref, { activeGameId: game.id });
  return true;
}

export const inviteFriends = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const gameId = id(data, 'gameId')!;
  const userIds = data.userIds;
  if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 20 || !userIds.every((u) => typeof u === 'string')) {
    throw new HttpsError('invalid-argument', 'Pick 1 to 20 friends to invite.');
  }

  const game = await db().doc(`games/${gameId}`).get();
  requireMember(game, uid);
  if (game.get('status') !== 'active') throw new HttpsError('failed-precondition', 'That game has ended.');
  const members = game.get('memberIds') as string[];

  const pairs = await db().getAll(...(userIds as string[]).map((u) => db().doc(`friendships/${pairId(uid, u)}`)));
  const invited: string[] = [];
  const batch = db().batch();
  for (const pair of pairs) {
    if (!pair.exists || pair.get('status') !== 'accepted') continue;
    const friend = pair.get('userA') === uid ? (pair.get('userB') as string) : (pair.get('userA') as string);
    if (members.includes(friend)) continue;
    batch.set(db().doc(`invites/${gameId}_${friend}`), {
      gameId,
      gameName: game.get('name'),
      invitedBy: uid,
      inviteeId: friend,
      code: null,
      status: 'pending',
      expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
      createdAt: FieldValue.serverTimestamp(),
    });
    invited.push(friend);
  }
  if (invited.length === 0) throw new HttpsError('failed-precondition', 'Only friends who are not already in the game can be invited.');
  await batch.commit();

  const me = await db().doc(`users/${uid}`).get();
  await notify(invited, {
    kind: 'game_invite',
    pref: 'invites',
    title: 'Game invite',
    body: `@${me.get('username')} invited you to ${game.get('name')}.`,
    data: { gameId, inviteId: `${gameId}_` },
  });
  return { invited: invited.length };
});

export const createInviteLink = onCall(async (request) => {
  const uid = requireUid(request);
  const gameId = id(input(request), 'gameId')!;
  const game = await db().doc(`games/${gameId}`).get();
  requireMember(game, uid);
  if (game.get('status') !== 'active') throw new HttpsError('failed-precondition', 'That game has ended.');
  const code = inviteCode();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS);
  await db().collection('invites').doc().set({
    gameId,
    gameName: game.get('name'),
    invitedBy: uid,
    inviteeId: null,
    code,
    status: 'pending',
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { code, expiresAt: expiresAt.toMillis() };
});

export const respondToInvite = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const inviteId = id(data, 'inviteId')!;
  const accept = bool(data, 'accept');

  const gameId = await db().runTransaction(async (tx) => {
    const invite = await tx.get(db().doc(`invites/${inviteId}`));
    if (!invite.exists || invite.get('inviteeId') !== uid) throw new HttpsError('not-found', 'Invite not found.');
    if (invite.get('status') !== 'pending') throw new HttpsError('failed-precondition', 'That invite was already answered.');
    const gid = invite.get('gameId') as string;
    if (!accept) {
      tx.update(invite.ref, { status: 'declined' });
      return gid;
    }
    if ((invite.get('expiresAt') as Timestamp).toMillis() < Date.now()) {
      throw new HttpsError('deadline-exceeded', 'That invite has expired.');
    }
    const [game, user] = await Promise.all([tx.get(db().doc(`games/${gid}`)), tx.get(db().doc(`users/${uid}`))]);
    requireGame(game);
    joinInTx(tx, game, user);
    tx.update(invite.ref, { status: 'accepted' });
    return gid;
  });
  return { gameId, joined: accept };
});

export const joinGameByCode = onCall(async (request) => {
  const uid = requireUid(request);
  const raw = input(request).code;
  const code = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (code.length !== 8) throw new HttpsError('invalid-argument', 'Invite codes are 8 characters.');

  const found = await db().collection('invites').where('code', '==', code).limit(1).get();
  const invite = found.docs[0];
  if (!invite || invite.get('status') !== 'pending') throw new HttpsError('not-found', 'That invite code is not valid.');
  if ((invite.get('expiresAt') as Timestamp).toMillis() < Date.now()) {
    throw new HttpsError('deadline-exceeded', 'That invite code has expired.');
  }
  const gameId = invite.get('gameId') as string;
  await db().runTransaction(async (tx) => {
    const [game, user] = await Promise.all([tx.get(db().doc(`games/${gameId}`)), tx.get(db().doc(`users/${uid}`))]);
    requireGame(game);
    joinInTx(tx, game, user);
  });
  return { gameId };
});

/** Removes a member. Their entries and lifetime points stay. */
async function removeFromGame(gameId: string, actor: string, target: string) {
  await db().runTransaction(async (tx) => {
    const [game, user] = await Promise.all([tx.get(db().doc(`games/${gameId}`)), tx.get(db().doc(`users/${target}`))]);
    requireMember(game, actor);
    if (actor !== target) requireCreator(game, actor);
    if (target === game.get('createdBy')) {
      throw new HttpsError('failed-precondition', 'The creator cannot leave. End the game instead.');
    }
    const members = game.get('memberIds') as string[];
    if (!members.includes(target)) return;
    tx.update(game.ref, { memberIds: FieldValue.arrayRemove(target) });
    tx.delete(game.ref.collection('members').doc(target));
    for (const other of members) if (other !== target) removeSharedGame(tx, target, other, gameId);
    if (user.exists && user.get('activeGameId') === gameId) tx.update(user.ref, { activeGameId: null });
  });
}

export const leaveGame = onCall(async (request) => {
  const uid = requireUid(request);
  await removeFromGame(id(input(request), 'gameId')!, uid, uid);
  return { ok: true };
});

export const removeMember = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  await removeFromGame(id(data, 'gameId')!, uid, id(data, 'userId')!);
  return { ok: true };
});

export async function endGameNow(gameId: string): Promise<boolean> {
  const ended = await db().runTransaction(async (tx) => {
    const game = await tx.get(db().doc(`games/${gameId}`));
    if (!game.exists || game.get('status') !== 'active') return false;
    tx.update(game.ref, { status: 'ended', endedAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (ended) {
    const game = await db().doc(`games/${gameId}`).get();
    await notify(game.get('memberIds') as string[], {
      kind: 'game_ended',
      pref: 'gameEnding',
      title: `${game.get('name')} is over`,
      body: 'See the final leaderboard.',
      data: { gameId },
    });
  }
  return ended;
}

export const endGame = onCall(async (request) => {
  const uid = requireUid(request);
  const gameId = id(input(request), 'gameId')!;
  const game = await db().doc(`games/${gameId}`).get();
  requireCreator(game, uid);
  await endGameNow(gameId);
  return { ok: true };
});

export { requireCreator, requireGame, requireMember };
