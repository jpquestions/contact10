import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { USERNAME_PATTERN, newProfile } from './shared';

/**
 * Claims a username for the caller. Usernames are unique, so the claim and
 * the release of any previous name happen in one transaction.
 */
export const claimUsername = onCall<{ username?: unknown }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const raw = request.data?.username;
  const username = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!USERNAME_PATTERN.test(username)) {
    throw new HttpsError('invalid-argument', 'Use 3 to 20 lowercase letters, numbers or underscores.');
  }

  const db = getFirestore();
  const nameRef = db.doc(`usernames/${username}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const [nameSnap, userSnap] = await Promise.all([tx.get(nameRef), tx.get(userRef)]);

    if (nameSnap.exists && nameSnap.get('uid') !== uid) {
      throw new HttpsError('already-exists', 'That username is taken.');
    }

    const previous: string | null = userSnap.exists ? (userSnap.get('username') ?? null) : null;
    if (previous === username) return;
    if (previous) tx.delete(db.doc(`usernames/${previous}`));

    tx.set(nameRef, { uid, createdAt: FieldValue.serverTimestamp() });
    if (userSnap.exists) {
      tx.update(userRef, { username });
    } else {
      tx.set(userRef, { ...newProfile(), username, createdAt: FieldValue.serverTimestamp() });
    }
  });

  return { username };
});
