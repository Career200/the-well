/**
 * The level, and what a rise looks like.
 *
 * The surface is the one well dimension that moves in play. A push raises it,
 * riding the `agitation` kick the clock already sets, and what a push displaces
 * grows with the turns behind it, so a late one moves more water than an early
 * one. Nothing here is a standing level: the rise decays with the agitation and
 * the well settles back, so the reading band is only borrowed.
 *
 * How a rise draws is two candidates, kept side by side until one is chosen —
 * `wash` lays a deepening fill under the surface, `grain` carries the halftone
 * up the shaft with it. The `Rise` setting picks between them.
 */

import type { Well } from './projection.js';
import { clamp01, lerp } from './svg.js';

/** How the rise is drawn. Both are built; neither is settled. */
export type Rise = 'wash' | 'grain';

/**
 * Rise a push displaces at full agitation on the first turn, in well units.
 * Sized against the budget that puts the surface at the eye — 0.455 from rest —
 * so a late push on a spent presence crosses it and holds there for a beat
 * rather than for the one frame before the clock takes the agitation back.
 */
const KICK = 0.18;

/** What the last of the turns adds to that, as a multiple, and over how many. */
const LATE = 4;
const LATE_OVER = 40;

/** Most the surface may stand above its rest, in well units. */
const CAP = 0.8;

/** Two harmonics across the ring, and how fast each travels. */
const CHOP = 0.055;
const HARMONIC = [
  { waves: 7, rate: -1.6, share: 0.7 },
  { waves: 13, rate: 0.9, share: 0.3 }
] as const;

/**
 * How far a push displaces the surface, in well units. Zero at rest, so a well
 * nobody has touched is exactly the one `WELL` describes.
 */
export function riseOf(agitation: number, turn: number): number {
  const late = 1 + LATE * clamp01(turn / LATE_OVER);
  return Math.min(CAP, clamp01(agitation) * KICK * late);
}

/** The well as this beat leaves it. A rise is a new well, never a write. */
export const wellAt = (rest: Well, rise: number): Well =>
  rise === 0 ? rest : { ...rest, water: rest.water + rise };

/**
 * The surface at one bearing, as a height in the well. The wave displaces the
 * ring before it is projected, so the bowing is the lens doing it rather than a
 * screen-space path bent to look like it.
 */
export function surfaceAt(well: Well, bearing: number, phase: number, agitation: number): number {
  if (agitation <= 0) return well.water;
  let wave = 0;
  for (const { waves, rate, share } of HARMONIC) {
    wave += Math.sin(bearing * waves + phase * rate) * share;
  }
  return well.water + wave * CHOP * agitation;
}

/**
 * How far under the surface the camera stands, 0 to 1 — 0 at the surface and
 * below it, 1 a full eye-height under. Past 0 the picture is under water, which
 * is the one state that draws over the reading band on purpose.
 */
export const submerged = (well: Well, eye: number): number =>
  clamp01((well.water - eye) / Math.max(0.001, eye));

/**
 * The wash: one fill under the surface, deepening as the level climbs. Depth is
 * carried by colour rather than by more specks, so the cost of a rise is one
 * path however far it goes.
 */
export function washOf(rest: Well, well: Well, eye: number): { fill: string; opacity: number } {
  // How far the rise has come, against the budget that puts the surface at the
  // eye. Past 1 the camera is under and the colour is at its deepest.
  const deep = clamp01((well.water - rest.water) / Math.max(0.001, eye - rest.water));
  const [r, g, b] = [
    Math.round(lerp(58, 12, deep)),
    Math.round(lerp(96, 30, deep)),
    Math.round(lerp(126, 58, deep))
  ];
  // Nothing at rest: the wash is what a rise adds, and a well nobody has
  // pushed is the picture it was before there was a wash at all.
  return { fill: `rgb(${r} ${g} ${b})`, opacity: lerp(0, 0.86, deep) };
}
