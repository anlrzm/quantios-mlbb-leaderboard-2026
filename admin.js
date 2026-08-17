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

/** First "Match N" label not already taken, compared like the validator does. */
function nextMatchLabel() {
  const taken = new Set(draft.matches.map((m) => m.label.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`match ${n}`)) n += 1;
  return `Match ${n}`;
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

/** Renames in place. Returns an error string, or null on success. */
function renamePlayer(player, rawIgn) {
  const ign = rawIgn.trim();
  if (ign === '') return 'Enter an in-game name.';

  // Re-casing or re-trimming your own name is always allowed.
  if (ign.toLowerCase() === player.ign.trim().toLowerCase()) {
    player.ign = ign;
    return null;
  }

  const clash = draft.players.some(
    (p) => p !== player && p.ign.trim().toLowerCase() === ign.toLowerCase(),
  );
  if (clash) return `"${ign}" is already on the roster.`;

  player.ign = ign;
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
      const error = renamePlayer(player, input.value);
      draw(error);
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

  draft.tournament.updated = new Date().toISOString().slice(0, 10);

  const blocking = validateAll();
  if (blocking) {
    section.append(el('div', 'ad-error', `Fix this before publishing: ${blocking}`));
    section.append(
      el('p', 'ad-hint', 'The JSON is hidden until the data is valid, so a broken file cannot be committed by accident.'),
    );
    return section;
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

/** True only for a real calendar date in YYYY-MM-DD form. */
function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  // A rolled-over date (Feb 30 -> Mar 2) fails to round-trip.
  return dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d;
}

/** Returns an error string, or null when the match is publishable. */
function validateMatch(match) {
  if (match.label.trim() === '') return 'Every match needs a label.';

  const duplicateLabel = draft.matches.some(
    (m) => m !== match && m.label.trim().toLowerCase() === match.label.trim().toLowerCase(),
  );
  if (duplicateLabel) return `Another match is already called "${match.label}".`;

  if (!isRealDate(match.date)) {
    return `"${match.label}" needs a real date as YYYY-MM-DD.`;
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
      label: nextMatchLabel(),
      date: new Date().toISOString().slice(0, 10),
      results: [],
    });
    draw();
  });
  section.append(add);

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
