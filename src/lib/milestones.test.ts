/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossedMilestones, milestoneProgress } from './milestones.ts';
import { FULL_CONTACT, QUICK_ADD, RULE_STEPS, isValidEntry } from './rules.ts';

test('progress before the first milestone', () => {
  assert.deepEqual(milestoneProgress(0), { reached: null, next: 10, fraction: 0 });
  assert.deepEqual(milestoneProgress(6), { reached: null, next: 10, fraction: 0.6 });
});

test('progress between milestones measures from the last one reached', () => {
  assert.deepEqual(milestoneProgress(10), { reached: 10, next: 50, fraction: 0 });
  assert.deepEqual(milestoneProgress(30), { reached: 10, next: 50, fraction: 0.5 });
});

test('progress after the last milestone', () => {
  assert.deepEqual(milestoneProgress(12000), { reached: 10000, next: null, fraction: 1 });
});

test('one entry can cross several milestones', () => {
  assert.deepEqual(crossedMilestones(0, 100), [10, 50, 100]);
  assert.deepEqual(crossedMilestones(10, 49), []);
  assert.deepEqual(crossedMilestones(9, 10), [10]);
});

test('rules ladder adds up to a full contact of 10', () => {
  assert.deepEqual(RULE_STEPS.map((s) => s.total), [1, 3, 6, 10]);
  assert.equal(FULL_CONTACT, 10);
  assert.deepEqual([...QUICK_ADD], [1, 2, 3, 6, 10]);
});

test('entries must be whole numbers from 1 to 100', () => {
  assert.ok(isValidEntry(1) && isValidEntry(100));
  assert.ok(!isValidEntry(0) && !isValidEntry(101) && !isValidEntry(2.5));
});
