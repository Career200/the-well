/** Vocabulary of the simulation. Content files may only speak in these terms. */

export type PersonId = string;
export type ObjectId = string;
export type SceneId = string;

/**
 * What a living person can feel about the well and about themselves.
 * Deliberately small: every axis must be readable from behaviour up there,
 * because the player is never told any of this in words.
 */
export const EMOTIONS = ['grief', 'fear', 'guilt', 'curiosity', 'anger', 'tenderness'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** What the village collectively decides the well *is*. Drives late-game paths. */
export const BELIEFS = ['haunted', 'mystery', 'tragedy', 'danger'] as const;
export type Belief = (typeof BELIEFS)[number];

export type Scalar = number; // conventionally clamped to [0, 1]

/**
 * How a line is voiced. Four registers, and the split is by *who is speaking
 * and about what*, not by importance — a fact is not a lesser scene, it is a
 * different kind of sentence, and the client styles it as one.
 *
 *   scene   someone is up there and this is happening to them. A storylet's
 *           beats and its outcome, and anything the presence does inside one.
 *   fact    the world resolving, stated plainly: a subject below coming into
 *           focus, a belonging looked at or taken up, a stance landing, a
 *           refusal. Not faded — this is the register that says *something of
 *           note happened and nobody is up there to see it*.
 *   idle    the texture of an empty turn. The only faded one.
 *   system  the run talking about itself: the stop, the phase ending. Not
 *           prose, and must never be mistaken for it.
 */
export type LineKind = 'scene' | 'fact' | 'idle' | 'system';

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
 * What the presence is doing, and keeps doing until told otherwise. Only one at
 * a time: pressing and holding are opposed moment to moment, which is what makes
 * blending them a matter of timing rather than of playstyle.
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
 * What the village concludes when it feels a thing near the well. This is the
 * bridge from private emotion to public story: it is why a grieving person and
 * a frightened person walk away from the same night with different villages.
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
