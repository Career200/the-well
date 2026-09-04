import { newGame, NOTHING_NEW, runStatus, step, TUNING } from '../core/engine.js';
import type { Game, PlayerAction } from '../core/engine.js';
import { pack } from '../content/index.js';
import { feelBand, feelOf, stanceLine, water } from '../core/readout.js';
import { BELIEFS, EMOTIONS } from '../core/types.js';
import type { LineKind, NarrationLine } from '../core/types.js';
import { makeShaft, PLACES } from './visuals.js';
import type { Bands, PlaceId } from './visuals.js';
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

/**
 * The four things that are yours, in reading order. Built once and never
 * rebuilt: cells change state, the layout never moves, so the player sees from
 * the first frame that there are exactly four and never a fifth.
 *
 * The five places are not here. They are in the picture — see `visuals.ts`.
 */
const CELLS: { id: string; label: string }[] = [
  { id: 'ring', label: 'the ring' },
  { id: 'whistle', label: 'the whistle' },
  { id: 'knife', label: 'the knife' },
  { id: 'coat', label: 'the coat' },
];

const cells = new Map<string, HTMLButtonElement>();
const labels = new Map<string, HTMLSpanElement>();
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
  // Filled in by `render`: a thing out of the silt is not yet a named thing,
  // and until it has been looked at the cell says only what was glimpsed.
  label.textContent = cell.label;
  button.append(label);
  labels.set(cell.id, label);
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

const shaft = makeShaft(el('shaft'), {
  onLayout: fitLog,
  floor: () => document.querySelector('footer')!.getBoundingClientRect().top,
  onPlace,
});

/**
 * The words live on the dry stone: between the rim overhead and the waterline.
 * They never cross the water, which is the whole reason the well is only half
 * full — light text over a bright halftone cannot be read.
 *
 * Both edges come from the picture itself, so moving the geometry moves the
 * text with it.
 *
 * Safe against feedback: `#log` is the flex child that absorbs slack, so
 * shrinking it leaves the header and footer where they were.
 */
function fitLog({ skyBottom, waterTop }: Bands): void {
  const gap = 14;
  // Once it is over the words take the whole column, top edge included. The
  // picture is down to a quarter of itself by then and the controls are gone,
  // so there is nothing left to leave room for — and the reading room is what
  // decides whether the ending has to be scrolled at all.
  if (game.mode.kind === 'over') {
    log.style.marginTop = `${gap}px`;
    log.style.marginBottom = `${gap}px`;
    fadeCoda();
    return;
  }
  // The header is optional — `index.html` may not have one. With it, the words
  // start under it; without it, at the top of the column.
  const top = document.querySelector('header');
  const header = top ? top.getBoundingClientRect().bottom : el('app').getBoundingClientRect().top;
  const footer = document.querySelector('footer')!.getBoundingClientRect().top;
  log.style.marginTop = `${Math.max(0, skyBottom + gap - header)}px`;
  log.style.marginBottom = `${Math.max(0, footer - waterTop + gap)}px`;
}

/**
 * Which edges of the ending have more past them.
 *
 * The coda is the only thing in the app that scrolls, and a scrollbar beside
 * it is a piece of browser chrome standing in the middle of an ending. So the
 * bar is hidden and the words say it themselves: the edge they continue past
 * dissolves, and stops dissolving once there is nothing past it. An edge that
 * is the actual start or end of the text never fades — a soft top on a coda
 * you have not scrolled would be lying about where it begins.
 */
function fadeCoda(): void {
  if (!log.classList.contains('ended')) return;
  const past = log.scrollHeight - log.clientHeight - log.scrollTop;
  log.classList.toggle('more-above', log.scrollTop > 1);
  log.classList.toggle('more-below', past > 1);
}

log.addEventListener('scroll', fadeCoda, { passive: true });

/**
 * Places already out of the dark. The reveal is a one-shot per place and it is
 * driven by the lines, not by the phase: `phase.revealed` grows on the turn
 * the subject comes due, but the sentence about it can be held back a beat by
 * `linesPerTurn`, and inside a beat it waits on the stagger. Reading state at
 * render time put the stone up before the words that name it.
 */
const outOfTheDark = new Set<string>();

/** One place, coming up as its line is read. Anything else is not a place. */
function reveal(id: string | undefined, delayMs: number): void {
  if (id === undefined || outOfTheDark.has(id)) return;
  if (!(PLACES as readonly string[]).includes(id)) return;
  outOfTheDark.add(id);
  setTimeout(() => shaft.resolve(id as PlaceId), delayMs);
}

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

/**
 * The register comes from the engine; the client never guesses at it. So does
 * the caption — a line is one of the nine speaking or it is not, and the
 * client only dresses what it is told.
 */
function say(text: string, kind: LineKind | 'marker', delayMs = 0, subject?: string): void {
  const p = document.createElement('p');
  p.className = kind;
  p.textContent = text;
  if (subject) p.dataset['subject'] = subject;
  if (delayMs > 0) p.style.animationDelay = `${Math.round(delayMs)}ms`;
  log.append(p);
  // The ending outranks the cap: older lines go, but a coda line is never
  // evicted — the whole of it stays.
  while (log.childElementCount > MAX_LINES && !log.firstElementChild?.classList.contains('coda')) {
    log.firstElementChild?.remove();
  }
  // `forget` goes on taking coda lines away long after the last render, so the
  // edges are refreshed wherever the log's contents actually move. Free during
  // a run: nothing scrolls until the ending.
  fadeCoda();
}

/**
 * A run of lines, paced. Every entrance in the app goes through here, so
 * nothing can arrive as a paragraph by having been written somewhere that
 * forgot about the stagger — the opening did exactly that.
 *
 * Returns where the last line fell, so a caller with something to add after
 * the beat can carry on from it rather than landing on top of it.
 */
function narrate(lines: readonly NarrationLine[]): number {
  let delay = 0;
  lines.forEach((line, i) => {
    say(line.text, line.kind, delay, line.subject);
    // The place comes up as its own sentence starts to surface, not when the
    // beat that carries it was computed.
    reveal(line.subjectId, delay);
    const next = lines[i + 1];
    if (next) delay += gapAfter(line, next);
  });
  return delay;
}

function act(action: PlayerAction): void {
  const wasInScene = game.mode.kind === 'scene';
  const result = step(game, action);
  game = result.game;
  const delay = narrate(result.lines);
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
 * A cell comes online once the silt has given the thing up and its own line
 * has been said. Until then it is dead: in the dark there is nothing of yours
 * to hold, and the room is what you touch.
 */
function onCell(cell: { id: string }): void {
  const button = cells.get(cell.id)!;
  const state = game.state.objects[cell.id];
  if (!state || !surfaced(cell.id)) return;
  pulse(button, 'acted', 500);
  act(state.discovered ? { kind: 'attune', object: cell.id } : { kind: 'look', object: cell.id });
}

/**
 * A place, asked. It costs a turn whether or not it has anything — the engine
 * answers with `NOTHING_NEW` when it does not, and the picture never promises
 * more than that it is worth looking.
 *
 * Two moments it is not a question at all: beat zero, where the room is still
 * assembling itself and nothing is clickable, and a scene, where somebody at
 * the rim has the turn.
 */
function onPlace(id: PlaceId): void {
  if (game.mode.kind === 'below' || game.mode.kind === 'scene' || game.mode.kind === 'over') return;
  act({ kind: 'look', object: id });
}

/** A place with something to say. It signals until it is asked. */
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

/** Has the silt given this one up yet? Only then is it a thing you can hold. */
const surfaced = (id: string): boolean => game.state.objects[id]?.found === true;

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
  // Beat zero survived: the room is simply there, and this is the backstop for
  // any place whose line the phase passed without saying.
  //
  // Not once it is over. A run that starved in the dark never found the sky or
  // the silt, and revealing them here put both of them up in the same frame as
  // the coda — the ending announcing the way out the presence never found.
  // What was never seen stays unseen.
  if (game.mode.kind !== 'below' && game.mode.kind !== 'over') {
    for (const id of PLACES) reveal(id, 0);
  }
  el('shaft').classList.toggle('receding', game.mode.kind === 'over');
  shaft.update({
    // Full through the run: what comes into view is one place at a time, and a
    // ramp across the whole picture only drowned that out. Once it is over the
    // picture goes back down — the words run the whole shaft, and the ending is
    // what has to be readable, not the place.
    visibility: game.mode.kind === 'over' ? 0.28 : 1,
    lucidity: game.state.presence.lucidity,
    occupied: inScene,
    charge: game.state.presence.charge,
    pressing: game.state.presence.stance.kind === 'pressing',
    turn: game.state.turn,
    // A place that is open moves until it is asked. Nothing signals while a
    // scene holds the turn — it would be offering something you cannot take.
    signals: game.mode.kind === 'idle' ? PLACES.filter(open) : [],
    asking: game.mode.kind === 'idle',
  });
  el('shaft').setAttribute(
    'aria-label',
    `${water(game.state.presence.charge)}${inScene ? ' Somebody is at the rim.' : ''}`,
  );

  // Cells are only restyled, never added, removed or reordered. One lights
  // when the silt has given the thing up and its line has been said.
  for (const cell of CELLS) {
    const button = cells.get(cell.id)!;
    const lit = surfaced(cell.id);
    button.classList.toggle('lit', lit);

    // Announced once out of the silt, then asking quietly while unexamined.
    if (lit && !arrived.has(cell.id)) {
      arrived.add(cell.id);
      button.classList.add('surfacing');
      setTimeout(() => button.classList.remove('surfacing'), 1200);
    }
    button.classList.toggle('calling', lit && game.state.objects[cell.id]?.discovered === false);

    const state = game.state.objects[cell.id];
    // Its name is the reward for looking. Before that the cell wears the
    // glimpse — enough to tell the four apart, not enough to know any of them.
    labels.get(cell.id)!.textContent =
      state?.discovered === true ? cell.label : (pack.below?.[cell.id]?.glimpseName ?? cell.label);
    button.disabled = !lit;
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
    // The scrollbar was also the only thing making this reachable without a
    // mouse. It is gone, so the ending takes focus itself — and only now, when
    // it is the whole page and there is nothing else to tab to.
    log.tabIndex = 0;
    fitLog(shaft.bands());
    if (game.mode.spine === 'forgotten') forget();
    if (import.meta.env.DEV) console.log(dump());
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

  fitLog(shaft.bands());

  if (import.meta.env.DEV) console.log(dump());
}

function dump(): object {
  const s = game.state;
  const status = runStatus(game);
  return {
    turn: s.turn,
    seed: s.seed,
    mode: game.mode.kind,
    beliefs: Object.fromEntries(BELIEFS.map((b) => [b, Number(s.beliefs[b].toFixed(2))])),
    people: Object.fromEntries(
      Object.values(s.people).map((person) => [
        person.name,
        {
          present: person.present,
          emotions: Object.fromEntries(
            EMOTIONS.filter((e) => person.emotions[e] > 0.01).map((e) => [e, Number(person.emotions[e].toFixed(2))]),
          ),
        },
      ]),
    ),
    stance: stanceLine(s.presence, nameOf),
    status: status.kind === 'open' ? 'open' : `quiet — ${status.reason}`,
    objects: Object.fromEntries(Object.values(s.objects).map((o) => [o.id, Number(o.charge.toFixed(2))])),
    flags: Object.keys(s.flags).filter((f) => s.flags[f]),
    played: s.history.map((h) => `${h.scene}:${h.outcome}`),
  };
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

// The first thing anybody sees, and it was arriving as one block: three
// `say`s a millisecond apart. It is a beat like any other and paces like one.
narrate((pack.belowProse?.opening ?? []).map((text): NarrationLine => ({ kind: 'fact', text })));
render();
