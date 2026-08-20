/**
 * The Play-offs page: a four-team double elimination drawn as four cards
 * flowing top to bottom, which is the same order the bracket resolves in.
 *
 *   Upper (Bo1)  A v B   winner -> Grand Final, loser -> Decider
 *   Lower (Bo1)  C v E   winner -> Decider,     loser -> 4th place
 *   Decider (Bo3)        winner -> Grand Final, loser -> 3rd place
 *   Grand Final (Bo3)    winner -> champion,    loser -> 2nd place
 *
 * buildBracket and validatePlayoffs are pure — no DOM — and unit tested.
 */
import { computeTeamTable, teamsById } from './standings.js';

/**
 * The shape of the bracket. Opening rounds take their teams from data.json;
 * later rounds take theirs from an earlier round's winner or loser, so the
 * whole thing resolves from two recorded results plus two more.
 */
const ROUNDS = [
  {
    id: 'upper',
    title: 'Upper Bracket',
    format: 'Bo1',
    seeded: true,
    outcomes: { winner: 'Advances to the Grand Final', loser: 'Drops to the Decider Match' },
  },
  {
    id: 'lower',
    title: 'Lower Bracket',
    format: 'Bo1',
    seeded: true,
    outcomes: { winner: 'Advances to the Decider Match', loser: 'Eliminated — 4th place' },
  },
  {
    id: 'decider',
    title: 'Decider Match',
    format: 'Bo3',
    sources: [
      { round: 'upper', take: 'loser' },
      { round: 'lower', take: 'winner' },
    ],
    outcomes: { winner: 'Advances to the Grand Final', loser: 'Finishes 3rd' },
  },
  {
    id: 'final',
    title: 'Grand Final',
    format: 'Bo3',
    sources: [
      { round: 'upper', take: 'winner' },
      { round: 'decider', take: 'winner' },
    ],
    outcomes: { winner: 'Champion', loser: 'Finishes 2nd' },
  },
];

const titleOf = (id) => ROUNDS.find((r) => r.id === id).title;

/** "Loser of Upper Bracket" — what a slot says before it has a team in it. */
function slotSource(source) {
  const take = source.take === 'winner' ? 'Winner' : 'Loser';
  return `${take} of ${titleOf(source.round)}`;
}

/** The team that lost a resolved round, or null while it is still undecided. */
function loserOf(resolved) {
  if (!resolved.winner) return null;
  const other = resolved.slots.find((s) => s.team !== null && s.team !== resolved.winner);
  return other ? other.team : null;
}

/**
 * Resolves the bracket as far as the recorded results allow. Rounds are
 * walked in order, so a later round can always read the one that feeds it.
 *
 * A declared winner that is not one of the round's resolved teams is ignored
 * rather than propagated — validatePlayoffs is what reports it.
 */
export function buildBracket(playoffs) {
  const source = playoffs ?? {};
  const byId = new Map();

  for (const round of ROUNDS) {
    const recorded = source[round.id] ?? {};

    const slots = round.seeded
      ? [0, 1].map((i) => ({ team: recorded.teams?.[i] ?? null, from: null }))
      : round.sources.map((from) => {
          const feeder = byId.get(from.round);
          const team = from.take === 'winner' ? feeder.winner : loserOf(feeder);
          return { team, from: team === null ? slotSource(from) : null };
        });

    const declared = typeof recorded.winner === 'string' ? recorded.winner : null;
    const winner = slots.some((s) => s.team === declared) ? declared : null;

    byId.set(round.id, {
      id: round.id,
      title: round.title,
      format: round.format,
      slots,
      winner,
      outcomes: round.outcomes,
    });
  }

  return ROUNDS.map((r) => byId.get(r.id));
}

/**
 * Returns {ok:true} or {ok:false, error} — never throws.
 *
 * `knownTeamIds` is optional. When it is given, every team named in the
 * bracket has to be one of them: a typo here would otherwise draw a card for
 * a team that does not exist, with no seed and an empty line-up.
 */
export function validatePlayoffs(playoffs, knownTeamIds) {
  if (playoffs === undefined || playoffs === null) return { ok: true };
  if (typeof playoffs !== 'object' || Array.isArray(playoffs)) {
    return { ok: false, error: 'Optional "playoffs" must be an object.' };
  }

  for (const round of ROUNDS) {
    const recorded = playoffs[round.id];
    if (recorded === undefined) continue;
    if (recorded === null || typeof recorded !== 'object' || Array.isArray(recorded)) {
      return { ok: false, error: `"${round.id}" must be an object.` };
    }
    if (round.seeded) {
      const { teams } = recorded;
      if (!Array.isArray(teams) || teams.length !== 2) {
        return { ok: false, error: `"${round.title}" needs exactly two "teams".` };
      }
      if (teams.some((t) => typeof t !== 'string' || t === '')) {
        return { ok: false, error: `"${round.title}" has a blank team name.` };
      }
      if (teams[0] === teams[1]) {
        return { ok: false, error: `"${round.title}" lists the same team twice.` };
      }
      if (knownTeamIds) {
        for (const team of teams) {
          if (!knownTeamIds.has(team)) {
            return {
              ok: false,
              error: `"${round.title}" names team "${team}", which is not defined.`,
            };
          }
        }
      }
    }
    if (recorded.winner !== undefined && typeof recorded.winner !== 'string') {
      return { ok: false, error: `"${round.title}" has a non-string "winner".` };
    }
  }

  // A winner only means something once the round's teams are known, so check
  // the declarations against the bracket the results actually produce.
  const bracket = buildBracket(playoffs);
  for (const round of bracket) {
    const declared = playoffs[round.id]?.winner;
    if (declared === undefined) continue;
    if (round.winner === null) {
      return {
        ok: false,
        error: `"${round.title}" records a winner of "${declared}", which is not playing that round yet.`,
      };
    }
  }

  return { ok: true };
}

/* ---------- rendering ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Groups the roster by team so a play-off card can show who is actually
 * playing. Players with no team are left out — there is no card for them.
 */
function rosterByTeam(data) {
  const byTeam = new Map();
  for (const player of data.players) {
    if (typeof player.team !== 'string' || player.team === '') continue;
    if (!byTeam.has(player.team)) byTeam.set(player.team, []);
    byTeam.get(player.team).push(player);
  }
  return byTeam;
}

/** The five-row line-up shown when a team is tapped open. */
function renderRoster(label, players) {
  const panel = el('div', 'po-roster');
  panel.append(el('div', 'po-roster-head', `${label} — line-up`));

  if (players.length === 0) {
    panel.append(el('p', 'po-roster-empty', 'No players on this roster yet.'));
    return panel;
  }

  const list = el('ol', 'po-roster-list');
  for (const player of players) {
    const item = el('li', 'po-player');
    item.append(el('span', 'po-ign', player.ign));
    // The real name is a placeholder until the rosters are confirmed, so it
    // is styled as secondary rather than sitting level with the IGN.
    item.append(el('span', 'po-real', player.name ?? 'Mr. X'));
    list.append(item);
  }
  panel.append(list);
  return panel;
}

/**
 * One side of a match-up. A team that is known is a button that opens its
 * roster; a slot still waiting on an earlier round is inert and says where
 * its team will come from.
 */
function renderSide(slot, context, onOpen) {
  if (slot.team === null) {
    const pending = el('div', 'po-side is-tbd');
    pending.append(el('span', 'po-badge is-tbd', '?'));
    pending.append(el('span', 'po-team', 'TBD'));
    pending.append(el('span', 'po-seed', slot.from ?? ''));
    return pending;
  }

  const side = el('button', 'po-side');
  side.type = 'button';
  side.setAttribute('aria-expanded', 'false');

  // The badge is the team id; the name underneath is what people call them.
  side.append(el('span', 'po-badge', slot.team));
  side.append(el('span', 'po-team', context.names.get(slot.team)?.name ?? slot.team));

  // Seed and group-stage record come straight from the Phase 1 table, so the
  // play-off page never drifts from the standings.
  const form = context.form.get(slot.team);
  const seed = form ? `#${form.rank} · ${form.won}W–${form.lost}L` : 'Phase 2';
  side.append(el('span', 'po-seed', seed));

  side.addEventListener('click', () => onOpen(side, slot.team));
  return side;
}

function renderRound(round, context) {
  const section = el('section', `po-round is-${round.id}`);

  const head = el('div', 'po-round-head');
  head.append(el('h2', 'po-round-title', round.title));
  head.append(el('span', 'po-fmt', round.format));
  section.append(head);

  const vs = el('div', 'po-vs');
  const rosterHost = el('div', 'po-roster-host');

  // One panel per card, showing whichever side was tapped last. Tapping the
  // open side again closes it, so a card can always be collapsed.
  let openTeam = null;
  const openRoster = (button, team) => {
    for (const other of vs.querySelectorAll('.po-side')) {
      other.classList.remove('is-open');
      if (other.tagName === 'BUTTON') other.setAttribute('aria-expanded', 'false');
    }
    if (openTeam === team) {
      openTeam = null;
      rosterHost.replaceChildren();
      return;
    }
    openTeam = team;
    button.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    rosterHost.replaceChildren(
      renderRoster(context.names.get(team)?.name ?? team, context.rosters.get(team) ?? []),
    );
  };

  round.slots.forEach((slot, index) => {
    if (index === 1) vs.append(el('span', 'po-vs-mark', 'VS'));
    const side = renderSide(slot, context, openRoster);
    if (round.winner !== null && slot.team !== null) {
      side.classList.add(slot.team === round.winner ? 'is-winner' : 'is-loser');
    }
    vs.append(side);
  });

  section.append(vs, rosterHost);

  const outcomes = el('div', 'po-outcomes');
  outcomes.append(el('span', 'po-out is-win', `W · ${round.outcomes.winner}`));
  outcomes.append(el('span', 'po-out is-lose', `L · ${round.outcomes.loser}`));
  section.append(outcomes);

  return section;
}

export function renderPlayoffs(container, data) {
  const header = el('header', 'lb-header');
  header.append(el('h1', 'lb-title', 'Play-off Bracket'));
  header.append(el('p', 'lb-meta', 'Phase 2 · Double Elimination'));
  header.append(
    el(
      'p',
      'lb-updated',
      'Opening rounds are best of 1. The Decider and the Grand Final are best of 3. Tap a team to see its line-up.',
    ),
  );
  container.append(header);

  const context = { form: new Map(), rosters: rosterByTeam(data), names: teamsById(data) };
  // Keyed by id: that is what the bracket names its teams by. Keying on the
  // display name would silently miss every lookup.
  for (const row of computeTeamTable(data)) context.form.set(row.teamId, row);

  const bracket = buildBracket(data.playoffs);
  bracket.forEach((round, index) => {
    container.append(renderRound(round, context));
    // A connector between cards, so the drop-down flow reads as a bracket
    // rather than as four unrelated panels.
    if (index < bracket.length - 1) container.append(el('div', 'po-link'));
  });
}
