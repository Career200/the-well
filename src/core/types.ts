/** Vocabulary of the simulation. Content files may only speak in these terms. */

export type PersonId = string;
export type ObjectId = string;
export type SceneId = string;

/** What a living person can feel about the well and themselves. */
export const EMOTIONS = ['grief', 'fear', 'guilt', 'curiosity', 'anger', 'tenderness'] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** What the village collectively decides the well is. Gates late-game scenes. */
export const BELIEFS = ['haunted', 'mystery', 'tragedy', 'danger'] as const;
export type Belief = (typeof BELIEFS)[number];

/** Clamped to [0, 1] by `clamp01` wherever effects write one. */
export type Scalar = number;

/**
 * How a line is voiced, by who is speaking and about what:
 *
 *   scene   a storylet's beats and outcome, and what happens inside one.
 *   fact    the world resolving plainly: a subject, a use, a refusal.
 *   idle    the texture of an empty turn. The only faded one.
 *   system  the run talking about itself: the stop, the phase ending.
 *   coda    the ending. Arrives once.
 */
export type LineKind = 'scene' | 'fact' | 'idle' | 'system' | 'coda';

/** One narrated line, with the register it is spoken in. */
export interface NarrationLine {
  kind: LineKind;
  text: string;
  /**
   * The caption a client puts over the line, set only when the text is one of
   * the nine subjects' own prose and the subject is known. A glimpse and the
   * presence's own voice both stay headless.
   */
  subject?: string;
  /**
   * The same subject as an id, set whenever `subject` is, for clients matching
   * on something the wording cannot drift away from.
   *
   * Also set alone, without a caption, on a line in the presence's own voice
   * that names a place outright, so a client can bring that place into view.
   */
  subjectId?: string;
}

export interface PersonState {
  id: PersonId;
  name: string;
  emotions: Record<Emotion, Scalar>;
  /** false once they are out of play. Nobody comes back. */
  present: boolean;
}

export interface ObjectState {
  id: ObjectId;
  /** Out of the silt. Until then it can be neither looked at nor used. */
  found: boolean;
  /** Looked at closely enough to be named. */
  discovered: boolean;
  /** Charge left. Each use spends `TUNING.holdCost` and none is regained. */
  charge: Scalar;
}

export interface WellState {
  /** How much the living think about this well. Gates scene frequency. */
  attention: Scalar;
  /** Accumulated wrongness. Colours every scene's default variant. */
  dread: Scalar;
}

/** Two scalars, and nothing ongoing: every action is paid for on its own beat. */
export interface PresenceState {
  /** Spent to haunt, recovered only by being still. */
  charge: Scalar;
  /** How much the presence knows about itself. Rises on discovery. */
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

/** Which belief a person's emotion feeds when resonance reaches them. */
export const BELIEF_OF_EMOTION: Record<Emotion, Belief> = {
  grief: 'tragedy',
  tenderness: 'tragedy',
  guilt: 'tragedy',
  curiosity: 'mystery',
  fear: 'haunted',
  anger: 'danger',
};

/** Total belief across all four: how loud the well is, whatever it is called. */
export const notoriety = (state: WorldState): number =>
  BELIEFS.reduce((sum, belief) => sum + state.beliefs[belief], 0);
