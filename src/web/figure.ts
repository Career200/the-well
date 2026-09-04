/**
 * The body at the rim: a head and a pair of shoulders in the opening, and what
 * the two levers do to them.
 *
 * A renderer supplies the opening's screen box and this holds the rest, so the
 * figure does not care how the opening was arrived at. Everything it does to
 * the state is a class, a scale, or a custom property; the motion laid over the
 * pose lives in the stylesheet.
 */

import { LIT_CORE, litFalloff } from './sky.js';
import type { ShaftState } from './shaft.js';
import { attrs, clamp01, svgEl } from './svg.js';

/** The opening on screen: its centre and its two half-axes, px. */
export interface Opening {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/**
 * Head and shoulders, as shares of the opening's half-width. Taking both from
 * one axis keeps the body the shape it is whatever the lens makes of the hole
 * around it: the shaft is foreshortened, the sky through it is not.
 */
const HEAD = { rx: 0.116, ry: 0.075 } as const;
const SHOULDERS = { rx: 0.314, ry: 0.128 } as const;

/** How far the head leans in past the shoulders, in the same share. */
const LEAN_IN = 0.17;

/** Scale applied on top of the pose while leaving. */
const LEAVE_SCALE = 0.93;

/** Lean the body and the head take at full reach, as added scale. */
const RESONANCE_LEAN = 0.12;
const RESONANCE_HEAD = 0.17;

/** How far back each step of recoil puts them. */
const RECOIL = [1, 0.9, 0.79] as const;

/** How long the coat's half-arrival runs, ms. Matches `.figure.withdrawing`. */
const WITHDRAW_MS = 2600;

export interface Figure {
  /** Goes into whatever the renderer clips to the opening. */
  readonly el: SVGGElement;
  /** The falloff that shapes it, and the mask that carries it. Go in `defs`. */
  readonly defs: readonly SVGElement[];
  /** Put it in the opening. Every anchor comes from that box. */
  place(at: Opening): void;
  /** Whether they are there, and what the levers have done to them. */
  pose(state: ShaftState): void;
  /** Up and gone inside one beat. The coat's hiding. */
  withdraw(): void;
  destroy(): void;
}

export function makeFigure(): Figure {
  const mask = svgEl('mask');
  mask.id = 'sky-lit';
  mask.setAttribute('maskUnits', 'userSpaceOnUse');
  const litShape = svgEl('ellipse');
  litShape.setAttribute('fill', 'url(#lit-falloff)');
  mask.append(litShape);

  const el = svgEl('g');
  el.classList.add('figure');
  el.setAttribute('mask', 'url(#sky-lit)');
  const shoulders = svgEl('ellipse');
  const head = svgEl('ellipse');
  head.classList.add('head');
  el.append(shoulders, head);

  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    el,
    defs: [litFalloff(), mask],

    place({ cx, cy, rx, ry }: Opening): void {
      attrs(litShape, { cx, cy, rx, ry });

      // The near lip is the top of the opening on screen: the wall the camera
      // has its back to is the closest part of the rim, and this lens carries
      // the closest part furthest off the forward axis. So the body comes over
      // the top edge and leans down into the hole, not up out of the bottom.
      //
      // It sits on the near edge of the lit core rather than on the stone. The
      // coin's own falloff is nearly out by the lip, and a silhouette needs
      // light behind it to be a silhouette at all.
      const near = cy - ry * LIT_CORE;
      const headCy = near + rx * LEAN_IN;
      const headRy = rx * HEAD.ry;
      attrs(shoulders, { cx, cy: near, rx: rx * SHOULDERS.rx, ry: rx * SHOULDERS.ry });
      attrs(head, { cx, cy: headCy, rx: rx * HEAD.rx, ry: headRy });

      // Both poses are scales about a fixed point. The body anchors where it
      // comes over the lip, so drawing back takes it out of the hole; the head
      // anchors to its own chin, the edge of it nearest the shoulders.
      el.style.transformOrigin = `${cx.toFixed(1)}px ${near.toFixed(1)}px`;
      head.style.transformOrigin = `${cx.toFixed(1)}px ${(headCy - headRy).toFixed(1)}px`;
    },

    pose(state: ShaftState): void {
      el.classList.toggle('there', state.occupied);
      el.classList.toggle('leaving', state.leaving);

      // Every part of the response scales with how much of the belonging
      // landed, so one nobody up there cares about moves nothing.
      const reach = state.resonating ? clamp01(state.reach) : 0;
      // One scale for both levers: recoil sinks them behind the rim, a
      // belonging brings them over it, and a scene with both nets out.
      const scale =
        RECOIL[state.recoil]! * (1 + RESONANCE_LEAN * reach) * (state.leaving ? LEAVE_SCALE : 1);
      el.style.transform = scale === 1 ? '' : `scale(${scale.toFixed(3)})`;
      head.style.transform = reach > 0 ? `scale(${(1 + RESONANCE_HEAD * reach).toFixed(3)})` : '';

      // The motion laid over the pose keys off these in the stylesheet: a
      // tremor at recoil, a head still attending at reach. Both animate the
      // `translate` property, which composes with the scale above.
      el.dataset['recoil'] = String(state.recoil);
      el.style.setProperty('--reach', reach.toFixed(3));
      // The hue map is in the stylesheet, keyed as the log and the cells are.
      if (state.resonating) el.dataset['subjectId'] = state.resonating;
      else delete el.dataset['subjectId'];
    },

    withdraw(): void {
      el.classList.remove('withdrawing');
      void (el as unknown as HTMLElement).offsetWidth; // restart a running one
      el.classList.add('withdrawing');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('withdrawing'), WITHDRAW_MS);
    },

    destroy(): void {
      clearTimeout(timer);
    }
  };
}
