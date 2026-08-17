/**
 * Pure tournament logic. No DOM. No network. Everything here is unit tested.
 */

/**
 * Checks that a parsed data.json has the shape the rest of the app assumes.
 * Returns {ok:true} or {ok:false, error} — never throws.
 */
export function validateShape(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Expected the document to be an object.' };
  }
  if (!Array.isArray(data.players)) {
    return { ok: false, error: 'Missing or invalid "players" — expected an array.' };
  }
  for (const p of data.players) {
    if (p === null || typeof p !== 'object') {
      return { ok: false, error: 'Every entry in "players" must be an object.' };
    }
    if (typeof p.id !== 'string' || p.id === '') {
      return { ok: false, error: 'Every player needs a non-empty string "id".' };
    }
    if (typeof p.ign !== 'string') {
      return { ok: false, error: `Player "${p.id}" needs a string "ign".` };
    }
  }
  if (!Array.isArray(data.matches)) {
    return { ok: false, error: 'Missing or invalid "matches" — expected an array.' };
  }
  for (const m of data.matches) {
    if (m === null || typeof m !== 'object') {
      return { ok: false, error: 'Every entry in "matches" must be an object.' };
    }
    if (!Array.isArray(m.results)) {
      return { ok: false, error: `Match "${m.id ?? '?'}" needs an array "results".` };
    }
  }
  return { ok: true };
}

/**
 * Renders a point value for display: at most one decimal, no trailing ".0",
 * and no floating-point artefacts (0.1 + 0.2 renders as "0.3").
 */
export function formatPoints(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Builds the ranked table. Results referencing an unknown playerId are
 * ignored here so a bad reference degrades one row rather than the page —
 * findUnknownPlayerRefs surfaces them in the admin panel instead.
 */
export function computeStandings(data) {
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const acc = new Map(
    data.players.map((p) => [p.id, { playerId: p.id, ign: p.ign, total: 0, matchesPlayed: 0 }]),
  );

  for (const match of data.matches) {
    for (const result of match.results) {
      if (!byId.has(result.playerId)) continue;
      const row = acc.get(result.playerId);
      row.total += Number(result.points) || 0;
      row.matchesPlayed += 1;
    }
  }

  const rows = [...acc.values()].sort(
    (a, b) => b.total - a.total || a.ign.toLowerCase().localeCompare(b.ign.toLowerCase()),
  );

  // Standard competition ranking: equal totals share a rank, the next rank
  // skips by the size of the tied group.
  let rank = 0;
  let previousTotal = null;
  rows.forEach((row, index) => {
    if (row.total !== previousTotal) {
      rank = index + 1;
      previousTotal = row.total;
    }
    row.rank = rank;
  });

  return rows;
}

/** Lists results pointing at playerIds that are not on the roster. */
export function findUnknownPlayerRefs(data) {
  const known = new Set(data.players.map((p) => p.id));
  const orphans = [];
  for (const match of data.matches) {
    for (const result of match.results) {
      if (!known.has(result.playerId)) {
        orphans.push({ matchId: match.id, matchLabel: match.label, playerId: result.playerId });
      }
    }
  }
  return orphans;
}

/**
 * Describes the champion-spotlight state. Returns null when there is nobody
 * to feature. On a tie for first, one player is featured (the top of the
 * sorted order) and the rest are named in tiedWith.
 */
export function leaderSummary(standings) {
  if (standings.length === 0) return null;

  const leader = standings[0];
  const tiedWith = standings.filter((r) => r.rank === 1 && r.playerId !== leader.playerId);
  const runnerUp = standings.find((r) => r.total < leader.total);

  return {
    ign: leader.ign,
    total: leader.total,
    matchesPlayed: leader.matchesPlayed,
    tied: tiedWith.length > 0,
    tiedWith: tiedWith.map((r) => r.ign),
    margin: tiedWith.length > 0 || !runnerUp ? null : leader.total - runnerUp.total,
  };
}
