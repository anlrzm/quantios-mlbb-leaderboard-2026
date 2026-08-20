# Quantios MLBB Challenge — Leaderboard

A static leaderboard for the internal Mobile Legends tournament. No backend,
no database, no login. `data.json` is the entire tournament.

**Live board:** https://anlrzm.github.io/quantios-mlbb-leaderboard-2026/

## Teams

Teams are defined once, at the top of `data.json`, and referenced everywhere
else by id:

```json
"teams": [
  { "id": "A", "name": "Confirm Win" },
  { "id": "B", "name": "GG Bro" }
]
```

The id is the letter the screenshot filenames already use (`AvB_17-8.png`) and
the letter shown in the badge on the standings and play-off pages. Everything
else — `players[].team`, `matches[].teams`, `matches[].winner`, and the
`playoffs` block — stores that id, so **renaming a team is a one-line edit**
and nothing else has to change.

Once `teams` is present, every reference has to resolve to a defined id;
`validateShape` rejects the file otherwise. That is deliberate — a typo used
to invent a team that then sat on the standings table with nobody in it. The
admin panel picks the team from a dropdown for the same reason.

The leaderboard labels a player's team `Team A - Confirm Win`, pairing the id
with the name; the standings and play-off pages put the id in the badge and
the name beside it. The screenshot and livestream tiles stack the two sides of
a match-up, each as a badge and a name.

The section is optional. A `data.json` without it still renders, with the raw
team value standing in for the name.

## Updating scores after a match

1. Open the board and add `#admin` to the URL.
2. Add any new players to the roster, picking their team from the dropdown.
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
   e.g. `AvB_17-8.jpg`. A play-off screenshot carries a phase prefix:
   `phase2_AvB_21-8.png`. No prefix means Phase 1. The year comes from
   `tournament.updated` in `data.json`.
2. Run `node tools/build-screenshots.mjs`. A static site cannot list a
   directory, so each gallery reads a manifest this writes — `screenshots.json`
   for Phase 1, `screenshots-phase2.json` for Phase 2. Every phase in `PHASES`
   gets a manifest even while it is still empty, so its page loads a blank
   gallery instead of a 404. A file whose name does not parse is reported and
   left out.

   The manifest stores the two **team ids** from the filename, not a finished
   caption. The gallery resolves them against `data.json` when it draws the
   tile, so renaming a team updates every caption without regenerating.
3. Commit the image and every manifest the run changed.

All phases share the one `screenshots/` folder; the prefix is what sorts them
onto the right page. When Phase 3 starts, add `3` to `PHASES` in
`tools/build-screenshots.mjs` and give it a menu entry and a route.

These images are published with the site — anyone with the URL can see
them.

The burger menu does not list score entry — only the Phase 1 and Phase 2
pages. `#admin` still works when typed on the URL; it is unadvertised
rather than protected, for the reason below.

## Recording play-off results

The bracket is four teams, double elimination, and lives in the `playoffs`
block of `data.json`:

```json
"playoffs": {
  "upper": { "teams": ["Team A", "Team B"], "winner": "Team A" },
  "lower": { "teams": ["Team C", "Team E"] },
  "decider": {},
  "final": {}
}
```

Only the two opening rounds name their teams. Everything after that is
derived — add a `"winner"` to a round and the next one fills itself in:

| Round | Format | Winner | Loser |
|---|---|---|---|
| Upper Bracket | Bo1 | Grand Final | Decider Match |
| Lower Bracket | Bo1 | Decider Match | 4th place |
| Decider Match | Bo3 | Grand Final | 3rd place |
| Grand Final | Bo3 | Champion | 2nd place |

A `"winner"` naming a team that is not playing that round yet is rejected,
and the page says so — that is the usual sign of recording the Decider before
the rounds feeding it. A malformed bracket only breaks this page; the
leaderboard still loads.

Tapping a team opens its line-up. The real names come from the optional
`"name"` field on each player in `data.json`, and show as `Mr. X` where it is
missing.

## Adding livestream recordings

1. Drop the `.mp4` in `videos/`.
2. Add an entry to `videos.json` — `file` is required, plus either `teams`
   (a pair of team ids, which captions the tile the same way the screenshot
   tiles are captioned) or a plain `title`. `date` and `poster` are optional.
   There is no generator: two clips are quicker to list by hand than to name
   by convention.
3. Commit both.

Nothing is downloaded until a visitor presses play. Mind the size — GitHub
warns above 50MB per file and rejects at 100MB, and a Pages site is capped at
1GB. If a VOD will not fit, host it elsewhere and we will switch the page to
embeds.

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

Expect 122 passing, 0 failing. This scans the working directory for test
files, so run it from the repo root. (`node --test test/` looks like it
should work but resolves `test` as a module path and fails immediately with
`MODULE_NOT_FOUND` on Windows — don't use it.)

The suite covers the pure logic with no DOM: `standings.js` (totals,
ranking, tie-breaking, prize places, validation), the grouping and
date-formatting half of `gallery.js`, the bracket resolution in
`playoffs.js`, manifest validation in `videos.js`, team resolution in
`matchup.js`, and filename parsing in `tools/build-screenshots.mjs`. `admin.js`,
`board.js`, `nav.js` and the rendering halves of the page modules have no
automated tests; their behavior is verified by eye against the running app.

## Layout

| File | Does |
|---|---|
| `standings.js` | Totals, ranking, validation, number formatting. Pure — no DOM. |
| `board.js` | The public leaderboard. |
| `admin.js` | The score-entry panel. |
| `teams.js` | The Team Standings page. The table is derived, never hand-kept. |
| `gallery.js` | The Post-Match Screenshots page. Grouping and date formatting are pure. |
| `matchup.js` | The stacked "A vs C" caption shared by the screenshot and livestream tiles. |
| `playoffs.js` | The Play-off Bracket page. Bracket resolution and validation are pure. |
| `videos.js` | The Match Livestreams page. Manifest validation is pure. |
| `nav.js` | The burger menu shared by every page. Phase sections live in `SECTIONS`. |
| `app.js` | Loads `data.json`, routes on the URL hash, renders errors. |
| `data.json` | The tournament: team names, roster, matches, results, bracket. |
| `screenshots.json` | Generated manifest of Phase 1 in `screenshots/`. Stores team ids. Do not hand-edit. |
| `screenshots-phase2.json` | Generated manifest of the `phase2_` screenshots. Do not hand-edit. |
| `videos.json` | Hand-kept manifest of `videos/`. |
| `tools/build-screenshots.mjs` | Regenerates every screenshot manifest. Name parsing is pure. |

Team standings come from the `teams` and `winner` fields on each match — team
ids, resolved to names through the `teams` section — so recording a result
keeps the table in step with the board. A match without
those fields still scores players but counts for nobody in the table. Win =
2 points via `WIN_POINTS`, top 4 qualify via `QUALIFY_PLACES`, both in
`standings.js`.

The top five places are prize places: the board sets them apart and draws a
line beneath them. Change `PRIZE_PLACES` in `standings.js` to move it.
