import { FieldValue, type DocumentReference, type SetOptions } from 'firebase-admin/firestore';
import { db } from './util';

// users/{a}/peers/{b} says b may see a's profile. A peer is visible while it
// is a friend, has a pending request, or shares at least one game. These are
// blind writes so they can run inside transactions after all reads.

/** The part of Transaction and WriteBatch these helpers need. */
type Writer = {
  set(ref: DocumentReference, data: Record<string, unknown>, options: SetOptions): unknown;
  delete(ref: DocumentReference): unknown;
};

function both(w: Writer, a: string, b: string, data: Record<string, unknown>) {
  w.set(db().doc(`users/${a}/peers/${b}`), data, { merge: true });
  w.set(db().doc(`users/${b}/peers/${a}`), data, { merge: true });
}

export function addSharedGame(w: Writer, a: string, b: string, gameId: string) {
  both(w, a, b, { games: FieldValue.arrayUnion(gameId) });
}

export function removeSharedGame(w: Writer, a: string, b: string, gameId: string) {
  both(w, a, b, { games: FieldValue.arrayRemove(gameId) });
}

export function setFriendState(w: Writer, a: string, b: string, state: { friend: boolean; pending: boolean }) {
  both(w, a, b, state);
}

/** Blocking hides both profiles from each other entirely. */
export function severPeers(w: Writer, a: string, b: string) {
  w.delete(db().doc(`users/${a}/peers/${b}`));
  w.delete(db().doc(`users/${b}/peers/${a}`));
}
