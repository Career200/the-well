/**
 * How fine the picture is drawn, from lucidity. Every table here is indexed by
 * `stepOf`, so one discovery is one step and a step is a full rebuild.
 */

import { clamp01 } from './svg.js';

/** Lucidity quantised to `lucidityPerDiscovery`. */
export const STEPS = 5;

export const stepOf = (lucidity: number): number => Math.round(clamp01(lucidity) * (STEPS - 1));

/** Halftone dot spacing, px. Larger is coarser and cheaper to draw. */
export const DOT_SPACING = [14, 13, 12, 11, 10] as const;

/** Joints across the far wall, and courses of stone between rim and floor. */
export const WALLS = [5, 7, 9, 11, 13] as const;
export const COURSES = [4, 6, 8, 10, 12] as const;

/** Blur over the whole picture, px. Zero at full lucidity. */
export const HAZE = [2.6, 1.8, 1.15, 0.5, 0] as const;
