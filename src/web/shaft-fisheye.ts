/**
 * The shaft as one SVG, through a fisheye lens: the opening, the waterline,
 * the silt edge and the stonework between them, drawn as polylines from a
 * camera standing on the floor with its back to the wall.
 *
 * One camera pose, held. `lucidity` sets how finely the bowing is subdivided
 * as well as the haze over it; per-place reveal is `resolve`.
 *
 * Class names and group structure match the flat picture, so the stylesheet
 * dresses both.
 */

import { makeChrome, veil } from './chrome.js';
import { makeClock } from './clock.js';
import { COURSES, JOINT_STEPS, RING_STEPS, SILT_RINGS, stepOf, WALLS } from './grain.js';
import { extent, eyeAt, joint, polyline, projector, REST_POSE, ring, WELL } from './projection.js';
import type { Frame, Point, Project } from './projection.js';
import type { Bands, PlaceId, Shaft, ShaftOptions, ShaftState } from './shaft.js';
import { OCCLUDED, skyGlow, skyLight } from './sky.js';
import { attrs, clamp01, hash, lerp, svgEl } from './svg.js';

/**
 * Joints around the full circle, from the far-wall count. The flat picture
 * draws its joints across one half, so a turn takes twice that less the pair
 * that would land on the seam.
 */
const jointsAt = (grain: number): number => 2 * (WALLS[grain]! - 1);

/** Share of a floor cell one speck fills, low to high over its own noise. */
const SPECK_FILL = [0.3, 0.8] as const;

/**
 * The sky's signal disc, as a share of the rim's shorter projected half-axis,
 * and how far it travels as a share of each. The opening is near-round under
 * this lens, so the orbit is the same share both ways.
 */
const MOON = 0.14;
const ORBIT = 0.72;

/** How far the floor stirs with the water, and how fast the wave crosses it. */
const HEAVE = 0.14;
const HEAVE_PER_UNIT = 1.7;

/** One mote of floor, kept so the clock can stir it without re-deriving it. */
interface Speck {
  el: SVGRectElement;
  x: number;
  y: number;
  /** Size at rest, px. */
  base: number;
  /** Distance from the eye, in well units. Sets the size and the wave. */
  dist: number;
  jitter: number;
  /** Last written size, so a still speck costs nothing. */
  size: number;
}

export function makeFisheyeShaft(host: HTMLElement, opts: ShaftOptions = {}): Shaft {
  const svg = svgEl('svg');
  svg.setAttribute('preserveAspectRatio', 'none'); // viewBox tracks pixel size
  svg.classList.add('scene');

  const defs = svgEl('defs');
  // The rim is a bowed polyline rather than an ellipse, so the light across
  // the opening is placed in px off that path instead of in its bounding box.
  const glow = skyGlow();
  attrs(glow, { gradientUnits: 'userSpaceOnUse' });
  const hole = svgEl('clipPath');
  hole.id = 'sky-hole';
  const holeShape = svgEl('path');
  hole.append(holeShape);
  defs.append(glow, skyLight(), hole);

  // ---- the walls: one set of stones, cut at the waterline ----------------
  const wallsG = svgEl('g');
  wallsG.classList.add('walls', 'place-shape');
  const dry = svgEl('g');
  dry.classList.add('dry');
  const drowned = svgEl('g');
  drowned.classList.add('drowned');
  wallsG.append(dry, drowned);

  // ---- the water: the surface, seen from just above it -------------------
  const waterG = svgEl('g');
  waterG.classList.add('water', 'place-shape');
  const waterline = svgEl('path');
  waterline.classList.add('waterline');
  waterline.setAttribute('fill', 'none');
  waterG.append(waterline);

  // ---- the silt ----------------------------------------------------------
  const siltG = svgEl('g');
  siltG.classList.add('silt', 'place-shape');
  const siltEdge = svgEl('path');
  siltEdge.classList.add('silt-edge');
  siltEdge.setAttribute('fill', 'none');
  const siltGrain = svgEl('g');
  siltGrain.classList.add('silt-grain');
  siltG.append(siltEdge, siltGrain);

  // ---- the sky: the opening, and what is through it -----------------------
  // The lip, the coin and the hole are one path. Nothing else in the picture
  // projects inside it — every ring below the rim lands outside it — so the
  // sky is drawn last and covers nothing.
  const coin = svgEl('path');
  coin.classList.add('coin');
  coin.setAttribute('fill', 'url(#sky-glow)');
  const skyDisc = svgEl('ellipse');
  skyDisc.classList.add('sky-light');
  skyDisc.setAttribute('fill', 'url(#sky-light)');
  const rim = svgEl('path');
  rim.classList.add('rim');
  rim.setAttribute('fill', 'none');

  // The lip is stonework and stays outside the clip; the disc travels, so it
  // needs one.
  const through = svgEl('g');
  through.setAttribute('clip-path', 'url(#sky-hole)');
  through.append(coin, skyDisc);

  const skyG = svgEl('g');
  skyG.classList.add('sky', 'place-shape');
  skyG.append(through, rim);

  svg.append(defs, wallsG, waterG, siltG, skyG);

  const shapes: Record<PlaceId, SVGGElement> = { sky: skyG, walls: wallsG, water: waterG, silt: siltG };
  const chrome = makeChrome(shapes, opts.onPlace);
  host.replaceChildren(svg, chrome.corners, chrome.regions);

  let specks: Speck[] = [];
  let last: ShaftState | undefined;
  let bands: Bands = { skyBottom: 0, waterTop: 0, siltTop: 0 };
  /** Which grain the picture is currently built at. A step rebuilds it. */
  let grain = -1;

  const clock = makeClock({ draw: () => draw(), charge: () => last?.charge ?? 1 });

  /** One path element carrying a polyline, appended to `into`. */
  const strokePath = (into: SVGGElement, pts: readonly Point[], project: Project): void => {
    const d = polyline(pts, project);
    if (!d) return;
    const path = svgEl('path');
    attrs(path, { d });
    into.append(path);
  };

  /**
   * The floor, as motes stuck to the plane at `y = 0`. Generated on a polar
   * grid and culled to the frame: at rest the lens carries only the far third
   * of the disc, so most of the grid never reaches a rect.
   */
  function buildSilt(project: Project, frame: Frame, rings: number): void {
    siltGrain.replaceChildren();
    specks = [];
    const eye = eyeAt(REST_POSE, WELL);
    const step = WELL.radius / rings;
    // Px per radian, which is what turns a cell of floor into a size on screen.
    const f = frame.h / 2 / (REST_POSE.fov / 2);
    const margin = 8;

    for (let i = 0; i < rings; i++) {
      const r = (i + 0.5) * step;
      const arcs = Math.max(8, Math.round((2 * Math.PI * r) / step));
      for (let j = 0; j < arcs; j++) {
        const n = hash(r * 71.3, j * 13.7);
        const m = hash(j * 29.1, r * 47.9);
        // Off the grid, or the floor reads as a grid.
        const t = ((j + (m - 0.5) * 0.7) / arcs) * Math.PI * 2;
        const rr = r + (n - 0.5) * step * 0.7;
        const p: Point = { x: Math.cos(t) * rr, y: 0, z: Math.sin(t) * rr };
        const s = project(p);
        if (!s) continue;
        if (s.x < -margin || s.x > frame.w + margin) continue;
        if (s.y < -margin || s.y > frame.h + margin) continue;

        // A cell is `step` across; the lens decides how many px that is from
        // here, so the near floor is coarse and the far floor is fine.
        const dist = Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);
        const fill = lerp(SPECK_FILL[0], SPECK_FILL[1], n);
        const base = Math.round(((f * step) / dist) * fill * 2) / 2;
        if (base <= 0.5) continue;

        const el = svgEl('rect');
        attrs(el, { x: s.x - base / 2, y: s.y - base / 2, width: base, height: base, fill: 'currentColor' });
        siltGrain.append(el);
        specks.push({ el, x: s.x, y: s.y, base, dist, jitter: m, size: base });
      }
    }
  }

  function layout(): void {
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    grain = stepOf(last?.lucidity ?? 0);
    const ringSteps = RING_STEPS[grain]!;
    const jointSteps = JOINT_STEPS[grain]!;
    const joints = jointsAt(grain);
    const courses = COURSES[grain]!;

    const frame: Frame = { w, h };
    const project = projector(REST_POSE, WELL, frame);

    const rimRing = ring(WELL.height, WELL, ringSteps);
    const surfaceRing = ring(WELL.water, WELL, ringSteps);
    const floorRing = ring(0, WELL, ringSteps);

    // The lip, the coin and the clip are the same closed polyline.
    const rimD = polyline(rimRing, project);
    attrs(rim, { d: rimD });
    attrs(coin, { d: rimD });
    attrs(holeShape, { d: rimD });
    attrs(waterline, { d: polyline(surfaceRing, project) });
    attrs(siltEdge, { d: polyline(floorRing, project) });

    // A joint runs the full height, cut at the surface so the two halves take
    // their own opacity from the stylesheet.
    dry.replaceChildren();
    drowned.replaceChildren();
    for (let i = 0; i < joints; i++) {
      const t = (i / joints) * Math.PI * 2;
      strokePath(dry, joint(t, WELL.water, WELL.height, WELL, jointSteps), project);
      strokePath(drowned, joint(t, 0, WELL.water, WELL, jointSteps), project);
    }

    // Courses of stone, evenly spaced in the well. The crowding toward the rim
    // is the lens doing it rather than a curve applied here.
    for (let k = 1; k <= courses; k++) {
      const y = (k / (courses + 1)) * WELL.height;
      strokePath(y > WELL.water ? dry : drowned, ring(y, WELL, ringSteps), project);
    }

    buildSilt(project, frame, SILT_RINGS[grain]!);

    // Provisional: the screen extremes of the three rings, which is enough to
    // stack the tap targets. Deriving the reading band properly is its own step.
    const rimAt = extent(rimRing, project);
    const surfaceAt = extent(surfaceRing, project);
    const floorAt = extent(floorRing, project);

    // The light through the opening, placed off the rim's own box. The gradient
    // is a circle in user space, so a transform gives it the box's aspect.
    if (rimAt) {
      const cx = (rimAt.left + rimAt.right) / 2;
      const cy = (rimAt.top + rimAt.bottom) / 2;
      const rx = Math.max(1, (rimAt.right - rimAt.left) / 2);
      const ry = Math.max(1, (rimAt.bottom - rimAt.top) / 2);
      attrs(glow, {
        cx,
        cy,
        r: rx,
        gradientTransform: `translate(0 ${cy.toFixed(1)}) scale(1 ${(ry / rx).toFixed(4)}) translate(0 ${(-cy).toFixed(1)})`,
      });
      // Round: the shaft is foreshortened but the sky through the hole is not,
      // so a body up there is a circle on screen.
      const moon = Math.min(rx, ry) * MOON;
      attrs(skyDisc, { cx, cy, rx: moon, ry: moon });
      skyDisc.style.setProperty('--orbit-x', `${(rx * ORBIT).toFixed(1)}px`);
      skyDisc.style.setProperty('--orbit-y', `${(ry * ORBIT).toFixed(1)}px`);
    }

    bands = {
      skyBottom: rimAt?.bottom ?? 0,
      waterTop: surfaceAt?.top ?? h,
      siltTop: floorAt?.top ?? h,
    };

    chrome.stack(bands, h);

    if (last) draw();
    opts.onLayout?.(bands);
  }

  /** The only function here that writes to the DOM outside `layout`. */
  function draw(): void {
    const state = last;
    if (!state) return;

    // The floor stirs with the water, at a lower amplitude.
    for (const speck of specks) {
      const heave = Math.sin(speck.dist * HEAVE_PER_UNIT - clock.phase * 0.35 + speck.jitter * 6.2);
      const size = Math.max(0, Math.round(speck.base * (1 + heave * HEAVE * clock.agitation) * 2) / 2);
      if (size === speck.size) continue;
      speck.size = size;
      attrs(speck.el, { x: speck.x - size / 2, y: speck.y - size / 2, width: size, height: size });
    }

    chrome.agitate(state, clock.agitation);

    // The light a body over the hole keeps out. The coin loses opacity; the
    // shaft loses brightness, the hole being the only light it has.
    const shut = clamp01(state.occlusion);
    coin.style.opacity = String(1 - shut * OCCLUDED.coin);
    veil(svg, state, shut * OCCLUDED.room);

    chrome.places(state);
  }

  layout();
  const observer = new ResizeObserver(layout);
  observer.observe(host);

  return {
    resolve: chrome.resolve,
    update(state: ShaftState): void {
      last = state;
      if (state.pressing) clock.strike(state.turn);
      // A step of lucidity changes the grain, which means a full rebuild.
      if (stepOf(state.lucidity) !== grain) layout();
      else draw();
    },
    bands: () => bands,
    flash: chrome.flash,
    /** No figure at this scope; the coat's hiding has nothing to play on yet. */
    withdraw(): void {},
    destroy(): void {
      observer.disconnect();
      clock.stop();
      chrome.destroy();
      host.replaceChildren();
    },
  };
}
