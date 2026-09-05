/**
 * The contract a shaft renderer satisfies. One `ShaftState` in, one picture out;
 * the client never knows which renderer it is holding.
 */

/** The four places with geometry to click. The cold has no region. */
export const PLACES = ['sky', 'walls', 'water', 'silt'] as const;
export type PlaceId = (typeof PLACES)[number];

export interface ShaftState {
  /** Opacity of the whole picture, 0 to 1. Not the per-place reveal. */
  visibility: number;
  /** Grain of the picture, quantised by `stepOf`. */
  lucidity: number;
  /** Somebody is at the rim. */
  occupied: boolean;
  /** How much of the light the figure keeps out, 0 to 1. */
  occlusion: number;
  /** Leaving, holding the pose. Runs with `occupied` already false. */
  leaving: boolean;
  /** How far the figure has drawn back: 0 over the rim, 2 nearly gone. */
  recoil: 0 | 1 | 2;
  /**
   * The belonging reaching for them. Written as `data-subject-id`, which is
   * where the stylesheet keys the hue map. Says which object, not whether it
   * landed.
   */
  resonating: string | null;
  /**
   * How much of it landed, 0 to 1: the belonging's affinity for whoever is up
   * there, times the charge it had left. A belonging nobody up there cares
   * about is near 0 and the figure barely moves.
   */
  reach: number;
  /** Presence charge. Full is glass; empty never settles. */
  charge: number;
  /** This beat was a push. */
  pressing: boolean;
  /** Beat counter, used only to detect a new push. */
  turn: number;
  /** Places with something to say. They signal until asked. */
  signals: readonly PlaceId[];
  /** Whether places accept clicks. False in beat zero and in a scene. */
  asking: boolean;
}

/** Where the picture leaves room for words, in viewport px. */
export interface Bands {
  /** Bottom edge of the rim, coin and all. */
  skyBottom: number;
  /** The waterline. Text must stay above it. */
  waterTop: number;
  /** The near edge of the floor. */
  siltTop: number;
}

export interface Shaft {
  update(state: ShaftState): void;
  bands(): Bands;
  /** The picture's own accessible name. The tap targets are outside it. */
  label(text: string): void;
  /**
   * A place coming out of the dark. Outside `update` because it is timed to
   * the narration, not to the state: the client calls it as the line about
   * that place is read. Idempotent; `on = false` is for the debug harness.
   */
  resolve(id: PlaceId, on?: boolean): void;
  /** A spike on the corners: the presence could not afford what was clicked. */
  flash(): void;
  /** The figure surfaces and goes back out inside one beat. The coat's hiding. */
  withdraw(): void;
  /**
   * Release the observer, the clock and any running timer, and empty the host.
   * The renderer is dead after this.
   */
  destroy(): void;
}

export interface ShaftOptions {
  onLayout?: (bands: Bands) => void;
  /** Top of the controls, px. On narrow screens the floor sits against it. */
  floor?: () => number;
  /** A place was clicked. The client decides whether that is allowed. */
  onPlace?: (id: PlaceId) => void;
}

/** Builds a renderer into `host`. Every renderer has this shape. */
export type ShaftFactory = (host: HTMLElement, opts?: ShaftOptions) => Shaft;
