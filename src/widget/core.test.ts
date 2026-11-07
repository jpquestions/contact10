/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTargetId, resolveTarget, SOLO, targetLabel, withPoints, type WidgetState } from './core.ts';

const state: WidgetState = {
  refreshToken: 'r',
  apiKey: 'k',
  functionsBase: 'https://x',
  username: 'me',
  lifetimePoints: 40,
  activeGameId: 'b',
  games: [
    { id: 'a', name: 'Friday', points: 5, leaders: [] },
    { id: 'b', name: 'Weekend', points: 12, leaders: [] },
  ],
};

test('the widget follows the app until a target is picked', () => {
  assert.equal(targetLabel(resolveTarget(state, null)), 'Weekend');
  assert.equal(targetLabel(resolveTarget(state, 'a')), 'Friday');
  assert.equal(targetLabel(resolveTarget(state, SOLO)), 'Personal');
  assert.equal(targetLabel(resolveTarget(state, 'gone')), 'Weekend', 'an ended game falls back to the active one');
  assert.equal(targetLabel(resolveTarget({ ...state, games: [] }, null)), 'Personal');
});

test('tapping the title cycles through games and Personal', () => {
  assert.equal(nextTargetId(state, resolveTarget(state, 'a')), 'b');
  assert.equal(nextTargetId(state, resolveTarget(state, 'b')), SOLO);
  assert.equal(nextTargetId(state, resolveTarget(state, SOLO)), 'a');
});

test('points show right away on the chosen target', () => {
  const after = withPoints(state, 'a', 6);
  assert.equal(after.lifetimePoints, 46);
  assert.deepEqual(after.games.map((g) => g.points), [11, 12]);
  assert.equal(withPoints(state, null, 3).games[0].points, 5, 'personal points leave games alone');
});
