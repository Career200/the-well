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
const belongings = el('belongings');
const meters = el('meters');
const debug = el<HTMLPreElement>('debug');

const shaft = makeShaft(el('shaft'), fitLog);

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

/** The register comes from the engine now — the client never guesses at it. */
function say(text: string, kind: LineKind | 'marker'): void {
  const p = document.createElement('p');
  p.className = kind;
  p.textContent = text;
  log.append(p);
  log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
  if (game.state.flags[HAS_PRESSED]) revealed++;
}

function act(action: PlayerAction): void {
  const wasInScene = game.mode.kind === 'scene';
  const result = step(game, action);
  game = result.game;
  for (const line of result.lines) say(line.text, line.kind);
  if (!quiet && runStatus(game).kind === 'quiet') {
    quiet = true;
    say('nothing further will happen', 'system');
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

  // During beat zero you see exactly what the silt has given up so far, which
  // is the half of the phase that is about uncovering things one at a time.
  const uncoverable = game.mode.kind === 'below' ? game.mode.phase.seen : undefined;

  belongings.replaceChildren();
  for (const def of pack.objects) {
    if (uncoverable && !uncoverable[def.id]) continue;
    const state = game.state.objects[def.id];
    if (!state) continue;
    const button = document.createElement('button');
    button.type = 'button';
    if (!state.discovered) {
      button.className = 'unknown';
      button.textContent = def.glimpse ?? def.name;
      button.title = 'look closer';
      button.onclick = () => act({ kind: 'look', object: def.id });
    } else {
      // A belonging is a stance, not an item slot: clicking it is *hold this*,
      // and it stays held until the player is still. Warmth is the border.
      button.textContent = def.name;
      button.dataset['feel'] = feelBand(state);
      button.disabled = state.charge <= TUNING.spent;
      button.title = feelOf(state);
      button.onclick = () => act({ kind: 'attune', object: def.id });
    }
    belongings.append(button);
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
  // letting the player spend a beat finding out. Stillness is never refused.
  el<HTMLButtonElement>('haunt-btn').disabled = presence.charge < TUNING.pressCost;

  // The footer grows as belongings surface and as the debug row comes and
  // goes, so the words have to be re-fitted to the water after every beat,
  // not only when the shaft is laid out.
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

for (const line of pack.belowProse?.opening ?? []) say(line, 'fact');
render();
