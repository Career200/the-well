/** Vocabulary of the simulation. Content files may only speak in these terms. */

export type PersonId = string;
export type ObjectId = string;
export type SceneId = string;

/**
 * What a living person can feel about the well and themselves. Deliberately
 * small: every axis must be readable from behaviour, never stated.
 */
export const EMOTIONS = ['grief', 'fear', 'guilt', 'curiosity', 'anger', 'tenderness'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** What the village collectively decides the well *is*. Drives late-game paths. */
export const BELIEFS = ['haunted', 'mystery', 'tragedy', 'danger'] as const;
export type Belief = (typeof BELIEFS)[number];

export type Scalar = number; // conventionally clamped to [0, 1]

/**
 * How a line is voiced. Split by who is speaking and about what, not by
 * importance — a fact is not a lesser scene, and the client styles it as one.
 *
 *   scene   someone is up there and this is happening to them: a storylet's
 *           beats and outcome, and what the presence does inside one.
 *   fact    the world resolving plainly — a subject coming into focus, a
 *           belonging held, a stance landing, a refusal. Not faded.
 *   idle    the texture of an empty turn. The only faded one.
 *   system  the run talking about itself: the stop, the phase ending.
 *   coda    the ending. Arrives once and never again.
 */
export type LineKind = 'scene' | 'fact' | 'idle' | 'system' | 'coda';

/** One narrated line, with the register it is spoken in. */
export interface NarrationLine {
  kind: LineKind;
  text: string;
}

export interface PersonState {
  id: PersonId;
  name: string;
  emotions: Record<Emotion, Scalar>;
  /** false once they are dead, gone from the village, or otherwise out of play. */
  present: boolean;
}

export interface ObjectState {
  id: ObjectId;
  /**
   * The silt has given it up; until then it cannot be looked at or held. Two
   * arrive in beat zero, the rest have to be pressed for.
   */
  found: boolean;
  /** The player has looked closely enough to know it is theirs. */
  discovered: boolean;
  /** How much of its charge is left; attuning spends it. */
  charge: Scalar;
}

export interface WellState {
  /** How much the living think about this well at all. Gates scene frequency. */
  attention: Scalar;
  /** Accumulated wrongness of the place. Colours every scene's default variant. */
  dread: Scalar;
}

/**
 * What the presence is doing, and keeps doing until told otherwise. One at a
 * time, so blending pressing and holding is a matter of timing.
 */
export type Stance =
  | { kind: 'still' }
  | { kind: 'pressing' }
  | { kind: 'holding'; object: ObjectId };

export interface PresenceState {
  /** Spent to haunt. Refills by waiting — silence is a resource. */
  charge: Scalar;
  /** How much the presence understands about itself. Rises on discovery. */
  lucidity: Scalar;
  /** Held until changed. Ticked once per turn, before the scene advances. */
  stance: Stance;
}

export interface WorldState {
  seed: number;
  turn: number;
  presence: PresenceState;
  well: WellState;
  beliefs: Record<Belief, Scalar>;
  people: Record<PersonId, PersonState>;
  objects: Record<ObjectId, ObjectState>;
  flags: Record<string, boolean>;
  /** Scenes already resolved, oldest first, with the outcome each took. */
  history: { scene: SceneId; outcome: string; turn: number }[];
}

export const clamp01 = (n: number): Scalar => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * The bridge from private emotion to public story: why a grieving person and a
 * frightened person walk away from the same night with different villages.
 */
export const BELIEF_OF_EMOTION: Record<Emotion, Belief> = {
  grief: 'tragedy',
  tenderness: 'tragedy',
  guilt: 'tragedy',
  curiosity: 'mystery',
  fear: 'haunted',
  anger: 'danger',
};

/** How loud the well has become as a subject, regardless of what it is said to be. */
export const notoriety = (state: WorldState): number =>
  BELIEFS.reduce((sum, belief) => sum + state.beliefs[belief], 0);
