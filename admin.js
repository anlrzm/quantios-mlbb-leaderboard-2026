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

// Replaced in Task 7.
function renderMatches() {
  return el('section', 'ad-section');
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
