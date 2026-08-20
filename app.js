import { teamsById, validateShape } from './standings.js';
import { renderBoard } from './board.js';
import { renderAdmin } from './admin.js';
import { renderGallery, validateScreenshots } from './gallery.js';
import { renderNav } from './nav.js';
import { renderTeams } from './teams.js';
import { renderPlayoffs, validatePlayoffs } from './playoffs.js';
import { renderVideos, validateVideos } from './videos.js';

const container = document.getElementById('app');

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

/**
 * A side file that is only fetched the first time its page is opened, and is
 * kept afterwards so flipping between pages does not refetch it.
 */
function sideFile(path, validate, noun) {
  return { path, validate, noun, doc: null, error: null };
}

const SCREENSHOTS = sideFile('screenshots.json', validateScreenshots, 'screenshots');
const SCREENSHOTS_2 = sideFile('screenshots-phase2.json', validateScreenshots, 'screenshots');
const VIDEOS = sideFile('videos.json', validateVideos, 'videos');

async function loadJson(path) {
  // Cache-bust: GitHub Pages will otherwise serve a stale file for minutes
  // after a commit.
  const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Server returned ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Draws a page backed by a side file: its error, its loading state, or the
 * page itself, depending on how far the fetch has got.
 */
function routeSideFile(source, render) {
  if (source.error) {
    showError(`Could not load the ${source.noun}`, source.error);
  } else if (source.doc === null) {
    const loading = document.createElement('p');
    loading.className = 'state-msg';
    loading.textContent = `Loading ${source.noun}…`;
    container.append(loading);
  } else {
    render(container, source.doc);
  }
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
  } else if (hash === '#playoffs') {
    // The bracket is checked here rather than in validateShape: a malformed
    // playoffs block should cost this page, not the whole leaderboard.
    const check = validatePlayoffs(data.playoffs, new Set(teamsById(data).keys()));
    if (!check.ok) {
      showError('The play-off bracket is malformed', check.error);
    } else {
      renderPlayoffs(container, data);
    }
  } else if (hash === '#videos') {
    // The manifests store team ids; the names they resolve to live in
    // data.json, so every caption follows a rename there.
    routeSideFile(VIDEOS, (host, doc) => renderVideos(host, doc, { teams: teamsById(data) }));
  } else if (hash === '#screenshots') {
    routeSideFile(SCREENSHOTS, (host, doc) =>
      renderGallery(host, doc, { teams: teamsById(data) }),
    );
  } else if (hash === '#screenshots2') {
    routeSideFile(SCREENSHOTS_2, (host, doc) =>
      renderGallery(host, doc, { subtitle: 'Phase 2 · Play-offs', teams: teamsById(data) }),
    );
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
 * Opening a side-file page needs a second file. Fetch it, then re-route so the
 * page paints with real content instead of an empty shell.
 */
async function ensureSideFile(source, hash, data) {
  if (location.hash !== hash || source.doc !== null || source.error !== null) return;
  try {
    const doc = await loadJson(source.path);
    const check = source.validate(doc);
    if (!check.ok) {
      source.error = `${source.path} is malformed. ${check.error}`;
    } else {
      source.doc = doc;
    }
  } catch (error) {
    source.error = `${source.path} could not be fetched. ${error.message}`;
  }
  if (location.hash === hash) safeRoute(data);
}

function ensureSideFiles(data) {
  ensureSideFile(SCREENSHOTS, '#screenshots', data);
  ensureSideFile(SCREENSHOTS_2, '#screenshots2', data);
  ensureSideFile(VIDEOS, '#videos', data);
}

async function main() {
  let data;
  try {
    data = await loadJson('data.json');
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
  ensureSideFiles(data);
  window.addEventListener('hashchange', () => {
    safeRoute(data);
    ensureSideFiles(data);
  });
}

main();
