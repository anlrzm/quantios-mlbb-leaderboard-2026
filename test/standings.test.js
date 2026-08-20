import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTeamLabel,
  teamsById,
  validateShape,
  formatPoints,
  PRIZE_PLACES,
  isPrizeRank,
  QUALIFY_PLACES,
  isQualifyingRank,
  computeTeamTable,
} from '../standings.js';

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
  assert.match(r.error, /"id"/);
});

test('validateShape rejects duplicate player ids', () => {
  const r = validateShape({ ...valid, players: [{ id: 'p1', ign: 'A' }, { id: 'p1', ign: 'B' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /[Dd]uplicate/);
});

test('validateShape rejects non-finite points', () => {
  const bad = { ...valid, matches: [{ id: 'm1', label: 'M', date: '2026-08-17', results: [{ playerId: 'p1', points: 'twenty' }] }] };
  const r = validateShape(bad);
  assert.equal(r.ok, false);
  assert.match(r.error, /points/i);
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

test('computeStandings ties players whose totals differ only by float drift', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha'), P('p2', 'Bravo')],
    [M('m1', [R('p1', 0.1), R('p2', 0.3)]), M('m2', [R('p1', 0.2)])],
  ));
  // Alpha accrues 0.1 + 0.2 = 0.30000000000000004; Bravo has exactly 0.3.
  // Both display as "0.3", so both must rank 1.
  assert.deepEqual(s.map((x) => x.rank), [1, 1]);
});

test('computeStandings stores totals at display precision', () => {
  const s = computeStandings(doc(
    [P('p1', 'Alpha')],
    [M('m1', [R('p1', 0.1)]), M('m2', [R('p1', 0.2)])],
  ));
  assert.equal(s[0].total, 0.3);
});

test('validateShape accepts a player with a team', () => {
  const doc = { ...valid, players: [{ id: 'p1', ign: 'Alpha', team: 'Team A' }] };
  assert.deepEqual(validateShape(doc), { ok: true });
});

test('validateShape rejects a non-string team', () => {
  const doc = { ...valid, players: [{ id: 'p1', ign: 'Alpha', team: 3 }] };
  const r = validateShape(doc);
  assert.equal(r.ok, false);
  assert.match(r.error, /team/);
});

test('computeStandings carries the team onto each row', () => {
  const rows = computeStandings({
    players: [{ id: 'p1', ign: 'Alpha', team: 'Team A' }, { id: 'p2', ign: 'Beta' }],
    matches: [],
  });
  assert.equal(rows.find((r) => r.playerId === 'p1').team, 'Team A');
  assert.equal(rows.find((r) => r.playerId === 'p2').team, null);
});

test('leaderSummary reports the leader team', () => {
  const rows = computeStandings({
    players: [{ id: 'p1', ign: 'Alpha', team: 'Team A' }],
    matches: [{ id: 'm1', label: 'M', date: '2026-08-17', results: [{ playerId: 'p1', points: 5 }] }],
  });
  assert.equal(leaderSummary(rows).team, 'Team A');
});

test('isPrizeRank covers exactly the top five places', () => {
  assert.equal(PRIZE_PLACES, 5);
  assert.deepEqual([1, 2, 3, 4, 5].map(isPrizeRank), [true, true, true, true, true]);
  assert.equal(isPrizeRank(6), false);
  assert.equal(isPrizeRank(0), false);
});

const teamDoc = {
  players: [
    { id: 'p1', ign: 'A1', team: 'Team A' },
    { id: 'p2', ign: 'B1', team: 'Team B' },
    { id: 'p3', ign: 'C1', team: 'Team C' },
  ],
  matches: [
    { id: 'm1', label: 'A vs B', date: '2026-08-17', teams: ['Team A', 'Team B'], winner: 'Team A', results: [] },
    { id: 'm2', label: 'A vs C', date: '2026-08-18', teams: ['Team A', 'Team C'], winner: 'Team A', results: [] },
    { id: 'm3', label: 'B vs C', date: '2026-08-18', teams: ['Team B', 'Team C'], winner: 'Team B', results: [] },
  ],
};

test('computeTeamTable counts played, won, lost and points', () => {
  const rows = computeTeamTable(teamDoc);
  assert.deepEqual(
    rows.map((r) => [r.team, r.played, r.won, r.lost, r.points, r.rank]),
    [
      ['Team A', 2, 2, 0, 4, 1],
      ['Team B', 2, 1, 1, 2, 2],
      ['Team C', 2, 0, 2, 0, 3],
    ],
  );
});

test('computeTeamTable lists a team that has not played yet', () => {
  const rows = computeTeamTable({
    players: [...teamDoc.players, { id: 'p4', ign: 'D1', team: 'Team D' }],
    matches: teamDoc.matches,
  });
  const d = rows.find((r) => r.team === 'Team D');
  assert.deepEqual([d.played, d.won, d.lost, d.points], [0, 0, 0, 0]);
});

test('computeTeamTable skips a match with no recorded winner', () => {
  const rows = computeTeamTable({
    players: teamDoc.players,
    matches: [{ id: 'm1', label: 'A vs B', date: '2026-08-17', teams: ['Team A', 'Team B'], results: [] }],
  });
  assert.equal(rows.every((r) => r.played === 0), true);
});

test('computeTeamTable ties teams on equal points and ranks them together', () => {
  const rows = computeTeamTable({
    players: [
      { id: 'p1', ign: 'A1', team: 'Team A' },
      { id: 'p2', ign: 'B1', team: 'Team B' },
    ],
    matches: [
      { id: 'm1', label: 'A vs B', date: '2026-08-17', teams: ['Team A', 'Team B'], winner: 'Team A', results: [] },
      { id: 'm2', label: 'A vs B 2', date: '2026-08-18', teams: ['Team A', 'Team B'], winner: 'Team B', results: [] },
    ],
  });
  assert.deepEqual(rows.map((r) => r.rank), [1, 1]);
});

test('validateShape accepts a match with teams and a winner', () => {
  const doc = { ...valid, matches: [{ ...valid.matches[0], teams: ['Team A', 'Team B'], winner: 'Team A' }] };
  assert.deepEqual(validateShape(doc), { ok: true });
});

test('validateShape rejects a winner that did not play the match', () => {
  const doc = { ...valid, matches: [{ ...valid.matches[0], teams: ['Team A', 'Team B'], winner: 'Team C' }] };
  const r = validateShape(doc);
  assert.equal(r.ok, false);
  assert.match(r.error, /winner/);
});

test('validateShape rejects a match listing one team', () => {
  const doc = { ...valid, matches: [{ ...valid.matches[0], teams: ['Team A'] }] };
  assert.equal(validateShape(doc).ok, false);
});

test('validateShape rejects a winner with no teams', () => {
  const doc = { ...valid, matches: [{ ...valid.matches[0], winner: 'Team A' }] };
  assert.equal(validateShape(doc).ok, false);
});

test('isQualifyingRank covers exactly the top four places', () => {
  assert.equal(QUALIFY_PLACES, 4);
  assert.deepEqual([1, 2, 3, 4].map(isQualifyingRank), [true, true, true, true]);
  assert.equal(isQualifyingRank(5), false);
});

test('validateShape accepts a player carrying a real name', () => {
  assert.deepEqual(
    validateShape({ ...valid, players: [{ id: 'p1', ign: 'Alpha', name: 'Mr. X' }] }),
    { ok: true },
  );
});

test('validateShape rejects a non-string player name', () => {
  const r = validateShape({ ...valid, players: [{ id: 'p1', ign: 'Alpha', name: 42 }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /name/);
});

/* ---------- the teams section ---------- */

const withTeams = {
  tournament: { name: 'T', season: 'S1', updated: '2026-08-17' },
  teams: [
    { id: 'A', name: 'Confirm Win' },
    { id: 'B', name: 'GG Bro' },
    { id: 'C', name: '养MVP队' },
  ],
  players: [
    { id: 'p1', ign: 'Alpha', team: 'A' },
    { id: 'p2', ign: 'Beta', team: 'B' },
  ],
  matches: [
    { id: 'm1', label: 'A vs B', date: '2026-08-17', teams: ['A', 'B'], winner: 'A', results: [] },
  ],
};

test('validateShape accepts a teams section', () => {
  assert.deepEqual(validateShape(withTeams), { ok: true });
});

test('validateShape rejects a team without an id', () => {
  const r = validateShape({ ...withTeams, teams: [{ name: 'Confirm Win' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /id/);
});

test('validateShape rejects a team without a name', () => {
  const r = validateShape({ ...withTeams, teams: [{ id: 'A' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /name/);
});

test('validateShape rejects duplicate team ids', () => {
  const r = validateShape({
    ...withTeams,
    teams: [{ id: 'A', name: 'One' }, { id: 'A', name: 'Two' }],
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /Duplicate/i);
});

test('validateShape rejects a player on a team that is not defined', () => {
  const r = validateShape({
    ...withTeams,
    players: [{ id: 'p1', ign: 'Alpha', team: 'Z' }],
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /Z/);
});

test('validateShape rejects a match played by a team that is not defined', () => {
  const r = validateShape({
    ...withTeams,
    matches: [{ id: 'm1', label: 'A vs Z', date: '2026-08-17', teams: ['A', 'Z'], results: [] }],
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /Z/);
});

test('validateShape still accepts a roster with no teams section', () => {
  assert.deepEqual(validateShape(valid), { ok: true });
});

test('teamsById maps every team id to its name', () => {
  const lookup = teamsById(withTeams);
  assert.equal(lookup.get('A').name, 'Confirm Win');
  assert.equal(lookup.get('C').name, '养MVP队');
  assert.equal(lookup.size, 3);
});

test('computeTeamTable shows the team name and keeps the id for the badge', () => {
  const rows = computeTeamTable(withTeams);
  const top = rows.find((r) => r.teamId === 'A');
  assert.equal(top.team, 'Confirm Win');
  assert.equal(top.won, 1);
});

test('computeTeamTable lists a defined team that has not played yet', () => {
  const rows = computeTeamTable(withTeams);
  const idle = rows.find((r) => r.teamId === 'C');
  assert.equal(idle.team, '养MVP队');
  assert.equal(idle.played, 0);
});

test('computeTeamTable falls back to the id when a team has no definition', () => {
  const undefined_teams = {
    players: [{ id: 'p1', ign: 'Alpha', team: 'Team A' }],
    matches: [],
  };
  const rows = computeTeamTable(undefined_teams);
  assert.equal(rows.find((r) => r.teamId === 'Team A').team, 'Team A');
});

test('computeStandings shows the team name, not the id', () => {
  const rows = computeStandings(withTeams);
  assert.equal(rows.find((r) => r.playerId === 'p1').team, 'Confirm Win');
});

test('computeStandings leaves a player with no team on null', () => {
  const rows = computeStandings(valid);
  assert.equal(rows[0].team, null);
});

test('formatTeamLabel writes the id and the name together', () => {
  assert.equal(formatTeamLabel('B', 'GG Bro'), 'Team B - GG Bro');
});

test('formatTeamLabel handles a team with no player', () => {
  assert.equal(formatTeamLabel(null, null), null);
});

test('formatTeamLabel drops the dash when the team has no name of its own', () => {
  assert.equal(formatTeamLabel('B', 'B'), 'Team B');
});

test('leaderSummary carries the team id so the board can label it', () => {
  const summary = leaderSummary(computeStandings(withTeams));
  assert.equal(summary.teamId, 'A');
  assert.equal(summary.team, 'Confirm Win');
});
