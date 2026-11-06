import { FieldValue, Timestamp, type DocumentSnapshot, type QuerySnapshot } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { requireCreator, requireMember } from './games';
import { notify } from './notify';
import { recomputeTarget } from './scoring';
import { FLAG_WINDOW_AFTER_END_MS, MILESTONES } from './shared';
import { bool, db, id, input, requireUid, str } from './util';

function insideFlagWindow(game: DocumentSnapshot, now = Date.now()): boolean {
  if (game.get('status') === 'active') {
    const endsAt = game.get('endsAt') as Timestamp | null;
    return endsAt === null || endsAt.toMillis() + FLAG_WINDOW_AFTER_END_MS > now;
  }
  const endedAt = (game.get('endedAt') as Timestamp | null) ?? (game.get('endsAt') as Timestamp | null);
  return endedAt !== null && endedAt.toMillis() + FLAG_WINDOW_AFTER_END_MS > now;
}

export const flagEntry = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const entryId = id(data, 'entryId')!;
  const reason = str(data, 'reason', { max: 200, optional: true });

  const { game, entry } = await db().runTransaction(async (tx) => {
    const entry = await tx.get(db().doc(`entries/${entryId}`));
    if (!entry.exists || entry.get('gameId') === null) throw new HttpsError('not-found', 'Only game entries can be flagged.');
    const gameId = entry.get('gameId') as string;
    const [game, flag] = await Promise.all([tx.get(db().doc(`games/${gameId}`)), tx.get(db().doc(`games/${gameId}/flags/${entryId}`))]);
    requireMember(game, uid);
    if (entry.get('userId') === uid) throw new HttpsError('failed-precondition', 'You cannot flag your own entry.');
    if (entry.get('deletedAt') !== null) throw new HttpsError('failed-precondition', 'That entry was removed.');
    if (flag.exists) throw new HttpsError('already-exists', 'That entry has already been flagged.');
    if (!insideFlagWindow(game)) throw new HttpsError('failed-precondition', 'The window to flag entries in this game has closed.');

    tx.create(flag.ref, {
      entryId,
      entryUserId: entry.get('userId'),
      entryUsername: entry.get('username'),
      amount: entry.get('amount'),
      flaggedBy: uid,
      reason,
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(entry.ref, { flagStatus: 'pending' });
    return { game, entry };
  });

  const name = game.get('name') as string;
  await notify([game.get('createdBy') as string], {
    kind: 'flag_review',
    pref: 'flags',
    title: `Flag to review in ${name}`,
    body: `An entry of ${entry.get('amount')} by @${entry.get('username')} was flagged.`,
    data: { gameId: game.id, entryId },
  });
  await notify([entry.get('userId') as string], {
    kind: 'entry_flagged',
    pref: 'flags',
    title: `Your entry was flagged`,
    body: `Your ${entry.get('amount')} points in ${name} are waiting on the creator's review.`,
    data: { gameId: game.id, entryId },
  });
  return { ok: true };
});

export const resolveFlag = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const gameId = id(data, 'gameId')!;
  const entryId = id(data, 'entryId')!;
  const upheld = bool(data, 'upheld');

  const outcome = await db().runTransaction(async (tx) => {
    const gameRef = db().doc(`games/${gameId}`);
    const [game, flag, entry] = await Promise.all([
      tx.get(gameRef),
      tx.get(db().doc(`games/${gameId}/flags/${entryId}`)),
      tx.get(db().doc(`entries/${entryId}`)),
    ]);
    requireCreator(game, uid);
    if (!flag.exists || flag.get('status') !== 'pending') throw new HttpsError('failed-precondition', 'That flag is not waiting on a decision.');

    const owner = entry.get('userId') as string;
    const decision = { status: upheld ? 'upheld' : 'dismissed', decidedBy: uid, decidedAt: FieldValue.serverTimestamp() };

    if (!upheld) {
      tx.update(flag.ref, decision);
      tx.update(entry.ref, { flagStatus: 'dismissed' });
      return { game, flag, owner };
    }

    const [user, members]: [DocumentSnapshot, QuerySnapshot] = await Promise.all([
      tx.get(db().doc(`users/${owner}`)),
      tx.get(db().collection(`games/${gameId}/members`)),
    ]);
    const amount = entry.get('amount') as number;
    const lifetimeBefore = user.get('lifetimePoints') as number;
    const lifetimeAfter = Math.max(0, lifetimeBefore - amount);

    tx.update(flag.ref, decision);
    tx.update(entry.ref, { flagStatus: 'upheld', removedByFlag: true, deletedAt: FieldValue.serverTimestamp() });
    tx.update(user.ref, { lifetimePoints: lifetimeAfter });
    // Milestones that only the false points earned are taken back.
    for (const m of MILESTONES) if (m > lifetimeAfter && m <= lifetimeBefore) tx.delete(db().doc(`users/${owner}/unlocks/${m}`));

    const member = members.docs.find((m) => m.id === owner);
    if (member) {
      const points = Math.max(0, (member.get('points') as number) - amount);
      tx.update(member.ref, { points });
      recomputeTarget(tx, game, members, owner, points);
    }
    return { game, flag, owner };
  });

  const verdict = upheld ? 'upheld: the points were removed' : 'dismissed: the points stand';
  const amount = outcome.flag.get('amount');
  const name = outcome.game.get('name');
  await notify([outcome.owner], {
    kind: 'flag_decided',
    pref: 'flags',
    title: `Flag decided in ${name}`,
    body: `The flag on your ${amount} points was ${verdict}.`,
    data: { gameId, entryId },
  });
  await notify([outcome.flag.get('flaggedBy') as string], {
    kind: 'flag_decided',
    pref: 'flags',
    title: `Flag decided in ${name}`,
    body: `Your flag on @${outcome.flag.get('entryUsername')}'s ${amount} points was ${verdict}.`,
    data: { gameId, entryId },
  });
  return { ok: true };
});
