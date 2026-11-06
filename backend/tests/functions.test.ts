/// <reference types="node" />
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const run = Date.now().toString(36);

/** A signed in client, as the app would be, pointed at the emulators. */
async function client(name: string) {
  const app = initializeApp({ projectId: 'demo-contact10', apiKey: 'demo-key' }, `${name}-${run}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const { user } = await createUserWithEmailAndPassword(auth, `${name}-${run}@test.dev`, 'password123');
  const claim = httpsCallable<{ username: string }, { username: string }>(functions, 'claimUsername');
  return { app, db, uid: user.uid, claim };
}

async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    return (err as { code?: string }).code ?? 'unknown';
  }
}

describe('claimUsername', () => {
  test('claims, rejects duplicates and invalid names, and releases old names', async () => {
    const a = await client('a');
    const b = await client('b');
    const name = `u_${run}`.slice(0, 20);
    const renamed = `v_${run}`.slice(0, 20);

    const res = await a.claim({ username: name.toUpperCase() });
    assert.equal(res.data.username, name);

    const profile = await getDoc(doc(a.db, `users/${a.uid}`));
    assert.equal(profile.get('username'), name);
    assert.equal(profile.get('lifetimePoints'), 0);
    assert.equal((await getDoc(doc(a.db, `usernames/${name}`))).get('uid'), a.uid);

    assert.equal(await errorCode(b.claim({ username: name })), 'functions/already-exists');
    assert.equal(await errorCode(b.claim({ username: 'no spaces!' })), 'functions/invalid-argument');
    assert.equal(await errorCode(b.claim({ username: 'ab' })), 'functions/invalid-argument');

    await a.claim({ username: renamed });
    assert.equal((await getDoc(doc(a.db, `usernames/${name}`))).exists(), false);
    assert.equal((await getDoc(doc(a.db, `users/${a.uid}`))).get('username'), renamed);

    // The released name is free again.
    assert.equal((await b.claim({ username: name })).data.username, name);

    await Promise.all([deleteApp(a.app), deleteApp(b.app)]);
  });
});
