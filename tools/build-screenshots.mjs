/**
 * Regenerates the screenshot manifests from whatever is sitting in
 * screenshots/.
 *
 * A static site cannot list a directory, so the gallery pages read a manifest
 * instead. Run this after dropping new files in:
 *
 *   node tools/build-screenshots.mjs
 *
 * Expected filename shape: <TeamA>v<TeamB>_<D>-<M>.<ext>, e.g. AvB_17-8.jpg.
 * A file for a later phase carries a "phase<N>_" prefix — phase2_AvB_20-8.png
 * — and lands in that phase's own manifest. Anything that does not parse is
 * reported and left out rather than shipped as a mystery tile.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const NAME_PATTERN = /^(?:phase(\d+)_)?([A-Za-z0-9]+)v([A-Za-z0-9]+)_(\d{1,2})-(\d{1,2})$/;

/**
 * The phases that get a manifest. A phase is listed here even before its
 * first screenshot exists, so its page loads an empty gallery rather than
 * a 404. Add the next number when that phase starts.
 */
export const PHASES = [1, 2];

/**
 * Phase 1 keeps the original filename — it is the manifest the first gallery
 * has always read, and renaming it would break a cached page mid-tournament.
 */
export function manifestFor(phase) {
  return phase === 1 ? 'screenshots.json' : `screenshots-phase${phase}.json`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * Turns a filename into a manifest entry, or null when it is not a match
 * screenshot. The entry carries the two team ids rather than a finished
 * caption: the gallery resolves them against data.json at render time, so
 * renaming a team does not mean regenerating every manifest. Pure — unit
 * tested.
 */
export function parseName(file, year) {
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = file.slice(dot).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;

  const parsed = NAME_PATTERN.exec(file.slice(0, dot));
  if (!parsed) return null;

  const [, phase, home, away, day, month] = parsed;
  const date = `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;

  return {
    file: `screenshots/${file}`,
    teams: [home, away],
    date,
    // No prefix means Phase 1, so the names from the group stage still parse.
    phase: phase === undefined ? 1 : Number(phase),
  };
}

/** The season's year, so filenames can stay short (17-8 rather than 2026-08-17). */
function seasonYear() {
  const data = JSON.parse(readFileSync('data.json', 'utf8'));
  const stamp = data.tournament?.updated ?? '';
  const parsed = Number(stamp.slice(0, 4));
  return Number.isFinite(parsed) && parsed > 2000 ? parsed : new Date().getFullYear();
}

function main() {
  const year = seasonYear();
  const byPhase = new Map(PHASES.map((phase) => [phase, []]));
  const skipped = [];
  const unknownPhase = [];

  for (const file of readdirSync('screenshots')) {
    const entry = parseName(file, year);
    if (!entry) {
      skipped.push(file);
    } else if (byPhase.has(entry.phase)) {
      // "phase" is what routed the entry; it is not worth shipping in the
      // manifest, since each manifest holds exactly one phase.
      const { phase, ...shot } = entry;
      byPhase.get(phase).push(shot);
    } else {
      unknownPhase.push(file);
    }
  }

  for (const [phase, entries] of byPhase) {
    // Newest day first, then a stable alphabetical order within the day.
    entries.sort(
      (a, b) => b.date.localeCompare(a.date) || a.teams.join().localeCompare(b.teams.join()),
    );
    const path = manifestFor(phase);
    writeFileSync(path, `${JSON.stringify({ screenshots: entries }, null, 2)}\n`);
    console.log(`Wrote ${path} with ${entries.length} screenshot(s).`);
  }

  if (skipped.length > 0) {
    console.log(`Skipped (unrecognised name): ${skipped.join(', ')}`);
  }
  if (unknownPhase.length > 0) {
    console.log(
      `Skipped (no manifest for that phase — add it to PHASES): ${unknownPhase.join(', ')}`,
    );
  }
}

// Only build when run as a script: the test suite imports this file for the
// pure half and must not have it rewrite the manifests on import.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
