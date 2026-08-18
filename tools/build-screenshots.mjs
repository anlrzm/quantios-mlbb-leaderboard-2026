/**
 * Regenerates screenshots.json from whatever is sitting in screenshots/.
 *
 * A static site cannot list a directory, so the gallery page reads a manifest
 * instead. Run this after dropping new files in:
 *
 *   node tools/build-screenshots.mjs
 *
 * Expected filename shape: <TeamA>v<TeamB>_<D>-<M>.<ext>, e.g. AvB_17-8.jpg.
 * Anything that does not parse is reported and left out of the manifest
 * rather than shipped as a mystery tile.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const NAME_PATTERN = /^([A-Za-z0-9]+)v([A-Za-z0-9]+)_(\d{1,2})-(\d{1,2})$/;

/** The season's year, so filenames can stay short (17-8 rather than 2026-08-17). */
function seasonYear() {
  const data = JSON.parse(readFileSync('data.json', 'utf8'));
  const stamp = data.tournament?.updated ?? '';
  const year = Number(stamp.slice(0, 4));
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseName(file, year) {
  const dot = file.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = file.slice(dot).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;

  const parsed = NAME_PATTERN.exec(file.slice(0, dot));
  if (!parsed) return null;

  const [, home, away, day, month] = parsed;
  const date = `${year}-${pad(Number(month))}-${pad(Number(day))}`;
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;

  return { file: `screenshots/${file}`, label: `Team ${home} vs Team ${away}`, date };
}

const year = seasonYear();
const entries = [];
const skipped = [];

for (const file of readdirSync('screenshots')) {
  const entry = parseName(file, year);
  if (entry) entries.push(entry);
  else skipped.push(file);
}

// Newest day first, then a stable alphabetical order within the day.
entries.sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));

writeFileSync('screenshots.json', `${JSON.stringify({ screenshots: entries }, null, 2)}\n`);

console.log(`Wrote screenshots.json with ${entries.length} screenshot(s).`);
if (skipped.length > 0) {
  console.log(`Skipped (unrecognised name): ${skipped.join(', ')}`);
}
