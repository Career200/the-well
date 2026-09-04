/**
 * The shaft, drawn from the bottom of it, from under the water.
 *
 * The well is half full and the presence is lying in the silt at the bottom of
 * it, looking up. Three ellipses down one cone: the rim at the top with the
 * coin of sky in it, the waterline across the middle seen from underneath, and
 * the floor of silt near enough to touch. The walls run the whole way, dry
 * stone above the waterline and drowned below it.
 *
 * That split is what makes the picture readable. Above the water there is
 * stone for the words to sit on and a shaft for the coin to be at the end of;
 * below it there is the halftone, bright at the surface and dying downward,
 * with the words nowhere near it.
 *
 * All of it shares one coordinate system, so a wall line lands on the rim, the
 * waterline and the floor at the same angle. A resize rebuilds it together and
 * the joins never drift. The viewBox tracks the host's pixel size, so the dots
 * stay square and the ovals keep their perspective.
 *
 * Two controls on the root: how much of it you can see (`visibility`), and how
 * clearly (`lucidity`). The first is a fade; the second rebuilds the whole
 * picture at a finer grain. Neither reveals anything — the four places come
 * out of the dark one at a time, through `resolve`, on the beat the client
 * reads the line about each.
 *
 * The picture has its own clock. `update` stores state; the clock settles the
 * water and calls `draw`. `draw` is the only function here that writes to the
 * DOM, so a beat and a tick can never fight over it.
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

/**
 * The four places the presence can turn to. The cold has no region and no
 * geometry — it is not somewhere you look, and it is not here yet.
 */
export const PLACES = ['sky', 'walls', 'water', 'silt'] as const;
export type PlaceId = (typeof PLACES)[number];

/**
 * Lucidity in steps, matching `lucidityPerDiscovery`. Everything the room is
 * drawn from reads this, so a discovery is one visible event rather than a
 * continuous creep nobody can see happening.
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
 * How flat a cross-section of the shaft is: `ry / rx`, the same at every depth.
 * It has to be the same, or the wall joints do not meet at one point and the
 * whole thing reads as broken perspective however steep the walls are.
 *
 * What it says physically is how far the camera is tilted. Small is a shallow,
 * diagonal look up the shaft, which is the view this picture is drawn from.
 */
const SECTION_ASPECT = 0.28;

/**
 * How far the outermost joint leans off vertical, in degrees. Solved per
 * layout inside this range rather than fixed, because whether the shaft
 * reaches the sides of the screen is a question about the *viewport*, not
 * about the well: on a phone the bottom of this range already overflows, and
 * on a wide desktop nothing under about forty degrees does.
 *
 * The camera opens only as far as it must. Below the floor of the range the
 * walls stop reading as walls; above the ceiling they read as a funnel.
 */
const SHAFT_ANGLE: readonly [number, number] = [22, 40];

/** The rim is forty feet up: the small end, and the size of the opening. */
const RIM_MAX = 150;
/**
 * How far across the opening the light reaches before it is gone. The sky is
 * the size of a coin because of this profile, not because the hole is small.
 * The figure is masked with the same numbers, so its silhouette ends where the
 * light it is blocking ends.
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
 * The waterline is placed, not fixed: as far down the cone as it can go while
 * still leaving this much water showing above the floor. Everything above it
 * is stone the words can sit on, everything below it is halftone, so every
 * pixel it moves down is a pixel of reading room — but a water band thinner
 * than this stops being a place you can see or touch.
 *
 * Proportional on top of that, because on a short screen a fixed band costs
 * more than it is worth.
 */
const WATER_BAND = 130;
const WATER_BAND_VS_HEIGHT = 0.17;


/**
 * The floor is the near thing and it may run off both sides, but the controls
 * would bury it on a phone — and the silt is a place you have to be able to
 * touch. So it comes up until `MIN_SILT_BAND` of it clears them.
 */
const NARROW = 640;
const MIN_SILT_BAND = 56;

/**
 * ~5fps. The stepped look is the intent, not a budget compromise: it suits the
 * halftone, and water that moves smoothly reads as fluid rather than as heavy
 * and cold. Fewer, larger frames.
 */
export const TICK_MS = 190;
/**
 * Ripple travel per tick. Scaled with the slower clock so a pass still crosses
 * the water in about three and a half seconds — the wave keeps its speed, and
 * each frame simply moves it further.
 */
const PHASE_PER_TICK = 0.33;
/**
 * A push starts a cycle and the water runs it on its own: struck, moving,
 * settled, back to glass. Nothing about it waits for the player, and it always
 * ends in the same place — the water is a record of what just happened, not a
 * gauge you can read at rest.
 *
 * Charge shapes the cycle rather than its resting point. A composed presence
 * strikes the water lightly and it is over in about a second; a spent one
 * throws it hard and the surface will not stop moving for nearly three.
 */
const KICK_CALM = 0.45;
const KICK_SPENT = 1;
/** Fraction of what is left that a tick takes away. Lower runs longer. */
const SETTLE_CALM = 0.4;
const SETTLE_SPENT = 0.2;
/**
 * Below this the water is glass and the clock has nothing to do. An exponential
 * never actually reaches zero, so without a floor the cycle never ends and the
 * interval never stops.
 */
const REST = 0.015;

/**
 * Charge at which the room is still open. The corners are the one thing here
 * that *is* a reading of how much is left: above this a composed presence sees
 * clear to the walls, and below it the room closes in, full at nothing left.
 * A level, not a cycle — it only moves when the charge does, and it stays.
 */
const COMPOSED = 0.7;
/**
 * How much of the room still left open a single push may close for a moment.
 * The press already shows up in the level, permanently, as the charge it cost;
 * this is only the flinch on top, and it is the part that fades.
 */
const KICK_SHARE = 0.35;

/** Samples across the waterline. Enough that the chop reads as water. */
const SURFACE_SAMPLES = 56;


export interface ShaftState {
  /**
   * The whole picture at once: 0 is gone, 1 is all of it. Not the reveal —
   * places arrive one at a time through `resolve`, and a ramp across
   * everything only drowned that out. The run holds this at 1 and the ending
   * takes it back down.
   */
  visibility: number;
  /** How clearly. Drives the grain of the whole picture, in steps. */
  lucidity: number;
  /** Somebody leaning over the rim. */
  occupied: boolean;
  /** Presence. Full is glass; empty is water that will not settle at all. */
  charge: number;
  /** This beat was a push. An event, not a condition. */
  pressing: boolean;
  /** Beats. The ripple runs off the clock; this only marks a new push. */
  turn: number;
  /** Places with something to say. They move until they are asked. */
  signals: readonly PlaceId[];
  /**
   * Whether a place can be asked at all right now. Beat zero is the room
   * assembling itself and a scene belongs to whoever is at the rim; in both,
   * the places are picture and nothing else.
   */
  asking: boolean;
}

/**
 * Where the picture leaves room for words, in viewport px. The log fits to
 * these, so text can never end up over the rim or down in the water.
 */
export interface Bands {
  /** Bottom edge of the rim, coin and all. */
  skyBottom: number;
  /** The waterline. The last line the words may cross. */
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
   * The top of the controls. On narrow screens the floor is placed against it
   * so it can never be buried. Safe from feedback: the controls are a
   * fixed-size flex child, independent of where the silt lands.
   */
  floor?: () => number;
  /** A place was asked. The client decides whether that is allowed right now. */
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
  // The opening, and the coin, are the same ellipse. The walls converge to the
  // hole they actually converge to, and the falloff is what keeps the sky the
  // size of a coin: the eye measures the lit core, not the geometry. Two
  // separate ellipses — an opening three times the sky coming through it — is
  // a thing no well does, and it is what read as a cutout laid on the picture.
  const skyGlow = gradient('sky-glow', 'radialGradient', [
    [LIT_FALLOFF[0]![0], '#fffdf2', LIT_FALLOFF[0]![1]],
    [LIT_FALLOFF[1]![0], '#f7e6ad', LIT_FALLOFF[1]![1]],
    [LIT_FALLOFF[2]![0], '#e0c983', LIT_FALLOFF[2]![1]],
    [LIT_FALLOFF[3]![0], '#c0a765', LIT_FALLOFF[3]![1]],
    [LIT_FALLOFF[4]![0], '#9c8347', LIT_FALLOFF[4]![1]],
  ]);
  // The same profile in white, as a mask. A silhouette can only exist where
  // there is light behind it to block, so the figure fades out exactly where
  // the coin does — which is also what stops it becoming a shape in its own
  // right once the opening got bigger than the light in it.
  const litFalloff = gradient(
    'lit-falloff',
    'radialGradient',
    LIT_FALLOFF.map(([offset, alpha]) => [offset, '#ffffff', alpha] as const),
  );
  // Light pooling around the hole it comes through. Forty feet of shaft is not
  // a clean edge even before there is water in the way.
  const underGlow = gradient('under-glow', 'radialGradient', [
    ['0%', '#f7e6ad', 0.3],
    ['55%', '#cdd6db', 0.1],
    ['100%', '#9aa5ac', 0],
  ]);
  // The light that wanders the stonework when the walls have something.
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
  // grains interpenetrate instead of the silt ending on a drawn edge — that
  // hard rim is what made it read as a shape laid over the picture.
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
  // The opening is a hole in stone, so the light ends where the stone begins.
  // Everything seen through it is clipped to it: no bloom creeping onto the
  // wall, no falloff drifting to nothing somewhere short of the edge.
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

  // The corners answering the water. Its own channel: it lands on the first
  // press, before the shaft is visible enough to read.
  const corners = document.createElement('div');
  corners.className = 'agitation';

  // The places, as tap targets. Transparent, full width, stacked over the
  // picture — the shape signals, and the band around it is what you touch.
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
   * Which places are out of the dark. Owned here rather than passed in every
   * beat: a place resolves once, on the client's word, and a snapshot that
   * disagreed for one frame would take the room back down again.
   */
  const here = new Set<PlaceId>();

  function resolve(id: PlaceId, on = true): void {
    if (on) here.add(id);
    else here.delete(id);
    shapes[id].classList.toggle('resolved', on);
    // A place that has not resolved is not there: no target, and no name in
    // the accessibility tree either.
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
  /**
   * How unsettled the water actually is — not what the charge says it should
   * be. It eases toward that on the clock, so a press throws it and the next
   * second of stillness is spent visibly coming back down.
   */
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

    // ---- the opening, forty feet up and nearly edge on --------------------
    // One ellipse: the hole, the sky through it, and what the walls converge
    // to. What makes it read as a coin is `sky-glow` dying long before the
    // edge, not a second, smaller shape.
    const rimRx = Math.min(w * 0.22, RIM_MAX);
    const rimRy = rimRx * SECTION_ASPECT;
    const rimCy = Math.min(h * 0.1, 84);
    /** How much of the opening the light actually fills. Sizes the figure. */
    const lit = rimRx * LIT_CORE;

    // ---- the shaft, as one perspective cone -------------------------------
    // Every vertical line on a cylinder meets at one point under a pinhole
    // projection, so every wall joint here has to as well. That holds exactly
    // when the cross-sections are homothetic about that point: the same
    // `SECTION_ASPECT` at every depth, and a centre whose distance below the
    // vanishing point is proportional to its width.
    //
    // Getting this wrong is what read as broken perspective, and it had
    // nothing to do with how steep the walls were: with the floor at a
    // different aspect from the rim, the joints extended upward crossed the
    // axis anywhere across a hundred pixels instead of meeting.
    //
    // Everything below is derived from one dial — the angle of the outermost
    // joint — and three targets the layout will not give up: where the rim
    // sits, where the waterline sits, where the floor's near edge sits.
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

    // The camera opens only as far as it has to. A shaft narrower than the
    // viewport leaves the water stopping short of the edges, which turns it
    // into a pond in the middle of the screen instead of the thing you are
    // lying in; wider than that is a funnel for no gain. On a phone the floor
    // of the range already overflows, so it stays as tight as it is allowed.
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

    /**
     * Half-width of the shaft at a screen row. The outermost joint runs from
     * the vanishing point at exactly this slope, so this is the wall itself —
     * straight, because a straight wall projects to a straight line.
     */
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
    // Sized to the light rather than to the hole: a silhouette only reads
    // where there is something behind it to block.
    const litRy = lit * 0.38;
    attrs(head, { cx, cy: rimCy + litRy * 0.42, rx: lit * 0.2, ry: litRy * 0.4 });
    attrs(shoulders, { cx, cy: rimCy + litRy * 1.3, rx: lit * 0.55, ry: litRy * 0.62 });
    // Perspective, not brightness: when the sky has something, it comes down
    // the shaft and goes back up. Scaled about its own centre, so it stays in
    // the hole it came through.
    skyG.style.setProperty('--sky-origin', `${cx}px ${rimCy}px`);

    // ---- the walls, cut at the waterline ---------------------------------
    // One set of stones, drawn in two groups: dry above, drowned below. The
    // dry half is the only large surface the words have to sit on, so it is
    // the half that carries the lucidity detail.
    dry.replaceChildren();
    drowned.replaceChildren();

    // Straight, and cut at the waterline. All three points of a joint — rim,
    // waterline, floor — lie on one ray from the vanishing point, which is the
    // whole reason the cross-sections are built the way they are.
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

    // The wandering light, sized to the dry stone and parked in the middle of
    // it. It travels in CSS, in its own units, so no JS runs for it per tick.
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

        // Light enters at the surface and does not reach the bottom. That is
        // the whole reason the silt is allowed to be as dark as it is.
        const down = clamp01((y - waterTop) / depth);
        const fall = 0.95 - down * 0.8;
        const middle = 1 - nx * nx * 0.35;
        const value = clamp01(fall * middle + (hash(x, y) - 0.5) * 0.3);
        const base = Math.round(value * (spacing - 2) * 2) / 2;
        if (base <= 0.5) continue;

        const el = svgEl('rect');
        attrs(el, { x: x - base / 2, y: y - base / 2, width: base, height: base, fill: 'currentColor' });
        grainG.append(el);
        // Rings come off the waterline, which is where anything that disturbs
        // this water comes from.
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
      // Start above the floor, not on it: the coarse stuff thins upward into
      // the water so the two grains meet in a band rather than at a line.
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

  /**
   * The waterline, broken by however unsettled the water is. Glass is a clean
   * ellipse; spent is a line that will not hold still. It sits directly under
   * the last line of text, which makes it the most readable thing the charge
   * has — more so than the swell of the dots.
   */
  function breakSurface(): void {
    // A calm surface is the same path every tick. Only re-walk it when the
    // number that shapes it has actually moved.
    const shaped = Math.round(agitation * 40) / 40;
    if (shaped === brokenBy && shaped === 0) return;
    brokenBy = shaped;

    const { cx, cy, rx, ry } = surface;
    const chop = agitation * 7;
    let d = '';
    for (let i = 0; i < SURFACE_SAMPLES; i++) {
      const angle = Math.PI + (i / (SURFACE_SAMPLES - 1)) * Math.PI;
      const x = cx + rx * Math.cos(angle);
      // Two harmonics travelling at different rates, so it never reads as one
      // wave sliding past. Flattened at the ends, where the surface meets the
      // stone and cannot move.
      const held = Math.abs(Math.sin(angle));
      const wave =
        Math.sin(angle * 7 - phase * 1.6) * 0.7 + Math.sin(angle * 13 + phase * 0.9) * 0.3;
      const y = cy + ry * Math.sin(angle) + wave * chop * held;
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    waterline.setAttribute('d', d);
  }

  /**
   * The only function here that writes to the DOM. Both clocks — the game's
   * beats and the shaft's own — arrive as state and leave through this one.
   */
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
      // At low agitation most of the field is standing still. Those dots cost
      // nothing: a tick only pays for what actually moved.
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

    // The mud only stirs when the water is troubled, and slower than it is.
    for (const dot of silt) {
      const heave = Math.sin(dot.dist * 0.02 - phase * 0.35 + dot.jitter * 6.2);
      const size = Math.max(0, Math.round(dot.base * (1 + heave * 0.14 * agitation) * 2) / 2);
      if (size === dot.size) continue;
      dot.size = size;
      attrs(dot.el, { x: dot.x - size / 2, y: dot.y - size / 2, width: size, height: size });
    }

    svg.classList.toggle('pressing', state.pressing);
    // The corners are the charge, held rather than played: they close in as the
    // presence thins and stay closed until stillness buys the room back. A push
    // lands here twice — once as the charge it costs, which does not come back
    // on its own, and once as a flinch above that, which does. The flinch is
    // taken out of the headroom that is left, so a room already closed to the
    // walls has nothing further to give and the two never fight over the top.
    const lack = clamp01((COMPOSED - state.charge) / COMPOSED);
    const flinch = agitation * (state.pressing ? 1 : 0.72) * KICK_SHARE;
    corners.style.opacity = String(clamp01(lack + flinch * (1 - lack)));

    // One filter, one opacity, on everything at once: the sky is no more
    // available to the presence than the silt is. Lucidity adds the haze —
    // early on the room is inferred from shapes rather than seen.
    const seen = clamp01(state.visibility);
    const eased = seen * seen * (3 - 2 * seen);
    svg.style.opacity = String(0.05 + eased * 0.95);
    const haze = HAZE[stepOf(state.lucidity)]!;
    svg.style.filter = `brightness(${(0.4 + eased * 0.6).toFixed(3)})${haze > 0 ? ` blur(${haze.toFixed(2)}px)` : ''}`;

    figure.classList.toggle('there', state.occupied);

    for (const id of PLACES) {
      const lit = state.signals.includes(id);
      shapes[id].classList.toggle('signalling', lit);
      // Whether it is there at all is `resolve`'s business. One that is there
      // but cannot be asked is disabled rather than removed — it did not go
      // away.
      buttons[id].disabled = !state.asking;
      buttons[id].classList.toggle('signalling', lit);
    }
  }

  // ---- the clock ---------------------------------------------------------
  // The picture moves whether or not the player does. It stops for a hidden
  // tab, and for nothing else.
  //
  // `prefers-reduced-motion` is deliberately not read here. Nothing in this
  // picture is what that setting protects against: the dots swell by about a
  // pixel, the waterline wobbles by a few, and the signals loop over seven to
  // twenty-six seconds. There is no travel across the screen, no parallax and
  // no sudden onset. Turning it off left the shaft a still image, which is a
  // worse outcome for everyone than the motion it was avoiding.
  let timer: ReturnType<typeof setInterval> | undefined;
  let rate = TICK_MS;
  let frozen = false;

  /** How hard this push lands, and how long it takes to be over. */
  const spent = (): number => (last ? 1 - clamp01(last.charge) : 0);
  const kick = (): number => lerp(KICK_CALM, KICK_SPENT, spent());
  const settle = (): number => lerp(SETTLE_CALM, SETTLE_SPENT, spent());

  function beat(): void {
    phase += PHASE_PER_TICK;
    agitation -= agitation * settle();
    if (agitation < REST) agitation = 0;
    draw();
    // The cycle is over and there is nothing left to move. Stopping is the
    // point: at rest the shaft costs nothing, and still means still.
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
      // A press is an acute event, not a level: it throws the water on the
      // beat that caused it and settles back on the clock from there. Keyed
      // to the turn, so one push is one kick.
      const struck = state.pressing && state.turn !== pressedAt;
      if (struck) pressedAt = state.turn;
      last = state;
      if (struck) agitation = clamp01(kick());
      // A step of lucidity is a different picture, not a different shade of
      // this one: rebuild it. It happens a handful of times in a run.
      if (stepOf(state.lucidity) !== grain) layout();
      else draw();
      // A push is what starts the clock. It stops itself once the water is
      // glass again.
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
