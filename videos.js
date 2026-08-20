/**
 * The Match Livestreams page. Reads videos.json and lays the clips out as
 * tiles, newest first. The files themselves live in videos/ and ship with the
 * site, so this is a hand-kept manifest — two clips does not justify the
 * generator that screenshots.json needs.
 */

import { matchSides, renderMatchup } from './matchup.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Returns {ok:true} or {ok:false, error} — never throws. */
export function validateVideos(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: 'Expected the document to be an object.' };
  }
  if (!Array.isArray(doc.videos)) {
    return { ok: false, error: 'Missing or invalid "videos" — expected an array.' };
  }
  for (const clip of doc.videos) {
    if (clip === null || typeof clip !== 'object' || Array.isArray(clip)) {
      return { ok: false, error: 'Every entry in "videos" must be an object.' };
    }
    if (typeof clip.file !== 'string' || clip.file === '') {
      return { ok: false, error: 'Every video needs a non-empty string "file".' };
    }
    if (clip.teams !== undefined) {
      if (!Array.isArray(clip.teams) || clip.teams.length !== 2) {
        return { ok: false, error: `Video "${clip.file}" needs exactly two "teams".` };
      }
      if (clip.teams.some((t) => typeof t !== 'string' || t === '')) {
        return { ok: false, error: `Video "${clip.file}" has a blank team id.` };
      }
    }
    // A clip is titled either by the teams that played it or by a string —
    // an untitled tile would be an anonymous video player.
    if (clip.teams === undefined && (typeof clip.title !== 'string' || clip.title === '')) {
      return { ok: false, error: `Video "${clip.file}" needs a "title" or two "teams".` };
    }
    if (clip.title !== undefined && typeof clip.title !== 'string') {
      return { ok: false, error: `Video "${clip.file}" has a non-string "title".` };
    }
    if (clip.date !== undefined && typeof clip.date !== 'string') {
      return { ok: false, error: `Video "${clip.file}" has a non-string "date".` };
    }
    // An optional still frame shown before playback starts.
    if (clip.poster !== undefined && typeof clip.poster !== 'string') {
      return { ok: false, error: `Video "${clip.file}" has a non-string "poster".` };
    }
  }
  return { ok: true };
}

/**
 * "2026-08-24" -> "Monday, 24 August 2026". Anything that is not a plain
 * YYYY-MM-DD is shown as-is rather than as "Invalid Date".
 */
function formatDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return date;
  return dt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function renderClip(clip, names) {
  const figure = el('figure', 'clip');
  const sides = matchSides(clip.teams, names);

  const video = document.createElement('video');
  video.className = 'clip-video';
  video.controls = true;
  video.playsInline = true;
  // Nothing but the first frame and the duration is fetched until someone
  // presses play — a match VOD is far too heavy to pull in on page load.
  video.preload = 'metadata';
  if (clip.poster) video.poster = clip.poster;

  const source = document.createElement('source');
  source.src = clip.file;
  source.type = 'video/mp4';
  video.append(source);
  video.append(
    document.createTextNode('Your browser cannot play this video. Download it instead: '),
  );
  const fallback = el('a', null, clip.file);
  fallback.href = clip.file;
  video.append(fallback);

  figure.append(video);

  const caption = el('figcaption', 'clip-cap');
  // Titled by the teams that played it where we know them, so the caption
  // matches the screenshot tiles and follows a team rename.
  if (sides) caption.append(renderMatchup(sides));
  else caption.append(el('span', 'clip-title', clip.title));
  if (clip.date) caption.append(el('span', 'clip-date', formatDay(clip.date)));
  figure.append(caption);

  return figure;
}

export function renderVideos(container, doc, options = {}) {
  const names = options.teams ?? new Map();
  const header = el('header', 'lb-header');
  header.append(el('h1', 'lb-title', 'Match Livestreams'));

  const clips = doc?.videos ?? [];
  header.append(
    el('p', 'lb-meta', `${clips.length} ${clips.length === 1 ? 'recording' : 'recordings'}`),
  );
  container.append(header);

  if (clips.length === 0) {
    container.append(el('p', 'state-msg', 'No videos posted yet.'));
    return;
  }

  const grid = el('div', 'clip-grid');
  for (const clip of clips) grid.append(renderClip(clip, names));
  container.append(grid);
}
