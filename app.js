import { validateShape } from './standings.js';
import { renderBoard } from './board.js';
import { renderAdmin } from './admin.js';

const container = document.getElementById('app');

function showError(title, detail) {
  container.replaceChildren();
  const card = document.createElement('div');
  card.className = 'error-card';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  card.append(h, p);
  container.append(card);
}

async function loadData() {
  // Cache-bust: GitHub Pages will otherwise serve a stale board for minutes
  // after a commit.
  const response = await fetch(`data.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Server returned ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function route(data) {
  const isAdmin = location.hash === '#admin';
  container.replaceChildren();
  if (isAdmin) {
    renderAdmin(container, data);
  } else {
    renderBoard(container, data);
  }
}

/** Rendering must never leave an empty <main>: show the error card instead. */
function safeRoute(data) {
  try {
    route(data);
  } catch (error) {
    showError('Something went wrong rendering the page', error.message);
  }
}

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    showError('Could not load the leaderboard', `data.json could not be fetched. ${error.message}`);
    return;
  }

  const check = validateShape(data);
  if (!check.ok) {
    showError('The leaderboard data is malformed', check.error);
    return;
  }

  safeRoute(data);
  window.addEventListener('hashchange', () => safeRoute(data));
}

main();
