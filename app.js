import { validateShape } from './standings.js';
import { renderBoard } from './board.js';
import { renderAdmin } from './admin.js';
import { renderGallery, validateScreenshots } from './gallery.js';
import { renderNav } from './nav.js';
import { renderTeams } from './teams.js';

const container = document.getElementById('app');

// screenshots.json is only fetched when the gallery is first opened, and the
// result is kept so flipping between pages does not refetch it.
let screenshotDoc = null;
let screenshotError = null;

function showError(title, detail) {
  container.replaceChildren(renderNav(location.hash));
  const card = document.createElement('div');
  card.className = 'error-card';
  const h = document.createElement('h2');
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = detail;
  card.append(h, p);
  container.append(card);
}

async function loadScreenshots() {
  const response = await fetch(`screenshots.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Server returned ${response.status} ${response.statusText}`);
  }
  return response.json();
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
  const hash = location.hash;
  container.replaceChildren(renderNav(hash));

  if (hash === '#admin') {
    // The admin panel redraws itself on every keystroke, so it gets its own
    // subtree to clear — otherwise it would wipe the nav out from under us.
    const host = document.createElement('div');
    container.append(host);
    renderAdmin(host, data);
  } else if (hash === '#teams') {
    renderTeams(container, data);
  } else if (hash === '#screenshots') {
    if (screenshotError) {
      showError('Could not load the screenshots', screenshotError);
    } else if (screenshotDoc === null) {
      const loading = document.createElement('p');
      loading.className = 'state-msg';
      loading.textContent = 'Loading screenshots…';
      container.append(loading);
    } else {
      renderGallery(container, screenshotDoc);
    }
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

/**
 * Opening the gallery needs a second file. Fetch it, then re-route so the page
 * paints with real content instead of an empty shell.
 */
async function ensureScreenshots(data) {
  if (location.hash !== '#screenshots' || screenshotDoc !== null || screenshotError !== null) {
    return;
  }
  try {
    const doc = await loadScreenshots();
    const check = validateScreenshots(doc);
    if (!check.ok) {
      screenshotError = `screenshots.json is malformed. ${check.error}`;
    } else {
      screenshotDoc = doc;
    }
  } catch (error) {
    screenshotError = `screenshots.json could not be fetched. ${error.message}`;
  }
  if (location.hash === '#screenshots') safeRoute(data);
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
  ensureScreenshots(data);
  window.addEventListener('hashchange', () => {
    safeRoute(data);
    ensureScreenshots(data);
  });
}

main();
