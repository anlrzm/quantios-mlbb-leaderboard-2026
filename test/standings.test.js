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

import { computeStandings, findUnknownPlayerRefs, leaderSummary } from '../standings.js';

function doc(players, matches) {
  return { tournament: {}, players, matches };
}
const P = (id, ign) => ({ id, ign });
const M = (id, results) => ({ id, label: id, date: '2026-08-17', results });
const R = (playerId, points) => ({ playerId, points });

test('computeStandings sums points across matches', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha')],
    [M('m1', [R('p1', 10)]), M('m2', [R('p1', 15)])],
  ));
  assert.equal(s[0].total, 25);
  assert.equal(s[0].matchesPlayed, 2);
});

test('computeStandings ranks by total descending', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo')],
    [M('m1', [R('p1', 10), R('p2', 30)])],
  ));
  assert.deepEqual(s.map((x) => x.ign), ['Bravo', 'Alpha']);
  assert.deepEqual(s.map((x) => x.rank), [1, 2]);
});

test('computeStandings gives a player in no match a total of 0, ranked last', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Ghost')],
    [M('m1', [R('p1', 10)])],
  ));
  assert.equal(s[1].ign, 'Ghost');
  assert.equal(s[1].total, 0);
  assert.equal(s[1].matchesPlayed, 0);
  assert.equal(s[1].rank, 2);
});

test('computeStandings shares a rank on a tie and skips the next', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo'), P('p3', 'Charlie'), P('p4', 'Delta')],
    [M('m1', [R('p1', 50), R('p2', 40), R('p3', 40), R('p4', 10)])],
  ));
  assert.deepEqual(s.map((x) => x.rank), [1, 2, 2, 4]);
});

test('computeStandings skips two ranks after a three-way tie', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo'), P('p3', 'Charlie'), P('p4', 'Delta')],
    [M('m1', [R('p1', 40), R('p2', 40), R('p3', 40), R('p4', 10)])],
  ));
  assert.deepEqual(s.map((x) => x.rank), [1, 1, 1, 4]);
});

test('computeStandings orders a tie alphabetically, case-insensitively', () => {
  const s = computeStandings(doc(
    [P('p1', 'zulu'), P('p2', 'Alpha'), P('p3', 'mike')],
    [M('m1', [R('p1', 10), R('p2', 10), R('p3', 10)])],
  ));
  assert.deepEqual(s.map((x) => x.ign), ['Alpha', 'mike', 'zulu']);
});

test('computeStandings subtracts negative points', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha')],
    [M('m1', [R('p1', 20)]), M('m2', [R('p1', -5)])],
  ));
  assert.equal(s[0].total, 15);
});

test('computeStandings ignores a result referencing an unknown player', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha')],
    [M('m1', [R('p1', 10), R('pX', 99)])],
  ));
  assert.equal(s.length, 1);
  assert.equal(s[0].total, 10);
});

test('computeStandings returns an empty array for an empty roster', () => {
  assert.deepEqual(computeStandings(doc([], [])), []);
});

test('findUnknownPlayerRefs reports orphaned references', () => {
  const refs = findUnknownPlayerRefs(doc(
    [P('p1', 'Alpha')],
    [M('m1', [R('p1', 10), R('pX', 99)])],
  ));
  assert.deepEqual(refs, [{ matchId: 'm1', matchLabel: 'm1', playerId: 'pX' }]);
});

test('findUnknownPlayerRefs returns empty when everything resolves', () => {
  const refs = findUnknownPlayerRefs(doc([P('p1', 'Alpha')], [M('m1', [R('p1', 10)])]));
  assert.deepEqual(refs, []);
});

test('leaderSummary returns null when nobody has played', () => {
  assert.equal(leaderSummary(computeStandings(doc([], []))), null);
});

test('leaderSummary reports the margin over second place', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo')],
    [M('m1', [R('p1', 50), R('p2', 30)])],
  ));
  const l = leaderSummary(s);
  assert.equal(l.ign, 'Alpha');
  assert.equal(l.total, 50);
  assert.equal(l.tied, false);
  assert.equal(l.margin, 20);
});

test('leaderSummary reports a tie for first', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo')],
    [M('m1', [R('p1', 50), R('p2', 50)])],
  ));
  const l = leaderSummary(s);
  assert.equal(l.ign, 'Alpha');
  assert.equal(l.tied, true);
  assert.deepEqual(l.tiedWith, ['Bravo']);
  assert.equal(l.margin, null);
});

test('leaderSummary reports a three-way tie', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo'), P('p3', 'Charlie')],
    [M('m1', [R('p1', 50), R('p2', 50), R('p3', 50)])],
  ));
  const l = leaderSummary(s);
  assert.equal(l.tied, true);
  assert.deepEqual(l.tiedWith, ['Bravo', 'Charlie']);
});

test('leaderSummary has a null margin when there is only one player', () => {
  const s = computeStandings(doc([P('p1', 'Alpha')], [M('m1', [R('p1', 50)])]));
  assert.equal(leaderSummary(s).margin, null);
});
