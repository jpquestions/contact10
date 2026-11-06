/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MILESTONES as APP_MILESTONES } from '../../src/lib/milestones.ts';
import { MILESTONES as SERVER_MILESTONES } from '../functions/src/shared.ts';

test('app, functions and rules agree on milestones', () => {
  assert.deepEqual([...SERVER_MILESTONES], [...APP_MILESTONES]);
  const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  const listed = rules.match(/threshold in \[([^\]]+)\]/)?.[1].match(/\d+/g)?.map(Number);
  assert.deepEqual(listed, [...APP_MILESTONES]);
});
