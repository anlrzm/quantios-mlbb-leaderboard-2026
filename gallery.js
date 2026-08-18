/**
 * The Post-Match Screenshot page. Reads screenshots.json (regenerate it with
 * `node tools/build-screenshots.mjs`) and lays the images out day by day.
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Returns {ok:true} or {ok:false, error} — never throws. */
export function validateScreenshots(doc) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, error: 'Expected the document to be an object.' };
  }
  if (!Array.isArray(doc.screenshots)) {
    return { ok: false, error: 'Missing or invalid "screenshots" — expected an array.' };
  }
  for (const shot of doc.screenshots) {
    if (shot === null || typeof shot !== 'object' || Array.isArray(shot)) {
      return { ok: false, error: 'Every entry in "screenshots" must be an object.' };
    }
    if (typeof shot.file !== 'string' || shot.file === '') {
      return { ok: false, error: 'Every screenshot needs a non-empty string "file".' };
    }
    if (typeof shot.date !== 'string') {
      return { ok: false, error: `Screenshot "${shot.file}" needs a string "date".` };
    }
    if (shot.label !== undefined && typeof shot.label !== 'string') {
      return { ok: false, error: `Screenshot "${shot.file}" has a non-string "label".` };
    }
  }
  return { ok: true };
}

/**
 * Buckets screenshots into days, newest day first, keeping the given order
 * within each day. Pure — unit tested.
 */
export function groupByDate(screenshots) {
  const byDate = new Map();
  for (const shot of screenshots) {
    if (!byDate.has(shot.date)) byDate.set(shot.date, []);
    byDate.get(shot.date).push(shot);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

/**
 * "2026-08-17" -> "Monday, 17 August 2026". Anything that is not a plain
 * YYYY-MM-DD is shown as-is rather than as "Invalid Date".
 */
export function formatDay(date) {
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

function renderShot(shot) {
  const figure = el('figure', 'shot');

  const image = el('img', 'shot-img');
  image.src = shot.file;
  image.alt = shot.label ? `Post-match screenshot — ${shot.label}` : 'Post-match screenshot';
  image.loading = 'lazy';
  image.decoding = 'async';

  // The full-size image opens in a new tab: phone-sized tiles are unreadable
  // for checking a scoreboard.
  const link = el('a', 'shot-link');
  link.href = shot.file;
  link.target = '_blank';
  link.rel = 'noopener';
  link.append(image);
  figure.append(link);

  if (shot.label) figure.append(el('figcaption', 'shot-cap', shot.label));
  return figure;
}

function renderDay(day) {
  const section = el('section', 'day');

  const head = el('div', 'day-head');
  head.append(el('h2', 'day-title', formatDay(day.date)));
  head.append(
    el('span', 'day-count', `${day.items.length} ${day.items.length === 1 ? 'match' : 'matches'}`),
  );
  section.append(head);

  const grid = el('div', 'shot-grid');
  for (const shot of day.items) grid.append(renderShot(shot));
  section.append(grid);

  return section;
}

export function renderGallery(container, doc) {
  const header = el('header', 'lb-header');
  header.append(el('h1', 'lb-title', 'Post-Match Screenshots'));

  const shots = doc?.screenshots ?? [];
  const days = groupByDate(shots);
  header.append(
    el(
      'p',
      'lb-meta',
      `${shots.length} ${shots.length === 1 ? 'screenshot' : 'screenshots'} · ${days.length} ${
        days.length === 1 ? 'match day' : 'match days'
      }`,
    ),
  );
  container.append(header);

  if (days.length === 0) {
    container.append(el('p', 'state-msg', 'No screenshots posted yet.'));
    return;
  }

  for (const day of days) container.append(renderDay(day));
}
