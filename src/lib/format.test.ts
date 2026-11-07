/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultNightEnd, weekendWindow } from './format.ts';

test('a night game ends at 6 AM the next morning', () => {
  const end = defaultNightEnd(new Date(2026, 10, 6, 21, 30));
  assert.deepEqual([end.getDate(), end.getHours()], [7, 6]);
  const late = defaultNightEnd(new Date(2026, 10, 7, 2, 0));
  assert.deepEqual([late.getDate(), late.getHours()], [7, 6], 'after midnight it ends the same morning');
});

test('weekend windows run Friday 5 PM to Sunday night', () => {
  const tue = weekendWindow(new Date(2026, 10, 3, 12, 0)); // Tuesday Nov 3
  assert.deepEqual([tue.start.getDay(), tue.start.getHours(), tue.end.getDay(), tue.end.getHours()], [5, 17, 0, 23]);
  const sat = new Date(2026, 10, 7, 14, 0); // Saturday
  const w = weekendWindow(sat);
  assert.equal(w.start.getTime(), sat.getTime(), 'mid weekend starts now');
  assert.equal(w.end.getDate(), 8);
});

test('custom ranges cover whole days and never start in the past', async () => {
  const { customWindow } = await import('./format.ts');
  const now = new Date(2026, 10, 7, 15, 0);
  const today = customWindow(new Date(2026, 10, 7), new Date(2026, 10, 9), now);
  assert.equal(today.start.getTime(), now.getTime());
  assert.deepEqual([today.end.getDate(), today.end.getHours(), today.end.getMinutes()], [9, 23, 59]);
  const later = customWindow(new Date(2026, 11, 1, 12), new Date(2026, 11, 3), now);
  assert.deepEqual([later.start.getDate(), later.start.getHours()], [1, 0]);
});
