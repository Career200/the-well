/**
 * The water's clock. Runs only while the surface is unsettled, and stops for a
 * hidden tab.
 *
 * A push strikes it: `agitation` jumps to the kick and eases back to zero, and
 * `phase` advances one step per tick for as long as it runs. Both are read by
 * whatever is drawing; the clock itself writes nothing.
 *
 * `prefers-reduced-motion` is not read: every animation driven from here is
 * under a few px, with no travel, parallax or sudden onset.
 */

import { clamp01, lerp } from './svg.js';

/** Clock period, ms. ~5fps; the stepped look suits the halftone. */
const TICK_MS = 190;
/** Ripple travel per tick, scaled so a pass crosses in about 3.5s. */
const PHASE_PER_TICK = 0.33;
/** Agitation a push sets, interpolated on charge. */
const KICK_CALM = 0.45;
const KICK_SPENT = 1;
/** Fraction of the remaining agitation a tick takes: ~1s calm, ~3s spent. */
const SETTLE_CALM = 0.4;
const SETTLE_SPENT = 0.2;
/** Floor for the settle, so the exponential terminates and the clock stops. */
const REST = 0.015;

export interface Clock {
  /** Ripple travel, advanced only by the clock. */
  readonly phase: number;
  /** Current unsettledness, 0 to 1, eased to 0 per tick. */
  readonly agitation: number;
  /** A push landed. Sets the agitation and runs until it settles. */
  strike(): void;
  /** Stop for good and release the visibility listener. */
  stop(): void;
}

export interface ClockOptions {
  /** Called once per tick, after `phase` and `agitation` have advanced. */
  draw: () => void;
  /** Presence charge, 0 to 1. Sizes the kick and slows the settle. */
  charge: () => number;
}

export function makeClock({ draw, charge }: ClockOptions): Clock {
  let phase = 0;
  let agitation = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  /** Kick size and settle rate, both interpolated on how spent the charge is. */
  const spent = (): number => 1 - clamp01(charge());
  const kick = (): number => lerp(KICK_CALM, KICK_SPENT, spent());
  const settle = (): number => lerp(SETTLE_CALM, SETTLE_SPENT, spent());

  function beat(): void {
    phase += PHASE_PER_TICK;
    agitation -= agitation * settle();
    if (agitation < REST) agitation = 0;
    draw();
    // At rest there is nothing to draw, so the clock stops itself.
    if (agitation === 0) reclock();
  }

  function reclock(): void {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    if (!document.hidden && agitation > 0) timer = setInterval(beat, TICK_MS);
  }

  document.addEventListener('visibilitychange', reclock);

  return {
    get phase() {
      return phase;
    },
    get agitation() {
      return agitation;
    },
    strike(): void {
      agitation = clamp01(kick());
      reclock();
    },
    stop(): void {
      document.removeEventListener('visibilitychange', reclock);
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
      agitation = 0;
    },
  };
}
