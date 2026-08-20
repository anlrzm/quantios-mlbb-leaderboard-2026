import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBracket, validatePlayoffs } from '../playoffs.js';

const seeded = {
  upper: { teams: ['Team A', 'Team B'] },
  lower: { teams: ['Team C', 'Team E'] },
};

const round = (bracket, id) => bracket.find((r) => r.id === id);

test('buildBracket returns the four rounds in bracket order', () => {
  assert.deepEqual(
    buildBracket(seeded).map((r) => r.id),
    ['upper', 'lower', 'decider', 'final'],
  );
});

test('buildBracket marks Bo1 for the opening rounds and Bo3 for the deciding ones', () => {
  const bracket = buildBracket(seeded);
  assert.equal(round(bracket, 'upper').format, 'Bo1');
  assert.equal(round(bracket, 'lower').format, 'Bo1');
  assert.equal(round(bracket, 'decider').format, 'Bo3');
  assert.equal(round(bracket, 'final').format, 'Bo3');
});

test('buildBracket seeds the opening rounds from the declared teams', () => {
  const bracket = buildBracket(seeded);
  assert.deepEqual(
    round(bracket, 'upper').slots.map((s) => s.team),
    ['Team A', 'Team B'],
  );
  assert.deepEqual(
    round(bracket, 'lower').slots.map((s) => s.team),
    ['Team C', 'Team E'],
  );
});

test('buildBracket leaves later rounds unfilled, labelled by where the team comes from', () => {
  const bracket = buildBracket(seeded);
  assert.deepEqual(round(bracket, 'decider').slots, [
    { team: null, from: 'Loser of Upper Bracket' },
    { team: null, from: 'Winner of Lower Bracket' },
  ]);
  assert.deepEqual(round(bracket, 'final').slots, [
    { team: null, from: 'Winner of Upper Bracket' },
    { team: null, from: 'Winner of Decider Match' },
  ]);
});

test('buildBracket drops the upper-bracket loser into the decider', () => {
  const bracket = buildBracket({ ...seeded, upper: { teams: ['Team A', 'Team B'], winner: 'Team A' } });
  assert.equal(round(bracket, 'decider').slots[0].team, 'Team B');
});

test('buildBracket sends the upper-bracket winner straight to the grand final', () => {
  const bracket = buildBracket({ ...seeded, upper: { teams: ['Team A', 'Team B'], winner: 'Team A' } });
  assert.equal(round(bracket, 'final').slots[0].team, 'Team A');
});

test('buildBracket sends the lower-bracket winner to the decider', () => {
  const bracket = buildBracket({ ...seeded, lower: { teams: ['Team C', 'Team E'], winner: 'Team E' } });
  assert.equal(round(bracket, 'decider').slots[1].team, 'Team E');
});

test('buildBracket sends the decider winner to the grand final', () => {
  const bracket = buildBracket({
    upper: { teams: ['Team A', 'Team B'], winner: 'Team A' },
    lower: { teams: ['Team C', 'Team E'], winner: 'Team E' },
    decider: { winner: 'Team B' },
  });
  assert.equal(round(bracket, 'final').slots[1].team, 'Team B');
});

test('buildBracket reports the champion once the final is decided', () => {
  const bracket = buildBracket({
    upper: { teams: ['Team A', 'Team B'], winner: 'Team A' },
    lower: { teams: ['Team C', 'Team E'], winner: 'Team E' },
    decider: { winner: 'Team B' },
    final: { winner: 'Team A' },
  });
  assert.equal(round(bracket, 'final').winner, 'Team A');
});

test('buildBracket tolerates a missing playoffs block', () => {
  const bracket = buildBracket(undefined);
  assert.equal(bracket.length, 4);
  assert.ok(bracket.every((r) => r.slots.every((s) => s.team === null)));
});

test('buildBracket states what winning and losing each round is worth', () => {
  const bracket = buildBracket(seeded);
  assert.match(round(bracket, 'lower').outcomes.loser, /4th/);
  assert.match(round(bracket, 'decider').outcomes.loser, /3rd/);
  assert.match(round(bracket, 'final').outcomes.winner, /Champion/i);
});

test('validatePlayoffs accepts an absent block', () => {
  assert.deepEqual(validatePlayoffs(undefined), { ok: true });
});

test('validatePlayoffs accepts a well-formed block', () => {
  assert.deepEqual(validatePlayoffs(seeded), { ok: true });
});

test('validatePlayoffs rejects an opening round without exactly two teams', () => {
  const r = validatePlayoffs({ upper: { teams: ['Team A'] }, lower: seeded.lower });
  assert.equal(r.ok, false);
  assert.match(r.error, /two/);
});

test('validatePlayoffs rejects the same team twice in one round', () => {
  const r = validatePlayoffs({ upper: { teams: ['Team A', 'Team A'] }, lower: seeded.lower });
  assert.equal(r.ok, false);
  assert.match(r.error, /twice/);
});

test('validatePlayoffs rejects a winner that did not play the round', () => {
  const r = validatePlayoffs({
    upper: { teams: ['Team A', 'Team B'], winner: 'Team C' },
    lower: seeded.lower,
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /Team C/);
});

test('validatePlayoffs rejects a decider winner before the feeding rounds are played', () => {
  const r = validatePlayoffs({ ...seeded, decider: { winner: 'Team B' } });
  assert.equal(r.ok, false);
  assert.match(r.error, /Decider Match/);
});

test('validatePlayoffs rejects a team that is not defined', () => {
  const r = validatePlayoffs(
    { upper: { teams: ['A', 'Z'] }, lower: { teams: ['C', 'E'] } },
    new Set(['A', 'B', 'C', 'E']),
  );
  assert.equal(r.ok, false);
  assert.match(r.error, /Z/);
});

test('validatePlayoffs accepts teams that are all defined', () => {
  const r = validatePlayoffs(
    { upper: { teams: ['A', 'B'] }, lower: { teams: ['C', 'E'] } },
    new Set(['A', 'B', 'C', 'E']),
  );
  assert.deepEqual(r, { ok: true });
});

test('validatePlayoffs skips the roster check when it is not given the teams', () => {
  assert.deepEqual(validatePlayoffs(seeded), { ok: true });
});
