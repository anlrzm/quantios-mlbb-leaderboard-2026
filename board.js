import { computeStandings, formatPoints, leaderSummary } from './standings.js';

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

// Ranks 2 and 3 get their own accent; everything below is neutral.
function rowClassFor(rank) {
  if (rank === 2) return 'lb-row r2';
  if (rank === 3) return 'lb-row r3';
  return 'lb-row';
}

function renderRow(row) {
  const li = el('li', rowClassFor(row.rank));
  li.append(el('span', 'lb-rank', String(row.rank)));

  const name = el('span', 'lb-name-wrap');
  name.append(el('span', 'lb-name', row.ign));
  name.append(
    el('span', 'lb-sub', `${row.matchesPlayed} ${row.matchesPlayed === 1 ? 'match' : 'matches'}`),
  );
  li.append(name);

  li.append(el('span', 'lb-pts', formatPoints(row.total)));
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
  let detail = played;
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
    for (const row of rest) list.append(renderRow(row));
    container.append(list);
  }
}
