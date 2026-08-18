/**
 * The Team Standings page. The table is derived from data.json — every match
 * carrying "teams" and "winner" feeds it — so it never drifts from the board.
 */
import { QUALIFY_PLACES, WIN_POINTS, computeTeamTable, isQualifyingRank } from './standings.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function cell(tag, className, text) {
  const node = el(tag, className, text);
  if (tag === 'th') node.scope = 'col';
  return node;
}

function renderRow(row) {
  const tr = el('tr', isQualifyingRank(row.rank) ? 'tt-row qualify' : 'tt-row');

  const rank = el('td', 'tt-rank');
  rank.append(el('span', 'tt-rank-num', String(row.rank)));
  tr.append(rank);

  const team = el('td', 'tt-team');
  // The badge/name pair is flexed inside a span: a flexed <td> stops behaving
  // like a table cell and the columns stop lining up.
  const teamWrap = el('span', 'tt-team-wrap');
  teamWrap.append(el('span', 'tt-badge', row.team.replace(/^Team\s+/i, '')));
  teamWrap.append(el('span', 'tt-team-name', row.team));
  team.append(teamWrap);
  tr.append(team);

  tr.append(el('td', 'tt-num', String(row.played)));
  tr.append(el('td', 'tt-num tt-won', String(row.won)));
  tr.append(el('td', 'tt-num tt-lost', String(row.lost)));
  tr.append(el('td', 'tt-num tt-pts', String(row.points)));

  return tr;
}

export function renderTeams(container, data) {
  const header = el('header', 'lb-header');
  header.append(el('h1', 'lb-title', 'Team Standings'));

  const phase = data.tournament?.season;
  header.append(el('p', 'lb-meta', phase ? `${phase} · Group Stage` : 'Group Stage'));
  header.append(
    el(
      'p',
      'lb-updated',
      `Win = ${WIN_POINTS} points, loss = 0. Top ${QUALIFY_PLACES} qualify for playoffs.`,
    ),
  );
  container.append(header);

  const rows = computeTeamTable(data);
  if (rows.length === 0) {
    container.append(el('p', 'state-msg', 'No teams on the roster yet.'));
    return;
  }

  // The table scrolls inside its own box rather than pushing the page sideways
  // on a narrow phone.
  const scroller = el('div', 'tt-scroll');
  const table = el('table', 'tt');

  const head = el('thead');
  const headRow = el('tr');
  headRow.append(cell('th', 'tt-rank', '#'));
  headRow.append(cell('th', 'tt-team', 'Team'));
  headRow.append(cell('th', 'tt-num', 'P'));
  headRow.append(cell('th', 'tt-num', 'W'));
  headRow.append(cell('th', 'tt-num', 'L'));
  headRow.append(cell('th', 'tt-num', 'PTS'));
  head.append(headRow);
  table.append(head);

  const body = el('tbody');
  let cutDrawn = false;
  for (const row of rows) {
    // One divider, at the first team that misses the playoff cut.
    if (!cutDrawn && !isQualifyingRank(row.rank)) {
      const cut = el('tr', 'tt-cut');
      const cutCell = el('td', 'tt-cut-cell', `Qualification line · top ${QUALIFY_PLACES}`);
      cutCell.colSpan = 6;
      cut.append(cutCell);
      body.append(cut);
      cutDrawn = true;
    }
    body.append(renderRow(row));
  }
  table.append(body);

  scroller.append(table);
  container.append(scroller);

  const key = el('p', 'tt-key');
  key.append(el('span', 'tt-key-dot'));
  key.append(document.createTextNode(`Top ${QUALIFY_PLACES} — qualify for playoffs`));
  container.append(key);
}
