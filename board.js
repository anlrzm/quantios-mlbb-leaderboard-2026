import {
  PRIZE_PLACES,
  computeStandings,
  formatPoints,
  isPrizeRank,
  leaderSummary,
} from './standings.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderHeader(data) {
  const header = el('header', 'lb-header');
  const t = data.tournament ?? {};

  header.append(el('h1', 'lb-title', t.name ?? 'Leaderboard'));

  const bits = [];
  if (t.season) bits.push(t.season);
  bits.push(`${data.matches.length} ${data.matches.length === 1 ? 'match' : 'matches'}`);
  header.append(el('p', 'lb-meta', bits.join(' · ')));

  if (t.updated) header.append(el('p', 'lb-updated', `Updated ${t.updated}`));

  return header;
}

// The top PRIZE_PLACES are in the money and are styled apart from the rest;
// ranks 2 and 3 keep their own accent within that zone.
function rowClassFor(rank) {
  const classes = ['lb-row'];
  if (isPrizeRank(rank)) classes.push('prize');
  if (rank === 2) classes.push('r2');
  else if (rank === 3) classes.push('r3');
  return classes.join(' ');
}

function renderRow(row) {
  const li = el('li', rowClassFor(row.rank));
  li.append(el('span', 'lb-rank', String(row.rank)));

  const name = el('span', 'lb-name-wrap');
  name.append(el('span', 'lb-name', row.ign));

  const played = `${row.matchesPlayed} ${row.matchesPlayed === 1 ? 'match' : 'matches'}`;
  name.append(el('span', 'lb-sub', row.team ? `${row.team} · ${played}` : played));
  li.append(name);

  const points = el('span', 'lb-pts-wrap');
  points.append(el('span', 'lb-pts', formatPoints(row.total)));
  if (isPrizeRank(row.rank)) points.append(el('span', 'lb-prize-tag', 'Prize'));
  li.append(points);

  return li;
}

/** Marks where the prize places stop and the rest of the field begins. */
function renderCutLine() {
  const li = el('li', 'lb-cut');
  li.append(el('span', 'lb-cut-text', `Prize line · top ${PRIZE_PLACES}`));
  return li;
}

function renderSpotlight(leader) {
  const box = el('section', 'champ');

  const avatar = el('div', 'champ-av', [...leader.ign][0]?.toUpperCase() ?? '?');
  box.append(avatar);

  const middle = el('div', 'champ-mid');
  middle.append(el('div', 'champ-label', leader.tied ? 'Joint Leader' : 'Current Leader'));
  middle.append(el('div', 'champ-name', leader.ign));

  const played = `${leader.matchesPlayed} ${leader.matchesPlayed === 1 ? 'match' : 'matches'}`;
  let detail = leader.team ? `${leader.team} · ${played}` : played;
  if (leader.tied) {
    detail +=
      leader.tiedWith.length === 1
        ? ` · Tied with ${leader.tiedWith[0]}`
        : ` · Tied with ${leader.tiedWith.length} players`;
  } else if (leader.margin !== null) {
    detail += ` · +${formatPoints(leader.margin)} ahead`;
  }
  middle.append(el('div', 'champ-sub', detail));
  box.append(middle);

  const points = el('div', 'champ-pts');
  points.append(el('div', 'champ-pts-val', formatPoints(leader.total)));
  points.append(el('div', 'champ-pts-label', 'PTS'));
  box.append(points);

  return box;
}

export function renderBoard(container, data) {
  container.append(renderHeader(data));

  const standings = computeStandings(data);

  if (standings.length === 0) {
    container.append(el('p', 'state-msg', 'No players on the roster yet.'));
    return;
  }
  if (data.matches.length === 0) {
    container.append(el('p', 'state-msg', 'No matches recorded yet.'));
    const list = el('ol', 'lb-list');
    for (const row of standings) list.append(renderRow(row));
    container.append(list);
    return;
  }

  const leader = leaderSummary(standings);
  container.append(renderSpotlight(leader));

  // The spotlight replaces the leader's row. Co-leaders on a tie still appear
  // in the list at rank 1.
  const rest = standings.slice(1);
  if (rest.length > 0) {
    const list = el('ol', 'lb-list');
    let cutDrawn = false;
    for (const row of rest) {
      // One divider, at the first row that misses out on a prize.
      if (!cutDrawn && !isPrizeRank(row.rank)) {
        list.append(renderCutLine());
        cutDrawn = true;
      }
      list.append(renderRow(row));
    }
    container.append(list);
  }
}
