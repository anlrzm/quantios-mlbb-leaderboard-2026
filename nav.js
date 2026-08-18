/**
 * The burger menu. Hash links do the actual navigating — app.js re-routes on
 * hashchange — so this only has to open, close, and mark the current page.
 */

/**
 * Menu contents, grouped by phase. A phase title is a heading, not a link.
 *
 * Score entry is deliberately absent: it stays reachable by typing #admin on
 * the URL, but is not advertised to players browsing the menu.
 */
const SECTIONS = [
  {
    title: 'Phase 1',
    pages: [
      { hash: '#', label: 'Leaderboard' },
      { hash: '#teams', label: 'Team Standings' },
      { hash: '#screenshots', label: 'Post-Match Screenshots' },
    ],
  },
  { title: 'Phase 2', pages: [] },
  { title: 'Phase 3', pages: [] },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Every route change builds a fresh nav, so the outside-click and Escape
// handlers are registered once here against whichever nav is current —
// re-adding them per render would pile up listeners on a long session.
let current = null;

function closeCurrent() {
  if (!current) return;
  current.nav.classList.remove('is-open');
  current.button.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (event) => {
  if (current && !current.nav.contains(event.target)) closeCurrent();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeCurrent();
});

/** '' and '#' are both the board. */
function isCurrent(hash, route) {
  const normalised = route === '' ? '#' : route;
  return hash === normalised;
}

export function renderNav(route) {
  const nav = el('nav', 'nav');

  const button = el('button', 'nav-burger');
  button.type = 'button';
  button.setAttribute('aria-label', 'Menu');
  button.setAttribute('aria-expanded', 'false');
  for (let i = 0; i < 3; i += 1) button.append(el('span', 'nav-bar'));

  const menu = el('div', 'nav-menu');
  for (const section of SECTIONS) {
    const group = el('div', 'nav-group');
    group.append(el('div', 'nav-group-title', section.title));

    for (const page of section.pages) {
      const link = el('a', 'nav-link', page.label);
      link.href = page.hash;
      if (isCurrent(page.hash, route)) {
        link.classList.add('is-current');
        link.setAttribute('aria-current', 'page');
      }
      // Re-picking the page you are already on fires no hashchange, so close
      // here rather than waiting for the router.
      link.addEventListener('click', () => closeCurrent());
      group.append(link);
    }

    // A bare heading reads as a broken menu; say why there is nothing under it.
    if (section.pages.length === 0) {
      group.append(el('div', 'nav-empty', 'Not started yet'));
    }

    menu.append(group);
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (nav.classList.contains('is-open')) {
      closeCurrent();
    } else {
      nav.classList.add('is-open');
      button.setAttribute('aria-expanded', 'true');
    }
  });

  nav.append(button, menu);
  current = { nav, button };
  return nav;
}
