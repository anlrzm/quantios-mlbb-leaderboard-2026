# Quantios MLBB Challenge — Leaderboard

A static leaderboard for the internal Mobile Legends tournament. No backend,
no database, no login. `data.json` is the entire tournament.

**Live board:** https://anlrzm.github.io/quantios-mlbb-leaderboard-2026/

## Updating scores after a match

1. Open the board and add `#admin` to the URL.
2. Add any new players to the roster.
3. Click **Add match**, then **Add player result** for each player who scored.
4. Fix anything flagged in red — the JSON output stays hidden entirely while
   any validation error is unresolved, so a broken file can't be copied by
   accident.
5. Click **Copy JSON**.
6. Open [`data.json` in the GitHub editor][edit] → select all → paste →
   **Commit changes**.

[edit]: https://github.com/anlrzm/quantios-mlbb-leaderboard-2026/edit/main/data.json
7. The live board updates in about 20 seconds.

Nothing in the admin panel saves on its own. Closing the tab without
committing loses the edits.

## Adding post-match screenshots

1. Drop the image in `screenshots/`, named `<TeamA>v<TeamB>_<D>-<M>.<ext>` —
   e.g. `AvB_17-8.jpg`. The year comes from `tournament.updated` in
   `data.json`.
2. Run `node tools/build-screenshots.mjs`. A static site cannot list a
   directory, so the gallery reads the `screenshots.json` manifest this
   writes. A file whose name does not parse is reported and left out.
3. Commit both the image and `screenshots.json`.

These images are published with the site — anyone with the URL can see
them.

The burger menu does not list score entry — only the leaderboard and the
screenshots. `#admin` still works when typed on the URL; it is unadvertised
rather than protected, for the reason below.

## Why there is no password

The admin panel only generates text — a block of JSON you copy out by hand.
It cannot write to this repository on its own, so anyone who finds `#admin`
can only edit their own browser tab; nothing changes for anyone else unless
that JSON is pasted into `data.json` and committed. The real permission
boundary is commit access to this repo, which GitHub already gates. A
password on the admin panel would just be a second, weaker lock on the same
door.

## Running locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly as a `file://` URL does not work — the browser
blocks the `data.json` fetch. You need a local server, even a trivial one,
for `fetch` to succeed.

## Tests

```bash
node --test
```

Expect 49 passing, 0 failing. This scans the working directory for test
files, so run it from the repo root. (`node --test test/` looks like it
should work but resolves `test` as a module path and fails immediately with
`MODULE_NOT_FOUND` on Windows — don't use it.)

The suite covers the pure logic with no DOM: `standings.js` (totals,
ranking, tie-breaking, prize places, validation) and the grouping and
date-formatting half of `gallery.js`. `admin.js`, `board.js` and `nav.js`
have no automated tests; their behavior is verified by eye against the
running app.

## Layout

| File | Does |
|---|---|
| `standings.js` | Totals, ranking, validation, number formatting. Pure — no DOM. |
| `board.js` | The public leaderboard. |
| `admin.js` | The score-entry panel. |
| `teams.js` | The Team Standings page. The table is derived, never hand-kept. |
| `gallery.js` | The Post-Match Screenshots page. Grouping and date formatting are pure. |
| `nav.js` | The burger menu shared by every page. Phase sections live in `SECTIONS`. |
| `app.js` | Loads `data.json`, routes on the URL hash, renders errors. |
| `data.json` | The tournament: roster (with teams), matches, results. |
| `screenshots.json` | Generated manifest of `screenshots/`. Do not hand-edit. |
| `tools/build-screenshots.mjs` | Regenerates `screenshots.json`. |

Team standings come from the `teams` and `winner` fields on each match, so
recording a result keeps the table in step with the board. A match without
those fields still scores players but counts for nobody in the table. Win =
2 points via `WIN_POINTS`, top 4 qualify via `QUALIFY_PLACES`, both in
`standings.js`.

The top five places are prize places: the board sets them apart and draws a
line beneath them. Change `PRIZE_PLACES` in `standings.js` to move it.
