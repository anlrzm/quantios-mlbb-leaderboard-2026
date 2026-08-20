/**
 * The match-up caption shared by the screenshot gallery and the livestream
 * page: each side on its own line as an id badge plus the team name, with a
 * "vs" between them.
 *
 * Both manifests store team ids rather than a finished string, so renaming a
 * team in data.json updates every caption on both pages without regenerating
 * anything.
 */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Resolves a pair of team ids to the sides of a match-up, or null when there
 * is no usable pair. A team that is not defined keeps its id as the name, so
 * an unknown side still reads as something. Pure — unit tested.
 */
export function matchSides(teamIds, names) {
  if (!Array.isArray(teamIds) || teamIds.length !== 2) return null;
  if (teamIds.some((id) => typeof id !== 'string' || id === '')) return null;
  return teamIds.map((id) => ({ id, name: names.get(id)?.name ?? id }));
}

/** One side: the letter in a badge, the team name beside it. */
function renderSide(side) {
  const row = el('div', 'mu-side');
  row.append(el('span', 'mu-badge', side.id));
  row.append(el('span', 'mu-name', side.name));
  return row;
}

/** The stacked caption. `sides` comes from matchSides. */
export function renderMatchup(sides) {
  const box = el('div', 'mu');
  box.append(renderSide(sides[0]));
  box.append(el('div', 'mu-vs', 'vs'));
  box.append(renderSide(sides[1]));
  return box;
}
