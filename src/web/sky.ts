/**
 * The light through the opening: the falloff across it, the disc that crosses
 * it, and what a body over it keeps out.
 *
 * Both pictures draw the same light on different geometry, so the stops live
 * here and the placement does not. Each renderer appends what it uses and sets
 * the units and the shape itself.
 */

import { gradient } from './svg.js';

/**
 * Light falloff across the opening, as gradient stops. The figure is masked
 * with the same numbers, so its silhouette ends where the light does.
 */
export const LIT_FALLOFF = [
  ['0%', 1],
  ['34%', 0.97],
  ['57%', 0.62],
  ['83%', 0.34],
  ['100%', 0.18],
] as const;

/** Share of the opening the light fills. Sizes the figure. */
export const LIT_CORE = 0.57;

/**
 * What a fully occluding figure costs: opacity off the halo and the coin, and
 * brightness off the whole picture, the hole being its only light. The coin
 * keeps most of its own, since it is what the silhouette is read against.
 */
export const OCCLUDED = { halo: 0.8, coin: 0.22, room: 0.16 } as const;

/** The opening and the coin, which are one shape; the falloff sizes the coin. */
export const skyGlow = (): SVGElement =>
  gradient('sky-glow', 'radialGradient', [
    [LIT_FALLOFF[0][0], '#fffdf2', LIT_FALLOFF[0][1]],
    [LIT_FALLOFF[1][0], '#f7e6ad', LIT_FALLOFF[1][1]],
    [LIT_FALLOFF[2][0], '#e0c983', LIT_FALLOFF[2][1]],
    [LIT_FALLOFF[3][0], '#c0a765', LIT_FALLOFF[3][1]],
    [LIT_FALLOFF[4][0], '#9c8347', LIT_FALLOFF[4][1]],
  ]);

/** The same profile in white, as a mask: the figure ends where the coin does. */
export const litFalloff = (): SVGElement =>
  gradient(
    'lit-falloff',
    'radialGradient',
    LIT_FALLOFF.map(([offset, alpha]) => [offset, '#ffffff', alpha] as const),
  );

/**
 * The sky's signal: a cold disc crossing the opening. Alpha is held almost to
 * the edge and dropped over the last sixth, so it has a rim and reads as a
 * body up there rather than as a smear of light.
 */
export const skyLight = (): SVGElement =>
  gradient('sky-light', 'radialGradient', [
    ['0%', '#f8fafd', 0.94],
    ['64%', '#edf1f8', 0.88],
    ['87%', '#dbe3ef', 0.66],
    ['100%', '#c3d0e0', 0],
  ]);
