# Quantios MLBB Challenge — Leaderboard Design

**Date:** 2026-08-17
**Status:** Approved

## Goal

A public leaderboard for an internal Mobile Legends esports challenge. The organiser records each match's points per player; participants open a link and see current standings.

## Non-goals

Explicitly out of scope. Each was considered and cut.

- **Screenshot OCR / DeepSeek integration.** The original ask was to feed post-match screenshots to the DeepSeek API. DeepSeek's public API is text-only — the [official docs](https://api-docs.deepseek.com/) list only `deepseek-v4-flash` and `deepseek-v4-pro`, neither documenting image input. DeepSeek's vision models (VL2, Janus, DeepSeek-OCR 2) are open-weights requiring self-hosting. Rather than add a second vision vendor, scores are entered by hand.
- **Database / backend.** No server, no hosted DB, no runtime secrets.
- **Authentication.** Nobody logs in, including the organiser.
- **Teams and team standings.** Individual players only.
- **Per-player stat tracking** (KDA, gold, heroes). Points only.

## Architecture

A static site on GitHub Pages. Three moving parts:

```
index.html      shell, loads styles + app
data.json       the entire tournament state
app.js          entry point; routes on location.hash
board.js        renders the public leaderboard
admin.js        renders the score-entry panel
standings.js    pure logic — no DOM, no fetch
styles.css
```

**Read path:** `index.html` fetches `data.json` from its own origin, computes standings, renders.

**Write path:** the organiser opens `index.html#admin`, edits the roster and matches in a form, and the panel emits updated JSON. They paste it into `data.json` via GitHub's web editor and commit. Pages redeploys in roughly 20 seconds.

### Why the admin panel needs no password

The panel is a JSON generator. It holds no credentials and cannot write to the repository. A participant who discovers `#admin` can edit data in their own browser tab and change nothing anyone else sees. Publishing authority is GitHub commit access to the repo — an existing, real permission system rather than one we build and get wrong.

This is a deliberate trade: it means updates require a commit, and there is no way to push a score change from a phone without GitHub access.

### Cache busting

GitHub Pages serves `data.json` with caching headers that will otherwise show stale standings after a commit. The fetch must use `fetch('data.json?t=' + Date.now(), { cache: 'no-store' })`.

## Data model

`data.json` is the single source of truth.

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

**Matches are stored; totals are computed.** The organiser enters per-match points and the app sums them. This costs nothing extra at entry time and buys per-match history, the ability to correct one match without recalculating by hand, and a point-trend view later if wanted.

**Players are a separate list keyed by short opaque IDs.** Matches reference `playerId`, never the display name. This is the one indirection worth keeping: the admin form picks from the existing roster instead of accepting free text, so a player cannot fragment into two entries via a typo or trailing space. Renaming a player is a single-field edit.

**Points** are finite numbers and may be negative (penalties). Stored at full precision; **displayed rounded to at most one decimal place**, with no trailing `.0`.

**IDs** are assigned by the admin panel as `p` / `m` followed by one plus the highest numeric suffix currently present in that list. Deleting the highest-numbered entry therefore frees its ID for reuse — acceptable here because IDs are internal and never referenced outside `data.json`.

## Ranking

1. Sort by total points, descending.
2. Ties share a rank, and the next rank skips accordingly — two players on 40 are both **#3**, and the next player is **#5** (standard competition ranking).
3. Within a tie, display order is alphabetical by IGN, case-insensitive.

A player on the roster who appears in no match has a total of 0 and is ranked last, not hidden.

## Public board

Neon Arena visual direction with a champion spotlight.

**Visual language:** deep purple/indigo gradient background (`#1a0b2e` → `#0f0620`), magenta (`#d946ef`) and cyan (`#22d3ee`) accents, italic heavy weight for ranks and the tournament title, angular clipped row corners, magenta glow confined to the leader.

**Structure, top to bottom:**

1. **Header** — tournament name in a cyan→magenta gradient, then `{season} · {n} matches` and last-updated date.
2. **Champion spotlight** — a banner for the current leader: avatar circle with the first character of their IGN, the label `CURRENT LEADER`, their IGN, a sub-line reading `{n} matches · +{margin} ahead`, and their total points set large on the right.
3. **The rest** — ranks 2 downward as list rows. Ranks 2 and 3 get cyan and violet left borders respectively; everything below is neutral.

**Spotlight edge cases:**

- **Tie for first:** the spotlight shows one player (top of the sorted order defined above), labelled `JOINT LEADER`, with the sub-line `Tied with {name}` for one other or `Tied with {n} players` for more. Co-leaders still appear in the list below at rank 1.
- **No matches recorded:** the spotlight is hidden and the board shows `No matches recorded yet`.
- **Single player:** the spotlight renders with the sub-line omitting the margin.

**Responsive:** single-column throughout, sized for a 360px-wide phone first. This is why the podium layout was rejected — three staged columns compress badly at that width, and most participants will open the link on a phone.

**Accessibility:** the standings are marked up as an ordered list, not a grid of divs. Rank and points are never conveyed by colour alone. Body text holds at least 4.5:1 contrast against its background; the glow on the leader row is decorative only.

## Admin panel (`#admin`)

**Roster section** — add a player by IGN, rename, remove. Removing a player who appears in any match is blocked with a message naming the matches; the organiser deletes those results first. This prevents orphaned `playerId` references.

**Match section** — add a match with a label, a date, and one row per participating player. Player is chosen from a dropdown of the roster, points typed. Existing matches can be edited or deleted in place.

**Output section** — the full updated `data.json`, pretty-printed with two-space indent in a read-only textarea, with a **Copy JSON** button and a **Download data.json** button (a `Blob` and an `<a download>`; no external capability required).

**Validation, blocking output until resolved:**

- Match label is non-empty and unique.
- Date parses as `YYYY-MM-DD`.
- Every result references a roster player.
- No player appears twice in one match.
- Points parse as a finite number.
- Roster IGNs are unique after trimming whitespace, compared case-insensitively.

The panel warns but does not block when a match has zero results, since a placeholder match may be intentional.

## Error handling

- **`data.json` fails to fetch** — the board renders an error card explaining the file could not be loaded, not a blank page.
- **`data.json` is malformed JSON** — same error card, naming the parse failure.
- **Schema is valid JSON but wrong shape** (missing `players`, `matches` not an array) — error card naming the missing field. `standings.js` validates shape before computing.
- **A match references an unknown `playerId`** — the public board ignores that result silently rather than breaking the render; the admin panel surfaces it as a prominent warning with the offending match and ID.
- **`tournament.updated` missing** — falls back to no date rather than showing `undefined`.

## Testing

`standings.js` is pure and holds all the logic worth testing. Tests run under Node's built-in runner (`node --test`) — no dependencies, no build step.

Cases to cover:

- Totals sum across multiple matches.
- A player in no match totals 0 and sorts last.
- Two players tied share a rank and the next rank skips.
- Three-way tie skips two ranks.
- Alphabetical ordering within a tie is case-insensitive.
- Negative points reduce a total.
- Decimal points sum and render to at most one decimal place, with no floating-point artefacts (`0.1 + 0.2` displays as `0.3`).
- An unknown `playerId` in a result is ignored, not fatal.
- Shape validation rejects each malformed input named under Error handling.

DOM rendering is verified by eye. Automated browser testing is not worth its cost at this size.

## Deployment

Public GitHub repo, Pages serving the root of `main`. `.superpowers/` is gitignored so brainstorming mockups never ship.

`README.md` documents the update loop — open `#admin`, enter the match, copy the JSON, paste into `data.json` on GitHub, commit — because this will be forgotten within a month.

## Future, explicitly deferred

Per-player point trend over the tournament; rank movement arrows since last match; per-match breakdown view; team standings. The data model already supports all four without migration, which is the point of storing matches rather than totals.
