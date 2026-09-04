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

/**
 * Points per polyline under a curvilinear lens, which bends every straight
 * edge. Low counts draw the bowing faceted and high counts draw it smooth.
 */
export const RING_STEPS = [32, 48, 64, 96, 128] as const;
export const JOINT_STEPS = [12, 18, 24, 36, 48] as const;

/**
 * Rings of grain across the floor, from the axis to the wall. The count along
 * each ring follows from its circumference, so the scatter is even by area and
 * this is the only dial.
 */
export const SILT_RINGS = [7, 9, 11, 14, 17] as const;
