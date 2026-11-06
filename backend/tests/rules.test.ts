/// <reference types="node" />
import { after, before, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const profile = (username: string, lifetimePoints = 0) => ({
  username,
  displayName: null,
  avatarUrl: null,
  lifetimePoints,
  activeGameId: null,
  seenWidgetIntroLaunch: true,
  seenWidgetIntroFirstScore: false,
  createdAt: new Date(),
});

function as(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-contact10',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
  await env.clearFirestore();

  // Alice: friends with Bob, in a game with Carol. Dave is a stranger.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const name of ['alice', 'bob', 'carol', 'dave']) {
      await setDoc(doc(db, `users/${name}`), profile(name));
      await setDoc(doc(db, `usernames/${name}`), { uid: name });
    }
    for (const [a, b] of [['alice', 'bob'], ['alice', 'carol']]) {
      await setDoc(doc(db, `users/${a}/peers/${b}`), { friend: a === 'alice' && b === 'bob' });
      await setDoc(doc(db, `users/${b}/peers/${a}`), { friend: a === 'alice' && b === 'bob' });
    }
    await setDoc(doc(db, 'friendships/alice_bob'), {
      userA: 'alice', userB: 'bob', status: 'accepted', actedBy: 'alice',
    });
    await setDoc(doc(db, 'games/g1'), { name: 'Friday', memberIds: ['alice', 'carol'], createdBy: 'alice' });
    await setDoc(doc(db, 'games/g2'), { name: 'Other', memberIds: ['dave'], createdBy: 'dave' });
    await setDoc(doc(db, 'games/g1/members/alice'), { role: 'admin', points: 6 });
    await setDoc(doc(db, 'games/g1/members/carol'), { role: 'member', points: 10 });
    await setDoc(doc(db, 'entries/e1'), { userId: 'alice', gameId: 'g1', amount: 6 });
    await setDoc(doc(db, 'entries/e2'), { userId: 'carol', gameId: 'g1', amount: 10 });
    await setDoc(doc(db, 'entries/e3'), { userId: 'carol', gameId: null, amount: 3 });
    await setDoc(doc(db, 'users/bob/unlocks/10'), { reachedAt: new Date() });
    await setDoc(doc(db, 'users/carol/unlocks/10'), { reachedAt: new Date() });
    await setDoc(doc(db, 'users/alice/notifications/n1'), { kind: 'friend_accepted', readAt: null });
    await setDoc(doc(db, 'invites/i1'), { gameId: 'g1', inviteeId: 'dave', invitedBy: 'alice' });
  });
});

after(async () => {
  await env.cleanup();
});

describe('profiles', () => {
  test('a new user can create their own profile with defaults only', async () => {
    const fresh = { ...profile('x'), username: null, seenWidgetIntroLaunch: false, createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as('erin'), 'users/erin'), fresh));
    await assertFails(setDoc(doc(as('frank'), 'users/frank'), { ...fresh, lifetimePoints: 500 }));
    await assertFails(setDoc(doc(as('frank'), 'users/frank'), { ...fresh, username: 'frank' }));
    await assertFails(setDoc(doc(as('frank'), 'users/gina'), fresh));
  });

  test('owners edit only their allowed fields', async () => {
    const db = as('alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { displayName: 'Alice' }));
    await assertSucceeds(updateDoc(doc(db, 'users/alice'), { activeGameId: 'g1' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { activeGameId: 'g2' }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { lifetimePoints: 9999 }));
    await assertFails(updateDoc(doc(db, 'users/alice'), { username: 'queen' }));
    await assertFails(updateDoc(doc(db, 'users/bob'), { displayName: 'hacked' }));
  });

  test('profiles are visible to self, friends and game mates only', async () => {
    const db = as('alice');
    await assertSucceeds(getDoc(doc(db, 'users/alice')));
    await assertSucceeds(getDoc(doc(db, 'users/bob')));
    await assertSucceeds(getDoc(doc(db, 'users/carol')));
    await assertFails(getDoc(doc(db, 'users/dave')));
    await assertFails(getDoc(doc(as('carol'), 'users/bob')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore() as unknown as Firestore, 'users/alice')));
  });

  test('peer lists are private to their owner', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/alice/peers/bob')));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/peers/carol')));
    await assertFails(setDoc(doc(as('dave'), 'users/alice/peers/dave'), { friend: true }));
  });
});

describe('usernames', () => {
  test('search is allowed in small pages only', async () => {
    const db = as('dave');
    const byPrefix = (n: number) =>
      query(collection(db, 'usernames'), where(documentId(), '>=', 'al'), where(documentId(), '<', 'al'), limit(n));
    const page = await assertSucceeds(getDocs(byPrefix(20)));
    if (page.docs.map((d) => d.id).join() !== 'alice') throw new Error('prefix search returned the wrong users');
    await assertFails(getDocs(byPrefix(50)));
    await assertFails(getDocs(collection(db, 'usernames')));
  });

  test('clients cannot write usernames directly', async () => {
    await assertFails(setDoc(doc(as('dave'), 'usernames/admin'), { uid: 'dave' }));
  });
});

describe('games and entries', () => {
  test('members see their game, strangers do not', async () => {
    await assertSucceeds(getDoc(doc(as('carol'), 'games/g1')));
    await assertSucceeds(getDocs(collection(as('carol'), 'games/g1/members')));
    await assertFails(getDoc(doc(as('dave'), 'games/g1')));
    await assertFails(getDocs(collection(as('dave'), 'games/g1/members')));
    const mine = await assertSucceeds(
      getDocs(query(collection(as('alice'), 'games'), where('memberIds', 'array-contains', 'alice'))),
    );
    if (mine.size !== 1) throw new Error('expected one game for alice');
  });

  test('game entries are visible to the game, solo entries only to their owner', async () => {
    await assertSucceeds(getDocs(query(collection(as('alice'), 'entries'), where('gameId', '==', 'g1'))));
    await assertFails(getDocs(query(collection(as('dave'), 'entries'), where('gameId', '==', 'g1'))));
    await assertFails(getDoc(doc(as('alice'), 'entries/e3')));
    await assertSucceeds(getDoc(doc(as('carol'), 'entries/e3')));
  });

  test('scores, games, invites and friendships are written only by functions', async () => {
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'entries/x'), { userId: 'alice', gameId: null, amount: 5 }));
    await assertFails(updateDoc(doc(db, 'games/g1/members/alice'), { points: 500 }));
    await assertFails(setDoc(doc(db, 'games/g3'), { name: 'x', memberIds: ['alice'] }));
    await assertFails(setDoc(doc(db, 'friendships/alice_dave'), { userA: 'alice', userB: 'dave', status: 'accepted' }));
    await assertFails(setDoc(doc(db, 'invites/i2'), { gameId: 'g1', inviteeId: 'bob' }));
  });

  test('invites are visible to the invitee and the game', async () => {
    await assertSucceeds(getDoc(doc(as('dave'), 'invites/i1')));
    await assertSucceeds(getDoc(doc(as('carol'), 'invites/i1')));
    await assertFails(getDoc(doc(as('bob'), 'invites/i1')));
  });
});

describe('rewards, unlocks and notifications', () => {
  test('rewards are private and only at defined milestones', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/rewards/500'), { rewardText: 'New shoes' }));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/rewards/77'), { rewardText: 'x' }));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/rewards/50'), { rewardText: '' }));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/rewards/500'), { rewardText: 'x' }));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/rewards/500')));
  });

  test('friends see milestones reached, game mates do not', async () => {
    await assertSucceeds(getDoc(doc(as('alice'), 'users/bob/unlocks/10')));
    await assertFails(getDoc(doc(as('alice'), 'users/carol/unlocks/10')));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/unlocks/10000'), { reachedAt: new Date() }));
  });

  test('notifications can only be marked read', async () => {
    const db = as('alice');
    await assertSucceeds(updateDoc(doc(db, 'users/alice/notifications/n1'), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(db, 'users/alice/notifications/n1'), { kind: 'x' }));
    await assertFails(getDoc(doc(as('bob'), 'users/alice/notifications/n1')));
  });

  test('push tokens belong to their owner', async () => {
    const token = { platform: 'ios', updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as('alice'), 'users/alice/pushTokens/tok'), token));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/pushTokens/tok2'), { ...token, platform: 'web' }));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/pushTokens/tok3'), token));
  });
});
