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
