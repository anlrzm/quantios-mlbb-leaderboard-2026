import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideos } from '../videos.js';

const clip = (file) => ({ file, title: 'Upper Bracket — Team A vs Team B', date: '2026-08-24' });

test('validateVideos accepts a well-formed document', () => {
  assert.deepEqual(validateVideos({ videos: [clip('videos/upper.mp4')] }), { ok: true });
});

test('validateVideos accepts an empty list', () => {
  assert.deepEqual(validateVideos({ videos: [] }), { ok: true });
});

test('validateVideos rejects a missing videos array', () => {
  const r = validateVideos({});
  assert.equal(r.ok, false);
  assert.match(r.error, /videos/);
});

test('validateVideos rejects an entry without a file', () => {
  const r = validateVideos({ videos: [{ title: 'Grand Final' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /file/);
});

test('validateVideos rejects an entry without a title', () => {
  const r = validateVideos({ videos: [{ file: 'videos/a.mp4' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /title/);
});

test('validateVideos rejects a non-string date', () => {
  const r = validateVideos({ videos: [{ file: 'videos/a.mp4', title: 'A', date: 20260824 }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /date/);
});

test('validateVideos rejects a non-string poster', () => {
  const r = validateVideos({ videos: [{ ...clip('videos/a.mp4'), poster: 7 }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /poster/);
});

test('validateVideos accepts an entry titled by its teams instead of a string', () => {
  assert.deepEqual(
    validateVideos({ videos: [{ file: 'videos/a.mp4', teams: ['A', 'B'] }] }),
    { ok: true },
  );
});

test('validateVideos rejects an entry with neither a title nor teams', () => {
  const r = validateVideos({ videos: [{ file: 'videos/a.mp4' }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /title/);
});

test('validateVideos rejects teams that are not a pair', () => {
  const r = validateVideos({ videos: [{ file: 'videos/a.mp4', teams: ['A'] }] });
  assert.equal(r.ok, false);
  assert.match(r.error, /two/);
});
