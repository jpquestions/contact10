/// <reference types="node" />
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const run = Date.now().toString(36);
const apps: FirebaseApp[] = [];

// Open Firestore streams would keep the test process alive.
after(() => Promise.all(apps.map((a) => deleteApp(a))));

type Client = Awaited<ReturnType<typeof client>>;

async function client(name: string) {
  const app = initializeApp({ projectId: 'demo-contact10', apiKey: 'demo-key' }, `${name}-${run}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db: Firestore = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const fns = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const { user } = await createUserWithEmailAndPassword(auth, `${name}-${run}@test.dev`, 'password123');
  const call = async <T = Record<string, unknown>>(fn: string, data: Record<string, unknown> = {}) =>
    (await httpsCallable(fns, fn)(data)).data as T;
  const username = `${name}_${run}`.slice(0, 20);
  await call('claimUsername', { username });
  return { db, uid: user.uid, username, call };
}

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    return (err as { code?: string }).code ?? 'unknown';
  }
}

async function canRead(c: Client, path: string): Promise<boolean> {
  return (await code(getDoc(doc(c.db, path)))) === null;
}

async function profile(c: Client, uid = c.uid) {
  return (await getDoc(doc(c.db, `users/${uid}`))).data()!;
}

async function member(c: Client, gameId: string, uid = c.uid) {
  return (await getDoc(doc(c.db, `games/${gameId}/members/${uid}`))).data()!;
}

async function inbox(c: Client, kind: string) {
  const snap = await getDocs(collection(c.db, `users/${c.uid}/notifications`));
  return snap.docs.map((d) => d.data()).filter((n) => n.kind === kind);
}

describe('game flow', () => {
  let alice: Client, bob: Client, carol: Client, dave: Client;
  let gameId: string;
  let bobEntry: string;

  before(async () => {
    [alice, bob, carol, dave] = await Promise.all(['al', 'bo', 'ca', 'da'].map(client));
  });

  test('friend requests need acceptance and open up profiles', async () => {
    assert.equal(await canRead(alice, `users/${bob.uid}`), false);
    const sent = await alice.call<{ result: string }>('sendFriendRequest', { username: `@${bob.username}` });
    assert.equal(sent.result, 'sent');
    assert.equal((await inbox(bob, 'friend_request')).length, 1);
    assert.equal(await canRead(bob, `users/${alice.uid}`), true, 'pending request shows the requester');
    assert.equal(await code(alice.call('respondToFriendRequest', { userId: bob.uid, accept: true })), 'functions/not-found');
    await bob.call('respondToFriendRequest', { userId: alice.uid, accept: true });
    assert.equal((await inbox(alice, 'friend_accepted')).length, 1);
    const friends = await getDocs(
      query(collection(alice.db, 'friendships'), where('participants', 'array-contains', alice.uid), where('status', '==', 'accepted')),
    );
    assert.equal(friends.size, 1);
    assert.equal(await canRead(dave, `users/${alice.uid}`), false);
  });

  test('creating a game and inviting by friend list and by code', async () => {
    const res = await alice.call<{ gameId: string }>('createGame', {
      name: 'Friday Night',
      type: 'ongoing',
      targetPoints: 10,
      rewardText: 'Loser buys breakfast',
      rewardMode: 'first',
    });
    gameId = res.gameId;
    assert.equal((await profile(alice)).activeGameId, gameId);

    assert.equal(await code(alice.call('inviteFriends', { gameId, userIds: [carol.uid] })), 'functions/failed-precondition');
    await alice.call('inviteFriends', { gameId, userIds: [bob.uid] });
    assert.equal((await inbox(bob, 'game_invite')).length, 1);
    const invites = await getDocs(
      query(collection(bob.db, 'invites'), where('inviteeId', '==', bob.uid), where('status', '==', 'pending')),
    );
    assert.equal(invites.size, 1);
    await bob.call('respondToInvite', { inviteId: invites.docs[0].id, accept: true });

    const link = await alice.call<{ code: string }>('createInviteLink', { gameId });
    assert.match(link.code, /^[A-Z2-9]{8}$/);
    assert.equal(await code(carol.call('joinGameByCode', { code: 'AAAAAAAA' })), 'functions/not-found');
    await carol.call('joinGameByCode', { code: link.code.toLowerCase() });

    const game = (await getDoc(doc(carol.db, `games/${gameId}`))).data()!;
    assert.deepEqual(new Set(game.memberIds), new Set([alice.uid, bob.uid, carol.uid]));
    assert.equal(await canRead(carol, `users/${bob.uid}`), true, 'game mates see each other');
    assert.equal(await canRead(dave, `games/${gameId}`), false);
  });

  test('scoring updates game and lifetime totals and decides the winner', async () => {
    const c = await carol.call<{ gamePoints: number; lifetimePoints: number; reachedTarget: boolean }>('addPoints', {
      gameId,
      amount: 6,
    });
    assert.deepEqual([c.gamePoints, c.lifetimePoints, c.reachedTarget], [6, 6, false]);

    bobEntry = `entry-${run}`;
    const b = await bob.call<{ unlocked: number[]; wonGame: boolean; reachedTarget: boolean; duplicate: boolean }>('addPoints', {
      gameId,
      amount: 10,
      entryId: bobEntry,
      source: 'widget',
    });
    assert.deepEqual(b.unlocked, [10]);
    assert.equal(b.wonGame, true);

    const again = await bob.call<{ duplicate: boolean; lifetimePoints: number }>('addPoints', { gameId, amount: 10, entryId: bobEntry });
    assert.equal(again.duplicate, true, 'retries are idempotent');
    assert.equal(again.lifetimePoints, 10);

    assert.equal((await getDoc(doc(alice.db, `games/${gameId}`))).get('winnerId'), bob.uid);
    assert.equal((await inbox(carol, 'game_target')).length, 1, 'game members hear about the win');
    assert.equal((await inbox(alice, 'friend_milestone')).length, 1, 'friends hear about milestones');
    assert.equal((await inbox(carol, 'friend_milestone')).length, 0, 'game mates do not hear personal milestones');

    assert.equal(await code(bob.call('addPoints', { gameId, amount: 0 })), 'functions/invalid-argument');
    assert.equal(await code(bob.call('addPoints', { gameId, amount: 101 })), 'functions/invalid-argument');
    assert.equal(await code(dave.call('addPoints', { gameId, amount: 5 })), 'functions/permission-denied');

    const solo = await dave.call<{ lifetimePoints: number; gamePoints: null }>('addPoints', { amount: 3 });
    assert.equal(solo.lifetimePoints, 3);
    assert.equal(solo.gamePoints, null);
  });

  test('undo removes your own recent entry', async () => {
    const mine = await carol.call<{ entryId: string }>('addPoints', { gameId, amount: 2 });
    await carol.call('removePoints', { entryId: mine.entryId });
    assert.equal((await member(carol, gameId)).points, 6);
    assert.equal(await code(carol.call('removePoints', { entryId: mine.entryId })), 'functions/failed-precondition');
    assert.equal((await profile(carol)).lifetimePoints, 6);
    assert.equal(await code(carol.call('removePoints', { entryId: bobEntry })), 'functions/not-found');
  });

  test('editing fixes points added by accident, milestones and targets included', async () => {
    const oops = await carol.call<{ entryId: string; unlocked: number[]; lifetimePoints: number }>('addPoints', { gameId, amount: 100 });
    assert.deepEqual(oops.unlocked, [10, 50, 100]);
    assert.notEqual((await member(carol, gameId)).reachedTargetAt, null);

    const fixed = await carol.call<{ lifetimePoints: number; gamePoints: number }>('editPoints', { entryId: oops.entryId, amount: 1 });
    assert.deepEqual([fixed.lifetimePoints, fixed.gamePoints], [7, 7]);
    assert.equal((await getDoc(doc(carol.db, `users/${carol.uid}/unlocks/10`))).exists(), false, 'accidental milestones are revoked');
    assert.equal((await member(carol, gameId)).reachedTargetAt, null, 'accidental target is revoked');
    const edited = (await getDoc(doc(alice.db, `entries/${oops.entryId}`))).data()!;
    assert.deepEqual([edited.amount, edited.originalAmount], [1, 100], 'game mates can see it was edited');

    assert.equal(await code(carol.call('editPoints', { entryId: oops.entryId, amount: 0 })), 'functions/invalid-argument');
    assert.equal(await code(alice.call('editPoints', { entryId: oops.entryId, amount: 5 })), 'functions/not-found');
  });

  test('custom date range games', async () => {
    const day = 24 * 60 * 60 * 1000;
    const base = { name: 'Summer', type: 'custom', targetPoints: 500, rewardText: 'Trip', rewardMode: 'everyone' };
    const later = await alice.call<{ gameId: string }>('createGame', { ...base, startsAt: Date.now() + day, endsAt: Date.now() + 30 * day });
    assert.equal(await code(alice.call('addPoints', { gameId: later.gameId, amount: 1 })), 'functions/failed-precondition', 'not started yet');
    assert.equal(
      await code(alice.call('createGame', { ...base, startsAt: Date.now(), endsAt: Date.now() + 400 * day })),
      'functions/invalid-argument',
    );
    assert.equal(await code(alice.call('createGame', { ...base, startsAt: Date.now(), endsAt: null })), 'functions/invalid-argument');
    await alice.call('endGame', { gameId: later.gameId });
  });

  test('flags go to the creator, and upheld flags take the points back', async () => {
    assert.equal(await code(bob.call('flagEntry', { entryId: bobEntry })), 'functions/failed-precondition');
    await carol.call('flagEntry', { entryId: bobEntry, reason: 'Never happened' });
    assert.equal(await code(alice.call('flagEntry', { entryId: bobEntry })), 'functions/already-exists');
    assert.equal((await inbox(alice, 'flag_review')).length, 1);
    assert.equal(await code(bob.call('removePoints', { entryId: bobEntry })), 'functions/failed-precondition');
    assert.equal(await code(carol.call('resolveFlag', { gameId, entryId: bobEntry, upheld: true })), 'functions/permission-denied');

    await alice.call('resolveFlag', { gameId, entryId: bobEntry, upheld: true });
    assert.equal((await member(bob, gameId)).points, 0);
    assert.equal((await member(bob, gameId)).reachedTargetAt, null);
    assert.equal((await profile(bob)).lifetimePoints, 0);
    assert.equal((await getDoc(doc(bob.db, `users/${bob.uid}/unlocks/10`))).exists(), false, 'false milestone revoked');
    assert.equal((await getDoc(doc(alice.db, `games/${gameId}`))).get('winnerId'), null, 'win reopened');
    assert.equal((await inbox(bob, 'flag_decided')).length, 1);
    assert.equal((await inbox(carol, 'flag_decided')).length, 1);

    const c = await carol.call<{ wonGame: boolean }>('addPoints', { gameId, amount: 10 });
    assert.equal(c.wonGame, true, 'next to reach the target wins');
  });

  test('leaving a game removes visibility that came from it', async () => {
    assert.equal(await code(alice.call('leaveGame', { gameId })), 'functions/failed-precondition');
    await carol.call('leaveGame', { gameId });
    assert.equal(await canRead(carol, `users/${bob.uid}`), false);
    assert.equal(await canRead(carol, `games/${gameId}`), false);
  });

  test('only the creator ends a game, and ended games take no points', async () => {
    assert.equal(await code(bob.call('endGame', { gameId })), 'functions/permission-denied');
    await alice.call('endGame', { gameId });
    assert.equal(await code(bob.call('addPoints', { gameId, amount: 1 })), 'functions/failed-precondition');
    assert.equal((await inbox(bob, 'game_ended')).length, 1);
  });

  test('blocking hides users from each other', async () => {
    await dave.call('sendFriendRequest', { username: alice.username });
    assert.equal(await canRead(alice, `users/${dave.uid}`), true);
    await alice.call('blockUser', { userId: dave.uid });
    assert.equal(await canRead(alice, `users/${dave.uid}`), false);
    assert.equal(await code(dave.call('sendFriendRequest', { username: alice.username })), 'functions/failed-precondition');
  });

  test('anyone can report a user or game, and reports stay private', async () => {
    await carol.call('reportContent', { targetType: 'user', targetId: bob.uid, reason: 'harassment', details: 'Rude' });
    await carol.call('reportContent', { targetType: 'game', targetId: gameId, reason: 'spam' });
    assert.equal(await code(carol.call('reportContent', { targetType: 'user', targetId: carol.uid, reason: 'spam' })), 'functions/invalid-argument');
    assert.equal(await code(carol.call('reportContent', { targetType: 'user', targetId: bob.uid, reason: 'nope' })), 'functions/invalid-argument');
    assert.equal(await canRead(carol, `reports/${carol.uid}_user_${bob.uid}`), false);
  });

  test('deleting an account removes the profile and username', async () => {
    await dave.call('deleteAccount');
    const lookup = await getDoc(doc(alice.db, `usernames/${dave.username}`));
    assert.equal(lookup.exists(), false);
  });
});
