import type { Effect } from './effects.js';
import type { Emotion, ObjectId, PersonId, SceneId, WorldState } from './types.js';

/** What the player did *while* a scene was playing. Built up beat by beat. */
export interface SceneContext {
  /**
   * Total haunting applied during this scene, at `TUNING.pressure` a press.
   * One press is a noise (`NOTICED`, 0.25); two is undeniable (`UNDENIABLE`,
   * 0.6), and two is what a full bar buys. Nothing above that is reachable.
   */
  pressure: number;
  /** The belonging the player is currently holding their attention on, if any. */
  resonance: Resonance | null;
  /** Beats already narrated, for scenes that want to know how far they got. */
  beatIndex: number;
}

export interface Resonance {
  object: ObjectId;
  emotion: Emotion;
  /** Post-affinity strength for the cast of the current scene. */
  strength: number;
}

export interface Beat {
  /** Narration from the bottom of the well. Sound first, sight second. */
  text: (state: WorldState, ctx: SceneContext) => string;
  /** false for beats that pass too fast to act in. Defaults to true. */
  interactive?: boolean;
}

export interface Outcome {
  id: string;
  /** First matching outcome wins, so order them most-specific first. */
  when: (state: WorldState, ctx: SceneContext) => boolean;
  text: (state: WorldState, ctx: SceneContext) => string;
  effects: (state: WorldState, ctx: SceneContext) => Effect[];
}

export interface Scene {
  id: SceneId;
  title: string;
  cast: PersonId[];
  /** Hard gate. Cast presence is checked separately by the director. */
  requires?: (state: WorldState) => boolean;
  /** Relative likelihood among eligible scenes. Default 1. */
  weight?: (state: WorldState) => number;
  /** Scenes are once-only unless this is true. */
  repeatable?: boolean;
  /** The last step of a road: the run ends on it. The other door is starvation. */
  terminal?: boolean;
  beats: Beat[];
  outcomes: Outcome[];
}

export function resolveOutcome(scene: Scene, state: WorldState, ctx: SceneContext): Outcome {
  const match = scene.outcomes.find((o) => o.when(state, ctx));
  if (!match) {
    const last = scene.outcomes[scene.outcomes.length - 1];
    if (!last) throw new Error(`Scene ${scene.id} has no outcomes`);
    return last;
  }
  return match;
}
