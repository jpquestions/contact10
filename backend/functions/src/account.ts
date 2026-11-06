import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { endGameNow } from './games';
import { removeSharedGame, setFriendState } from './peers';
import { db, requireUid } from './util';

/**
 * Deletes the caller's account and personal data (required by the App
 * Store). Games they created are ended; games they joined lose them as a
 * member; their entries are removed from feeds.
 */
export const deleteAccount = onCall(async (request) => {
  const uid = requireUid(request);
  const user = await db().doc(`users/${uid}`).get();

  const games = await db().collection('games').where('memberIds', 'array-contains', uid).get();
  for (const game of games.docs) {
    if (game.get('createdBy') === uid) {
      await endGameNow(game.id);
    }
    const batch = db().batch();
    batch.update(game.ref, { memberIds: (game.get('memberIds') as string[]).filter((m) => m !== uid) });
    batch.delete(game.ref.collection('members').doc(uid));
    for (const other of game.get('memberIds') as string[]) if (other !== uid) removeSharedGame(batch, uid, other, game.id);
    await batch.commit();
  }

  const pairs = await db().collection('friendships').where('participants', 'array-contains', uid).get();
  for (const pair of pairs.docs) {
    const other = pair.get('userA') === uid ? (pair.get('userB') as string) : (pair.get('userA') as string);
    const batch = db().batch();
    batch.delete(pair.ref);
    setFriendState(batch, uid, other, { friend: false, pending: false });
    await batch.commit();
  }

  const entries = await db().collection('entries').where('userId', '==', uid).get();
  for (let i = 0; i < entries.docs.length; i += 400) {
    const batch = db().batch();
    for (const e of entries.docs.slice(i, i + 400)) batch.delete(e.ref);
    await batch.commit();
  }

  const invites = await db().collection('invites').where('inviteeId', '==', uid).get();
  if (!invites.empty) {
    const batch = db().batch();
    invites.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const username = user.get('username') as string | null;
  if (username) await db().doc(`usernames/${username}`).delete();
  await db().recursiveDelete(db().doc(`users/${uid}`));

  try {
    await getAuth().deleteUser(uid);
  } catch (err) {
    throw new HttpsError('internal', 'Your data was deleted but the login could not be removed. Try again.', String(err));
  }
  return { ok: true };
});
