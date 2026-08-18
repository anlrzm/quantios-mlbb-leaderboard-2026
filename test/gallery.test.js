import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByDate, formatDay, validateScreenshots } from '../gallery.js';

const shot = (file, date, label = 'Team A vs Team B') => ({ file, date, label });

test('validateScreenshots accepts a well-formed document', () => {
  assert.deepEqual(
    validateScreenshots({ screenshots: [shot('screenshots/AvB_17-8.jpg', '2026-08-17')] }),
    { ok: true },
  );
});

test('validateScreenshots accepts an empty gallery', () => {
  assert.deepEqual(validateScreenshots({ screenshots: [] }), { ok: true });
});

test('validateScreenshots rejects a missing screenshots array', () => {
  const r = validateScreenshots({});
  assert.equal(r.ok, false);
  assert.match(r.error, /screenshots/);
});

test('validateScreenshots rejects an entry without a file', () => {
  const r = validateScreenshots({ screenshots: [{ date: '2026-08-17' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /file/);
});

test('validateScreenshots rejects an entry without a date', () => {
  const r = validateScreenshots({ screenshots: [{ file: 'a.png' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /date/);
});

test('groupByDate buckets shots by day, newest first', () => {
  const groups = groupByDate([
    shot('a.png', '2026-08-11'),
    shot('b.png', '2026-08-17'),
    shot('c.png', '2026-08-11'),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.date, g.items.length]),
    [
      ['2026-08-17', 1],
      ['2026-08-11', 2],
    ],
  );
});

test('groupByDate keeps the given order within a day', () => {
  const groups = groupByDate([shot('b.png', '2026-08-11'), shot('a.png', '2026-08-11')]);
  assert.deepEqual(
    groups[0].items.map((s) => s.file),
    ['b.png', 'a.png'],
  );
});

test('groupByDate returns an empty array for no screenshots', () => {
  assert.deepEqual(groupByDate([]), []);
});

test('formatDay renders a readable day', () => {
  assert.equal(formatDay('2026-08-17'), 'Monday, 17 August 2026');
});

test('formatDay passes through anything that is not YYYY-MM-DD', () => {
  assert.equal(formatDay('sometime'), 'sometime');
});
