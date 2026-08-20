import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestFor, parseName } from '../tools/build-screenshots.mjs';

test('parseName reads a Phase 1 filename', () => {
  assert.deepEqual(parseName('AvB_17-8.jpg', 2026), {
    file: 'screenshots/AvB_17-8.jpg',
    teams: ['A', 'B'],
    date: '2026-08-17',
    phase: 1,
  });
});

test('parseName reads the phase off a prefixed filename', () => {
  assert.deepEqual(parseName('phase2_AvB_20-8.png', 2026), {
    file: 'screenshots/phase2_AvB_20-8.png',
    teams: ['A', 'B'],
    date: '2026-08-20',
    phase: 2,
  });
});

test('parseName keeps the prefix out of the team ids', () => {
  assert.deepEqual(parseName('phase2_CvE_21-8.png', 2026).teams, ['C', 'E']);
});

test('parseName pads a single-digit day and month', () => {
  assert.equal(parseName('AvE_1-9.png', 2026).date, '2026-09-01');
});

test('parseName rejects a file that is not an image', () => {
  assert.equal(parseName('phase2_AvB_20-8.txt', 2026), null);
});

test('parseName rejects a name that does not carry a match-up', () => {
  assert.equal(parseName('image.png', 2026), null);
});

test('parseName rejects an impossible month', () => {
  assert.equal(parseName('AvB_17-13.png', 2026), null);
});

test('manifestFor keeps Phase 1 on the original filename', () => {
  assert.equal(manifestFor(1), 'screenshots.json');
});

test('manifestFor gives every later phase its own manifest', () => {
  assert.equal(manifestFor(2), 'screenshots-phase2.json');
  assert.equal(manifestFor(3), 'screenshots-phase3.json');
});
