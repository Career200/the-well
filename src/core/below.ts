/**
 * Beat zero's phase runner — the spike specced in `story/BEAT_ZERO.md` and
 * `BEAT_ZERO_PLAN.md`. Everything here but `tierOf` is disposable: it goes
 * away once the ambient five and the two belongings become ordinary
 * situations in the finished deck.
 *
 * `tierOf` does not go away. Every subject in the finished game reads through
 * it, so it is written once, tested on its own, and left alone.
 */
import { band } from './readout.js';
import type { NarrationLine, ObjectId } from './types.js';

/** The nine subjects, as data. Populated (content/below.ts) from `story/descriptions/below.md`. */
export interface BelowSubject {
  id: string;
  /** Belongings only — what you can tell before pressing turns it up. */
  glimpse?: string;
  veiled: string;
  plain: string;
  /** Late-game payoff, authored now, unreachable in beat zero. */
  named: string;
  extra?: string;
}

export type Tier = 'veiled' | 'plain' | 'named';
const TIERS: readonly Tier[] = ['veiled', 'plain', 'named'];

/**
 * Permanent. Belongings run one tier ahead of everything else — they are the
 * surface where the presence knows itself best, so they reach the direct
 * register before the walls and the water do (`STORY_MACHINE.md` §2).
 */
export function tierOf(lucidity: number, isBelonging: boolean): Tier {
  // Pinned to discovery counts, not to a continuum: with four belongings at
  // `lucidityPerDiscovery` each, all four reaches `named`, missing one lands
  // on `plain`, and missing two leaves the presence `veiled`. One thing not
  // looked at is one ending not reached.
  const step = band(lucidity, [[0.75, 2], [0.55, 1]] as const, 0);
  return TIERS[Math.min(2, step + (isBelonging ? 1 : 0))]!;
}

/** Fixed order. Resolves whether or not the player acts (`BEAT_ZERO.md`, movement I). */
export const AMBIENT_ORDER = ['cold', 'water', 'walls', 'sky', 'silt'] as const;
export type AmbientId = (typeof AMBIENT_ORDER)[number];

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
  /** Every line already said down here. Nothing is ever said twice. */
  said: string[];
  /**
   * World-clock lines that did not fit in their own turn's budget, oldest
   * first. They keep their order, so the ambient five still resolve in the
   * order they were written.
   */
  pending: NarrationLine[];
}

/**
 * The two numbers `BEAT_ZERO_PLAN.md` §4 leaves for the keyboard. Tried here
 * as the doc suggests it — partial recovery, not a full bar — and meant to
 * move once this has actually been played and timed (plan §6 steps 3–4).
 */
export const BELOW_TUNING = {
  /** Hard ceiling. The light crosses past this regardless of the player's state. */
  cap: 16,
  /** Movement II's lesson lands on partial recovery, not a full bar. */
  recoverFloor: 0.3,
  /** Charge has to have dipped under this for recovering past it to read as a move. */
  lowFloor: 0.2,
  /** Turns between one ambient subject resolving and the next, in the dark. */
  ambientEvery: 2,
  /**
   * How far the dark resolves for a presence that has never once acted. The
   * cold, the water and the walls are what arrives whether you want it or
   * not — they are pressing against you. The sky and the silt are *looked at*,
   * and nothing looks at anything until it has found out it can act at all.
   */
  ambientWithoutPressing: 3,
  /**
   * Silent turns to allow before the dark says something about itself. One
   * quiet beat is not dead air — the water answers every press and settles
   * visibly on every still turn — so filling every gap with a line makes the
   * phase read as chattier than it is.
   */
  quietRun: 2,
  /**
   * Lines a single turn may narrate. Three clocks can come due at once down
   * here — what the player did, what the economy did about it, and where the
   * phase's own schedule had got to — and three unrelated sentences arriving
   * together read as a wall rather than as a beat. What the player caused is
   * always said; the world's own lines wait their turn.
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
    said: [],
    pending: [],
  };
}

/**
 * Beat zero is short, linear, and read closely, so a sentence the player has
 * already had lands as the machine showing through. Nothing repeats: a line
 * already said is dropped, and the turn goes by on the water alone — which is
 * legible now that the surface answers every press and settles on every still
 * turn. Once the phase is over the ordinary run has no such rule; repetition
 * up there is `times.withCast`'s job, and it is a feature.
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
 * Whether the dark should say something about itself this turn, given the
 * turn narrated nothing on its own. Returns the phase either way, because the
 * run of silence is state like anything else.
 */
export function fillSilence(phase: BelowPhase, narrated: boolean): { phase: BelowPhase; speak: boolean } {
  if (narrated) return { phase: { ...phase, quiet: 0 }, speak: false };
  const quiet = phase.quiet + 1;
  if (quiet <= BELOW_TUNING.quietRun) return { phase: { ...phase, quiet }, speak: false };
  return { phase: { ...phase, quiet: 0 }, speak: true };
}

/**
 * Whether the presence has found out it can act at all. One press that lands,
 * or one that empties it, and it knows. Nothing down here opens until then:
 * not the sky, not the silt, and not the way out.
 */
export const eyesOpen = (phase: BelowPhase): boolean => phase.pressCount > 0 || phase.exhausted;

export type BelowEvent =
  | { kind: 'ambient'; subject: AmbientId }
  | { kind: 'movement'; to: Movement }
  | { kind: 'glimpse'; object: ObjectId }
  | { kind: 'end' };

export interface BelowInput {
  presenceCharge: number;
  pressedThisTurn: boolean;
  exhaustedThisTurn: boolean;
}

/**
 * Conditions, not a script — every transition is a threshold on state the
 * engine already tracks (`BEAT_ZERO_PLAN.md` §3). The hard cap is what makes
 * this total: a player who only ever presses, or only ever waits, still
 * reaches the end inside it.
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

  // I. the dark — the ambient subjects resolve on their own clock, in fixed
  // order, and they stop at the walls until the presence has acted once. The
  // eyes are not open yet; there is no seeing the sky before that.
  const reach = eyesOpen(next) ? AMBIENT_ORDER.length : BELOW_TUNING.ambientWithoutPressing;
  if (next.revealed.length < reach && next.turn % BELOW_TUNING.ambientEvery === 0) {
    const subject = AMBIENT_ORDER[next.revealed.length]!;
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

  // III. Pressing disturbs the silt and gives up one belonging at a time.
  if (next.movement === 3 && input.pressedThisTurn) {
    const target = next.found.find((id) => !next.seen[id]);
    if (target) {
      next = { ...next, seen: { ...next.seen, [target]: 'glimpse' } };
      events.push({ kind: 'glimpse', object: target });
    }
  }

  // The light does not cross for a presence that never opened its eyes. There
  // is no ending here for someone who never began — the run starves instead,
  // still in the dark, and that is the whole of what happened to them.
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
