/**
 * The diegetic instrument panel: presence reads as the surface of the water,
 * belongings as warmth. Both clients read from here, so there is one place
 * where a number becomes a sentence.
 */
import type { ObjectState, PresenceState, Scalar, WorldState } from './types.js';

export const band = <T>(value: number, steps: readonly (readonly [number, T])[], last: T): T => {
  for (const [floor, out] of steps) if (value >= floor) return out;
  return last;
};

/** Presence, as the water reads it. Full and settled; spent and refusing to. */
export const water = (charge: Scalar): string =>
  band(
    charge,
    [
      [0.85, 'The water is glass. Nothing moves on it at all.'],
      [0.6, 'The water is almost still. A ring goes out from the wall and dies.'],
      [0.35, 'The water turns slowly against the stone, the way it does after something.'],
      [0.12, 'The water will not settle. It keeps finding the wall.'],
    ],
    'The water is going nowhere and going there fast. There is nothing of you left in it.',
  );

/** A belonging, as it feels to take up. Cold is permanent. */
export const feelOf = (object: ObjectState): string =>
  band(
    object.charge,
    [
      [0.75, 'warm'],
      [0.45, 'cooling'],
      [0.15, 'nearly cold'],
    ],
    'cold, and staying cold',
  );

/**
 * The same four steps as `feelOf`, as a slug a client can colour by. Kept
 * beside it so the word and the colour can never disagree.
 */
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

/** How much is left in the belongings altogether. The run's other clock. */
export const remaining = (state: WorldState): number =>
  Object.values(state.objects).reduce((sum, o) => sum + o.charge, 0);
