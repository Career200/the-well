/**
 * The shaft as one SVG, through a fisheye lens: the opening, the waterline,
 * the silt edge and the stonework between them, drawn as polylines from a
 * camera standing on the floor with its back to the wall.
 *
 * `lucidity` sets how finely the bowing is subdivided as well as the haze over
 * it; per-place reveal is `resolve`.
 *
 * Drawing is in two halves. `build` decides which elements exist and what
 * world points each one carries, and runs on a step of lucidity. `reproject`
 * walks those points through the current pose and writes screen coordinates,
 * and runs on every frame of a camera move — so a move costs attribute writes
 * and no element churn.
 *
 * Class names and group structure match the flat picture, so the stylesheet
 * dresses both.
 */

import { cameraFor, DIALS, makeCamera, poseOf } from './camera.js';
import type { Dials, PoseName } from './camera.js';
import { makeChrome, veil } from './chrome.js';
import { makeClock } from './clock.js';
import { COURSES, JOINT_STEPS, RING_STEPS, SILT_RINGS, stepOf, WALLS } from './grain.js';
import { crossing, extent, eyeAt, joint, polyline, projector, ring, WELL } from './projection.js';
import type { Camera, Frame, Point, Project } from './projection.js';
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

/** Smallest speck the halftone carries, px. Below this it is not drawn. */
const SPECK_FLOOR = 0.5;

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

/** A polyline that exists as an element and is reprojected in place. */
interface Line {
  el: SVGPathElement;
  pts: readonly Point[];
}

/** One mote of floor, stuck to the plane at `y = 0`. */
interface Speck {
  el: SVGRectElement;
  /** Where it is in the well. Fixed; the pose moves around it. */
  at: Point;
  /** Share of a cell it fills, and its offset in the wave. */
  fill: number;
  jitter: number;
  /** Where the last reprojection put it, px. */
  x: number;
  y: number;
  /** Its size at rest for that pose, px. Zero when the frame does not hold it. */
  base: number;
  /** Distance from the eye, well units. Sets the wave. */
  dist: number;
  /** Last written size. Negative once it has moved and must be written again. */
  size: number;
}

export function makeFisheyeShaft(
  host: HTMLElement,
  opts: ShaftOptions = {},
  dials: () => Dials = () => DIALS
): Shaft {
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

  let last: ShaftState | undefined;
  let bands: Bands = { skyBottom: 0, waterTop: 0, siltTop: 0 };
  let frame: Frame = { w: 800, h: 600 };

  // ---- what `build` decides and `reproject` reads -------------------------
  /** Which grain the picture is currently built at. A step rebuilds it. */
  let grain = -1;
  /** The three rings the bands are cut on, and the sky's own box. */
  let rimRing: Point[] = [];
  let surfaceRing: Point[] = [];
  let floorRing: Point[] = [];
  /** Joints and courses, each already parented into `dry` or `drowned`. */
  let lines: Line[] = [];
  let specks: Speck[] = [];
  /** A floor cell, well units. Sets how many px one speck is worth. */
  let cell = 0;

  /** Which pose the state last asked for. A change is what eases. */
  let posed: PoseName = 'rest';

  const clock = makeClock({ draw: () => draw(), charge: () => last?.charge ?? 1 });
  const camera = makeCamera({
    start: cameraFor('rest', dials()),
    draw: () => reproject(),
    // Bands travel the length of a move, and the reading band cannot be
    // relaid fifteen times a second. The client is told where the picture
    // came to rest; `bands()` answers live for anyone who wants it sooner.
    settled: () => opts.onLayout?.(bands)
  });

  /** One path element carrying a polyline, appended to `into`. */
  const strokeLine = (into: SVGGElement, pts: readonly Point[]): void => {
    const el = svgEl('path');
    into.append(el);
    lines.push({ el, pts });
  };

  /**
   * The floor, as motes on a polar grid. Every mote of the disc gets an
   * element: which of them the frame holds is the pose's business, and a pose
   * that culled the set could not move without rebuilding it.
   */
  function buildSilt(rings: number): void {
    siltGrain.replaceChildren();
    specks = [];
    cell = WELL.radius / rings;

    for (let i = 0; i < rings; i++) {
      const r = (i + 0.5) * cell;
      const arcs = Math.max(8, Math.round((2 * Math.PI * r) / cell));
      for (let j = 0; j < arcs; j++) {
        const n = hash(r * 71.3, j * 13.7);
        const m = hash(j * 29.1, r * 47.9);
        // Off the grid, or the floor reads as a grid.
        const t = ((j + (m - 0.5) * 0.7) / arcs) * Math.PI * 2;
        const rr = r + (n - 0.5) * cell * 0.7;
        const el = svgEl('rect');
        attrs(el, { x: 0, y: 0, width: 0, height: 0, fill: 'currentColor' });
        siltGrain.append(el);
        specks.push({
          el,
          at: { x: Math.cos(t) * rr, y: 0, z: Math.sin(t) * rr },
          fill: lerp(SPECK_FILL[0], SPECK_FILL[1], n),
          jitter: m,
          x: 0,
          y: 0,
          base: 0,
          dist: 1,
          size: 0
        });
      }
    }
  }

  /** Which elements exist, and what world points each one carries. */
  function build(): void {
    grain = stepOf(last?.lucidity ?? 0);
    const ringSteps = RING_STEPS[grain]!;
    const jointSteps = JOINT_STEPS[grain]!;
    const joints = jointsAt(grain);
    const courses = COURSES[grain]!;

    rimRing = ring(WELL.height, WELL, ringSteps);
    surfaceRing = ring(WELL.water, WELL, ringSteps);
    floorRing = ring(0, WELL, ringSteps);

    dry.replaceChildren();
    drowned.replaceChildren();
    lines = [];

    // A joint runs the full height, cut at the surface so the two halves take
    // their own opacity from the stylesheet.
    for (let i = 0; i < joints; i++) {
      const t = (i / joints) * Math.PI * 2;
      strokeLine(dry, joint(t, WELL.water, WELL.height, WELL, jointSteps));
      strokeLine(drowned, joint(t, 0, WELL.water, WELL, jointSteps));
    }

    // Courses of stone, evenly spaced in the well. The crowding toward the rim
    // is the lens doing it rather than a curve applied here.
    for (let k = 1; k <= courses; k++) {
      const y = (k / (courses + 1)) * WELL.height;
      strokeLine(y > WELL.water ? dry : drowned, ring(y, WELL, ringSteps));
    }

    buildSilt(SILT_RINGS[grain]!);
    reproject();
  }

  /** Every speck through the lens. Writes nothing; `draw` does that. */
  function placeSilt(project: Project, cam: Camera): void {
    const eye = eyeAt(cam, WELL);
    // Px per radian, which is what turns a cell of floor into a size on screen.
    const f = frame.h / 2 / (cam.fov / 2);
    const margin = 8;

    for (const speck of specks) {
      const s = project(speck.at);
      const held =
        s !== null &&
        s.x >= -margin &&
        s.x <= frame.w + margin &&
        s.y >= -margin &&
        s.y <= frame.h + margin;
      if (!held) {
        speck.base = 0;
        continue;
      }
      // A cell is `cell` across; the lens decides how many px that is from
      // here, so the near floor is coarse and the far floor is fine.
      const dist = Math.hypot(speck.at.x - eye.x, speck.at.y - eye.y, speck.at.z - eye.z);
      const base = Math.round(((f * cell) / dist) * speck.fill * 2) / 2;
      speck.x = s!.x;
      speck.y = s!.y;
      speck.dist = dist;
      speck.base = base <= SPECK_FLOOR ? 0 : base;
      // It has moved, so it is written again whatever size it comes out.
      speck.size = -1;
    }
  }

  /** The built set through the current pose. Every frame of a move runs this. */
  function reproject(): void {
    const cam = camera.pose;
    const project = projector(cam, WELL, frame);

    // The lip, the coin and the clip are the same closed polyline.
    const rimD = polyline(rimRing, project);
    attrs(rim, { d: rimD });
    attrs(coin, { d: rimD });
    attrs(holeShape, { d: rimD });
    attrs(waterline, { d: polyline(surfaceRing, project) });
    attrs(siltEdge, { d: polyline(floorRing, project) });

    for (const line of lines) attrs(line.el, { d: polyline(line.pts, project) });

    placeSilt(project, cam);

    // The light through the opening, placed off the rim's own box. The whole
    // ring is wanted here, off-frame edges and all: it is a shape being lit,
    // not a band being cut.
    const rimAt = extent(rimRing, project);
    if (rimAt) {
      const cx = (rimAt.left + rimAt.right) / 2;
      const cy = (rimAt.top + rimAt.bottom) / 2;
      const rx = Math.max(1, (rimAt.right - rimAt.left) / 2);
      const ry = Math.max(1, (rimAt.bottom - rimAt.top) / 2);
      // The gradient is a circle in user space, so a transform gives it the
      // box's aspect.
      attrs(glow, {
        cx,
        cy,
        r: rx,
        gradientTransform: `translate(0 ${cy.toFixed(1)}) scale(1 ${(ry / rx).toFixed(4)}) translate(0 ${(-cy).toFixed(1)})`
      });
      // Round: the shaft is foreshortened but the sky through the hole is not,
      // so a body up there is a circle on screen.
      const moon = Math.min(rx, ry) * MOON;
      attrs(skyDisc, { cx, cy, rx: moon, ry: moon });
      skyDisc.style.setProperty('--orbit-x', `${(rx * ORBIT).toFixed(1)}px`);
      skyDisc.style.setProperty('--orbit-y', `${(ry * ORBIT).toFixed(1)}px`);
    }

    // Provisional: the three rings' screen crossings, which is enough to stack
    // the tap targets. A ring the frame no longer holds falls to the bottom of
    // the picture, which gives that place no band — which is the truth.
    const rimCut = crossing(rimRing, project, frame);
    const surfaceCut = crossing(surfaceRing, project, frame);
    const floorCut = crossing(floorRing, project, frame);
    bands = {
      skyBottom: rimCut?.bottom ?? 0,
      waterTop: surfaceCut?.top ?? frame.h,
      siltTop: floorCut?.top ?? frame.h
    };
    chrome.stack(bands, frame.h);

    draw();
  }

  /** The frame changed. The set does not depend on it; the projection does. */
  function resize(): void {
    frame = { w: host.clientWidth || 800, h: host.clientHeight || 600 };
    svg.setAttribute('viewBox', `0 0 ${frame.w} ${frame.h}`);
    reproject();
    opts.onLayout?.(bands);
  }

  /** The only function here that writes to the DOM outside `build`. */
  function draw(): void {
    const state = last;

    // The floor stirs with the water, at a lower amplitude. Settled, there is
    // no wave and a speck that has not moved costs nothing.
    const stirred = clock.agitation > 0;
    for (const speck of specks) {
      let size = speck.base;
      if (stirred && size > 0) {
        const heave = Math.sin(speck.dist * HEAVE_PER_UNIT - clock.phase * 0.35 + speck.jitter * 6.2);
        size = Math.max(0, Math.round(speck.base * (1 + heave * HEAVE * clock.agitation) * 2) / 2);
      }
      if (size === speck.size) continue;
      speck.size = size;
      attrs(speck.el, { x: speck.x - size / 2, y: speck.y - size / 2, width: size, height: size });
    }

    if (!state) return;

    chrome.agitate(state, clock.agitation);

    // The light a body over the hole keeps out. The coin loses opacity; the
    // shaft loses brightness, the hole being the only light it has.
    const shut = clamp01(state.occlusion);
    coin.style.opacity = String(1 - shut * OCCLUDED.coin);
    veil(svg, state, shut * OCCLUDED.room);

    chrome.places(state);
  }

  frame = { w: host.clientWidth || 800, h: host.clientHeight || 600 };
  svg.setAttribute('viewBox', `0 0 ${frame.w} ${frame.h}`);
  build();
  opts.onLayout?.(bands);
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  return {
    resolve: chrome.resolve,
    update(state: ShaftState): void {
      last = state;
      if (state.pressing) clock.strike(state.turn);
      // A step of lucidity changes the grain, which means a full rebuild.
      if (stepOf(state.lucidity) !== grain) build();

      const name = poseOf(state);
      const target = cameraFor(name, dials());
      if (name !== posed) {
        // A beat asked for a different pose. This is the only thing that eases.
        posed = name;
        camera.aim(target);
      } else {
        // The pose is unchanged, so any difference is a dial moving under it.
        camera.jump(target);
      }

      draw();
    },
    bands: () => bands,
    flash: chrome.flash,
    /** No figure at this scope; the coat's hiding has nothing to play on yet. */
    withdraw(): void {},
    destroy(): void {
      observer.disconnect();
      clock.stop();
      camera.stop();
      chrome.destroy();
      host.replaceChildren();
    }
  };
}
