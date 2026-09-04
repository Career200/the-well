import type { Scene } from './scene.js';
import { EMOTIONS, BELIEFS } from './types.js';
import type { Belief, Emotion, ObjectId, PersonId, Scalar, WorldState } from './types.js';
import type { BelowSubject, Tier } from './below.js';
import type { Coda } from './coda.js';

export interface PersonDef {
  id: PersonId;
  name: string;
  /** Everything unlisted starts at 0. */
  emotions?: Partial<Record<Emotion, Scalar>>;
  present?: boolean;
}

/** Mechanics only; what a belonging says is in `pack.below` under the same id. */
export interface ObjectDef {
  id: ObjectId;
  name: string;
  /** One line per use, first to last. Three uses empty a belonging. */
  hold?: string[];
  release?: string[];
  emotion: Emotion;
  /** Per-person multiplier on that emotion. Unlisted people default to 0.1. */
  affinity: Partial<Record<PersonId, number>>;
  /** Strength before affinity. */
  power: number;
  /** Attunable before being looked at. */
  discovered?: boolean;
}

/**
 * The village read back to the presence. Carries no effects. Each band is a
 * pool; the engine picks one line from it.
 */
export interface Readout {
  beliefs: Record<Belief, string[]>;
  /** Two bands: over `READOUT_FLOOR`, then over `READOUT_LOUD`. */
  attention: [string[], string[]];
  dread: [string[], string[]];
}

/** Lines the engine itself speaks, for actions and for the stop. */
export interface PresenceProse {
  /** Pushing with nothing left. The first states the rule; the rest cycle. */
  tooThin: [string, string, string];
  /** A push that spends the last of the charge. */
  spent: string;
  pushInScene: string;
  pushBelow: string;
  pushFound: string;
  pushEmpty: string;
  busy: string;
  noSuchThing: string;
  nothingToSee: string;
  notLookedAt: string;
  spentBelonging: string;
  /** `{thing}` is substituted with the belonging's name. */
  holdFallback: string;
  /** Said once `runStatus` reaches `stalled` and the run is still open. */
  stalled: string;
  /** Said by the client once `runStatus` reaches `quiet`. */
  nothingFurther: string;
  ambientFallback: string;
}

/** Scalars as sentences. Bands are in `core/readout.ts`; wording is here. */
export interface InstrumentProse {
  /** Five bands of presence charge, fullest first. */
  water: [string, string, string, string, string];
  /** Four bands of belonging charge, warmest first. */
  feel: [string, string, string, string];
  /** Appended to the shaft's label while a scene is playing. */
  atTheRim: string;
}

export interface ContentPack {
  people: PersonDef[];
  objects: ObjectDef[];
  scenes: Scene[];
  presence: PresenceProse;
  instrument: InstrumentProse;
  /** Starting values for the well itself. */
  well?: { attention?: Scalar; dread?: Scalar };
  /** Lines for the empty turns between scenes. */
  ambient?: string[];
  /** Said instead of an ambient line once a quality is loud enough. */
  readout?: Readout;
  /** Pulling the coat over yourself, and missing whoever came. */
  hiding?: string[];
  /** One of the five has become lookable. Keyed by tier; never says which. */
  noticing?: Record<Tier, string>;
  /** The endings. See `core/coda.ts`. */
  coda?: Coda;
  /** Beat zero's nine subjects, keyed by id. See `core/below.ts`. */
  below?: Record<string, BelowSubject>;
  /** Beat zero's transition blocks. See `core/below.ts`. */
  belowProse?: {
    opening: string[];
    toMovementII: string[];
    toMovementIII: string[];
    exhaustionExtra: string[];
    lightCrossing: string[];
    /** Said on a turn that resolved nothing. */
    settling: string[];
  };
}

export function initWorld(pack: ContentPack, seed: number): WorldState {
  const people: WorldState['people'] = {};
  for (const def of pack.people) {
    const emotions = Object.fromEntries(EMOTIONS.map((e) => [e, def.emotions?.[e] ?? 0])) as Record<Emotion, Scalar>;
    people[def.id] = { id: def.id, name: def.name, emotions, present: def.present ?? true };
  }

  const objects: WorldState['objects'] = {};
  for (const def of pack.objects) {
    objects[def.id] = { id: def.id, found: false, discovered: def.discovered ?? false, charge: 1 };
  }

  return {
    seed,
    turn: 0,
    presence: { charge: 0.5, lucidity: 0 },
    well: { attention: pack.well?.attention ?? 0.1, dread: pack.well?.dread ?? 0 },
    beliefs: Object.fromEntries(BELIEFS.map((b) => [b, 0])) as WorldState['beliefs'],
    people,
    objects,
    flags: {},
    history: [],
  };
}
