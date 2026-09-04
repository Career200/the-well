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
 *           belonging used, an action landing, a refusal. Not faded.
 *   idle    the texture of an empty turn. The only faded one.
 *   system  the run talking about itself: the stop, the phase ending.
 *   coda    the ending. Arrives once and never again.
 */
export type LineKind = 'scene' | 'fact' | 'idle' | 'system' | 'coda';

/** One narrated line, with the register it is spoken in. */
export interface NarrationLine {
  kind: LineKind;
  text: string;
  /**
   * Who the line is about, when it is one of the nine subjects speaking: a
   * place resolving or a belonging looked at, held, or going cold. The client
   * captions it, so those lines stop arriving headless.
   *
   * Only ever set when the text is the subject's own prose and the presence
   * knows what it is looking at. Never on a glimpse — a shape in the silt has
   * no name yet — and never on the presence's own voice, an idle turn, a
   * scene, the system, or the coda.
   */
  subject?: string;
  /**
   * The same subject, as its id rather than its prose name. Set whenever
   * `subject` is. A client that draws the nine has to match on something the
   * writing cannot drift away from — `subject` is authored text and is free
   * to stop looking like an id at any point.
   *
   * It is also set, alone and without a caption, on a line in the presence's
   * own voice that nonetheless names a place outright. That line is not the
   * place speaking, so it stays headless, but a client drawing the place must
   * not still be holding it in the dark once a sentence has said it is there.
   */
  subjectId?: string;
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

/** Two scalars, and nothing ongoing: every action is paid for on its own beat. */
export interface PresenceState {
  /** Spent to haunt. Refills by waiting — silence is a resource. */
  charge: Scalar;
  /** How much the presence understands about itself. Rises on discovery. */
  lucidity: Scalar;
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
