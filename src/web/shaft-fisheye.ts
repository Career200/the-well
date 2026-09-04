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

import { cameraFor, DIALS, makeCamera, poseOf, samePose } from './camera.js';
import type { Dials, Pose } from './camera.js';
import { makeChrome, veil } from './chrome.js';
import { makeFigure } from './figure.js';
import { makeClock } from './clock.js';
import { COURSES, DOT_SPACING, JOINT_STEPS, RING_STEPS, SILT_RINGS, stepOf, WALLS } from './grain.js';
import { crossing, extent, eyeAt, polyline, projector, ring, WELL } from './projection.js';
import type { Camera, Frame, Point, Project, Well } from './projection.js';
import type { Bands, PlaceId, Shaft, ShaftOptions, ShaftState } from './shaft.js';
import { OCCLUDED, skyGlow, skyLight } from './sky.js';
import { attrs, clamp01, hash, lerp, svgEl } from './svg.js';
import { riseOf, submerged, surfaceAt, washOf, wellAt } from './water.js';
import type { Rise } from './water.js';

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

/**
 * A polyline that exists as an element and is reprojected in place. A course of
 * stone stands at a fixed height, so its points are settled at build; a joint
 * runs between the floor, the surface and the rim, and the surface moves, so it
 * carries its bearing and is walked per frame.
 */
interface Line {
  el: SVGPathElement;
  /** Fixed points, for anything the level does not move. */
  pts?: readonly Point[];
  /** Bearing and which side of the surface, for a joint. */
  at?: { bearing: number; under: boolean };
  /** Height in the well, for a course. Decides whether the water has it. */
  y: number;
}

/**
 * One dot of the flooded grain, on a fixed screen grid. The water is a plane
 * the camera stands just above, so a scatter across it in world space runs to
 * nothing: as the level climbs to the eye the plane collapses toward a horizon
 * and every mote near the camera divides by a distance going to zero. What
 * floods a frame is a field over the region the water covers on it.
 */
interface Mote {
  el: SVGRectElement;
  x: number;
  y: number;
  /** Its own noise, which sets how much of a cell it fills. */
  n: number;
  /** Last written size. */
  size: number;
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

/** What the harness sets: the camera's dials, and how a rise draws. */
export interface View {
  dials: Dials;
  rise: Rise;
}

const VIEW: View = { dials: DIALS, rise: 'wash' };

export function makeFisheyeShaft(
  host: HTMLElement,
  opts: ShaftOptions = {},
  view: () => View = () => VIEW
): Shaft {
  const dials = (): Dials => view().dials;
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
  const figure = makeFigure();
  defs.append(glow, skyLight(), hole, ...figure.defs);

  // ---- the walls: one set of stones, cut at the waterline ----------------
  // One set of stones in two groups: the opacity is the group's, so strokes
  // that cross do not brighten where they meet. A joint knows which half of
  // itself it is and never moves; a course changes hands when the water
  // reaches it.
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
  // The wash: everything under the surface, as one fill. Its top edge is the
  // waterline itself, so the two never disagree about where the water is.
  const wash = svgEl('path');
  wash.classList.add('wash');
  const waterGrain = svgEl('g');
  waterGrain.classList.add('grain');
  const waterline = svgEl('path');
  waterline.classList.add('waterline');
  waterline.setAttribute('fill', 'none');
  waterG.append(wash, waterGrain, waterline);

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

  // The lip is stonework and stays outside the clip; the disc and the body
  // travel, so they need one. The body's own bottom is cut by the lip, which is
  // the clip doing it.
  const through = svgEl('g');
  through.setAttribute('clip-path', 'url(#sky-hole)');
  through.append(coin, skyDisc, figure.el);

  const skyG = svgEl('g');
  skyG.classList.add('sky', 'place-shape');
  skyG.append(through, rim);

  // Back to front. The floor is under the surface at every level, so the water
  // draws over it: with a fill under the waterline, an order that put the silt
  // last would leave the floor sitting on top of the water covering it.
  svg.append(defs, wallsG, siltG, waterG, skyG);

  const shapes: Record<PlaceId, SVGGElement> = { sky: skyG, walls: wallsG, water: waterG, silt: siltG };
  const chrome = makeChrome(shapes, opts.onPlace);
  host.replaceChildren(svg, chrome.corners, chrome.regions);

  let last: ShaftState | undefined;
  let bands: Bands = { skyBottom: 0, waterTop: 0, siltTop: 0 };
  let frame: Frame = { w: 800, h: 600 };

  // ---- what `build` decides and `reproject` reads -------------------------
  /** Which grain the picture is currently built at. A step rebuilds it. */
  let grain = -1;
  /** The rings the bands are cut on. The surface is walked per frame. */
  let rimRing: Point[] = [];
  let floorRing: Point[] = [];
  /** Joints and courses. */
  let lines: Line[] = [];
  let specks: Speck[] = [];
  let motes: Mote[] = [];
  /** A floor cell, well units. Sets how many px one speck is worth. */
  let cell = 0;
  /** Points per polyline at the current grain. */
  let ringSteps = 64;
  let jointSteps = 24;

  /** The well this frame has. Derived from the agitation, never written to. */
  let well: Well = WELL;
  /** Which of the two rise treatments is drawn. Settled at build. */
  let rise: Rise = view().rise;

  /** What the state last asked for. A change is what eases. */
  let posed: Pose = { attend: false, beats: 0 };
  /** The turn a scene started on, so a beat inside one can be counted off it. */
  let sceneAt = 0;

  // The level and the wave both ride the agitation, so a tick moves geometry
  // and not only the size of what is already placed.
  const clock = makeClock({ draw: () => reproject(), charge: () => last?.charge ?? 1 });
  const camera = makeCamera({
    start: cameraFor(posed, dials()),
    draw: () => reproject(),
    // Bands travel the length of a move, and the reading band cannot be
    // relaid fifteen times a second. The client is told where the picture
    // came to rest; `bands()` answers live for anyone who wants it sooner.
    settled: () => opts.onLayout?.(bands)
  });

  /** Which side of the surface a line is on, at the well this frame has. */
  const sideOf = (line: Omit<Line, 'el'>, at: Well): SVGGElement =>
    (line.at ? line.at.under : line.y < at.water) ? drowned : dry;

  /** One path element in the wall, carrying whatever walks its points. */
  const strokeLine = (line: Omit<Line, 'el'>): void => {
    const el = svgEl('path');
    el.setAttribute('fill', 'none');
    sideOf(line, WELL).append(el);
    lines.push({ ...line, el });
  };

  /** The points of one line, at the well this frame has. */
  const pointsOf = (line: Line, at: Well): readonly Point[] => {
    if (line.pts) return line.pts;
    const { bearing, under } = line.at!;
    const x = Math.cos(bearing) * at.radius;
    const z = Math.sin(bearing) * at.radius;
    const y0 = under ? 0 : at.water;
    const y1 = under ? at.water : at.height;
    const pts: Point[] = [];
    for (let i = 0; i <= jointSteps; i++) pts.push({ x, y: y0 + (i / jointSteps) * (y1 - y0), z });
    return pts;
  };

  /**
   * A polar scatter over the disc, even by area: the count along each ring
   * follows from its circumference, so the ring count is the only dial. Off the
   * grid by its own noise, or it reads as a grid.
   */
  function* scatter(rings: number): Generator<{ r: number; bearing: number; n: number; m: number }> {
    const step = WELL.radius / rings;
    for (let i = 0; i < rings; i++) {
      const ring = (i + 0.5) * step;
      const arcs = Math.max(8, Math.round((2 * Math.PI * ring) / step));
      for (let j = 0; j < arcs; j++) {
        const n = hash(ring * 71.3, j * 13.7);
        const m = hash(j * 29.1, ring * 47.9);
        yield {
          r: ring + (n - 0.5) * step * 0.7,
          bearing: ((j + (m - 0.5) * 0.7) / arcs) * Math.PI * 2,
          n,
          m
        };
      }
    }
  }

  /**
   * The flooded grain, as a halftone over the whole frame. Which of it the
   * water has is decided per frame against the surface, so a rise floods more
   * of the grid without any of it being generated for the occasion.
   */
  function buildWater(): void {
    waterGrain.replaceChildren();
    motes = [];
    if (rise !== 'grain') return;
    const spacing = DOT_SPACING[grain]!;
    for (let x = spacing / 2; x < frame.w; x += spacing) {
      for (let y = spacing / 2; y < frame.h; y += spacing) {
        const el = svgEl('rect');
        attrs(el, { x: 0, y: 0, width: 0, height: 0, fill: 'currentColor' });
        waterGrain.append(el);
        motes.push({ el, x, y, n: hash(x, y), size: 0 });
      }
    }
  }

  /**
   * The floor, as motes on a polar grid. Every mote of the disc gets an
   * element: which of them the frame holds is the pose's business, and a pose
   * that culled the set could not move without rebuilding it.
   */
  function buildSilt(rings: number): void {
    siltGrain.replaceChildren();
    specks = [];
    cell = WELL.radius / rings;

    for (const { r, bearing, n, m } of scatter(rings)) {
      const el = svgEl('rect');
      attrs(el, { x: 0, y: 0, width: 0, height: 0, fill: 'currentColor' });
      siltGrain.append(el);
      specks.push({
        el,
        at: { x: Math.cos(bearing) * r, y: 0, z: Math.sin(bearing) * r },
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

  /** Which elements exist, and what world points each one carries. */
  function build(): void {
    grain = stepOf(last?.lucidity ?? 0);
    rise = view().rise;
    ringSteps = RING_STEPS[grain]!;
    jointSteps = JOINT_STEPS[grain]!;
    const joints = jointsAt(grain);
    const courses = COURSES[grain]!;

    rimRing = ring(WELL.height, WELL, ringSteps);
    floorRing = ring(0, WELL, ringSteps);

    dry.replaceChildren();
    drowned.replaceChildren();
    lines = [];

    // A joint runs the full height, cut at the surface so the two halves take
    // their own opacity from the stylesheet. Where the cut falls is the level's
    // business, so the halves are walked per frame rather than settled here.
    for (let i = 0; i < joints; i++) {
      const bearing = (i / joints) * Math.PI * 2;
      strokeLine({ at: { bearing, under: false }, y: WELL.height });
      strokeLine({ at: { bearing, under: true }, y: 0 });
    }

    // Courses of stone, evenly spaced in the well. The crowding toward the rim
    // is the lens doing it rather than a curve applied here.
    for (let k = 1; k <= courses; k++) {
      const y = (k / (courses + 1)) * WELL.height;
      strokeLine({ pts: ring(y, WELL, ringSteps), y });
    }

    buildSilt(SILT_RINGS[grain]!);
    buildWater();
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

  /**
   * The rise, drawn whichever way the setting asks for. Both take the same
   * level and the same waved surface; they differ only in what they put under
   * it — one fill that deepens, or the halftone carried up with the water.
   */
  function paintWater(surface: readonly Point[], project: Project, cam: Camera): void {
    const under = submerged(well, cam.eye) > 0;
    // Where the surface crosses each column of the frame. Everything below the
    // line it draws is water; above it is stone.
    const line = under ? null : skyline(surface, project);

    if (rise === 'wash') {
      const { fill, opacity } = washOf(WELL, well, cam.eye);
      // Under water the surface is overhead and there is no edge to close on,
      // so the wash is the whole frame. That is the state drawing over the
      // reading band, which it is allowed to do for as long as it lasts.
      attrs(wash, { d: line ? closedUnder(line) : `M 0 0 H ${frame.w} V ${frame.h} H 0 Z`, fill });
      wash.style.opacity = String(opacity);
      return;
    }

    const spacing = DOT_SPACING[grain]!;
    const deep = Math.max(1, frame.h - (line ? Math.min(...line) : 0));
    for (const mote of motes) {
      const top = line ? at(line, mote.x) : 0;
      let size = 0;
      if (mote.y >= top) {
        // Light enters at the surface and does not reach the bottom.
        const down = clamp01((mote.y - top) / deep);
        const value = clamp01(0.95 - down * 0.8 + (mote.n - 0.5) * 0.3);
        const swell = 1 + Math.sin((mote.y - top) * 0.055 - clock.phase) * 0.6 * clock.agitation;
        size = Math.max(0, Math.round(value * (spacing - 2) * swell * 2) / 2);
        if (size <= SPECK_FLOOR) size = 0;
        else attrs(mote.el, { x: mote.x - size / 2, y: mote.y - size / 2, width: size, height: size });
      }
      if (size === 0 && mote.size !== 0) attrs(mote.el, { width: 0, height: 0 });
      mote.size = size;
    }
  }

  /** Columns across the frame, each holding the surface's screen height there. */
  const COLUMNS = 48;

  /**
   * The surface as a height per column. The ring passes behind the camera and
   * the lens throws that part of it off to the sides, so only the run the frame
   * holds says anything about where the water is.
   */
  function skyline(surface: readonly Point[], project: Project): number[] {
    const line = new Array<number>(COLUMNS).fill(Infinity);
    for (const p of surface) {
      const s = project(p);
      if (!s || s.x < 0 || s.x > frame.w) continue;
      const col = Math.min(COLUMNS - 1, Math.floor((s.x / frame.w) * COLUMNS));
      if (s.y < line[col]!) line[col] = s.y;
    }
    // Columns the arc missed take their neighbour's height, so the line is
    // continuous across the frame even where the ring is sparse.
    let last = line.find((v) => v !== Infinity) ?? frame.h;
    for (let i = 0; i < COLUMNS; i++) {
      if (line[i] === Infinity) line[i] = last;
      else last = line[i]!;
    }
    for (let i = COLUMNS - 1; i >= 0; i--) {
      if (line[i] === Infinity) line[i] = last;
      else last = line[i]!;
    }
    return line;
  }

  /** The surface's height at one px across the frame. */
  const at = (line: readonly number[], x: number): number =>
    line[Math.min(COLUMNS - 1, Math.max(0, Math.floor((x / frame.w) * COLUMNS)))]!;

  /** The columns closed down over the bottom of the frame. */
  function closedUnder(line: readonly number[]): string {
    const step = frame.w / COLUMNS;
    let d = `M 0 ${line[0]!.toFixed(1)} `;
    for (let i = 0; i < COLUMNS; i++) d += `L ${((i + 0.5) * step).toFixed(1)} ${line[i]!.toFixed(1)} `;
    d += `L ${frame.w} ${line[COLUMNS - 1]!.toFixed(1)} L ${frame.w} ${frame.h} L 0 ${frame.h} Z`;
    return d;
  }

  /** The built set through the current pose. Every frame of a move runs this. */
  function reproject(): void {
    const cam = camera.pose;
    // A push raises the surface and it settles back with the agitation, so the
    // level is worked out per frame rather than carried between them.
    well = wellAt(WELL, riseOf(clock.agitation, last?.turn ?? 0));
    const project = projector(cam, well, frame);

    // The lip, the coin and the clip are the same closed polyline.
    const rimD = polyline(rimRing, project);
    attrs(rim, { d: rimD });
    attrs(coin, { d: rimD });
    attrs(holeShape, { d: rimD });
    attrs(siltEdge, { d: polyline(floorRing, project) });

    // The surface, waved before it is projected: the ring's own `y` moves, so
    // the bowing across it is the lens and not a screen-space path bent to look
    // like one.
    const surfaceRing: Point[] = [];
    for (let i = 0; i <= ringSteps; i++) {
      const bearing = (i / ringSteps) * Math.PI * 2;
      surfaceRing.push({
        x: Math.cos(bearing) * well.radius,
        y: surfaceAt(well, bearing, clock.phase, clock.agitation),
        z: Math.sin(bearing) * well.radius
      });
    }
    attrs(waterline, { d: polyline(surfaceRing, project) });

    for (const line of lines) {
      attrs(line.el, { d: polyline(pointsOf(line, well), project) });
      // A course changes hands when the water reaches it, which is rare enough
      // to be worth a check and not a rebuild.
      const side = sideOf(line, well);
      if (line.el.parentNode !== side) side.append(line.el);
    }

    placeSilt(project, cam);
    paintWater(surfaceRing, project, cam);

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
      // Every anchor the body takes is off this same box, so a pose that moves
      // the opening moves the body with it.
      figure.place({ cx, cy, rx, ry });
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
    // The flooded grain is a screen grid, so it is the one part of the set the
    // frame decides.
    buildWater();
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

    figure.pose(state);
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

      // A scene's beats are counted off the turn somebody arrived on.
      if (state.occupied && !posed.attend) sceneAt = state.turn;
      const pose = poseOf(state, state.turn - sceneAt);
      const target = cameraFor(pose, dials());
      if (!samePose(pose, posed)) {
        // A beat asked for something else. This is the only thing that eases,
        // and it retargets from wherever a running move has reached.
        posed = pose;
        camera.aim(target);
      } else {
        // What the state asks for is unchanged, so any difference is a dial
        // moving under it.
        camera.jump(target);
      }

      // The level is a function of this beat, so the beat reprojects: waiting
      // for the water's own clock would land the rise a tick late.
      reproject();
    },
    bands: () => bands,
    flash: chrome.flash,
    withdraw: figure.withdraw,
    destroy(): void {
      observer.disconnect();
      clock.stop();
      camera.stop();
      chrome.destroy();
      figure.destroy();
      host.replaceChildren();
    }
  };
}
