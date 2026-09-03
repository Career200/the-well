/**
 * Beat zero's phase runner. Everything here but `tierOf` is disposable — it
 * goes away once the five ambient subjects and the belongings become ordinary
 * situations in the finished deck. `tierOf` stays: every subject reads through
 * it.
 */
import { band } from './readout.js';
import type { NarrationLine, ObjectId } from './types.js';

/** The nine subjects, as data. Populated in `content/below.ts`. */
export interface BelowSubject {
  id: string;
  /**
   * What to caption a line with. Ambient places only: a belonging is named by
   * its `ObjectDef`, and one name for one thing is the whole point.
   */
  name?: string;
  /** Belongings only — what you can tell before pressing turns it up. */
  glimpse?: string;
  /**
   * Belongings only — the glimpse, short enough for a client to put on a
   * control. Stands in for the name until the thing has been looked at.
   */
  glimpseName?: string;
  veiled: string;
  plain: string;
  /** Late-game payoff, authored now, unreachable in beat zero. */
  named: string;
  extra?: string;
}

export type Tier = 'veiled' | 'plain' | 'named';
const TIERS: readonly Tier[] = ['veiled', 'plain', 'named'];

/**
 * Permanent. Belongings run one tier ahead: they are where the presence knows
 * itself best, so they reach the direct register first.
 */
export function tierOf(lucidity: number, isBelonging: boolean): Tier {
  // Pinned to discovery counts, not a continuum: at `lucidityPerDiscovery`
  // each, four belongings is `named`, three `plain`, two or fewer `veiled`.
  const step = band(lucidity, [[0.75, 2], [0.55, 1]] as const, 0);
  return TIERS[Math.min(2, step + (isBelonging ? 1 : 0))]!;
}

/** The five, as a set. Beat zero is not over until every one has resolved. */
export const AMBIENT_ORDER = ['water', 'cold', 'walls', 'sky', 'silt'] as const;
export type AmbientId = (typeof AMBIENT_ORDER)[number];

/**
 * The four that resolve on the clock, in the order they come.
 *
 * The water leads because it is the one thing that answers a push: by the time
 * it is described the presence has already felt it move. The cold follows —
 * the opening has named it, so it returns rather than arrives. Then the walls
 * close it in, and the sky is last, because it is the only one that is a way
 * out and nothing should suggest one early.
 *
 * The silt is not here. It resolves when the first belonging comes out of it,
 * which is the only moment the floor is worth looking at.
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
  /** The silt owes one. */
  owed: boolean;
  wasLow: boolean;
  exhausted: boolean;
  /** Consecutive turns that narrated nothing. See `BELOW_TUNING.quietRun`. */
  quiet: number;
  /** Every line already said down here. Nothing is ever said twice. */
  said: string[];
  /**
   * World-clock lines that did not fit their turn's budget, oldest first. They
   * keep their order, so the ambient five resolve as written.
   */
  pending: NarrationLine[];
}

/** Provisional — meant to move once this has been played and timed. */
export const BELOW_TUNING = {
  /** Hard ceiling. The light crosses past this regardless of the player's state. */
  cap: 16,
  /** Movement II's lesson lands on partial recovery, not a full bar. */
  recoverFloor: 0.3,
  /** Charge must have dipped under this for recovering past it to read as a move. */
  lowFloor: 0.2,
  /** Turns between one ambient subject resolving and the next, in the dark. */
  ambientEvery: 2,
  /**
   * How far down `TIMED_ORDER` the dark resolves for a presence that has never
   * acted. The water, the cold and the walls press against you regardless; the
   * sky is *looked at*, and nothing looks until it knows it can act. The silt
   * is not on this clock at all and needs a press of its own.
   */
  ambientWithoutPressing: 3,
  /**
   * Silent turns allowed before the dark says something about itself. A quiet
   * beat is not dead air — the water answers every press — so filling every
   * gap reads as chattier than the phase is.
   */
  quietRun: 2,
  /**
   * Lines a turn may narrate. Three clocks can come due at once (the player,
   * the economy, the phase schedule) and three sentences read as a wall. What
   * the player caused is always said; the world's own lines wait.
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
    owed: true,
    wasLow: false,
    exhausted: false,
    quiet: 0,
    said: [],
    pending: [],
  };
}

/**
 * Beat zero is short and read closely, so a repeated sentence reads as the
 * machine showing through: a line already said is dropped and the turn goes by
 * on the water alone. The ordinary run has no such rule.
 */
export function unsaid(phase: BelowPhase, lines: readonly string[]): { phase: BelowPhase; keep: boolean[] } {
  const said = new Set(phase.said);
  const keep = lines.map((text) => {
    if (said.has(text)) return false;
    said.add(text);
    return true;
  });
  return { phase: { ...phase, said: [...said] }, keep };
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
 * Whether the presence has found out it can act at all — one press that lands,
 * or one that empties it. Nothing opens until then: not the sky, not the silt,
 * not the way out.
 */
export const eyesOpen = (phase: BelowPhase): boolean => phase.pressCount > 0 || phase.exhausted;

export type BelowEvent =
  /**
   * `caused` marks the one ambient the player brought on rather than waited
   * out. It is the difference between the world's own clock coming due, which
   * can wait for a quiet turn, and an answer to something just done, which
   * cannot — see how `belowStep` sorts them.
   */
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
 * Conditions, not a script: every transition is a threshold on state the
 * engine already tracks. The hard cap makes it total — a player who only
 * presses, or only waits, still reaches the end inside it.
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

  // I. the dark — ambient subjects resolve on their own clock, in fixed order,
  // stopping at the walls until the presence has acted once. Counted over the
  // timed four alone: the silt can arrive mid-sequence and must not push the
  // sky forward by taking a slot it was never on.
  const onClock = next.revealed.filter((id) => (TIMED_ORDER as readonly string[]).includes(id)).length;
  const reach = eyesOpen(next) ? TIMED_ORDER.length : BELOW_TUNING.ambientWithoutPressing;
  if (onClock < reach && next.turn % BELOW_TUNING.ambientEvery === 0) {
    const subject = TIMED_ORDER.find((id) => !next.revealed.includes(id))!;
    next = { ...next, revealed: [...next.revealed, subject] };
    events.push({ kind: 'ambient', subject });
  }

  // I -> II. Pressing spent something twice, or spent it all at once.
  if (next.movement === 1 && (next.pressCount >= 2 || next.exhausted)) {
    next = { ...next, movement: 2 };
    events.push({ kind: 'movement', to: 2 });
  }

  // II -> III. Nothing to do but wait, and the waiting has to have paid off.
  if (next.movement === 2 && next.wasLow && input.presenceCharge >= BELOW_TUNING.recoverFloor) {
    next = { ...next, movement: 3 };
    events.push({ kind: 'movement', to: 3 });
  }

  // One on the second press, then the same debt the idle game runs.
  const target = input.pressedThisTurn && next.pressCount >= 2 ? next.found.find((id) => !next.seen[id]) : undefined;
  if (target) {
    if (next.owed || input.siltRolled) {
      // The floor comes into view with the first thing it gives up. Before
      // that it is only the dark you are lying in; a belonging coming out of
      // it is what makes it somewhere to look.
      if (!next.revealed.includes('silt')) {
        next = { ...next, revealed: [...next.revealed, 'silt'] };
        events.push({ kind: 'ambient', subject: 'silt', caused: true });
      }
      next = { ...next, owed: false, seen: { ...next.seen, [target]: 'glimpse' } };
      events.push({ kind: 'glimpse', object: target });
    } else {
      next = { ...next, owed: true };
    }
  }

  // The light does not cross for a presence that never opened its eyes: no
  // ending for someone who never began — the run starves in the dark instead.
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
