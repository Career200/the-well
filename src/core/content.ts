import type { Scene } from './scene.js';
import { EMOTIONS, BELIEFS } from './types.js';
import type { Emotion, ObjectId, PersonId, Scalar, WorldState } from './types.js';
import type { BelowSubject } from './below.js';
import type { Coda } from './coda.js';

export interface PersonDef {
  id: PersonId;
  name: string;
  /** Everything unlisted starts at 0. */
  emotions?: Partial<Record<Emotion, Scalar>>;
  present?: boolean;
}

export interface ObjectDef {
  id: ObjectId;
  /** How the presence refers to it once it knows what it is looking at. */
  name: string;
  /** All you can tell before looking closely. Falls back to `name`. */
  glimpse?: string;
  /** Read when the player looks closely. This is where the death is told, obliquely. */
  look: string;
  /**
   * Taking it up, and letting it go, once per hold it has left — first use
   * to last. A belonging is three holds and then cold forever, so this is
   * where that gets *felt* rather than tracked: the warmth arrives smaller
   * each time and leaves faster, and the last entry is the one that says it
   * is over. Falls back to the generic pair when absent.
   */
  hold?: string[];
  release?: string[];
  /** The feeling the thing carries. */
  emotion: Emotion;
  /** Per-person multiplier on that feeling. Unlisted people barely register it. */
  affinity: Partial<Record<PersonId, number>>;
  /** Strength before affinity. */
  power: number;
  /** Only these can be attuned to before being discovered. */
  discovered?: boolean;
}

export interface ContentPack {
  people: PersonDef[];
  objects: ObjectDef[];
  scenes: Scene[];
  /** Starting values for the well itself. */
  well?: { attention?: Scalar; dread?: Scalar };
  /** Lines for the empty turns between scenes. Waiting should still be a texture. */
  ambient?: string[];
  /** The endings. See `core/coda.ts`. */
  coda?: Coda;
  /** Beat zero's nine subjects, keyed by id. See `core/below.ts`. */
  below?: Record<string, BelowSubject>;
  /** Beat zero's ten stub blocks. See `core/below.ts` / `BEAT_ZERO_PLAN.md` §5. */
  belowProse?: {
    opening: string[];
    toMovementII: string[];
    toMovementIII: string[];
    exhaustionExtra: string[];
    lightCrossing: string[];
    /** A turn where nothing resolved. The dark's own ambient pool. */
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
    presence: { charge: 0.5, lucidity: 0, stance: { kind: 'still' } },
    well: { attention: pack.well?.attention ?? 0.1, dread: pack.well?.dread ?? 0 },
    beliefs: Object.fromEntries(BELIEFS.map((b) => [b, 0])) as WorldState['beliefs'],
    people,
    objects,
    flags: {},
    history: [],
  };
}
