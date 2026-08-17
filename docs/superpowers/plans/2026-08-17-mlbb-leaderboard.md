# MLBB Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages leaderboard for an internal Mobile Legends tournament, where the organiser enters match points by hand and participants view live standings at a public link.

**Architecture:** No backend, no database, no authentication. `data.json` holds the entire tournament state and is committed to the repo. `index.html` fetches it and renders standings. The same page at `#admin` is a JSON generator — it edits state in memory and emits updated `data.json` for the organiser to commit. All ranking logic lives in a pure, DOM-free module so it can be unit tested.

**Tech Stack:** Vanilla ES modules, no framework, no bundler, no dependencies. Node's built-in test runner (`node --test`) for the pure logic. GitHub Pages for hosting.

## Global Constraints

- **Zero runtime dependencies.** No npm packages ship to the browser. No CDN links — the page must work offline from `file://` except for the `data.json` fetch.
- **Inter is self-hosted, never CDN-loaded.** `fonts/inter-latin.woff2` and `fonts/inter-latin-italic.woff2` are already committed. Declare them via `@font-face` in `styles.css`. Never add a `<link>` to Google Fonts.
- **No build step.** Files are served exactly as committed. Use native ES modules (`<script type="module">`).
- **Node 18+** for the test runner (`node --test` with `node:test` and `node:assert/strict`).
- **The canonical test command is bare `node --test`**, which scans the working directory. Do NOT write `node --test test/` — on Windows Node resolves `test` as a module and dies with `MODULE_NOT_FOUND` before running anything. `node --test "test/*.test.js"` also works if a narrower target is ever needed.
- **A root `package.json` containing only `{"type": "module"}`** declares these `.js` files as ES modules. Without it, Node auto-detects ESM in `.js` only from v22.7+, silently breaking the Node 18 floor above. It declares no dependencies, adds no build step, and the browser never fetches it. Do not add dependencies, scripts, or any other field to it.
- **`standings.js` must not touch the DOM or the network.** It is pure functions only. This is what makes it testable.
- **All `data.json` fetches must bust cache:** `fetch('data.json?t=' + Date.now(), { cache: 'no-store' })`. GitHub Pages otherwise serves stale standings for minutes.
- **Colour tokens, exact values:** background gradient `#1a0b2e` → `#0f0620` → `#16092b`; magenta `#d946ef`; cyan `#22d3ee`; violet `#a78bfa`; primary text `#f5f3ff`; muted text `#a78bfa`.
- **Mobile first.** Layout is designed at 360px width and scales up. Never a horizontal scrollbar.
- **Rank display:** standard competition ranking — ties share a rank and the next rank skips (`#3, #3, #5`).
- **Points display:** rounded to at most one decimal place, no trailing `.0`.
- **Commit after every task.** Do not batch commits.

---

## File Structure

| File | Responsibility |
|---|---|
| `standings.js` | Pure logic: shape validation, totals, ranking, number formatting. No DOM, no fetch. |
| `board.js` | Renders the public leaderboard into a container element. Reads data, writes DOM. |
| `admin.js` | Renders the score-entry panel, mutates an in-memory copy of the data, emits JSON. |
| `app.js` | Entry point. Fetches `data.json`, routes on `location.hash`, delegates to `board` or `admin`, renders error states. |
| `styles.css` | All visual styling for both views. |
| `index.html` | Shell. Loads `styles.css` and `app.js`. |
| `data.json` | The tournament state. Committed. |
| `test/standings.test.js` | Unit tests for `standings.js`. |
| `README.md` | The update loop, documented for future-you. |

Task order follows the dependency chain: pure logic first (Task 1–2), then the shell it plugs into (Task 3), then the public view (Task 4–5), then the admin panel (Task 6–7), then deployment docs (Task 8).

---

### Task 1: Shape validation and number formatting

**Files:**
- Create: `standings.js`
- Test: `test/standings.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `validateShape(data)` → `{ ok: true } | { ok: false, error: string }`
  - `formatPoints(n)` → `string`

- [ ] **Step 1: Write the failing tests**

Create `test/standings.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — cannot resolve `../standings.js`.

- [ ] **Step 3: Write the implementation**

Create `standings.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 14 tests.

- [ ] **Step 5: Commit**

```bash
git add standings.js test/standings.test.js
git commit -m "feat: add shape validation and point formatting"
```

---

### Task 2: Standings computation and ranking

**Files:**
- Modify: `standings.js`
- Test: `test/standings.test.js`

**Interfaces:**
- Consumes: `formatPoints` from Task 1.
- Produces:
  - `computeStandings(data)` → `Array<{ playerId, ign, total, matchesPlayed, rank }>`, sorted by rank then IGN. Rank is 1-based, ties share a rank, next rank skips.
  - `findUnknownPlayerRefs(data)` → `Array<{ matchId, matchLabel, playerId }>`
  - `leaderSummary(standings)` → `null | { ign, total, matchesPlayed, tied: boolean, tiedWith: string[], margin: number | null }`

- [ ] **Step 1: Write the failing tests**

Append to `test/standings.test.js`:

```javascript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL — `computeStandings` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `standings.js`:

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: PASS — 30 tests total.

- [ ] **Step 5: Commit**

```bash
git add standings.js test/standings.test.js
git commit -m "feat: add standings computation with competition ranking"
```

---

### Task 3: Page shell, data loading, and error states

**Files:**
- Create: `index.html`, `app.js`, `styles.css`, `data.json`

**Interfaces:**
- Consumes: `validateShape` from Task 1.
- Produces:
  - `app.js` calls `renderBoard(container, data)` (Task 4) and `renderAdmin(container, data)` (Task 6). Both are imported and both take `(HTMLElement, data)` and return `void`. Stub them in this task so the shell runs.
  - `data.json` seeded with two players and one match so there is something to render.

- [ ] **Step 1: Create the seed data file**

Create `data.json`:

```json
{
  "tournament": {
    "name": "Quantios MLBB Challenge",
    "season": "Season 1",
    "updated": "2026-08-17"
  },
  "players": [
    { "id": "p1", "ign": "Zx_Raven" },
    { "id": "p2", "ign": "KyroBlast" }
  ],
  "matches": [
    {
      "id": "m1",
      "label": "Match 1",
      "date": "2026-08-17",
      "results": [
        { "playerId": "p1", "points": 24 },
        { "playerId": "p2", "points": 18 }
      ]
    }
  ]
}
```

- [ ] **Step 2: Create the HTML shell**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quantios MLBB Challenge — Leaderboard</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main id="app" class="app">
      <p class="state-msg">Loading standings…</p>
    </main>
    <script type="module" src="app.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create the base stylesheet**

Create `styles.css`. The `@font-face` block must come first — the font files
are already committed at `fonts/`, self-hosted rather than CDN-loaded so the
board matches the approved mockup without a third-party dependency. Both are
variable fonts spanning weights 400–900, so two files cover every weight the
design uses:

```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
  src: url('fonts/inter-latin.woff2') format('woff2');
}

@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 400 900;
  font-display: swap;
  src: url('fonts/inter-latin-italic.woff2') format('woff2');
}

:root {
  --bg-1: #1a0b2e;
  --bg-2: #0f0620;
  --bg-3: #16092b;
  --magenta: #d946ef;
  --cyan: #22d3ee;
  --violet: #a78bfa;
  --text: #f5f3ff;
  --muted: #a78bfa;
  --surface: rgba(255, 255, 255, 0.04);
  --hairline: rgba(255, 255, 255, 0.12);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(160deg, var(--bg-1) 0%, var(--bg-2) 55%, var(--bg-3) 100%);
  background-attachment: fixed;
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app {
  max-width: 560px;
  margin: 0 auto;
  padding: 28px 16px 64px;
}

.state-msg {
  padding: 32px 18px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.error-card {
  padding: 20px 18px;
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
}

.error-card h2 { margin: 0 0 8px; font-size: 15px; color: #fecaca; }
.error-card p { margin: 0; font-size: 13px; line-height: 1.6; color: #fca5a5; }
```

- [ ] **Step 4: Create the entry point with stubbed views**

Create `app.js`:

```javascript
import { validateShape } from './standings.js';

const container = document.getElementById('app');

function showError(title, detail) {
  container.replaceChildren();
  const card = document.createElement('div');
  card.className = 'error-card';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  card.append(h, p);
  container.append(card);
}

async function loadData() {
  // Cache-bust: GitHub Pages will otherwise serve a stale board for minutes
  // after a commit.
  const response = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Server returned ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function route(data) {
  const isAdmin = location.hash === '#admin';
  container.replaceChildren();
  if (isAdmin) {
    renderAdmin(container, data);
  } else {
    renderBoard(container, data);
  }
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    showError('Could not load the leaderboard', `data.json could not be fetched. ${error.message}`);
    return;
  }

  const check = validateShape(data);
  if (!check.ok) {
    showError('The leaderboard data is malformed', check.error);
    return;
  }

  route(data);
  window.addEventListener('hashchange', () => route(data));
}

main();
```

Add temporary stubs at the top of `app.js`, directly below the import, to be replaced in Tasks 4 and 6:

```javascript
// Replaced in Task 4.
function renderBoard(el, data) {
  el.textContent = `board: ${data.players.length} players`;
}
// Replaced in Task 6.
function renderAdmin(el, data) {
  el.textContent = `admin: ${data.matches.length} matches`;
}
```

- [ ] **Step 5: Verify in a browser**

Run: `python -m http.server 8000` (or `npx serve .`)
Open `http://localhost:8000`. Expected: `board: 2 players`.
Open `http://localhost:8000/#admin`. Expected: `admin: 1 matches`.

A malformed-data check: temporarily change `"players"` to `"playerz"` in `data.json`, reload, and confirm the red error card names the missing field. Revert the change.

- [ ] **Step 6: Commit**

```bash
git add index.html app.js styles.css data.json
git commit -m "feat: add page shell with data loading and error states"
```

---

### Task 4: Public board — header and standings list

**Files:**
- Create: `board.js`
- Modify: `app.js` (remove the `renderBoard` stub, add the import), `styles.css`

**Interfaces:**
- Consumes: `computeStandings`, `formatPoints` from Tasks 1–2.
- Produces: `renderBoard(container, data)` → `void`. Appends the header and the standings list to `container`.

- [ ] **Step 1: Write the board module**

Create `board.js`:

```javascript
import { computeStandings, formatPoints } from './standings.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderHeader(data) {
  const header = el('header', 'lb-header');
  const t = data.tournament ?? {};

  header.append(el('h1', 'lb-title', t.name ?? 'Leaderboard'));

  const bits = [];
  if (t.season) bits.push(t.season);
  bits.push(`${data.matches.length} ${data.matches.length === 1 ? 'match' : 'matches'}`);
  header.append(el('p', 'lb-meta', bits.join(' · ')));

  if (t.updated) header.append(el('p', 'lb-updated', `Updated ${t.updated}`));

  return header;
}

// Ranks 2 and 3 get their own accent; everything below is neutral.
function rowClassFor(rank) {
  if (rank === 2) return 'lb-row r2';
  if (rank === 3) return 'lb-row r3';
  return 'lb-row';
}

function renderRow(row) {
  const li = el('li', rowClassFor(row.rank));
  li.append(el('span', 'lb-rank', String(row.rank)));

  const name = el('span', 'lb-name-wrap');
  name.append(el('span', 'lb-name', row.ign));
  name.append(
    el('span', 'lb-sub', `${row.matchesPlayed} ${row.matchesPlayed === 1 ? 'match' : 'matches'}`),
  );
  li.append(name);

  li.append(el('span', 'lb-pts', formatPoints(row.total)));
  return li;
}

export function renderBoard(container, data) {
  container.append(renderHeader(data));

  const standings = computeStandings(data);

  if (standings.length === 0) {
    container.append(el('p', 'state-msg', 'No players on the roster yet.'));
    return;
  }
  if (data.matches.length === 0) {
    container.append(el('p', 'state-msg', 'No matches recorded yet.'));
  }

  const list = el('ol', 'lb-list');
  for (const row of standings) list.append(renderRow(row));
  container.append(list);
}
```

- [ ] **Step 2: Wire it into the entry point**

In `app.js`, delete the `renderBoard` stub and add to the imports at the top:

```javascript
import { renderBoard } from './board.js';
```

- [ ] **Step 3: Add the board styles**

Append to `styles.css`:

```css
/* ---------- header ---------- */
.lb-header { margin-bottom: 20px; }

.lb-title {
  margin: 0;
  font-size: clamp(22px, 7vw, 30px);
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.02em;
  line-height: 1.1;
  background: linear-gradient(90deg, var(--cyan), var(--magenta));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.lb-meta {
  margin: 6px 0 0;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--muted);
}

.lb-updated { margin: 3px 0 0; font-size: 11px; color: rgba(167, 139, 250, 0.65); }

/* ---------- standings list ---------- */
.lb-list { list-style: none; margin: 0; padding: 0; }

.lb-row {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 11px 13px;
  margin-bottom: 7px;
  background: var(--surface);
  border-left: 2px solid var(--hairline);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 8px 100%);
}

.lb-row.r2 {
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.16), transparent);
  border-left-color: var(--cyan);
}

.lb-row.r3 {
  background: linear-gradient(90deg, rgba(167, 139, 250, 0.14), transparent);
  border-left-color: var(--violet);
}

.lb-rank {
  font-size: 16px;
  font-weight: 900;
  font-style: italic;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
}

.lb-name-wrap { min-width: 0; }

.lb-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.lb-sub { display: block; font-size: 10.5px; color: rgba(167, 139, 250, 0.75); margin-top: 1px; }

.lb-pts {
  font-size: 15px;
  font-weight: 900;
  color: var(--cyan);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Verify in a browser**

Reload `http://localhost:8000`. Expected: the gradient title, `Season 1 · 1 match`, and two rows — `Zx_Raven 24` at rank 1 and `KyroBlast 18` at rank 2, with rank 2 carrying a cyan left border.

Narrow the window to 360px. Expected: no horizontal scrollbar, no clipped text.

- [ ] **Step 5: Commit**

```bash
git add board.js app.js styles.css
git commit -m "feat: render the public standings list"
```

---

### Task 5: Champion spotlight

**Files:**
- Modify: `board.js`, `styles.css`

**Interfaces:**
- Consumes: `leaderSummary` from Task 2.
- Produces: the spotlight banner, rendered above the list. `renderBoard`'s signature does not change.

- [ ] **Step 1: Add the spotlight renderer**

In `board.js`, add `leaderSummary` to the import from `./standings.js`, then add:

```javascript
function renderSpotlight(leader) {
  const box = el('section', 'champ');

  const avatar = el('div', 'champ-av', [...leader.ign][0]?.toUpperCase() ?? '?');
  box.append(avatar);

  const middle = el('div', 'champ-mid');
  middle.append(el('div', 'champ-label', leader.tied ? 'Joint Leader' : 'Current Leader'));
  middle.append(el('div', 'champ-name', leader.ign));

  const played = `${leader.matchesPlayed} ${leader.matchesPlayed === 1 ? 'match' : 'matches'}`;
  let detail = played;
  if (leader.tied) {
    detail +=
      leader.tiedWith.length === 1
        ? ` · Tied with ${leader.tiedWith[0]}`
        : ` · Tied with ${leader.tiedWith.length} players`;
  } else if (leader.margin !== null) {
    detail += ` · +${formatPoints(leader.margin)} ahead`;
  }
  middle.append(el('div', 'champ-sub', detail));
  box.append(middle);

  const points = el('div', 'champ-pts');
  points.append(el('div', 'champ-pts-val', formatPoints(leader.total)));
  points.append(el('div', 'champ-pts-label', 'PTS'));
  box.append(points);

  return box;
}
```

- [ ] **Step 2: Render the spotlight and drop the leader from the list**

Replace the body of `renderBoard` after the empty-roster guard with:

```javascript
  if (data.matches.length === 0) {
    container.append(el('p', 'state-msg', 'No matches recorded yet.'));
    const list = el('ol', 'lb-list');
    for (const row of standings) list.append(renderRow(row));
    container.append(list);
    return;
  }

  const leader = leaderSummary(standings);
  container.append(renderSpotlight(leader));

  // The spotlight replaces the leader's row. Co-leaders on a tie still appear
  // in the list at rank 1.
  const rest = standings.slice(1);
  if (rest.length > 0) {
    const list = el('ol', 'lb-list');
    for (const row of rest) list.append(renderRow(row));
    container.append(list);
  }
```

- [ ] **Step 3: Add the spotlight styles**

Append to `styles.css`:

```css
/* ---------- champion spotlight ---------- */
.champ {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 15px 15px 14px;
  margin-bottom: 14px;
  background: linear-gradient(105deg, rgba(217, 70, 239, 0.3), rgba(34, 211, 238, 0.09));
  border-left: 3px solid var(--magenta);
  box-shadow: 0 0 26px rgba(217, 70, 239, 0.24);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 11px 100%);
}

.champ-av {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(135deg, var(--magenta), var(--cyan));
}

.champ-mid { min-width: 0; }

.champ-label {
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 800;
  color: #f0abfc;
}

.champ-name {
  font-size: 19px;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -0.01em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.champ-sub { font-size: 10.5px; color: #c4b5fd; margin-top: 2px; }

.champ-pts { margin-left: auto; text-align: right; flex-shrink: 0; }

.champ-pts-val {
  font-size: 26px;
  font-weight: 900;
  font-style: italic;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.champ-pts-label {
  font-size: 8.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: #f0abfc;
  margin-top: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .champ { animation: champ-in 0.45s ease-out both; }
  @keyframes champ-in {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: none; }
  }
}
```

- [ ] **Step 4: Verify each spotlight state in a browser**

Reload. Expected: `Zx_Raven` in the spotlight reading `1 match · +6 ahead`, `128`-style large points, and only `KyroBlast` in the list below.

Now check the edge cases by editing `data.json`, reloading, then reverting each time:

1. **Tie for first** — set `KyroBlast` to `24`. Expected: label reads `JOINT LEADER`, sub-line reads `1 match · Tied with KyroBlast`, and KyroBlast still appears below at rank 1.
2. **No matches** — set `"matches": []`. Expected: `No matches recorded yet.`, no spotlight, both players listed at rank 1 with 0.
3. **Single player** — remove `p2` from `players` and from the match results. Expected: spotlight renders with no `+X ahead` and an empty list below.
4. **360px width** — confirm the name and points do not collide.

Revert `data.json` to the Task 3 seed.

- [ ] **Step 5: Commit**

```bash
git add board.js styles.css
git commit -m "feat: add champion spotlight with tie and empty states"
```

---

### Task 6: Admin panel — roster and JSON output

**Files:**
- Create: `admin.js`
- Modify: `app.js` (remove the `renderAdmin` stub, add the import), `styles.css`

**Interfaces:**
- Consumes: `findUnknownPlayerRefs` from Task 2.
- Produces: `renderAdmin(container, data)` → `void`. Holds a deep copy of `data` in module scope, mutates it, and re-renders. Never mutates the caller's object.

- [ ] **Step 1: Write the admin module with roster management**

Create `admin.js`:

```javascript
import { findUnknownPlayerRefs } from './standings.js';

// A working copy. The fetched object is never mutated, so leaving #admin and
// coming back reloads clean state from data.json.
let draft = null;
let host = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Next free id: one past the highest numeric suffix currently in the list. */
function nextId(items, prefix) {
  const highest = items.reduce((max, item) => {
    const n = Number(String(item.id).slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `${prefix}${highest + 1}`;
}

function matchesUsingPlayer(playerId) {
  return draft.matches.filter((m) => m.results.some((r) => r.playerId === playerId));
}

function addPlayer(rawIgn) {
  const ign = rawIgn.trim();
  if (ign === '') return 'Enter an in-game name.';
  const clash = draft.players.some((p) => p.ign.trim().toLowerCase() === ign.toLowerCase());
  if (clash) return `"${ign}" is already on the roster.`;
  draft.players.push({ id: nextId(draft.players, 'p'), ign });
  return null;
}

function removePlayer(playerId) {
  const used = matchesUsingPlayer(playerId);
  if (used.length > 0) {
    return `Still scored in: ${used.map((m) => m.label).join(', ')}. Remove those results first.`;
  }
  draft.players = draft.players.filter((p) => p.id !== playerId);
  return null;
}

function renderRoster() {
  const section = el('section', 'ad-section');
  section.append(el('h2', 'ad-h2', 'Roster'));

  const list = el('ul', 'ad-list');
  for (const player of draft.players) {
    const li = el('li', 'ad-item');

    const input = el('input', 'ad-input');
    input.value = player.ign;
    input.setAttribute('aria-label', `Name for ${player.ign}`);
    input.addEventListener('change', () => {
      player.ign = input.value.trim() || player.ign;
      draw();
    });
    li.append(input);

    const remove = el('button', 'ad-btn ad-btn-danger', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      const error = removePlayer(player.id);
      draw(error);
    });
    li.append(remove);

    list.append(li);
  }
  section.append(list);

  const row = el('div', 'ad-add');
  const field = el('input', 'ad-input');
  field.placeholder = 'New player IGN';
  field.setAttribute('aria-label', 'New player IGN');
  const add = el('button', 'ad-btn', 'Add player');
  add.type = 'button';
  const submit = () => {
    const error = addPlayer(field.value);
    if (!error) field.value = '';
    draw(error);
  };
  add.addEventListener('click', submit);
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  row.append(field, add);
  section.append(row);

  return section;
}

function renderOutput() {
  const section = el('section', 'ad-section');
  section.append(el('h2', 'ad-h2', 'Updated data.json'));
  section.append(
    el('p', 'ad-hint', 'Copy this, paste it into data.json on GitHub, and commit.'),
  );

  const orphans = findUnknownPlayerRefs(draft);
  if (orphans.length > 0) {
    const warn = el('div', 'ad-warn');
    warn.append(el('strong', null, 'Unknown player references: '));
    warn.append(
      document.createTextNode(
        orphans.map((o) => `${o.playerId} in ${o.matchLabel}`).join('; ') + '.',
      ),
    );
    section.append(warn);
  }

  const json = JSON.stringify(draft, null, 2);

  const area = el('textarea', 'ad-json');
  area.readOnly = true;
  area.value = json;
  area.rows = 14;
  section.append(area);

  const bar = el('div', 'ad-add');

  const copy = el('button', 'ad-btn', 'Copy JSON');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = 'Copied';
    } catch {
      area.select();
      copy.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => {
      copy.textContent = 'Copy JSON';
    }, 1800);
  });
  bar.append(copy);

  const download = el('button', 'ad-btn', 'Download data.json');
  download.type = 'button';
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data.json';
    link.click();
    URL.revokeObjectURL(url);
  });
  bar.append(download);

  section.append(bar);
  return section;
}

function draw(error) {
  host.replaceChildren();

  const header = el('header', 'lb-header');
  header.append(el('h1', 'ad-title', 'Score entry'));
  header.append(el('p', 'lb-meta', 'Nothing here saves until you commit data.json'));
  host.append(header);

  const back = el('a', 'ad-back', '← Back to the leaderboard');
  back.href = '#';
  host.append(back);

  if (error) host.append(el('div', 'ad-error', error));

  host.append(renderRoster());
  host.append(renderMatches());
  host.append(renderOutput());
}

export function renderAdmin(container, data) {
  host = container;
  draft = structuredClone(data);
  draft.tournament = draft.tournament ?? {};
  draw();
}
```

Note `renderMatches()` is referenced here and defined in Task 7. Add this placeholder immediately above `draw()` so this task runs standalone; Task 7 replaces it:

```javascript
// Replaced in Task 7.
function renderMatches() {
  return el('section', 'ad-section');
}
```

- [ ] **Step 2: Wire it into the entry point**

In `app.js`, delete the `renderAdmin` stub and add to the imports:

```javascript
import { renderAdmin } from './admin.js';
```

- [ ] **Step 3: Add the admin styles**

Append to `styles.css`:

```css
/* ---------- admin ---------- */
.ad-title { margin: 0; font-size: 22px; font-weight: 900; font-style: italic; }
.ad-back { display: inline-block; margin-bottom: 18px; font-size: 12px; color: var(--cyan); text-decoration: none; }
.ad-back:hover { text-decoration: underline; }

.ad-section {
  margin-bottom: 22px;
  padding: 15px 14px 16px;
  background: rgba(255, 255, 255, 0.035);
  border-radius: 10px;
  border: 1px solid var(--hairline);
}

.ad-h2 { margin: 0 0 4px; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.ad-hint { margin: 0 0 12px; font-size: 11.5px; color: rgba(167, 139, 250, 0.75); line-height: 1.5; }

.ad-list { list-style: none; margin: 10px 0; padding: 0; }
.ad-item { display: flex; gap: 8px; margin-bottom: 7px; align-items: center; }

.ad-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text);
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid var(--hairline);
  border-radius: 6px;
}

.ad-input:focus { outline: 2px solid var(--cyan); outline-offset: 1px; }

.ad-btn {
  padding: 8px 13px;
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  color: var(--text);
  background: rgba(217, 70, 239, 0.24);
  border: 1px solid rgba(217, 70, 239, 0.5);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.ad-btn:hover { background: rgba(217, 70, 239, 0.38); }
.ad-btn-danger { background: rgba(239, 68, 68, 0.16); border-color: rgba(239, 68, 68, 0.45); }
.ad-btn-danger:hover { background: rgba(239, 68, 68, 0.3); }

.ad-add { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }

.ad-error, .ad-warn {
  padding: 9px 11px;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}

.ad-error { background: rgba(239, 68, 68, 0.14); border-left: 3px solid #ef4444; color: #fca5a5; }
.ad-warn { background: rgba(245, 158, 11, 0.14); border-left: 3px solid #f59e0b; color: #fcd34d; }

.ad-json {
  width: 100%;
  padding: 10px;
  font-family: 'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
  font-size: 11.5px;
  line-height: 1.5;
  color: #d8b4fe;
  background: rgba(0, 0, 0, 0.38);
  border: 1px solid var(--hairline);
  border-radius: 6px;
  resize: vertical;
}
```

- [ ] **Step 4: Verify in a browser**

Open `http://localhost:8000/#admin`. Expected: the roster lists both players, and the JSON textarea shows the full document.

Check these behaviours:
1. Add a player named `TestGuy`. Expected: appears in the roster and in the JSON.
2. Add `testguy` again. Expected: red error, `"testguy" is already on the roster.`
3. Remove `TestGuy`. Expected: gone from both.
4. Try to remove `Zx_Raven`. Expected: red error naming `Match 1`.
5. Click **Copy JSON**. Expected: the label flips to `Copied`, and pasting elsewhere yields the document.
6. Click **Download data.json**. Expected: a file downloads.
7. Click **← Back to the leaderboard**. Expected: the board renders, with none of your admin edits applied.

- [ ] **Step 5: Commit**

```bash
git add admin.js app.js styles.css
git commit -m "feat: add admin roster management and JSON output"
```

---

### Task 7: Admin panel — match entry

**Files:**
- Modify: `admin.js`

**Interfaces:**
- Consumes: `draft`, `el`, `nextId`, `draw` from Task 6.
- Produces: `renderMatches()` → `HTMLElement`, replacing the Task 6 placeholder.

- [ ] **Step 1: Write the validation helper**

Add to `admin.js`, above the placeholder `renderMatches`:

```javascript
/** Returns an error string, or null when the match is publishable. */
function validateMatch(match) {
  if (match.label.trim() === '') return 'Every match needs a label.';

  const duplicateLabel = draft.matches.some(
    (m) => m !== match && m.label.trim().toLowerCase() === match.label.trim().toLowerCase(),
  );
  if (duplicateLabel) return `Another match is already called "${match.label}".`;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date) || Number.isNaN(Date.parse(match.date))) {
    return `"${match.label}" needs a date as YYYY-MM-DD.`;
  }

  const seen = new Set();
  for (const result of match.results) {
    if (seen.has(result.playerId)) {
      const who = draft.players.find((p) => p.id === result.playerId);
      return `${who?.ign ?? result.playerId} appears twice in "${match.label}".`;
    }
    seen.add(result.playerId);

    if (!Number.isFinite(result.points)) {
      return `Points in "${match.label}" must be numbers.`;
    }
  }
  return null;
}

/** First error across all matches, or null. */
function validateAll() {
  for (const match of draft.matches) {
    const error = validateMatch(match);
    if (error) return error;
  }
  return null;
}
```

- [ ] **Step 2: Replace the placeholder with the real match renderer**

Delete the Task 6 placeholder `renderMatches` and add:

```javascript
function renderResultRow(match, result) {
  const row = el('div', 'ad-result');

  const select = el('select', 'ad-input');
  select.setAttribute('aria-label', 'Player');
  for (const player of draft.players) {
    const option = el('option', null, player.ign);
    option.value = player.id;
    if (player.id === result.playerId) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => {
    result.playerId = select.value;
    draw();
  });
  row.append(select);

  const points = el('input', 'ad-input ad-points');
  points.type = 'number';
  points.step = 'any';
  points.value = String(result.points);
  points.setAttribute('aria-label', 'Points');
  points.addEventListener('change', () => {
    result.points = points.value === '' ? 0 : Number(points.value);
    draw();
  });
  row.append(points);

  const remove = el('button', 'ad-btn ad-btn-danger', '×');
  remove.type = 'button';
  remove.setAttribute('aria-label', 'Remove this result');
  remove.addEventListener('click', () => {
    match.results = match.results.filter((r) => r !== result);
    draw();
  });
  row.append(remove);

  return row;
}

function renderMatch(match) {
  const card = el('div', 'ad-match');

  const head = el('div', 'ad-match-head');

  const label = el('input', 'ad-input');
  label.value = match.label;
  label.setAttribute('aria-label', 'Match label');
  label.addEventListener('change', () => {
    match.label = label.value;
    draw();
  });
  head.append(label);

  const date = el('input', 'ad-input ad-date');
  date.type = 'date';
  date.value = match.date;
  date.setAttribute('aria-label', 'Match date');
  date.addEventListener('change', () => {
    match.date = date.value;
    draw();
  });
  head.append(date);

  const kill = el('button', 'ad-btn ad-btn-danger', 'Delete');
  kill.type = 'button';
  kill.addEventListener('click', () => {
    draft.matches = draft.matches.filter((m) => m !== match);
    draw();
  });
  head.append(kill);

  card.append(head);

  for (const result of match.results) card.append(renderResultRow(match, result));

  if (match.results.length === 0) {
    card.append(el('p', 'ad-hint', 'No results yet — this match scores nobody.'));
  }

  const add = el('button', 'ad-btn', 'Add player result');
  add.type = 'button';
  add.disabled = draft.players.length === 0;
  add.addEventListener('click', () => {
    const used = new Set(match.results.map((r) => r.playerId));
    const free = draft.players.find((p) => !used.has(p.id)) ?? draft.players[0];
    match.results.push({ playerId: free.id, points: 0 });
    draw();
  });
  card.append(add);

  return card;
}

function renderMatches() {
  const section = el('section', 'ad-section');
  section.append(el('h2', 'ad-h2', 'Matches'));

  for (const match of draft.matches) section.append(renderMatch(match));

  if (draft.matches.length === 0) {
    section.append(el('p', 'ad-hint', 'No matches yet.'));
  }

  const add = el('button', 'ad-btn', 'Add match');
  add.type = 'button';
  add.addEventListener('click', () => {
    draft.matches.push({
      id: nextId(draft.matches, 'm'),
      label: `Match ${draft.matches.length + 1}`,
      date: new Date().toISOString().slice(0, 10),
      results: [],
    });
    draw();
  });
  section.append(add);

  return section;
}
```

- [ ] **Step 3: Block the JSON output while validation fails**

In `renderOutput`, replace `const json = JSON.stringify(draft, null, 2);` with:

```javascript
  const blocking = validateAll();
  if (blocking) {
    section.append(el('div', 'ad-error', `Fix this before publishing: ${blocking}`));
    section.append(
      el('p', 'ad-hint', 'The JSON is hidden until the data is valid, so a broken file cannot be committed by accident.'),
    );
    return section;
  }

  const json = JSON.stringify(draft, null, 2);
```

Also stamp the update date so it is never manually maintained. In `renderOutput`, immediately before `const blocking = validateAll();`, add:

```javascript
  draft.tournament.updated = new Date().toISOString().slice(0, 10);
```

- [ ] **Step 4: Add the match-entry styles**

Append to `styles.css`:

```css
.ad-match {
  padding: 12px;
  margin-bottom: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid var(--hairline);
}

.ad-match-head { display: flex; gap: 7px; margin-bottom: 10px; flex-wrap: wrap; }
.ad-result { display: flex; gap: 7px; margin-bottom: 6px; align-items: center; }
.ad-points { max-width: 92px; flex: 0 0 auto; }
.ad-date { max-width: 150px; flex: 0 0 auto; }
.ad-btn:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 5: Verify in a browser**

Reload `http://localhost:8000/#admin`. Check each:

1. **Add match** → a new card appears, dated today, labelled `Match 2`.
2. **Add player result** twice → two rows; set different players and points.
3. **Duplicate player** — set both rows to the same player. Expected: JSON hidden, error naming the player twice in that match.
4. **Duplicate label** — rename `Match 2` to `Match 1`. Expected: JSON hidden, error about the clashing name.
5. **Empty label** — clear a label. Expected: JSON hidden, `Every match needs a label.`
6. **Valid again** — fix all three. Expected: JSON reappears, `tournament.updated` shows today.
7. **Round trip** — copy the JSON, paste it over `data.json`, reload the board. Expected: standings reflect the new match.
8. **360px width** — confirm the match cards wrap without a horizontal scrollbar.

- [ ] **Step 6: Commit**

```bash
git add admin.js styles.css
git commit -m "feat: add match entry with validation gating the JSON output"
```

---

### Task 8: README and GitHub Pages deployment

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the finished app.
- Produces: a live public URL.

- [ ] **Step 1: Run the full test suite**

Run: `node --test`
Expected: PASS, 30 tests, zero failures. Do not proceed past a failure.

- [ ] **Step 2: Write the README**

Create `README.md`:

````markdown
# Quantios MLBB Challenge — Leaderboard

A static leaderboard for the internal Mobile Legends tournament. No backend,
no database, no login. `data.json` is the entire tournament.

**Live board:** https://<user>.github.io/<repo>/

## Updating scores after a match

1. Open the board and add `#admin` to the URL.
2. Add any new players to the roster.
3. Click **Add match**, then **Add player result** for each player who scored.
4. Fix anything flagged in red — the JSON stays hidden until the data is valid.
5. Click **Copy JSON**.
6. In GitHub, open `data.json` → pencil icon → select all → paste → **Commit changes**.
7. The live board updates in about 20 seconds.

Nothing in the admin panel saves on its own. Closing the tab without
committing loses the edits.

## Why there is no password

The admin panel only generates text. It cannot write to this repository, so
anyone who finds `#admin` can edit their own browser tab and change nothing
that anyone else sees. Publishing requires commit access to this repo, which
is the real permission boundary.

## Running locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly as a `file://` URL will not work — the browser
blocks the `data.json` fetch.

## Tests

```bash
node --test
```

Covers `standings.js`, which holds all the ranking logic. Rendering is
verified by eye.

## Layout

| File | Does |
|---|---|
| `standings.js` | Totals, ranking, validation, number formatting. Pure — no DOM. |
| `board.js` | The public leaderboard. |
| `admin.js` | The score-entry panel. |
| `app.js` | Loads `data.json`, routes on the URL hash, renders errors. |
| `data.json` | The tournament. |
````

Replace `<user>` and `<repo>` with the real values once Pages is enabled.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with the score update loop"
```

- [ ] **Step 4: Push and enable GitHub Pages**

```bash
gh repo create <repo-name> --public --source=. --remote=origin --push
```

Then enable Pages:

```bash
gh api -X POST repos/{owner}/<repo-name>/pages -f 'source[branch]=main' -f 'source[path]=/'
```

If that returns a 409, Pages is already enabled — carry on.

- [ ] **Step 5: Verify the deployment**

Wait roughly a minute, then open `https://<user>.github.io/<repo>/`.

Expected: the board renders with the seeded data. Confirm on a phone, not just a narrow desktop window — check that the spotlight and rows read cleanly and nothing scrolls sideways.

Then verify the full update loop end to end: open `#admin` on the live URL, add a match, copy the JSON, commit it through GitHub's web editor, wait, hard-reload the board, and confirm the new standings appear. This is the one flow that must work, and it is the only way to prove cache-busting is doing its job.

- [ ] **Step 6: Update the README with the real URL**

```bash
git add README.md
git commit -m "docs: record the live Pages URL"
git push
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Non-goals (no OCR, backend, auth, teams, stats) | Respected throughout; no task introduces any |
| Static Pages architecture, file layout | Task 3, 8 |
| Cache busting on `data.json` | Task 3 Step 4; verified Task 8 Step 5 |
| Admin needs no password, rationale | Task 6; documented Task 8 |
| Data model, matches stored not totals | Task 2, 3 |
| Opaque player IDs, `nextId` allocation | Task 6 Step 1 |
| Points: finite, negative, one decimal | Task 1 (`formatPoints`), Task 7 (validation) |
| Ranking: desc, shared ranks, skip, alpha tiebreak | Task 2 |
| Player in no match totals 0, ranked last, not hidden | Task 2 |
| Neon Arena visuals, exact colour tokens | Task 4, 5 (tokens in Global Constraints) |
| Header: gradient title, season, match count, updated | Task 4 |
| Champion spotlight, avatar, label, margin | Task 5 |
| Spotlight tie / no-match / single-player states | Task 5 Step 4 |
| Ranks 2 and 3 accented, rest neutral | Task 4 (`rowClassFor`) |
| Mobile first at 360px | Tasks 4, 5, 7 verification steps |
| Accessibility: `<ol>`, contrast, not colour-alone | Task 4 (`<ol>`, rank rendered as text) |
| Roster add / rename / remove, removal blocked when scored | Task 6 |
| Match add / edit / delete | Task 7 |
| Output: pretty JSON, Copy, Download | Task 6 |
| All six validation rules | Task 6 (IGN uniqueness), Task 7 (the other five) |
| Zero-result match warns but does not block | Task 7 (`ad-hint`, absent from `validateMatch`) |
| Error states: fetch fail, bad JSON, wrong shape | Task 3 |
| Unknown `playerId` ignored publicly, warned in admin | Task 2, 6 |
| Missing `tournament.updated` degrades gracefully | Task 4 (`if (t.updated)`) |
| All nine test cases | Tasks 1, 2 |
| `.superpowers/` gitignored | Already committed with the spec |
| README documents the update loop | Task 8 |

No gaps.

**Placeholder scan:** No TBD/TODO. The two deliberate stubs (Task 3's `renderBoard`/`renderAdmin`, Task 6's `renderMatches`) each name the task that replaces them and carry working bodies so every task runs standalone.

**Type consistency:** `renderBoard(container, data)` and `renderAdmin(container, data)` match between Task 3's stubs and Tasks 4/6. `el(tag, className, text)` is defined separately in `board.js` and `admin.js` — intentional duplication of five lines rather than a shared module for one helper. `formatPoints` is imported in both `board.js` (Task 4) and used in `renderSpotlight` (Task 5) — Task 5 adds only `leaderSummary` to the existing import, which is correct since Task 4 already imports `formatPoints`. `nextId(items, prefix)` is called with `'p'` and `'m'` in Tasks 6 and 7 consistently. `draw(error)` takes one optional argument everywhere.
