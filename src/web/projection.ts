/**
 * The well as geometry, and the lens that puts it on screen.
 *
 * World axes: the silt is `y = 0`, the rim is `y = height`, and the camera has
 * its back to the -z wall looking toward +z. Nothing here touches the DOM.
 *
 * The lens is equidistant fisheye — `r = f · θ`, θ measured off the forward
 * axis — so every straight edge in the world bows on screen and has to be
 * carried as a subdivided polyline.
 */

export interface Point {
  x: number;
  y: number;
  z: number;
}

/** A projected point in px, or null where the lens does not carry it. */
export type ScreenPoint = { x: number; y: number } | null;

export interface Frame {
  w: number;
  h: number;
}

/** Well units throughout. */
export interface Well {
  radius: number;
  height: number;
  /** The surface, above the silt. The dimension a rising level moves. */
  water: number;
}

export interface Camera {
  /** Eye above the silt. */
  eye: number;
  /** Off the axis toward -z, as a share of the clear radius. */
  wall: number;
  /** Up off the horizontal, radians. */
  pitch: number;
  /** Vertical field of view, radians. */
  fov: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

const HEIGHT = 9.5;

/**
 * The well the picture is of. Frozen at the type level: a moving water level
 * is a new `Well` passed to `projector`, never a write to this one.
 */
export const WELL: Readonly<Well> = {
  radius: 1.8,
  height: HEIGHT,
  water: HEIGHT * 0.11
};

/** Where the camera rests. Pitch and fov are what a pose moves. */
export const REST_POSE: Camera = {
  eye: 1.5,
  wall: 0.75,
  pitch: rad(27),
  fov: rad(132)
};

/**
 * How close the eye may come to the stone, in well units. `wall` is a share of
 * the radius less this, so the gap is exactly this at `wall = 1` and wider
 * below it.
 */
const CLEARANCE = 0.25;

/** The widest angle off the forward axis the lens carries, radians. */
const LIMIT = 2.9;

export const eyeAt = (cam: Camera, well: Well): Point => ({
  x: 0,
  y: cam.eye,
  z: -(well.radius - CLEARANCE) * cam.wall
});

/** World point into camera space: forward +z, up +y, pitched about x. */
export function camSpace(p: Point, eye: Point, pitch: number): Point {
  const dx = p.x - eye.x;
  const dy = p.y - eye.y;
  const dz = p.z - eye.z;
  const c = Math.cos(pitch);
  const s = Math.sin(pitch);
  return { x: dx, y: dy * c - dz * s, z: dy * s + dz * c };
}

/** Camera space to pixels. */
export function lens(v: Point, frame: Frame, fov: number): ScreenPoint {
  const a = Math.atan2(Math.hypot(v.x, v.y), v.z);
  if (a > LIMIT) return null;
  const phi = Math.atan2(v.y, v.x);
  const f = frame.h / 2 / (fov / 2);
  return {
    x: frame.w / 2 + f * a * Math.cos(phi),
    y: frame.h / 2 - f * a * Math.sin(phi)
  };
}

export type Project = (p: Point) => ScreenPoint;

/** The two halves bound to one camera, one well and one frame. */
export function projector(cam: Camera, well: Well, frame: Frame): Project {
  const eye = eyeAt(cam, well);
  return (p) => lens(camSpace(p, eye, cam.pitch), frame, cam.fov);
}

/** A horizontal ring of the shaft, at height `y`. Closed. */
export function ring(y: number, well: Well, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: Math.cos(t) * well.radius, y, z: Math.sin(t) * well.radius });
  }
  return pts;
}

/** A vertical joint at bearing `t`, from `y0` up to `y1`. */
export function joint(
  t: number,
  y0: number,
  y1: number,
  well: Well,
  steps: number
): Point[] {
  const x = Math.cos(t) * well.radius;
  const z = Math.sin(t) * well.radius;
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++)
    pts.push({ x, y: y0 + (i / steps) * (y1 - y0), z });
  return pts;
}

/**
 * One polyline as a path `d`, broken into runs wherever the lens drops a
 * point. Empty when nothing survives.
 */
export function polyline(pts: readonly Point[], project: Project): string {
  let d = "";
  let open = false;
  for (const p of pts) {
    const s = project(p);
    if (!s) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"} ${s.x.toFixed(1)} ${s.y.toFixed(1)} `;
    open = true;
  }
  return d;
}

/** Screen box of a projected polyline, in px. */
export interface Extent {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Screen extent of a projected polyline, or null if none of it lands. */
export function extent(pts: readonly Point[], project: Project): Extent | null {
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of pts) {
    const s = project(p);
    if (!s) continue;
    if (s.x < left) left = s.x;
    if (s.x > right) right = s.x;
    if (s.y < top) top = s.y;
    if (s.y > bottom) bottom = s.y;
  }
  return top === Infinity ? null : { left, right, top, bottom };
}
