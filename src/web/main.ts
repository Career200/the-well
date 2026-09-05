import { newGame, NOTHING_NEW, resonanceStrength, runStatus, step, TUNING } from '../core/engine.js';
import type { Game, PlayerAction } from '../core/engine.js';
import { applyEffects } from '../core/effects.js';
import { pack } from '../content/index.js';
import { NOTICED, UNDENIABLE } from '../content/scenes.js';
import { feelBand, feelOf, water } from '../core/readout.js';
import type { LineKind, NarrationLine } from '../core/types.js';
import { makeShaft } from './visuals.js';
import { PLACES } from './shaft.js';
import type { Bands, PlaceId } from './shaft.js';
import { initAnalytics } from './analytics.js';
import type { DevPanel } from './dev.js';

initAnalytics();

/** Dev-only, and dynamically imported so the module is absent from a build. */
let dev: DevPanel | undefined;
if (import.meta.env.DEV) {
  void import('./dev.js').then((m) => {
    dev = m.attach(() => game);
    dev.update();
  });
}

const seed = Number(new URLSearchParams(location.search).get('seed') ?? Math.floor(Math.random() * 1e5));
let game: Game = newGame(pack, seed, { below: true });

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const log = el('log');
const subjects = el('subjects');

/**
 * The four belongings, in reading order. Built once: cells change state, the
 * layout never moves. The five places live in the picture — see `visuals.ts`.
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
  // What the stylesheet reads to give the belonging its hue.
  button.dataset['id'] = cell.id;
  // The name lives in a span so `visibility: hidden` can hide it without
  // collapsing the box or leaving the word in the accessibility tree.
  const label = document.createElement('span');
  label.className = 'label';
  // `render` swaps this for the glimpse until the thing has been looked at.
  label.textContent = cell.label;
  button.append(label);
  labels.set(cell.id, label);
  button.onclick = () => onCell(cell);
  // Walked round rather than drawn, so no two neighbours share a side and a
  // belonging keeps the same corner for the whole run.
  const [dx, dy] = CORNERS[index % CORNERS.length]!;
  button.style.setProperty('--glow-dx', dx);
  button.style.setProperty('--glow-dy', dy);
  // A backgrounded tab may never fire `animationend`, so `render` also clears
  // this on a timer.
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
 * Keeps the text between the rim and the waterline, where it stays legible.
 * Both edges come from the picture, so moving the geometry moves the text.
 *
 * No feedback loop: `#log` is the flex child that absorbs slack, so resizing
 * it leaves the header and footer where they were.
 */
function fitLog({ skyBottom, waterTop }: Bands): void {
  const gap = 14;
  // Once it is over the words take the whole column: the picture has receded
  // and the controls are gone.
  if (game.mode.kind === 'over') {
    log.style.marginTop = `${gap}px`;
    log.style.marginBottom = `${gap}px`;
    fadeCoda();
    return;
  }
  // The header is optional; without one the words start at the column top.
  const top = document.querySelector('header');
  const header = top ? top.getBoundingClientRect().bottom : el('app').getBoundingClientRect().top;
  const footer = document.querySelector('footer')!.getBoundingClientRect().top;
  log.style.marginTop = `${Math.max(0, skyBottom + gap - header)}px`;
  log.style.marginBottom = `${Math.max(0, footer - waterTop + gap)}px`;
}

/**
 * Marks which edges of the coda have more text past them. The scrollbar is
 * hidden, so the fade is the only affordance; a true start or end never fades.
 */
function fadeCoda(): void {
  if (!log.classList.contains('ended')) return;
  const past = log.scrollHeight - log.clientHeight - log.scrollTop;
  log.classList.toggle('more-above', log.scrollTop > 1);
  log.classList.toggle('more-below', past > 1);
}

log.addEventListener('scroll', fadeCoda, { passive: true });

/**
 * Places already out of the dark. One-shot per place, and driven by the lines
 * rather than by `phase.revealed`: a subject can come due a beat before its
 * sentence is released by `linesPerTurn`, and later still by the stagger.
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
 * All of a beat's lines enter the document at once; the stagger is a delay on
 * each entrance. The gap scales with the previous line's length, plus a pause
 * whenever the register changes.
 */
const STAGGER = {
  base: 110,
  perWord: 24,
  /** Added when the next line is a different `LineKind`. */
  registerShift: 160,
  /** Ceiling, so a long line does not stall the ones behind it. */
  max: 850,
};

const gapAfter = (line: NarrationLine, next: NarrationLine): number =>
  Math.min(
    STAGGER.max,
    STAGGER.base +
      line.text.trim().split(/\s+/).length * STAGGER.perWord +
      (line.kind === next.kind ? 0 : STAGGER.registerShift),
  );

/** No scrollback during a run: the log holds this many lines. */
const MAX_LINES = 12;

/** Register and caption both come from the engine; the client only styles. */
function say(text: string, kind: LineKind | 'marker', delayMs = 0, subject?: string, subjectId?: string): void {
  const p = document.createElement('p');
  p.className = kind;
  p.textContent = text;
  if (subject) p.dataset['subject'] = subject;
  // The caption can be worded any way; the id is what the hue is keyed on.
  if (subjectId) p.dataset['subjectId'] = subjectId;
  if (delayMs > 0) p.style.animationDelay = `${Math.round(delayMs)}ms`;
  log.append(p);
  // Coda lines are exempt from the cap; the whole ending stays.
  while (log.childElementCount > MAX_LINES && !log.firstElementChild?.classList.contains('coda')) {
    log.firstElementChild?.remove();
  }
  // `forget` moves the log's contents outside of render, so refresh here.
  // A no-op during a run, where nothing scrolls.
  fadeCoda();
}

/**
 * A run of lines, paced. Every entrance goes through here. Returns the delay
 * each line fell on, so a caller can time something to any of them.
 */
function narrate(lines: readonly NarrationLine[]): number[] {
  const delays: number[] = [];
  let delay = 0;
  lines.forEach((line, i) => {
    delays.push(delay);
    say(line.text, line.kind, delay, line.subject, line.subjectId);
    // The place comes up with its own sentence, not with the beat.
    reveal(line.subjectId, delay);
    const next = lines[i + 1];
    if (next) delay += gapAfter(line, next);
  });
  return delays;
}

function act(action: PlayerAction): void {
  // A beat cuts short whatever the previous one was still holding.
  release();
  const before = game;
  const wasInScene = before.mode.kind === 'scene';
  // An event, not a condition, so it is read from the click.
  pushedThisBeat = action.kind === 'haunt';
  const lucidityBefore = game.state.presence.lucidity;
  const result = step(game, action);
  game = result.game;
  const delays = narrate(result.lines);
  const delay = delays.at(-1) ?? 0;
  // The coat's hiding is the only thing that takes lucidity back, so a drop
  // is the beat somebody came and was missed. Timed to the last line, because
  // it is the answer to what was just read.
  if (game.state.presence.lucidity < lucidityBefore) {
    setTimeout(() => shaft.withdraw(), delay);
  }
  if (!quiet && runStatus(game).kind === 'quiet') {
    quiet = true;
    const last = result.lines.at(-1);
    const stop: NarrationLine = { kind: 'idle', text: pack.presence.nothingFurther };
    say(stop.text, stop.kind, last ? delay + gapAfter(last, stop) : 0);
  }
  if (wasInScene && game.mode.kind !== 'scene') {
    hold(afterAction(before, action), result.lines, delays);
    // Always written; CSS decides visibility, so debug shows the whole run.
    const last = game.state.history.at(-1);
    if (last) say(`${last.scene} · ${last.outcome}`, 'marker');
  }
  render();
}

/** A cell is live once the thing is out of the silt and its line was said. */
function onCell(cell: { id: string }): void {
  const button = cells.get(cell.id)!;
  const state = game.state.objects[cell.id];
  if (!state || !surfaced(cell.id)) return;
  pulse(button, 'acted', 500);
  act(state.discovered ? { kind: 'attune', object: cell.id } : { kind: 'look', object: cell.id });
}

/**
 * Asking a place costs a beat whether or not it has anything; the engine
 * answers `NOTHING_NEW` when it does not. Not askable during beat zero, a
 * scene, or after the run is over.
 */
function onPlace(id: PlaceId): void {
  if (game.mode.kind === 'below' || game.mode.kind === 'scene' || game.mode.kind === 'over') return;
  act({ kind: 'look', object: id });
}

/** A place with something to say. It signals until it is asked. */
const open = (id: string): boolean => game.state.flags[`subject.${id}.open`] === true;

/** A one-shot class, with a timer behind it in case the tab is throttled. */
function pulse(el: Element, cls: string, ms = 600): void {
  el.classList.remove(cls);
  void (el as HTMLElement).offsetWidth; // restart even if one is already running
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

/**
 * Pushing, from any source. On a push that lands the push button lights with
 * whatever was clicked; on a refusal the shaft and the still button answer.
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

/** Out of the silt, and so usable. */
const surfaced = (id: string): boolean => game.state.objects[id]?.found === true;

let quiet = false;
/** Whether the beat just played was a push. An event, not a condition. */
let pushedThisBeat = false;
let forgetting: ReturnType<typeof setInterval> | undefined;

/**
 * The `forgotten` ending only. The engine erodes the letters; this removes the
 * remaining lines one at a time. 
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
  }, 13000);
}

/** Whoever is up there, as the picture shows them. */
interface Rim {
  occupied: boolean;
  occlusion: number;
  leaving: boolean;
  recoil: 0 | 1 | 2;
  resonating: string | null;
  reach: number;
}

const EMPTY_RIM: Rim = {
  occupied: false,
  occlusion: 0,
  leaving: false,
  recoil: 0,
  resonating: null,
  reach: 0,
};

const recoilOf = (pressure: number): 0 | 1 | 2 => (pressure >= UNDENIABLE ? 2 : pressure >= NOTICED ? 1 : 0);

/**
 * A resonance against the best that belonging can do, 0 to 1.
 * `resonanceStrength` is `power * affinity * charge`; dividing out `power`,
 * which is the same for every use of one thing, leaves affinity times charge.
 * The charge is what is left *after* the use, so the most any first use can
 * carry is `1 - holdCost`, and that is what 1 means here.
 */
function reachOf(object: string, strength: number): number {
  const power = pack.objects.find((o) => o.id === object)?.power ?? 0;
  const best = power * (1 - TUNING.holdCost);
  return best > 0 ? Math.min(1, Math.max(0, strength / best)) : 0;
}

/**
 * The strength the engine will record for a belonging used on this beat, for
 * the one frame the client has to draw before it can read it back. Built the
 * way the engine builds it: the use is paid for first, and the charge left is
 * part of what reaches them.
 */
function strengthOf(before: Game, object: string): number {
  const mode = before.mode;
  const def = pack.objects.find((o) => o.id === object);
  const playing = mode.kind === 'scene' ? pack.scenes.find((s) => s.id === mode.scene) : undefined;
  if (!def || !playing) return 0;
  const spent = applyEffects(before.state, [
    { kind: 'objectCharge', object: def.id, delta: -TUNING.holdCost },
  ]);
  return resonanceStrength({ ...before, state: spent }, def, playing.cast);
}

/** Beats of the playing scene left after this one, or 0 outside a scene. */
function beatsLeft(g: Game): number {
  const mode = g.mode;
  if (mode.kind !== 'scene') return 0;
  const playing = pack.scenes.find((s) => s.id === mode.scene);
  return playing ? Math.max(0, playing.beats.length - 1 - mode.ctx.beatIndex) : 0;
}

/**
 * What the two levers have done to whoever is up there, this scene. Both are
 * kept for the length of a scene and both are gone the moment it ends, so an
 * empty rim always reads as nothing having happened — which is exactly what
 * did happen when a lever was pulled at one. `held` is the exception, and the
 * only channel in `render` the words are allowed to hold up.
 */
function atTheRim(): Rim {
  if (held) return held;
  if (game.mode.kind !== 'scene') return EMPTY_RIM;
  const { pressure, resonance } = game.mode.ctx;
  return {
    occupied: true,
    // Full while they are over the hole, released on the beat that is the last
    // one: the light coming back is them leaning off it, and it is the only
    // notice the player gets that this is the last chance to reach them.
    occlusion: beatsLeft(game) === 0 ? 0 : 1,
    leaving: false,
    recoil: recoilOf(pressure),
    resonating: resonance?.object ?? null,
    reach: resonance ? reachOf(resonance.object, resonance.strength) : 0,
  };
}

/**
 * The rim as the beat leaves it. The scene context is gone from `game` the
 * moment the scene resolves, so a lever pulled on the resolving beat exists
 * nowhere to read back; it is reconstructed here from the click and from the
 * context that click landed in.
 */
function afterAction(before: Game, action: PlayerAction): Rim {
  if (before.mode.kind !== 'scene') return EMPTY_RIM;
  const { pressure, resonance } = before.mode.ctx;
  const pressed = action.kind === 'haunt' && before.state.presence.charge >= TUNING.pressCost;
  const used = action.kind === 'attune' ? action.object : null;
  const reaching = used ?? resonance?.object ?? null;
  const strength = used ? strengthOf(before, used) : (resonance?.strength ?? 0);
  return {
    occupied: true,
    occlusion: 0,
    leaving: false,
    recoil: recoilOf(pressed ? pressure + TUNING.pressure : pressure),
    resonating: reaching,
    reach: reaching ? reachOf(reaching, strength) : 0,
  };
}

/** How long the exit takes. Matches `.figure.leaving` in the stylesheet. */
const LEAVING_MS = 1100;

let held: Rim | null = null;
let holdTimer: ReturnType<typeof setTimeout> | undefined;

/** Back to whatever the state says. A new beat cuts a running hold short. */
function release(): void {
  clearTimeout(holdTimer);
  holdTimer = undefined;
  held = null;
}

/**
 * Keep the rim as the beat left it until the line about it has been read, then
 * let them go with that pose still on them. Timed to the last scene line
 * rather than to the end of the beat, so a coda does not keep them there. The
 * coat withholds that line, and then the beat's last line is the cue instead.
 */
function hold(rim: Rim, lines: readonly NarrationLine[], delays: readonly number[]): void {
  const scened = lines.reduce((found, line, i) => (line.kind === 'scene' ? i : found), -1);
  const at = scened >= 0 ? scened : lines.length - 1;
  const line = lines[at];
  if (!line) return;
  held = rim;
  // The line's own gap, as if another like it followed: how long it takes to
  // read, by the same rule the stagger uses.
  holdTimer = setTimeout(() => {
    held = { ...rim, occupied: false, leaving: true };
    render();
    holdTimer = setTimeout(() => {
      release();
      render();
    }, LEAVING_MS);
  }, delays[at]! + gapAfter(line, line));
}

function render(): void {
  // Somebody is up there as far as the picture and the label are concerned,
  // which includes a rim being held past the end of its scene.
  const inScene = game.mode.kind === 'scene' || (held?.occupied ?? false);
  // Backstop for any place whose line beat zero passed without saying. Not
  // once the run is over: what was never revealed stays unrevealed.
  if (game.mode.kind !== 'below' && game.mode.kind !== 'over') {
    for (const id of PLACES) reveal(id, 0);
  }
  // The run is over on the beat the terminal scene resolved, but the picture
  // is still holding that scene's last moment; it recedes once that is read.
  const done = game.mode.kind === 'over' && !held;
  el('shaft').classList.toggle('receding', done);
  shaft.update({
    // Full through the run; the picture recedes once the coda has the column.
    visibility: done ? 0.28 : 1,
    lucidity: game.state.presence.lucidity,
    ...atTheRim(),
    charge: game.state.presence.charge,
    pressing: pushedThisBeat,
    turn: game.state.turn,
    // An open place signals until it is asked. Nothing signals in a scene,
    // where `onPlace` would refuse the click anyway.
    signals: game.mode.kind === 'idle' ? PLACES.filter(open) : [],
    asking: game.mode.kind === 'idle',
  });
  el('shaft').setAttribute(
    'aria-label',
    `${water(pack.instrument, game.state.presence.charge)}${inScene ? pack.instrument.atTheRim : ''}`,
  );

  // Cells are only restyled, never added, removed or reordered.
  for (const cell of CELLS) {
    const button = cells.get(cell.id)!;
    const lit = surfaced(cell.id);
    button.classList.toggle('lit', lit);

    // The arrival plays once; `calling` continues while it is unexamined.
    if (lit && !arrived.has(cell.id)) {
      arrived.add(cell.id);
      button.classList.add('surfacing');
      setTimeout(() => button.classList.remove('surfacing'), 1200);
    }
    button.classList.toggle('calling', lit && game.state.objects[cell.id]?.discovered === false);

    const state = game.state.objects[cell.id];
    // The glimpse stands in for the name until the thing has been looked at.
    labels.get(cell.id)!.textContent =
      state?.discovered === true ? cell.label : (pack.below?.[cell.id]?.glimpseName ?? cell.label);
    button.disabled = !lit;
    if (!lit || !state) {
      delete button.dataset['feel'];
      button.title = '';
      button.classList.remove('unknown');
      continue;
    }
    // Clicking spends one use immediately. Charge shows as the border colour.
    button.disabled = state.discovered && state.charge <= TUNING.spent;
    button.classList.toggle('unknown', !state.discovered);
    button.dataset['feel'] = state.discovered ? feelBand(state) : 'unknown';
    button.title = state.discovered ? feelOf(pack.instrument, state) : 'look closer';
  }

  const { presence } = game.state;

  // Coda replaces the run and scrolls
  const footer = document.querySelector('footer')!;
  footer.classList.toggle('gone', game.mode.kind === 'over');
  if (game.mode.kind === 'over') {
    for (const line of [...log.children]) if (!line.classList.contains('coda')) line.remove();
    log.classList.add('ended');
    // With the scrollbar hidden, the log itself has to be keyboard-reachable.
    log.tabIndex = 0;
    fitLog(shaft.bands());
    if (game.mode.spine === 'forgotten') forget();
    dev?.update();
    return;
  }

  const spent = presence.charge < TUNING.pressCost;
  el<HTMLButtonElement>('haunt-btn').disabled = spent;
  el<HTMLButtonElement>('still-btn').classList.toggle('hinting', spent);

  fitLog(shaft.bands());

  dev?.update();
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

narrate((pack.belowProse?.opening ?? []).map((text): NarrationLine => ({ kind: 'fact', text })));
render();
