/** Beat zero's phase runner. Every subject reads its tier through `tierOf`. */
import { band } from './readout.js';
import type { NarrationLine, ObjectId } from './types.js';

/** The nine subjects, as data. Authored in `content/prose/below.ts`. */
export interface BelowSubject {
  id: string;
  /** Caption for ambient places. A belonging is named by its `ObjectDef`. */
  name?: string;
  /** Belongings only: what can be told before a press turns it up. */
  glimpse?: string;
  /** Belongings only: the glimpse, short enough for a control. */
  glimpseName?: string;
  veiled: string;
  plain: string;
  /** Unreachable in beat zero, which tops out at `plain`. */
  named: string;
  extra?: string;
}

export type Tier = 'veiled' | 'plain' | 'named';
const TIERS: readonly Tier[] = ['veiled', 'plain', 'named'];

/** Belongings run one tier ahead of the ambient five. */
export function tierOf(lucidity: number, isBelonging: boolean): Tier {
  // Thresholds track discovery counts at `lucidityPerDiscovery` each: four
  // belongings is `named`, three `plain`, two or fewer `veiled`.
  const step = band(lucidity, [[0.75, 2], [0.55, 1]] as const, 0);
  return TIERS[Math.min(2, step + (isBelonging ? 1 : 0))]!;
}

/** The five. Beat zero is not over until every one has resolved. */
export const AMBIENT_ORDER = ['water', 'cold', 'walls', 'sky', 'silt'] as const;
export type AmbientId = (typeof AMBIENT_ORDER)[number];

/**
 * The four that resolve on the phase clock, in order. The silt is not on it:
 * it resolves when the first belonging comes out of it.
 */
export const TIMED_ORDER = ['water', 'cold', 'walls', 'sky'] as const;

export type Movement = 1 | 2 | 3;

export interface BelowPhase {
  movement: Movement;
  turn: number;
  pressCount: number;
  revealed: AmbientId[];
  /** The two belongings reachable this run, drawn once at phase start. */
  found: [ObjectId, ObjectId];
  seen: Partial<Record<ObjectId, 'glimpse' | 'plain'>>;
  wasLow: boolean;
  exhausted: boolean;
  /** Consecutive turns that narrated nothing. See `BELOW_TUNING.quietRun`. */
  quiet: number;
  /**
   * World-clock lines that did not fit their turn's budget, oldest first. They
   * keep their order, so the ambient five resolve as written.
   */
  pending: NarrationLine[];
}

export const BELOW_TUNING = {
  /** Hard ceiling. The light crosses past this whatever the player's state. */
  cap: 16,
  /** Charge to recover back up to for movement II -> III. */
  recoverFloor: 0.3,
  /** Charge must have dipped under this first for that recovery to count. */
  lowFloor: 0.2,
  /** Turns between one ambient subject resolving and the next. */
  ambientEvery: 2,
  /** How far down `TIMED_ORDER` a presence that has never acted gets. */
  ambientWithoutPressing: 3,
  /** Silent turns allowed before the dark says something about itself. */
  quietRun: 2,
  /**
   * Lines a turn may narrate. What the player caused is always said; the
   * world's own lines queue in `pending`.
   */
  linesPerTurn: 2,
} as const;

/** Drawn from the seeded rng, so a run's pair is reproducible from its seed. */
export function startBelow(pick: () => number, belongingIds: readonly ObjectId[]): BelowPhase {
  const pool = [...belongingIds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(pick() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return {
    movement: 1,
    turn: 0,
    pressCount: 0,
    revealed: [],
    found: [pool[0]!, pool[1]!],
    seen: {},
    wasLow: false,
    exhausted: false,
    quiet: 0,
    pending: [],
  };
}

/**
 * Whether the dark should say something about itself, given a turn that
 * narrated nothing. Returns the phase either way: the silent run is state.
 */
export function fillSilence(phase: BelowPhase, narrated: boolean): { phase: BelowPhase; speak: boolean } {
  if (narrated) return { phase: { ...phase, quiet: 0 }, speak: false };
  const quiet = phase.quiet + 1;
  if (quiet <= BELOW_TUNING.quietRun) return { phase: { ...phase, quiet }, speak: false };
  return { phase: { ...phase, quiet: 0 }, speak: true };
}

/**
 * One press that landed, or one that emptied the bar. The sky, the silt and
 * the ending are all gated on this.
 */
export const eyesOpen = (phase: BelowPhase): boolean => phase.pressCount > 0 || phase.exhausted;

export type BelowEvent =
  /** `caused` marks an ambient the player brought on, which cannot be queued. */
  | { kind: 'ambient'; subject: AmbientId; caused?: boolean }
  | { kind: 'movement'; to: Movement }
  | { kind: 'glimpse'; object: ObjectId }
  | { kind: 'end' };

export interface BelowInput {
  presenceCharge: number;
  pressedThisTurn: boolean;
  exhaustedThisTurn: boolean;
  /** The engine's dice, so the phase stays pure. */
  siltRolled: boolean;
}

/**
 * Every transition is a threshold on state the engine already tracks. The cap
 * makes it total: any sequence of actions reaches the end inside it.
 */
export function advanceBelow(phase: BelowPhase, input: BelowInput): { phase: BelowPhase; events: BelowEvent[] } {
  const events: BelowEvent[] = [];
  let next: BelowPhase = {
    ...phase,
    turn: phase.turn + 1,
    pressCount: phase.pressCount + (input.pressedThisTurn ? 1 : 0),
    exhausted: phase.exhausted || input.exhaustedThisTurn,
    wasLow: phase.wasLow || input.presenceCharge < BELOW_TUNING.lowFloor,
  };

  // Ambient subjects resolve on their own clock, in fixed order, stopping at
  // `ambientWithoutPressing` until the presence has acted once. Counted over
  // the timed four alone, so an out-of-band silt does not take the sky's slot.
  const onClock = next.revealed.filter((id) => (TIMED_ORDER as readonly string[]).includes(id)).length;
  const reach = eyesOpen(next) ? TIMED_ORDER.length : BELOW_TUNING.ambientWithoutPressing;
  if (onClock < reach && next.turn % BELOW_TUNING.ambientEvery === 0) {
    const subject = TIMED_ORDER.find((id) => !next.revealed.includes(id))!;
    next = { ...next, revealed: [...next.revealed, subject] };
    events.push({ kind: 'ambient', subject });
  }

  // I -> II. Two presses, or one that emptied the bar.
  if (next.movement === 1 && (next.pressCount >= 2 || next.exhausted)) {
    next = { ...next, movement: 2 };
    events.push({ kind: 'movement', to: 2 });
  }

  // II -> III. Dipped below `lowFloor`, then recovered past `recoverFloor`.
  if (next.movement === 2 && next.wasLow && input.presenceCharge >= BELOW_TUNING.recoverFloor) {
    next = { ...next, movement: 3 };
    events.push({ kind: 'movement', to: 3 });
  }

  // The pair reachable down here comes up from the second press on, at the
  // chance the engine rolled.
  const target = input.pressedThisTurn && next.pressCount >= 2 ? next.found.find((id) => !next.seen[id]) : undefined;
  if (target && input.siltRolled) {
    // The silt resolves on the first thing it gives up, not on the clock.
    if (!next.revealed.includes('silt')) {
      next = { ...next, revealed: [...next.revealed, 'silt'] };
      events.push({ kind: 'ambient', subject: 'silt', caused: true });
    }
    next = { ...next, seen: { ...next.seen, [target]: 'glimpse' } };
    events.push({ kind: 'glimpse', object: target });
  }

  // The light does not cross for a presence that never acted; `doorOut`
  // starves that run at the cap instead.
  const done =
    eyesOpen(next) &&
    ((next.revealed.length === AMBIENT_ORDER.length && next.found.some((id) => next.seen[id] === 'plain')) ||
      next.turn >= BELOW_TUNING.cap);
  if (done) events.push({ kind: 'end' });

  return { phase: next, events };
}

/** `look`, during the phase: glimpse -> plain, for a belonging already found. */
export function lookBelow(phase: BelowPhase, object: ObjectId): BelowPhase | undefined {
  if (phase.seen[object] !== 'glimpse') return undefined;
  return { ...phase, seen: { ...phase.seen, [object]: 'plain' } };
}
