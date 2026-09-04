/**
 * Dev-only readout. Loaded by a dynamic import behind `import.meta.env.DEV`,
 * so nothing here reaches a production bundle.
 *
 * Shows the whole of `Game` — world state and the current mode's context —
 * next to the run it belongs to. `\`` toggles it; `?dev` opens it at start.
 */

import './dev.css';
import { runStatus } from '../core/engine.js';
import type { Game } from '../core/engine.js';
import { BELIEFS, EMOTIONS } from '../core/types.js';

export interface DevPanel {
  update(): void;
}

const n = (value: number): number => Number(value.toFixed(2));

/** The scalars, the mode's own fields, and everything the run has done. */
function dump(game: Game): object {
  const s = game.state;
  const status = runStatus(game);
  return {
    turn: s.turn,
    seed: s.seed,
    status: status.kind === 'open' ? 'open' : `${status.kind} — ${status.reason}`,
    mode: mode(game),
    presence: { charge: n(s.presence.charge), lucidity: n(s.presence.lucidity) },
    well: { attention: n(s.well.attention), dread: n(s.well.dread) },
    beliefs: Object.fromEntries(BELIEFS.map((b) => [b, n(s.beliefs[b])])),
    people: Object.fromEntries(
      Object.values(s.people).map((person) => [
        person.name,
        {
          present: person.present,
          emotions: Object.fromEntries(
            EMOTIONS.filter((e) => person.emotions[e] > 0.01).map((e) => [e, n(person.emotions[e])]),
          ),
        },
      ]),
    ),
    objects: Object.fromEntries(
      Object.values(s.objects).map((o) => [
        o.id,
        `${n(o.charge)} ${o.found ? (o.discovered ? 'discovered' : 'found') : 'silt'}`,
      ]),
    ),
    flags: Object.keys(s.flags).filter((f) => s.flags[f]),
    said: Object.fromEntries(Object.entries(game.ledger).map(([channel, lines]) => [channel, lines.length])),
    played: s.history.map((h) => `${h.scene}:${h.outcome}@${h.turn}`),
  };
}

/** The half of `Game` the world state does not hold. */
function mode(game: Game): object {
  const m = game.mode;
  switch (m.kind) {
    case 'scene':
      return {
        kind: m.kind,
        scene: m.scene,
        beat: m.ctx.beatIndex,
        pressure: n(m.ctx.pressure),
        resonance: m.ctx.resonance
          ? `${m.ctx.resonance.object} · ${m.ctx.resonance.emotion} ${n(m.ctx.resonance.strength)}`
          : null,
      };
    case 'below': {
      const p = m.phase;
      return {
        kind: m.kind,
        movement: p.movement,
        turn: p.turn,
        presses: p.pressCount,
        revealed: p.revealed,
        found: p.found,
        seen: p.seen,
        quiet: p.quiet,
        pending: p.pending.length,
      };
    }
    case 'over':
      return { kind: m.kind, door: m.door, spine: m.spine };
    default:
      return { kind: m.kind };
  }
}

export function attach(get: () => Game): DevPanel {
  const panel = document.createElement('pre');
  panel.id = 'dev';
  document.body.append(panel);

  /** `body.dev` is what the scene markers in the log hang off. */
  const show = (on: boolean): void => {
    panel.hidden = !on;
    document.body.classList.toggle('dev', on);
  };
  show(new URLSearchParams(location.search).has('dev'));

  addEventListener('keydown', (e) => {
    if (e.key === '`') {
      show(panel.hidden);
      update();
    }
  });

  function update(): void {
    if (!panel.hidden) panel.textContent = JSON.stringify(dump(get()), null, 1);
  }

  // Also reachable from the console, where the object is browsable rather
  // than a string.
  Object.assign(window, { well: { game: get, dump: () => dump(get()) } });

  return { update };
}
