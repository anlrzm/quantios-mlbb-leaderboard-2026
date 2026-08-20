import test from 'node:test';
import assert from 'node:assert/strict';
import { matchSides } from '../matchup.js';

const NAMES = new Map([
  ['A', { id: 'A', name: 'Confirm Win' }],
  ['C', { id: 'C', name: '养MVP队' }],
]);

test('matchSides pairs each team id with its name', () => {
  assert.deepEqual(matchSides(['A', 'C'], NAMES), [
    { id: 'A', name: 'Confirm Win' },
    { id: 'C', name: '养MVP队' },
  ]);
});

test('matchSides falls back to the id when the team is not defined', () => {
  assert.deepEqual(matchSides(['A', 'Z'], NAMES), [
    { id: 'A', name: 'Confirm Win' },
    { id: 'Z', name: 'Z' },
  ]);
});

test('matchSides returns null when there is no pair to show', () => {
  assert.equal(matchSides(undefined, NAMES), null);
  assert.equal(matchSides(['A'], NAMES), null);
  assert.equal(matchSides(['A', 'B', 'C'], NAMES), null);
});

test('matchSides returns null when a side is not a team id', () => {
  assert.equal(matchSides(['A', 7], NAMES), null);
  assert.equal(matchSides(['A', ''], NAMES), null);
});
