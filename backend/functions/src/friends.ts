import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { notify } from './notify';
import { setFriendState, severPeers } from './peers';
import { USERNAME_PATTERN, pairId } from './shared';
import { bool, db, id, input, requireUid } from './util';

function pairRef(a: string, b: string) {
  return db().doc(`friendships/${pairId(a, b)}`);
}

function pairFields(a: string, b: string) {
  const [userA, userB] = a < b ? [a, b] : [b, a];
  return { userA, userB, participants: [userA, userB] };
}

export const sendFriendRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const raw = input(request).username;
  const username = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/^@/, '') : '';
  if (!USERNAME_PATTERN.test(username)) throw new HttpsError('invalid-argument', 'That is not a valid username.');

  const name = await db().doc(`usernames/${username}`).get();
  if (!name.exists) throw new HttpsError('not-found', 'No one has that username.');
  const other = name.get('uid') as string;
  if (other === uid) throw new HttpsError('invalid-argument', 'That is you.');

  const result = await db().runTransaction(async (tx) => {
    const ref = pairRef(uid, other);
    const pair = await tx.get(ref);
    if (pair.exists) {
      const status = pair.get('status');
      if (status === 'accepted') return 'already_friends' as const;
      if (status === 'blocked') throw new HttpsError('failed-precondition', 'You cannot send a request to this user.');
      if (pair.get('actedBy') === uid) return 'already_sent' as const;
      // They already asked you: sending back accepts.
      tx.update(ref, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() });
      setFriendState(tx, uid, other, { friend: true, pending: false });
      return 'accepted' as const;
    }
    tx.set(ref, {
      ...pairFields(uid, other),
      status: 'pending',
      actedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      acceptedAt: null,
    });
    setFriendState(tx, uid, other, { friend: false, pending: true });
    return 'sent' as const;
  });

  const me = await db().doc(`users/${uid}`).get();
  if (result === 'sent') {
    await notify([other], {
      kind: 'friend_request',
      pref: 'friendRequests',
      title: 'Friend request',
      body: `@${me.get('username')} wants to be friends.`,
      data: { userId: uid },
    });
  } else if (result === 'accepted') {
    await notify([other], {
      kind: 'friend_accepted',
      pref: 'friendRequests',
      title: 'New friend',
      body: `@${me.get('username')} accepted your friend request.`,
      data: { userId: uid },
    });
  }
  return { result, userId: other };
});

export const respondToFriendRequest = onCall(async (request) => {
  const uid = requireUid(request);
  const data = input(request);
  const other = id(data, 'userId')!;
  const accept = bool(data, 'accept');

  await db().runTransaction(async (tx) => {
    const ref = pairRef(uid, other);
    const pair = await tx.get(ref);
    if (!pair.exists || pair.get('status') !== 'pending' || pair.get('actedBy') !== other) {
      throw new HttpsError('not-found', 'No request from that user.');
    }
    if (accept) {
      tx.update(ref, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() });
      setFriendState(tx, uid, other, { friend: true, pending: false });
    } else {
      tx.delete(ref);
      setFriendState(tx, uid, other, { friend: false, pending: false });
    }
  });

  if (accept) {
    const me = await db().doc(`users/${uid}`).get();
    await notify([other], {
      kind: 'friend_accepted',
      pref: 'friendRequests',
      title: 'New friend',
      body: `@${me.get('username')} accepted your friend request.`,
      data: { userId: uid },
    });
  }
  return { ok: true };
});

/** Unfriend, or cancel a request you sent. */
export const removeFriend = onCall(async (request) => {
  const uid = requireUid(request);
  const other = id(input(request), 'userId')!;
  await db().runTransaction(async (tx) => {
    const ref = pairRef(uid, other);
    const pair = await tx.get(ref);
    if (!pair.exists || pair.get('status') === 'blocked') return;
    tx.delete(ref);
    setFriendState(tx, uid, other, { friend: false, pending: false });
  });
  return { ok: true };
});

export const blockUser = onCall(async (request) => {
  const uid = requireUid(request);
  const other = id(input(request), 'userId')!;
  if (other === uid) throw new HttpsError('invalid-argument', 'That is you.');
  const batch = db().batch();
  batch.set(pairRef(uid, other), {
    ...pairFields(uid, other),
    status: 'blocked',
    actedBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    acceptedAt: null,
  });
  severPeers(batch, uid, other);
  await batch.commit();
  return { ok: true };
});

export const unblockUser = onCall(async (request) => {
  const uid = requireUid(request);
  const other = id(input(request), 'userId')!;
  const ref = pairRef(uid, other);
  const pair = await ref.get();
  if (pair.exists && pair.get('status') === 'blocked' && pair.get('actedBy') === uid) await ref.delete();
  return { ok: true };
});
