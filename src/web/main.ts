import { HAS_PRESSED, newGame, runStatus, step, TUNING } from '../core/engine.js';
import type { Game, PlayerAction } from '../core/engine.js';
import { pack } from '../content/index.js';
import { feelBand, feelOf, stanceLine, water } from '../core/readout.js';
import { BELIEFS, EMOTIONS } from '../core/types.js';
import type { LineKind } from '../core/types.js';
import { makeShaft } from './visuals.js';
import type { Bands } from './visuals.js';

const seed = Number(new URLSearchParams(location.search).get('seed') ?? Math.floor(Math.random() * 1e5));
let game: Game = newGame(pack, seed, { below: true });

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const log = el('log');
const subjects = el('subjects');
const meters = el('meters');
const debug = el<HTMLPreElement>('debug');

/**
 * Everything there is down here, in reading order, three by three. The grid is
 * built once and never rebuilt — cells change state, the layout never moves,
 * and the player can see from the first frame that there are exactly nine
 * things and there will never be a tenth.
 */
const CELLS: { id: string; label: string; belonging: boolean }[] = [
  { id: 'cold', label: 'the cold', belonging: false },
  { id: 'water', label: 'the water', belonging: false },
  { id: 'walls', label: 'the walls', belonging: false },
  { id: 'sky', label: 'the sky', belonging: false },
  { id: 'silt', label: 'the silt', belonging: false },
  { id: 'ring', label: 'the ring', belonging: true },
  { id: 'whistle', label: 'the whistle', belonging: true },
  { id: 'knife', label: 'the knife', belonging: true },
  { id: 'coat', label: 'the coat', belonging: true },
];

/** Ambient subjects met so far. The phase forgets; the room does not. */
const met = new Set<string>();
const cells = new Map<string, HTMLButtonElement>();
/** Cells that have already surfaced, so the arrival only ever plays once. */
const arrived = new Set<string>();

/** Which way the bloom leans, in the order the grid is walked. */
const CORNERS = [
  ['-8px', '-8px'],
  ['8px', '-8px'],
  ['8px', '8px'],
  ['-8px', '8px'],
] as const;

CELLS.forEach((cell, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cell';
  // The name lives in a span so an unmet cell can hide it without collapsing:
  // `visibility: hidden` keeps the box exactly the size it will be when the
  // thing arrives, and keeps the word out of the accessibility tree until it
  // is the player's to know.
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = cell.label;
  button.append(label);
  button.onclick = () => onCell(cell);
  // Which corner the thing calls from. Walked round rather than drawn at
  // random — `rng.ts` reserves randomness for the simulation, no two
  // neighbours call from the same side, and a belonging always calls from
  // its own corner, which is a small tell of its own.
  const [dx, dy] = CORNERS[index % CORNERS.length]!;
  button.style.setProperty('--glow-dx', dx);
  button.style.setProperty('--glow-dy', dy);
  // The arrival is a one-shot; the slow call underneath it takes over after.
  // Belt and braces on the timer, because a tab that is not being looked at
  // throttles its animations and `animationend` may never arrive — and a cell
  // stuck mid-arrival would never start calling.
  button.addEventListener('animationend', () => button.classList.remove('surfacing'));
  subjects.append(button);
  cells.set(cell.id, button);
});

const shaft = makeShaft(el('shaft'), fitLog, () => document.querySelector('footer')!.getBoundingClientRect().top);

/**
 * The words live between the coin of sky and the waterline. Both edges come
 * from the picture itself rather than from a margin somebody guessed, so
 * moving the geometry moves the text out of its way automatically.
 *
 * Safe against feedback: `#log` is the flex child that absorbs slack, so
 * shrinking it leaves the header and footer exactly where they were.
 */
function fitLog({ skyBottom, waterTop }: Bands): void {
  const gap = 14;
  const header = document.querySelector('header')!.getBoundingClientRect().bottom;
  const footer = document.querySelector('footer')!.getBoundingClientRect().top;
  log.style.marginTop = `${Math.max(0, skyBottom + gap - header)}px`;
  log.style.marginBottom = `${Math.max(0, footer - waterTop + gap)}px`;
}

/**
 * The world comes into view on a clock of its own, and the clock only starts
 * when the presence first pushes. Every line written after that brings it up a
 * little, so a player who does anything at all is guaranteed the whole picture
 * in short order — and a player who stays perfectly still the entire run sits
 * in the dark, which is the correct outcome for someone who never acted.
 */
const REVEAL_LINES = 14;
let revealed = 0;

/**
 * Lines arrive one at a time even when a beat produced four of them: they are
 * in the document immediately, and the stagger is a delay on each one's
 * entrance. A beat should read as a thing unfolding, not as a paragraph
 * appearing.
 */
const STAGGER_MS = 180;

/**
 * There is no scrollback. The log holds the last `MAX_LINES` and the rest is
 * gone — the room is what you can see, and nothing down here is ever
 * recovered. What does not fit in the band is the player's loss, which is why
 * the count is generous enough to read a scene through.
 */
const MAX_LINES = 12;

/** The register comes from the engine now — the client never guesses at it. */
function say(text: string, kind: LineKind | 'marker', index = 0): void {
  const p = document.createElement('p');
  p.className = kind;
  p.textContent = text;
  if (index > 0) p.style.animationDelay = `${index * STAGGER_MS}ms`;
  log.append(p);
  while (log.childElementCount > MAX_LINES) log.firstElementChild?.remove();
  if (game.state.flags[HAS_PRESSED]) revealed++;
}

function act(action: PlayerAction): void {
  const wasInScene = game.mode.kind === 'scene';
  const result = step(game, action);
  game = result.game;
  result.lines.forEach((line, i) => say(line.text, line.kind, i));
  if (!quiet && runStatus(game).kind === 'quiet') {
    quiet = true;
    say('nothing further will happen', 'system', result.lines.length);
  }
  // Markers are always written, and CSS decides whether they are visible —
  // so turning debug on shows the whole run's worth, not just what happened
  // to land while the panel was open.
  if (wasInScene && game.mode.kind !== 'scene') {
    const last = game.state.history.at(-1);
    if (last) say(`${last.scene} · ${last.outcome}`, 'marker');
  }
  render();
}

const nameOf = (id: string): string => pack.objects.find((o) => o.id === id)?.name ?? id;

/**
 * A cell comes online when its own line has been said — the room reaches you
 * one thing at a time. Before that, in beat zero, reaching for it is not a
 * refusal and not a dead control: you are not all there yet, so the only thing
 * you can do to a thing you cannot name is push at it, and pushing is what
 * turns the next one up. Nothing you click in the dark does nothing.
 *
 * Once the phase is over the presence has itself together, and a cell that
 * cannot be acted on says so by being disabled.
 */
function onCell(cell: { id: string; belonging: boolean }): void {
  const state = game.state.objects[cell.id];
  if (cell.belonging && state && surfaced(cell.id)) {
    act(state.discovered ? { kind: 'attune', object: cell.id } : { kind: 'look', object: cell.id });
    return;
  }
  if (game.mode.kind === 'below') act({ kind: 'haunt' });
}

/** Has this thing's own line been said yet? */
function surfaced(id: string): boolean {
  if (game.mode.kind !== 'below') return true;
  const phase = game.mode.phase;
  return !!phase.seen[id] || phase.revealed.includes(id as never);
}

let quiet = false;

function render(): void {
  const inScene = game.mode.kind === 'scene';
  shaft.update({
    visibility: game.state.flags[HAS_PRESSED] ? revealed / REVEAL_LINES : 0,
    occupied: inScene,
    charge: game.state.presence.charge,
    pressing: game.state.presence.stance.kind === 'pressing',
    turn: game.state.turn,
  });
  el('shaft').setAttribute(
    'aria-label',
    `${water(game.state.presence.charge)}${inScene ? ' Somebody is at the rim.' : ''}`,
  );

  // Cells are only ever restyled — never added, removed or reordered. A cell
  // lights when its own line has been said; in the dark an unlit one is still
  // live, and reaching for it pushes.
  const inBelow = game.mode.kind === 'below';
  if (game.mode.kind === 'below') for (const id of game.mode.phase.revealed) met.add(id);
  else for (const cell of CELLS) if (!cell.belonging) met.add(cell.id);

  for (const cell of CELLS) {
    const button = cells.get(cell.id)!;
    const lit = cell.belonging ? surfaced(cell.id) && !!game.state.objects[cell.id] : met.has(cell.id);
    button.classList.toggle('lit', lit);

    // Only the belongings call. A thing that was yours announces itself once
    // when it comes out of the silt and then goes on asking quietly for as
    // long as it is unexamined; the cold and the walls and the sky do none of
    // that, because they are not asking for anything. They are just there.
    if (cell.belonging && lit && !arrived.has(cell.id)) {
      arrived.add(cell.id);
      button.classList.add('surfacing');
      setTimeout(() => button.classList.remove('surfacing'), 1200);
    }
    button.classList.toggle(
      'calling',
      cell.belonging && lit && game.state.objects[cell.id]?.discovered === false,
    );

    if (!cell.belonging) {
      // Lookable subjects are not built yet — see NEXT_STEPS. In the dark the
      // cell still answers, because everything there answers with a push.
      button.disabled = !inBelow;
      continue;
    }

    const state = game.state.objects[cell.id];
    button.disabled = !inBelow && !lit;
    if (!lit || !state) {
      delete button.dataset['feel'];
      button.title = '';
      button.classList.remove('unknown');
      continue;
    }
    // A belonging is a stance, not an item slot: clicking it is *hold this*,
    // and it stays held until the player is still. Warmth is the border.
    button.disabled = state.discovered && state.charge <= TUNING.spent;
    button.classList.toggle('unknown', !state.discovered);
    button.dataset['feel'] = state.discovered ? feelBand(state) : 'unknown';
    button.title = state.discovered ? feelOf(state) : 'look closer';
  }

  const { presence, well } = game.state;
  meters.replaceChildren();

  for (const [label, value] of [
    ['charge', presence.charge],
    ['dread', well.dread],
    ['attention', well.attention],
    ['lucidity', presence.lucidity],
  ] as const) {
    const span = document.createElement('span');
    span.append(`${label} `);
    const b = document.createElement('b');
    b.textContent = '█'.repeat(Math.round(value * 8)).padEnd(8, '·');
    span.append(b);
    meters.append(span);
  }

  // Push is the one stance that can be unavailable, and it says so rather than
  // letting the player spend a beat finding out. Stillness is never refused —
  // and when it is the only move left it calls, in the same voice the
  // belongings use, because a greyed-out button says what you cannot do and
  // nothing at all about what you can.
  // The two calls are deliberately different in kind: a belonging asks for you
  // in warm light, and stillness only gathers the room's own cold behind
  // itself — the same wash as the agitation over the whole screen, told small.
  const spent = presence.charge < TUNING.pressCost;
  el<HTMLButtonElement>('haunt-btn').disabled = spent;
  el<HTMLButtonElement>('still-btn').classList.toggle('hinting', spent);

  // The footer is a fixed size now, but the debug row still comes and goes, so
  // the words are re-fitted to the water after every beat rather than only
  // when the shaft is laid out.
  fitLog(shaft.bands());

  if (!debug.hidden) debug.textContent = dump();
}

function dump(): string {
  const s = game.state;
  const rows = [
    `turn ${s.turn}  seed ${s.seed}  mode ${game.mode.kind}`,
    `beliefs ${BELIEFS.map((b) => `${b} ${s.beliefs[b].toFixed(2)}`).join('  ')}`,
    '',
  ];
  for (const person of Object.values(s.people)) {
    const felt = EMOTIONS.filter((e) => person.emotions[e] > 0.01)
      .map((e) => `${e} ${person.emotions[e].toFixed(2)}`)
      .join(' ');
    rows.push(`${person.present ? ' ' : '×'} ${person.name.padEnd(15)} ${felt || '—'}`);
  }
  const status = runStatus(game);
  rows.push('', `stance ${stanceLine(s.presence, nameOf)}  ·  ${status.kind === 'open' ? 'open' : `quiet — ${status.reason}`}`);
  rows.push(`objects ${Object.values(s.objects).map((o) => `${o.id} ${o.charge.toFixed(2)}`).join('  ')}`);
  rows.push(`flags ${Object.keys(s.flags).filter((f) => s.flags[f]).join(', ') || '—'}`);
  rows.push(`played ${s.history.map((h) => `${h.scene}:${h.outcome}`).join(', ') || '—'}`);
  return rows.join('\n');
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-act]')) {
  const kind = button.dataset['act'];
  if (kind === 'haunt') button.id = 'haunt-btn';
  if (kind === 'still') button.id = 'still-btn';
  button.onclick = () => act({ kind } as PlayerAction);
}

/**
 * One switch for everything that is not the game: the state panel, the meters,
 * and the scene·outcome markers in the log. All three are instruments, none of
 * them is the well, and the player should be able to put all of them away with
 * one hand.
 */
el('peek').onclick = () => {
  debug.hidden = !debug.hidden;
  document.body.classList.toggle('debug', !debug.hidden);
  render();
};

(pack.belowProse?.opening ?? []).forEach((line, i) => say(line, 'fact', i));
render();
