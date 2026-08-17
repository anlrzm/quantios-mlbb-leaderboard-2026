import test from 'node:test';
import assert from 'node:assert/strict';
import { validateShape, formatPoints } from '../standings.js';

const valid = {
  tournament: { name: 'T', season: 'S1', updated: '2026-08-17' },
  players: [{ id: 'p1', ign: 'Alpha' }],
  matches: [{ id: 'm1', label: 'Match 1', date: '2026-08-17', results: [] }],
};

test('validateShape accepts a well-formed document', () => {
  assert.deepEqual(validateShape(valid), { ok: true });
});

test('validateShape rejects a non-object', () => {
  const r = validateShape(null);
  assert.equal(r.ok, false);
  assert.match(r.error, /object/i);
});

test('validateShape rejects missing players', () => {
  const r = validateShape({ ...valid, players: undefined });
  assert.equal(r.ok, false);
  assert.match(r.error, /players/);
});

test('validateShape rejects players that is not an array', () => {
  const r = validateShape({ ...valid, players: {} });
  assert.equal(r.ok, false);
  assert.match(r.error, /players/);
});

test('validateShape rejects missing matches', () => {
  const r = validateShape({ ...valid, matches: undefined });
  assert.equal(r.ok, false);
  assert.match(r.error, /matches/);
});

test('validateShape rejects a match whose results is not an array', () => {
  const bad = { ...valid, matches: [{ id: 'm1', label: 'M', date: 'd', results: 'nope' }] };
  const r = validateShape(bad);
  assert.equal(r.ok, false);
  assert.match(r.error, /results/);
});

test('validateShape rejects a player missing an id', () => {
  const r = validateShape({ ...valid, players: [{ ign: 'NoId' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /id/);
});

test('validateShape tolerates a missing tournament block', () => {
  assert.deepEqual(validateShape({ ...valid, tournament: undefined }), { ok: true });
});

test('formatPoints drops a trailing .0', () => {
  assert.equal(formatPoints(24), '24');
  assert.equal(formatPoints(24.0), '24');
});

test('formatPoints keeps one decimal', () => {
  assert.equal(formatPoints(24.5), '24.5');
});

test('formatPoints rounds to one decimal', () => {
  assert.equal(formatPoints(24.44), '24.4');
  assert.equal(formatPoints(24.46), '24.5');
});

test('formatPoints kills floating point artefacts', () => {
  assert.equal(formatPoints(0.1 + 0.2), '0.3');
});

test('formatPoints handles negatives', () => {
  assert.equal(formatPoints(-5), '-5');
  assert.equal(formatPoints(-5.5), '-5.5');
});

test('formatPoints handles zero', () => {
  assert.equal(formatPoints(0), '0');
});
