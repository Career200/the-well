/**
 * The shaft, drawn from the bottom, as one picture.
 *
 * Sky, walls and water share one SVG and one coordinate system, so every wall
 * line lands on both the rim of the sky and the edge of the water at the same
 * angle. A resize rebuilds it all together and the joins never drift.
 *
 * The viewBox tracks the host's pixel size, so nothing is stretched: the dots
 * stay square and the ovals keep their perspective.
 *
 * One control, one filter, on the root: how much of it you can see.
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

/** How far apart the halftone dots sit, in px. Bigger is cheaper and coarser. */
const DOT_SPACING = 9;
/** Joints across the far wall, and courses of stone between the two ends. */
const WALLS = 9;
const COURSES = 8;
/**
 * The widest the water may get, against the column of text. A water oval that
 * fills the viewport turns the shaft into a stocky cone, so the near edge is
 * only a little wider than the words.
 */
const COLUMN = 640; // 40rem, matching #app
const WATER_VS_COLUMN = 0.62;

/**
 * Below this width the controls would bury the water, which is not decoration
 * — it is how the player reads *not settled yet, do not push*. So the surface
 * comes up until `MIN_WATER_BAND` of it clears them.
 */
const NARROW = 640;
const MIN_WATER_BAND = 64;

export interface ShaftState {
  /** 0 — barely there. 1 — as much of it as there is ever going to be. */
  visibility: number;
  /** Somebody leaning over the rim. */
  occupied: boolean;
  /** Presence. Full is glass; empty is water that will not settle at all. */
  charge: number;
  /** Pushing, right now, this beat. */
  pressing: boolean;
  /** Advances the ripple, so consecutive beats never draw the same water. */
  turn: number;
}

/**
 * Where the picture leaves room for words, in viewport px. The log fits to
 * these, so text can never end up behind the sky or under the water.
 */
export interface Bands {
  /** Bottom edge of the coin of sky. */
  skyBottom: number;
  /** The waterline — the far edge of the water. */
  waterTop: number;
}

export interface Shaft {
  update(state: ShaftState): void;
  bands(): Bands;
  /**
   * The room answering something the player could not do. The corners already
   * read the charge, so a spike says *that* is what went wrong, without a
   * number appearing anywhere.
   */
  flash(): void;
}

interface Dot {
  el: SVGRectElement;
  x: number;
  y: number;
  /** Size at rest, in px. */
  base: number;
  /** Distance from the middle of the water, in px. */
  dist: number;
  jitter: number;
}

/**
 * `floor` reports the top of the controls. On narrow screens the water is
 * placed against it so it can never be buried. Safe from feedback: the
 * controls are a fixed-size flex child, independent of where the water lands.
 */
export function makeShaft(host: HTMLElement, onLayout?: (bands: Bands) => void, floor?: () => number): Shaft {
  const svg = svgEl('svg');
  svg.setAttribute('preserveAspectRatio', 'none'); // viewBox tracks pixel size
  svg.classList.add('scene');

  const defs = svgEl('defs');
  const glow = svgEl('radialGradient');
  glow.id = 'sky-glow';
  for (const [offset, color] of [
    ['0%', '#fffdf2'],
    ['58%', '#f7e6ad'],
    ['100%', '#c9a955'],
  ] as const) {
    const stop = svgEl('stop');
    attrs(stop, { offset, 'stop-color': color });
    glow.append(stop);
  }
  const clip = svgEl('clipPath');
  clip.id = 'sky-clip';
  const clipShape = svgEl('ellipse');
  clip.append(clipShape);
  defs.append(glow, clip);

  const wallsG = svgEl('g');
  wallsG.classList.add('walls');
  const waterG = svgEl('g');
  waterG.classList.add('water');

  const coin = svgEl('ellipse');
  coin.setAttribute('fill', 'url(#sky-glow)');
  const figure = svgEl('g');
  figure.setAttribute('clip-path', 'url(#sky-clip)');
  figure.classList.add('figure');
  const head = svgEl('ellipse');
  const shoulders = svgEl('ellipse');
  figure.append(shoulders, head);

  const skyG = svgEl('g');
  skyG.classList.add('sky');
  skyG.append(coin, figure);

  svg.append(defs, wallsG, waterG, skyG);

  // The corners answering the water. Its own channel: it lands on the first
  // press, before the shaft is visible enough to read.
  const corners = document.createElement('div');
  corners.className = 'agitation';

  host.replaceChildren(svg, corners);

  let dots: Dot[] = [];
  /** Kept so a resize can redraw the water as it stood, not as glass. */
  let last: ShaftState | undefined;
  let bands: Bands = { skyBottom: 0, waterTop: 0 };

  function layout(): void {
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const cx = w / 2;

    // Forty feet up and small with it, flattened because you are lying under
    // it. Sits in the band the log leaves clear at the top.
    const skyRx = Math.min(w * 0.09, 56);
    const skyRy = skyRx * 0.4;
    const skyCy = Math.min(h * 0.085, 74);

    // The nearest thing there is — wider than the words, not much wider. Its
    // middle sits just off the bottom edge, with the widest part still on
    // screen: that is where the walls meet it, and without it they read as
    // splaying past.
    const waterRx = Math.min(w * 0.62, COLUMN * WATER_VS_COLUMN);
    const waterRy = Math.min(h * 0.3, waterRx * 0.45);
    // On a phone the controls would bury it: bring the surface up until
    // `MIN_WATER_BAND` clears them. The walls follow, being drawn from these
    // same two ellipses.
    const covered = floor?.() ?? h;
    const waterCy =
      w < NARROW
        ? Math.min(h * 0.96, covered - MIN_WATER_BAND + waterRy)
        : h * 0.96;

    attrs(coin, { cx, cy: skyCy, rx: skyRx, ry: skyRy });
    attrs(clipShape, { cx, cy: skyCy, rx: skyRx, ry: skyRy });
    attrs(head, { cx, cy: skyCy + skyRy * 0.42, rx: skyRx * 0.2, ry: skyRy * 0.4 });
    attrs(shoulders, { cx, cy: skyCy + skyRy * 1.3, rx: skyRx * 0.55, ry: skyRy * 0.62 });

    // ---- the walls ------------------------------------------------------
    // Nothing is drawn below the waterline. Joints and courses cover the far
    // half only, from the rim of the sky to the far edge of the water.
    wallsG.replaceChildren();

    for (let i = 0; i < WALLS; i++) {
      const angle = Math.PI + (i / (WALLS - 1)) * Math.PI; // π..2π: the far half
      const line = svgEl('line');
      attrs(line, {
        x1: cx + skyRx * Math.cos(angle),
        y1: skyCy + skyRy * Math.sin(angle),
        x2: cx + waterRx * Math.cos(angle),
        y2: waterCy + waterRy * Math.sin(angle),
      });
      wallsG.append(line);
    }

    // Courses of stone, crowding as they go up. The last one is the waterline.
    for (let k = 1; k <= COURSES; k++) {
      const t = Math.pow(k / COURSES, 1.7);
      const cy = lerp(skyCy, waterCy, t);
      const rx = lerp(skyRx, waterRx, t);
      const ry = lerp(skyRy, waterRy, t);
      const course = svgEl('path');
      attrs(course, { d: `M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`, fill: 'none' });
      wallsG.append(course);
    }

    // ---- the water: halftone, in the same units so the dots stay square ---
    waterG.replaceChildren();
    dots = [];
    for (let x = DOT_SPACING / 2; x < w; x += DOT_SPACING) {
      for (let y = DOT_SPACING / 2; y < h; y += DOT_SPACING) {
        const nx = (x - cx) / waterRx;
        const ny = (y - waterCy) / waterRy;
        const d = Math.hypot(nx, ny);
        if (d > 1) continue;

        // Brighter toward the near edge, but the far edge keeps its weight:
        // the bottom of a well, not a fade.
        const depth = clamp01(0.72 + ny * 0.5);
        const value = clamp01(depth * (1 - d * d * 0.32) + (hash(x, y) - 0.5) * 0.26);
        const base = Math.round(value * (DOT_SPACING - 2) * 2) / 2;
        if (base <= 0.5) continue;

        const el = svgEl('rect');
        attrs(el, { x: x - base / 2, y: y - base / 2, width: base, height: base, fill: 'currentColor' });
        waterG.append(el);
        dots.push({ el, x, y, base, dist: Math.hypot(x - cx, (y - waterCy) * 2.2), jitter: hash(y, x) });
      }
    }

    if (last) drawWater(last.charge, last.pressing, last.turn);

    bands = { skyBottom: skyCy + skyRy, waterTop: waterCy - waterRy };
    onLayout?.(bands);
  }

  /**
   * The water, per beat, and the only reading of the charge the player gets:
   * a full bar is glass, and the surface refuses to settle until the presence
   * has gathered itself back.
   */
  function drawWater(charge: number, pressing: boolean, turn: number): void {
    const agitation = clamp01((1 - clamp01(charge)) * (pressing ? 1.3 : 1));
    const phase = turn * 0.8;

    for (const dot of dots) {
      const ring = Math.sin(dot.dist * 0.075 - phase);
      const swell = 1 + ring * 0.5 * agitation;
      const broken = (dot.jitter - 0.5) * 2.6 * agitation * agitation;
      const size = Math.max(0, Math.round((dot.base * swell + broken) * 2) / 2);
      const drift = ring * agitation * 2.4;

      attrs(dot.el, {
        x: dot.x - size / 2,
        y: dot.y - size / 2 + drift,
        width: size,
        height: size,
      });
    }

    svg.classList.toggle('pressing', pressing);
    // The corners answer first and loudest: something is wrong with the room,
    // never a reading of how much is left.
    corners.style.opacity = String(agitation * (pressing ? 1 : 0.72));
  }

  layout();
  new ResizeObserver(layout).observe(host);

  return {
    update(state: ShaftState): void {
      const { visibility, occupied, charge, pressing, turn } = state;
      last = state;
      // One filter, one opacity, on everything at once: the sky is no more
      // available to the presence than the water is.
      const seen = clamp01(visibility);
      const eased = seen * seen * (3 - 2 * seen);
      svg.style.opacity = String(0.05 + eased * 0.9);
      svg.style.filter = `brightness(${(0.4 + eased * 0.6).toFixed(3)})`;

      figure.classList.toggle('there', occupied);
      drawWater(charge, pressing, turn);
    },
    bands: () => bands,
    flash(): void {
      corners.classList.remove('flash');
      void corners.offsetWidth; // restart it even if one is already running
      corners.classList.add('flash');
      setTimeout(() => corners.classList.remove('flash'), 1100);
    },
  };
}
