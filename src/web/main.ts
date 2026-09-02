import { HAS_PRESSED, newGame, NOTHING_NEW, runStatus, step, TUNING } from '../core/engine.js';
import type { Game, PlayerAction } from '../core/engine.js';
import { pack } from '../content/index.js';
import { feelBand, feelOf, stanceLine, water } from '../core/readout.js';
import { BELIEFS, EMOTIONS } from '../core/types.js';
import type { LineKind, NarrationLine } from '../core/types.js';
import { makeShaft } from './visuals.js';
import type { Bands } from './visuals.js';
import { initAnalytics } from './analytics.js';

initAnalytics();

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
 * Everything down here, in reading order, three by three. Built once and never
 * rebuilt: cells change state, the layout never moves, so the player sees from
 * the first frame that there are exactly nine things and never a tenth.
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
  // `visibility: hidden` keeps the box its final size and keeps the word out
  // of the accessibility tree until it is the player's to know.
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = cell.label;
  button.append(label);
  button.onclick = () => onCell(cell);
  // Which corner the thing calls from. Walked round rather than random —
  // randomness belongs to the simulation — so no two neighbours share a side
  // and a belonging always calls from its own corner.
  const [dx, dy] = CORNERS[index % CORNERS.length]!;
  button.style.setProperty('--glow-dx', dx);
  button.style.setProperty('--glow-dy', dy);
  // The arrival is a one-shot; the slow call underneath takes over after. A
  // backgrounded tab throttles animations and may never fire `animationend`,
  // which would leave the cell stuck mid-arrival — hence the timer too.
  button.addEventListener('animationend', () => button.classList.remove('surfacing'));
  subjects.append(button);
  cells.set(cell.id, button);
});

const shaft = makeShaft(el('shaft'), fitLog, () => document.querySelector('footer')!.getBoundingClientRect().top);

/**
 * The words live between the coin of sky and the waterline. Both edges come
 * from the picture itself, so moving the geometry moves the text with it.
 *
 * Safe against feedback: `#log` is the flex child that absorbs slack, so
 * shrinking it leaves the header and footer where they were.
 */
function fitLog({ skyBottom, waterTop }: Bands): void {
  const gap = 14;
  const header = document.querySelector('header')!.getBoundingClientRect().bottom;
  const footer = document.querySelector('footer')!.getBoundingClientRect().top;
  log.style.marginTop = `${Math.max(0, skyBottom + gap - header)}px`;
  // Once it is over the words take the whole shaft — nothing left to read the
  // water for. `render` puts the controls away at the same moment.
  log.style.marginBottom =
    game.mode.kind === 'over' ? `${gap}px` : `${Math.max(0, footer - waterTop + gap)}px`;
}

/**
 * The world comes into view on its own clock, which only starts on the first
 * push; every line after that brings it up. A player who never acts sits in
 * the dark, which is the correct outcome.
 */
const REVEAL_LINES = 14;
let revealed = 0;

/**
 * Lines arrive one at a time even when a beat produced several: all are in the
 * document immediately, and the stagger is a delay on each entrance, so a beat
 * unfolds rather than appearing as a paragraph.
 *
 * The gap scales with the previous line's length — a flat tick gives
 * twenty-five words the same room as four — plus a breath for a new voice.
 */
const STAGGER = {
  base: 110,
  perWord: 24,
  /** A `fact` after a `scene` line is somebody else speaking. */
  registerShift: 160,
  /** Past this a long line stalls the ones behind it. */
  max: 850,
};

const gapAfter = (line: NarrationLine, next: NarrationLine): number =>
  Math.min(
    STAGGER.max,
    STAGGER.base +
      line.text.trim().split(/\s+/).length * STAGGER.perWord +
      (line.kind === next.kind ? 0 : STAGGER.registerShift),
  );

/**
 * No scrollback: the log holds the last `MAX_LINES` and the rest is gone.
 * Generous enough to read a scene through.
 */
const MAX_LINES = 12;

/** The register comes from the engine; the client never guesses at it. */
function say(text: string, kind: LineKind | 'marker', delayMs = 0): void {
  const p = document.createElement('p');
  p.className = kind;
  p.textContent = text;
  if (delayMs > 0) p.style.animationDelay = `${Math.round(delayMs)}ms`;
  log.append(p);
  // The ending outranks the cap: older lines go, but a coda line is never
  // evicted — the whole of it stays.
  while (log.childElementCount > MAX_LINES && !log.firstElementChild?.classList.contains('coda')) {
    log.firstElementChild?.remove();
  }
  if (game.state.flags[HAS_PRESSED]) revealed++;
}

function act(action: PlayerAction): void {
  const wasInScene = game.mode.kind === 'scene';
  const result = step(game, action);
  game = result.game;
  let delay = 0;
  result.lines.forEach((line, i) => {
    say(line.text, line.kind, delay);
    const next = result.lines[i + 1];
    if (next) delay += gapAfter(line, next);
  });
  if (!quiet && runStatus(game).kind === 'quiet') {
    quiet = true;
    const last = result.lines.at(-1);
    const stop: NarrationLine = { kind: 'system', text: 'nothing further will happen' };
    say(stop.text, stop.kind, last ? delay + gapAfter(last, stop) : 0);
  }
  // Markers are always written and CSS decides visibility, so turning debug on
  // shows the whole run's worth rather than only what landed while it was open.
  if (wasInScene && game.mode.kind !== 'scene') {
    const last = game.state.history.at(-1);
    if (last) say(`${last.scene} · ${last.outcome}`, 'marker');
  }
  render();
}

const nameOf = (id: string): string => pack.objects.find((o) => o.id === id)?.name ?? id;

/**
 * A cell comes online when its own line has been said. Before that, in beat
 * zero, clicking one pushes instead — nothing clicked in the dark does
 * nothing, and pushing is what turns the next cell up. Once the phase is over
 * a cell that cannot be acted on is disabled instead.
 */
function onCell(cell: { id: string; belonging: boolean }): void {
  const button = cells.get(cell.id)!;
  const state = game.state.objects[cell.id];
  if (cell.belonging && state && surfaced(cell.id)) {
    pulse(button, 'acted', 500);
    act(state.discovered ? { kind: 'attune', object: cell.id } : { kind: 'look', object: cell.id });
    return;
  }
  if (!cell.belonging && open(cell.id)) {
    pulse(button, 'acted', 500);
    act({ kind: 'look', object: cell.id });
    return;
  }
  if (game.mode.kind === 'below') push(button);
}

/** An ambient subject the presence can turn to. One look, then it closes again. */
const open = (id: string): boolean => game.state.flags[`subject.${id}.open`] === true;

/** A one-shot class, with a timer behind it in case the tab is not watching. */
function pulse(el: Element, cls: string, ms = 600): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth; // restart even if one is already running
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/**
 * Pushing, from wherever the player pushed from. If it lands, the push button
 * lights along with whatever was clicked — which is how a cell teaches that it
 * was a push. If there is nothing left, the room and the still button answer
 * instead: the same lesson from the other side, without showing a dial.
 */
function push(source?: Element): void {
  const refused = game.state.presence.charge < TUNING.pressCost;
  const button = el<HTMLButtonElement>('haunt-btn');
  if (source) pulse(source, 'acted', 500);

  if (refused) {
    pulse(el('still-btn'), 'refused', 1100);
    shaft.flash();
  } else if (source !== button) {
    pulse(button, 'acted', 500);
  }
  act({ kind: 'haunt' });
}

/**
 * Has this thing's own line been said yet? A belonging is on the world's
 * record once the silt gives it up; an ambient subject only resolves inside
 * the phase.
 */
function surfaced(id: string): boolean {
  if (game.state.objects[id]) return game.state.objects[id]!.found;
  if (game.mode.kind !== 'below') return true;
  return game.mode.phase.revealed.includes(id as never);
}

let quiet = false;
let forgetting: ReturnType<typeof setInterval> | undefined;

/**
 * The one ending that goes on happening after it is told. The engine erodes
 * the letters; this takes the remaining lines one at a time while the player
 * watches. Bounded: it stops when the coda is gone, and re-entry is a no-op.
 */
function forget(): void {
  if (forgetting) return;
  forgetting = setInterval(() => {
    const left = log.querySelector('p.coda');
    if (!left) {
      clearInterval(forgetting);
      forgetting = undefined;
      return;
    }
    left.remove();
    say(NOTHING_NEW, 'idle');
    // Slow on purpose: unreadable text taken away is a transition, not a loss.
  }, 13000);
}

function render(): void {
  const inScene = game.mode.kind === 'scene';
  // Clamped here, not in the shaft: `revealed` counts all run, so an unclamped
  // value would swallow the scaling applied below.
  const seen = game.state.flags[HAS_PRESSED] ? Math.min(1, revealed / REVEAL_LINES) : 0;
  el('shaft').classList.toggle('receding', game.mode.kind === 'over');
  shaft.update({
    // Once it is over the picture goes back down: the words run the whole
    // shaft, and the ending is what has to be readable, not the place.
    visibility: game.mode.kind === 'over' ? seen * 0.28 : seen,
    occupied: inScene,
    charge: game.state.presence.charge,
    pressing: game.state.presence.stance.kind === 'pressing',
    turn: game.state.turn,
  });
  el('shaft').setAttribute(
    'aria-label',
    `${water(game.state.presence.charge)}${inScene ? ' Somebody is at the rim.' : ''}`,
  );

  // Cells are only restyled, never added, removed or reordered. One lights
  // when its own line has been said; in the dark an unlit one still pushes.
  const inBelow = game.mode.kind === 'below';
  if (game.mode.kind === 'below') for (const id of game.mode.phase.revealed) met.add(id);
  else for (const cell of CELLS) if (!cell.belonging) met.add(cell.id);

  for (const cell of CELLS) {
    const button = cells.get(cell.id)!;
    const lit = cell.belonging ? surfaced(cell.id) && !!game.state.objects[cell.id] : met.has(cell.id);
    button.classList.toggle('lit', lit);

    // Only belongings call: announced once out of the silt, then asking
    // quietly while unexamined. The cold and the walls ask for nothing.
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
      // In the dark the cell answers with a push. Afterwards it is dead stone
      // until lucidity turns one of them up.
      button.disabled = !inBelow && !open(cell.id);
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
    // held until the player is still. Warmth is the border.
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

  // A finished run puts its controls away: nine dead cells would keep saying
  // there is something to do, and the ending needs the space.
  const footer = document.querySelector('footer')!;
  footer.classList.toggle('gone', game.mode.kind === 'over');
  if (game.mode.kind === 'over') {
    // The ending replaces the run: everything that led here goes, so the coda
    // gets the whole shaft. Scrolling comes back too — no-scrollback is a rule
    // about the run, and a long ending has to be readable to its end.
    for (const line of [...log.children]) if (!line.classList.contains('coda')) line.remove();
    log.classList.add('ended');
    fitLog(shaft.bands());
    if (game.mode.spine === 'forgotten') forget();
    if (!debug.hidden) debug.textContent = dump();
    return;
  }

  // Push is the one stance that can be unavailable, and it says so rather than
  // costing a beat to find out. Stillness is never refused, and when it is the
  // only move left it calls — a greyed-out button says nothing about what you
  // *can* do. The two calls differ in kind: a belonging asks in warm light,
  // stillness gathers the room's own cold behind itself.
  const spent = presence.charge < TUNING.pressCost;
  el<HTMLButtonElement>('haunt-btn').disabled = spent;
  el<HTMLButtonElement>('still-btn').classList.toggle('hinting', spent);

  // The debug row still comes and goes, so refit after every beat rather than
  // only when the shaft is laid out.
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
  button.onclick = () => {
    if (kind === 'haunt') return push(button);
    pulse(button, 'acted', 500);
    act({ kind } as PlayerAction);
  };
}

/**
 * One switch for everything that is not the game: state panel, meters, and the
 * scene·outcome markers. All instruments; all put away together.
 */
el('peek').onclick = () => {
  debug.hidden = !debug.hidden;
  document.body.classList.toggle('debug', !debug.hidden);
  render();
};

(pack.belowProse?.opening ?? []).forEach((line, i) => say(line, 'fact', i));
render();
