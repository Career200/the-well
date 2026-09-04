/**
 * The shaft, drawn looking up from the bottom: three ellipses down one cone —
 * the rim with the coin of sky in it, the waterline seen from underneath, and
 * the floor. Walls run the whole way, dry stone above the waterline and
 * halftone below it. Text is only ever placed in the dry band; see `Bands`.
 *
 * Everything shares one coordinate system, so the wall joints meet the rim,
 * the waterline and the floor at one angle and a resize rebuilds them
 * together. The viewBox tracks the host's pixel size, so dots stay square.
 *
 * Two root controls: `visibility` fades the whole picture, `lucidity` rebuilds
 * it at a finer grain. Neither reveals a place — that is `resolve`, called per
 * place as the client reads the line about it.
 *
 * `update` only stores state. The clock settles the water and calls `draw`,
 * which is the one function here that writes to the DOM.
 */

const NS = 'http://www.w3.org/2000/svg';

const svgEl = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);

const attrs = (el: Element, values: Record<string, string | number>): void => {
  for (const [key, value] of Object.entries(values)) el.setAttribute(key, String(value));
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Deterministic per-dot noise: the same water every run, not a snowstorm. */
const hash = (x: number, y: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** The four places with geometry to click. The cold has no region. */
export const PLACES = ['sky', 'walls', 'water', 'silt'] as const;
export type PlaceId = (typeof PLACES)[number];

/**
 * Lucidity quantised to match `lucidityPerDiscovery`, so a discovery is one
 * visible step. Every table below is indexed by it.
 */
const STEPS = 5;
const stepOf = (lucidity: number): number => Math.round(clamp01(lucidity) * (STEPS - 1));

/** How far apart the halftone dots sit, in px. Bigger is cheaper and coarser. */
const DOT_SPACING = [14, 13, 12, 11, 10] as const;
/** Joints across the far wall, and courses of stone between the two ends. */
const WALLS = [5, 7, 9, 11, 13] as const;
const COURSES = [4, 6, 8, 10, 12] as const;
/** How much of the room is still guessed at rather than seen, in px of blur. */
const HAZE = [1.7, 1.25, 0.85, 0.4, 0] as const;

/**
 * Flatness of a cross-section, `ry / rx`. Constant at every depth: if it
 * varies, the wall joints stop meeting at one vanishing point.
 */
const SECTION_ASPECT = 0.28;

/**
 * Range for the lean of the outermost joint off vertical, in degrees. Solved
 * per layout rather than fixed, since whether the walls reach the edges of the
 * screen depends on the viewport. Below the floor they stop reading as walls;
 * above the ceiling they read as a funnel.
 */
const SHAFT_ANGLE: readonly [number, number] = [22, 40];

/** Radius of the rim, the small end of the cone. */
const RIM_MAX = 150;
/**
 * Light falloff across the opening, as gradient stops. The figure is masked
 * with the same numbers, so its silhouette ends where the light does.
 */
const LIT_FALLOFF = [
  ['0%', 1],
  ['34%', 0.97],
  ['57%', 0.62],
  ['83%', 0.34],
  ['100%', 0.18],
] as const;
/** Where the light is still worth calling light. Sizes the figure. */
const LIT_CORE = 0.57;

/**
 * Minimum water showing above the floor, as px and as a fraction of height.
 * The waterline goes as far down the cone as it can while leaving this much,
 * since everything above it is reading room.
 */
const WATER_BAND = 130;
const WATER_BAND_VS_HEIGHT = 0.17;

/** Below `NARROW`, the floor lifts until `MIN_SILT_BAND` of it clears the controls. */
const NARROW = 640;
const MIN_SILT_BAND = 56;

/** ~5fps. The stepped look is intended; it suits the halftone. */
export const TICK_MS = 190;
/** Ripple travel per tick, scaled so a pass crosses in about 3.5s. */
const PHASE_PER_TICK = 0.33;
/**
 * A push kicks the water and it settles back to glass on its own. Charge picks
 * the kick and the settle rate: composed is over in about a second, spent runs
 * for nearly three.
 */
const KICK_CALM = 0.45;
const KICK_SPENT = 1;
/** Fraction of what is left that a tick takes away. Lower runs longer. */
const SETTLE_CALM = 0.4;
const SETTLE_SPENT = 0.2;
/** Floor for the settle, so the exponential terminates and the clock stops. */
const REST = 0.015;

/**
 * Charge above which the corners stay open. A level rather than a cycle: it
 * moves only when charge does, and it stays where charge leaves it.
 */
const COMPOSED = 0.7;
/** Share of the remaining opening one push may close for a moment. */
const KICK_SHARE = 0.35;

/** Samples across the waterline. */
const SURFACE_SAMPLES = 56;


export interface ShaftState {
  /** Opacity of the whole picture, 0 to 1. Not the per-place reveal. */
  visibility: number;
  /** Drives the grain of the picture, quantised by `stepOf`. */
  lucidity: number;
  /** Somebody is at the rim. */
  occupied: boolean;
  /** Presence charge. Full is glass; empty never settles. */
  charge: number;
  /** This beat was a push. An event, not a condition. */
  pressing: boolean;
  /** Beat counter, used only to detect a new push. */
  turn: number;
  /** Places with something to say. They signal until asked. */
  signals: readonly PlaceId[];
  /** Whether places accept clicks at all. False in beat zero and in a scene. */
  asking: boolean;
}

/** Where the picture leaves room for words, in viewport px. */
export interface Bands {
  /** Bottom edge of the rim, coin and all. */
  skyBottom: number;
  /** The waterline. Text must stay above it. */
  waterTop: number;
  /** The near edge of the floor. */
  siltTop: number;
}

export interface Shaft {
  update(state: ShaftState): void;
  bands(): Bands;
  /**
   * A place coming out of the dark, once. Not part of `update`: the client
   * calls it at the moment the line about the place is read, which is a delay
   * on a beat rather than a fact about the state of the world — a state
   * snapshot would put the stone up before the sentence that names it.
   *
   * Idempotent, and reversible only for the debug harness.
   */
  resolve(id: PlaceId, on?: boolean): void;
  /**
   * The room answering something the player could not do. The corners already
   * read the charge, so a spike says *that* is what went wrong, without a
   * number appearing anywhere.
   */
  flash(): void;
  /** The clock, for the debug harness. The game never touches these. */
  rate(ms: number): void;
  freeze(): void;
  resume(): void;
  /** One tick, whether or not the clock is running. */
  tick(): void;
}

export interface ShaftOptions {
  onLayout?: (bands: Bands) => void;
  /**
   * Top of the controls. On narrow screens the floor sits against it. No
   * feedback loop: the controls are a fixed-size flex child.
   */
  floor?: () => number;
  /** A place was clicked. The client decides whether that is allowed. */
  onPlace?: (id: PlaceId) => void;
}

interface Dot {
  el: SVGRectElement;
  x: number;
  y: number;
  /** Size at rest, in px. */
  base: number;
  /** Distance from where the ripple starts, in px. */
  dist: number;
  jitter: number;
  /** Last written geometry, so a still dot costs nothing. */
  size: number;
  drift: number;
}

/** The waterline, kept so the clock can break it without re-deriving it. */
interface Surface {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const gradient = (
  id: string,
  kind: 'radialGradient' | 'linearGradient',
  stops: readonly (readonly [string, string, number])[],
  box?: Record<string, string | number>,
): SVGElement => {
  const grad = svgEl(kind);
  grad.id = id;
  if (box) attrs(grad, box);
  for (const [offset, color, opacity] of stops) {
    const stop = svgEl('stop');
    attrs(stop, { offset, 'stop-color': color, 'stop-opacity': opacity });
    grad.append(stop);
  }
  return grad;
};

export function makeShaft(host: HTMLElement, opts: ShaftOptions = {}): Shaft {
  const svg = svgEl('svg');
  svg.setAttribute('preserveAspectRatio', 'none'); // viewBox tracks pixel size
  svg.classList.add('scene');

  const defs = svgEl('defs');
  // The opening and the coin are one ellipse: the walls converge on the hole
  // itself, and the falloff is what makes the sky read as coin-sized.
  const skyGlow = gradient('sky-glow', 'radialGradient', [
    [LIT_FALLOFF[0]![0], '#fffdf2', LIT_FALLOFF[0]![1]],
    [LIT_FALLOFF[1]![0], '#f7e6ad', LIT_FALLOFF[1]![1]],
    [LIT_FALLOFF[2]![0], '#e0c983', LIT_FALLOFF[2]![1]],
    [LIT_FALLOFF[3]![0], '#c0a765', LIT_FALLOFF[3]![1]],
    [LIT_FALLOFF[4]![0], '#9c8347', LIT_FALLOFF[4]![1]],
  ]);
  // The same profile in white, as a mask, so the figure fades out exactly
  // where the coin does.
  const litFalloff = gradient(
    'lit-falloff',
    'radialGradient',
    LIT_FALLOFF.map(([offset, alpha]) => [offset, '#ffffff', alpha] as const),
  );
  // Light pooling around the hole it comes through.
  const underGlow = gradient('under-glow', 'radialGradient', [
    ['0%', '#f7e6ad', 0.3],
    ['55%', '#cdd6db', 0.1],
    ['100%', '#9aa5ac', 0],
  ]);
  // The walls' signal: light moving over the stonework.
  const wallGlow = gradient('wall-glow', 'radialGradient', [
    ['0%', '#d9cfae', 0.55],
    ['100%', '#d9cfae', 0],
  ]);
  // The water's own signal: a glow gathering under the surface, not on it.
  const waterGlow = gradient('water-glow', 'radialGradient', [
    ['0%', '#cfe4d6', 0.5],
    ['60%', '#9fc4ae', 0.2],
    ['100%', '#7fa894', 0],
  ]);
  // The floor, top to bottom. Transparent where it meets the water so the two
  // grains interpenetrate rather than meeting on a drawn edge.
  const siltFill = gradient(
    'silt-body',
    'linearGradient',
    [
      ['0%', '#100d09', 0],
      ['14%', '#100d09', 0.55],
      ['34%', '#0d0b08', 0.92],
      ['100%', '#080706', 1],
    ],
    { x1: 0, y1: 0, x2: 0, y2: 1 },
  );
  // Everything seen through the opening is clipped to it, so no bloom creeps
  // onto the wall.
  const hole = svgEl('clipPath');
  hole.id = 'sky-hole';
  const holeShape = svgEl('ellipse');
  hole.append(holeShape);

  const litMask = svgEl('mask');
  litMask.id = 'sky-lit';
  litMask.setAttribute('maskUnits', 'userSpaceOnUse');
  const litShape = svgEl('ellipse');
  litShape.setAttribute('fill', 'url(#lit-falloff)');
  litMask.append(litShape);
  defs.append(skyGlow, litFalloff, underGlow, wallGlow, waterGlow, siltFill, hole, litMask);

  // ---- the walls: one set of stones, cut at the waterline ----------------
  const wallsG = svgEl('g');
  wallsG.classList.add('walls', 'place-shape');
  const dry = svgEl('g');
  dry.classList.add('dry');
  const drowned = svgEl('g');
  drowned.classList.add('drowned');
  const wallLight = svgEl('ellipse');
  wallLight.setAttribute('fill', 'url(#wall-glow)');
  const wallLightG = svgEl('g');
  wallLightG.classList.add('wall-light');
  wallLightG.append(wallLight);
  wallsG.append(dry, drowned, wallLightG);

  // ---- the water: the waterline, the grain under it, and its own glow ----
  const waterG = svgEl('g');
  waterG.classList.add('water', 'place-shape');
  const waterline = svgEl('path');
  waterline.classList.add('waterline');
  waterline.setAttribute('fill', 'none');
  const gathering = svgEl('ellipse');
  gathering.classList.add('gathering');
  gathering.setAttribute('fill', 'url(#water-glow)');
  const grainG = svgEl('g');
  grainG.classList.add('grain');
  waterG.append(gathering, grainG, waterline);

  // ---- the silt: a body with no edge, and the coarse stuff in it ---------
  const siltG = svgEl('g');
  siltG.classList.add('silt', 'place-shape');
  const siltBody = svgEl('ellipse');
  siltBody.classList.add('silt-body');
  siltBody.setAttribute('fill', 'url(#silt-body)');
  const siltGrain = svgEl('g');
  siltGrain.classList.add('silt-grain');
  siltG.append(siltBody, siltGrain);

  // ---- the sky: the rim, and what is through it --------------------------
  const coin = svgEl('ellipse');
  coin.setAttribute('fill', 'url(#sky-glow)');
  const halo = svgEl('ellipse');
  halo.setAttribute('fill', 'url(#under-glow)');
  const rim = svgEl('ellipse');
  rim.classList.add('rim');
  rim.setAttribute('fill', 'none');
  const figure = svgEl('g');
  figure.setAttribute('mask', 'url(#sky-lit)');
  figure.classList.add('figure');
  const head = svgEl('ellipse');
  const shoulders = svgEl('ellipse');
  figure.append(shoulders, head);

  // What is through the hole, and the lip of the hole itself. The lip is
  // outside the clip: it is the stonework, not the light.
  const through = svgEl('g');
  through.setAttribute('clip-path', 'url(#sky-hole)');
  through.append(halo, coin, figure);

  const skyG = svgEl('g');
  skyG.classList.add('sky', 'place-shape');
  skyG.append(through, rim);

  svg.append(defs, wallsG, waterG, siltG, skyG);

  // A separate channel from the SVG, so it lands on the first press, before
  // the shaft is visible enough to read.
  const corners = document.createElement('div');
  corners.className = 'agitation';

  // Tap targets: transparent full-width bands stacked over the picture.
  const regions = document.createElement('div');
  regions.className = 'places';
  const shapes: Record<PlaceId, SVGGElement> = { sky: skyG, walls: wallsG, water: waterG, silt: siltG };
  const buttons = {} as Record<PlaceId, HTMLButtonElement>;
  for (const id of PLACES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place';
    button.dataset['place'] = id;
    button.setAttribute('aria-label', `the ${id}`);
    button.onclick = () => opts.onPlace?.(id);
    buttons[id] = button;
    regions.append(button);
  }

  host.replaceChildren(svg, corners, regions);

  /**
   * Which places are out of the dark. Owned here rather than passed per beat,
   * so one disagreeing snapshot cannot un-resolve a place.
   */
  const here = new Set<PlaceId>();

  function resolve(id: PlaceId, on = true): void {
    if (on) here.add(id);
    else here.delete(id);
    shapes[id].classList.toggle('resolved', on);
    // Unresolved places are not targets and are out of the a11y tree.
    buttons[id].hidden = !on;
  }

  let dots: Dot[] = [];
  let silt: Dot[] = [];
  /** Kept so a resize can redraw the water as it stood, not as glass. */
  let last: ShaftState | undefined;
  let bands: Bands = { skyBottom: 0, waterTop: 0, siltTop: 0 };
  let surface: Surface = { cx: 0, cy: 0, rx: 0, ry: 0 };
  /** Which grain the picture is currently built at. A step rebuilds it. */
  let grain = -1;
  /** The ripple, owned by the clock and by nothing else. */
  let phase = 0;
  /** Current unsettledness, eased toward the charge-derived target per tick. */
  let agitation = 0;
  let pressedAt = -1;
  /** Last waterline written, so a calm surface is not re-pathed every tick. */
  let brokenBy = -1;

  const place = (button: HTMLButtonElement, top: number, bottom: number): void => {
    button.style.top = `${Math.max(0, top)}px`;
    button.style.height = `${Math.max(0, bottom - top)}px`;
  };

  function layout(): void {
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    grain = stepOf(last?.lucidity ?? 0);
    const spacing = DOT_SPACING[grain]!;
    const joints = WALLS[grain]!;
    const courses = COURSES[grain]!;

    const cx = w / 2;

    // ---- the opening ------------------------------------------------------
    // One ellipse for the hole, the sky through it, and the walls' vanishing
    // target. `sky-glow` dying before the edge is what makes it read as a coin.
    const rimRx = Math.min(w * 0.22, RIM_MAX);
    const rimRy = rimRx * SECTION_ASPECT;
    const rimCy = Math.min(h * 0.1, 84);
    /** How much of the opening the light actually fills. Sizes the figure. */
    const lit = rimRx * LIT_CORE;

    // ---- the shaft, as one perspective cone -------------------------------
    // Under a pinhole projection every vertical on a cylinder meets at one
    // point, so every wall joint must too. That holds exactly when the
    // cross-sections are homothetic about that point: one `SECTION_ASPECT` at
    // every depth, and a centre whose distance below the vanishing point is
    // proportional to its width.
    //
    // Everything below follows from one dial — the outermost joint's angle —
    // and three fixed targets: the rim, the waterline, and the floor's near
    // edge.
    const siltRyRef = Math.min(h * 0.22, 198);
    const nearRef = h * 1.04;
    const covered = opts.floor?.() ?? h;
    const siltTop = (w < NARROW ? Math.min(nearRef, covered - MIN_SILT_BAND + siltRyRef) : nearRef) - siltRyRef;
    const want = Math.min(WATER_BAND, h * WATER_BAND_VS_HEIGHT);
    const waterTop = siltTop - want;

    /**
     * The shaft for a given outer-joint angle. `vy` is where the joints meet;
     * a section is placed by its far arc, which is the edge the layout cares
     * about, and its width follows from how far below `vy` its centre lands.
     */
    const shaftAt = (deg: number) => {
      const a = Math.tan((deg * Math.PI) / 180);
      const vy = rimCy - rimRx / a;
      const k = SECTION_ASPECT;
      const centreFor = (top: number): number => (top - k * a * vy) / (1 - k * a);
      const section = (top: number) => {
        const cy = centreFor(top);
        const rx = a * (cy - vy);
        return { cy, rx, ry: k * rx };
      };
      return { a, vy, silt: section(siltTop), surf: section(waterTop) };
    };

    // Binary search for the tightest angle whose waterline still reaches the
    // edges of the viewport. Anything narrower reads as a pond.
    let angle = SHAFT_ANGLE[1]!;
    let lo = SHAFT_ANGLE[0]!;
    let hi = SHAFT_ANGLE[1]!;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (shaftAt(mid).surf.rx >= w / 2) hi = mid;
      else lo = mid;
      angle = hi;
    }

    const { a, vy, silt: siltSec, surf } = shaftAt(angle);
    const siltCy = siltSec.cy;
    const siltRx = siltSec.rx;
    const siltRy = siltSec.ry;
    const surfCy = surf.cy;
    const surfRx = surf.rx;
    const surfRy = surf.ry;
    surface = { cx, cy: surfCy, rx: surfRx, ry: surfRy };

    /** Half-width of the shaft at a screen row, along the outermost joint. */
    const widthAt = (y: number): number => Math.max(1, a * (y - vy));

    /** A cross-section by its centre, for the courses. */
    const sectionAt = (cy: number) => {
      const rx = a * (cy - vy);
      return { rx, ry: SECTION_ASPECT * rx };
    };

    attrs(coin, { cx, cy: rimCy, rx: rimRx, ry: rimRy });
    attrs(litShape, { cx, cy: rimCy, rx: rimRx, ry: rimRy });
    attrs(holeShape, { cx, cy: rimCy, rx: rimRx, ry: rimRy });
    attrs(litMask, {
      x: cx - rimRx * 2,
      y: rimCy - rimRy * 3,
      width: rimRx * 4,
      height: rimRy * 6,
    });
    attrs(halo, { cx, cy: rimCy, rx: rimRx * 1.5, ry: rimRy * 2.4 });
    attrs(rim, { cx, cy: rimCy, rx: rimRx, ry: rimRy });
    // Sized to the lit core rather than the hole, matching the mask.
    const litRy = lit * 0.38;
    attrs(head, { cx, cy: rimCy + litRy * 0.42, rx: lit * 0.2, ry: litRy * 0.4 });
    attrs(shoulders, { cx, cy: rimCy + litRy * 1.3, rx: lit * 0.55, ry: litRy * 0.62 });
    // The sky signals by scaling about its own centre, so it stays in the hole.
    skyG.style.setProperty('--sky-origin', `${cx}px ${rimCy}px`);

    // ---- the walls, cut at the waterline ---------------------------------
    // One set of stones in two groups: dry above, drowned below.
    dry.replaceChildren();
    drowned.replaceChildren();

    // A joint's three points — rim, waterline, floor — lie on one ray from the
    // vanishing point, which is what the homothetic sections buy.
    const segment = (
      angle: number,
      from: { cy: number; rx: number; ry: number },
      to: { cy: number; rx: number; ry: number },
    ): SVGLineElement => {
      const line = svgEl('line');
      attrs(line, {
        x1: cx + from.rx * Math.cos(angle),
        y1: from.cy + from.ry * Math.sin(angle),
        x2: cx + to.rx * Math.cos(angle),
        y2: to.cy + to.ry * Math.sin(angle),
      });
      return line;
    };

    const rimSec = { cy: rimCy, rx: rimRx, ry: rimRy };
    const surfSec = { cy: surfCy, rx: surfRx, ry: surfRy };
    const floorSec = { cy: siltCy, rx: siltRx, ry: siltRy };
    for (let i = 0; i < joints; i++) {
      const angle = Math.PI + (i / (joints - 1)) * Math.PI; // π..2π: the far half
      dry.append(segment(angle, rimSec, surfSec));
      drowned.append(segment(angle, surfSec, floorSec));
    }

    // Courses of stone, crowding as they go up and away.
    for (let k = 1; k <= courses; k++) {
      const t = Math.pow(k / courses, 1.7);
      const cy = lerp(rimCy, siltCy, t);
      const { rx, ry } = sectionAt(cy);
      const course = svgEl('path');
      attrs(course, { d: `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`, fill: 'none' });
      (cy <= surfCy ? dry : drowned).append(course);
    }

    // Sized to the dry stone and centred in it. It travels in CSS, so no JS
    // runs for it per tick.
    const wallMid = lerp(rimCy, waterTop, 0.5);
    attrs(wallLight, { cx, cy: wallMid, rx: Math.max(70, w * 0.2), ry: Math.max(70, (waterTop - rimCy) * 0.38) });

    // ---- the water: everything under the waterline ------------------------
    grainG.replaceChildren();
    dots = [];
    const depth = Math.max(1, siltTop - waterTop);
    for (let x = spacing / 2; x < w; x += spacing) {
      const sx = (x - cx) / siltRx;
      const siltEdge = Math.abs(sx) >= 1 ? siltCy : siltCy - siltRy * Math.sqrt(1 - sx * sx);
      const nsx = (x - cx) / surfRx;
      // The far arc of the waterline, which is where the water starts.
      const top = Math.abs(nsx) >= 1 ? surfCy : surfCy - surfRy * Math.sqrt(1 - nsx * nsx);
      for (let y = top; y < h; y += spacing) {
        const nx = (x - cx) / widthAt(y);
        if (Math.abs(nx) > 1) continue;
        if (y > siltEdge) continue;

        // Light enters at the surface and does not reach the bottom.
        const down = clamp01((y - waterTop) / depth);
        const fall = 0.95 - down * 0.8;
        const middle = 1 - nx * nx * 0.35;
        const value = clamp01(fall * middle + (hash(x, y) - 0.5) * 0.3);
        const base = Math.round(value * (spacing - 2) * 2) / 2;
        if (base <= 0.5) continue;

        const el = svgEl('rect');
        attrs(el, { x: x - base / 2, y: y - base / 2, width: base, height: base, fill: 'currentColor' });
        grainG.append(el);
        // `dist` is measured from the waterline: rings start there.
        dots.push({
          el,
          x,
          y,
          base,
          dist: Math.hypot((x - cx) * 0.55, y - waterTop),
          jitter: hash(y, x),
          size: base,
          drift: 0,
        });
      }
    }

    attrs(gathering, { cx, cy: lerp(waterTop, siltTop, 0.55), rx: surfRx * 0.9, ry: Math.max(40, depth * 0.55) });

    // ---- the silt --------------------------------------------------------
    attrs(siltBody, { cx, cy: siltCy, rx: siltRx, ry: siltRy });
    siltGrain.replaceChildren();
    silt = [];
    const siltSpacing = spacing * 1.5;
    for (let x = siltSpacing / 2; x < w; x += siltSpacing) {
      const sx = (x - cx) / siltRx;
      if (Math.abs(sx) > 1) continue;
      const top = siltCy - siltRy * Math.sqrt(1 - sx * sx);
      // Starts above the floor so the two grains meet in a band, not a line.
      const from = top - siltSpacing * 2.5;
      for (let y = from; y < h + siltSpacing; y += siltSpacing) {
        const n = hash(x * 0.7, y * 1.3);
        // Above the floor it is a scatter; on it, it is the ground.
        const held = y < top ? clamp01((y - from) / (top - from)) : 1;
        if (y < top && n > held * 0.85) continue;
        const down = clamp01((y - siltTop) / Math.max(1, h - siltTop));
        const base = Math.round((0.35 + down * 0.85) * (siltSpacing - 3) * (0.45 + n * 0.75) * held * 2) / 2;
        if (base <= 1) continue;
        const jx = (hash(y, x) - 0.5) * siltSpacing * 0.45;
        const el = svgEl('rect');
        attrs(el, { x: x + jx - base / 2, y: y - base / 2, width: base, height: base, fill: 'currentColor' });
        siltGrain.append(el);
        silt.push({ el, x: x + jx, y, base, dist: y, jitter: n, size: base, drift: 0 });
      }
    }

    bands = { skyBottom: rimCy + rimRy, waterTop, siltTop };

    // The regions, in the same order down the picture.
    place(buttons.sky, 0, bands.skyBottom);
    place(buttons.walls, bands.skyBottom, waterTop);
    place(buttons.water, waterTop, siltTop);
    place(buttons.silt, siltTop, h);

    brokenBy = -1;
    if (last) draw();
    opts.onLayout?.(bands);
  }

  /** The waterline, displaced in proportion to `agitation`. */
  function breakSurface(): void {
    // A calm surface is the same path every tick, so only re-walk it when the
    // number that shapes it has moved.
    const shaped = Math.round(agitation * 40) / 40;
    if (shaped === brokenBy && shaped === 0) return;
    brokenBy = shaped;

    const { cx, cy, rx, ry } = surface;
    const chop = agitation * 7;
    let d = '';
    for (let i = 0; i < SURFACE_SAMPLES; i++) {
      const angle = Math.PI + (i / (SURFACE_SAMPLES - 1)) * Math.PI;
      const x = cx + rx * Math.cos(angle);
      // Two harmonics at different rates, flattened at the ends where the
      // surface meets the stone.
      const held = Math.abs(Math.sin(angle));
      const wave =
        Math.sin(angle * 7 - phase * 1.6) * 0.7 + Math.sin(angle * 13 + phase * 0.9) * 0.3;
      const y = cy + ry * Math.sin(angle) + wave * chop * held;
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    waterline.setAttribute('d', d);
  }

  /** The only function here that writes to the DOM. Both clocks end up here. */
  function draw(): void {
    const state = last;
    if (!state) return;

    breakSurface();

    for (const dot of dots) {
      const ring = Math.sin(dot.dist * 0.055 - phase);
      const swell = 1 + ring * 0.72 * agitation;
      const broken = (dot.jitter - 0.5) * 3.2 * agitation * agitation;
      const size = Math.max(0, Math.round((dot.base * swell + broken) * 2) / 2);
      const drift = Math.round(ring * agitation * 3.6 * 2) / 2;
      // A tick only pays for dots that actually moved.
      if (size === dot.size && drift === dot.drift) continue;
      dot.size = size;
      dot.drift = drift;
      attrs(dot.el, {
        x: dot.x - size / 2,
        y: dot.y - size / 2 + drift,
        width: size,
        height: size,
      });
    }

    // The silt stirs with the water, at a lower frequency and amplitude.
    for (const dot of silt) {
      const heave = Math.sin(dot.dist * 0.02 - phase * 0.35 + dot.jitter * 6.2);
      const size = Math.max(0, Math.round(dot.base * (1 + heave * 0.14 * agitation) * 2) / 2);
      if (size === dot.size) continue;
      dot.size = size;
      attrs(dot.el, { x: dot.x - size / 2, y: dot.y - size / 2, width: size, height: size });
    }

    svg.classList.toggle('pressing', state.pressing);
    // Two terms: a level from the charge, which only stillness reverses, and a
    // transient flinch. The flinch is taken from the headroom the level leaves,
    // so the two cannot sum past 1.
    const lack = clamp01((COMPOSED - state.charge) / COMPOSED);
    const flinch = agitation * (state.pressing ? 1 : 0.72) * KICK_SHARE;
    corners.style.opacity = String(clamp01(lack + flinch * (1 - lack)));

    // One filter and one opacity for the whole picture; lucidity adds the haze.
    const seen = clamp01(state.visibility);
    const eased = seen * seen * (3 - 2 * seen);
    svg.style.opacity = String(0.05 + eased * 0.95);
    const haze = HAZE[stepOf(state.lucidity)]!;
    svg.style.filter = `brightness(${(0.4 + eased * 0.6).toFixed(3)})${haze > 0 ? ` blur(${haze.toFixed(2)}px)` : ''}`;

    figure.classList.toggle('there', state.occupied);

    for (const id of PLACES) {
      const lit = state.signals.includes(id);
      shapes[id].classList.toggle('signalling', lit);
      // Presence is `resolve`'s business; this only gates asking.
      buttons[id].disabled = !state.asking;
      buttons[id].classList.toggle('signalling', lit);
    }
  }

  // ---- the clock ---------------------------------------------------------
  // Runs independently of the player, and stops only for a hidden tab.
  //
  // `prefers-reduced-motion` is deliberately not read: the motion here is
  // sub-pixel to a few pixels, with no travel, parallax or sudden onset.
  let timer: ReturnType<typeof setInterval> | undefined;
  let rate = TICK_MS;
  let frozen = false;

  /** Kick size and settle rate, both interpolated on how spent the charge is. */
  const spent = (): number => (last ? 1 - clamp01(last.charge) : 0);
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

  /** Nothing to draw between cycles, so the clock only exists during one. */
  const running = (): boolean => !frozen && !document.hidden && agitation > 0;

  function reclock(): void {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
    if (running()) timer = setInterval(beat, rate);
  }

  document.addEventListener('visibilitychange', reclock);

  // Nothing is out of the dark until something says so.
  for (const id of PLACES) resolve(id, false);

  layout();
  new ResizeObserver(layout).observe(host);
  reclock();

  return {
    resolve,
    update(state: ShaftState): void {
      // Keyed to the turn, so one push is one kick.
      const struck = state.pressing && state.turn !== pressedAt;
      if (struck) pressedAt = state.turn;
      last = state;
      if (struck) agitation = clamp01(kick());
      // A step of lucidity changes the grain, which means a full rebuild.
      if (stepOf(state.lucidity) !== grain) layout();
      else draw();
      if (struck) reclock();
    },
    bands: () => bands,
    flash(): void {
      corners.classList.remove('flash');
      void corners.offsetWidth; // restart it even if one is already running
      corners.classList.add('flash');
      setTimeout(() => corners.classList.remove('flash'), 1100);
    },
    rate(ms: number): void {
      rate = Math.max(16, ms);
      reclock();
    },
    freeze(): void {
      frozen = true;
      reclock();
    },
    resume(): void {
      frozen = false;
      reclock();
    },
    tick: beat,
  };
}
