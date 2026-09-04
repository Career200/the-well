/**
 * Where a scalar becomes a sentence. Both clients read from here, so a number
 * has one wording. The bands are here; the wording is in `pack.instrument`.
 */
import type { InstrumentProse } from './content.js';
import type { ObjectState, Scalar, WorldState } from './types.js';

export const band = <T>(value: number, steps: readonly (readonly [number, T])[], last: T): T => {
  for (const [floor, out] of steps) if (value >= floor) return out;
  return last;
};

/** Presence charge, as the water reads it. */
export const water = (prose: InstrumentProse, charge: Scalar): string =>
  band(
    charge,
    [
      [0.85, prose.water[0]],
      [0.6, prose.water[1]],
      [0.35, prose.water[2]],
      [0.12, prose.water[3]],
    ],
    prose.water[4],
  );

/** A belonging, as it feels to take up. Cold is permanent. */
export const feelOf = (prose: InstrumentProse, object: ObjectState): string =>
  band(
    object.charge,
    [
      [0.75, prose.feel[0]],
      [0.45, prose.feel[1]],
      [0.15, prose.feel[2]],
    ],
    prose.feel[3],
  );

/** The same four bands as `feelOf`, as a slug a client can colour by. */
export const feelBand = (object: ObjectState): 'warm' | 'cooling' | 'nearly-cold' | 'cold' =>
  band(
    object.charge,
    [
      [0.75, 'warm' as const],
      [0.45, 'cooling' as const],
      [0.15, 'nearly-cold' as const],
    ],
    'cold' as const,
  );

/** Charge left across all belongings. The run's other clock. */
export const remaining = (state: WorldState): number =>
  Object.values(state.objects).reduce((sum, o) => sum + o.charge, 0);
