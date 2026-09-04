import { describe, expect, it } from 'vitest';
import {
  camSpace,
  extent,
  eyeAt,
  lens,
  polyline,
  projector,
  REST_POSE,
  ring,
  WELL,
} from '../src/web/projection.js';
import type { Point, Project } from '../src/web/projection.js';

/** The three rings the layout hangs on, as the renderer takes them. */
const railsAt = (w: number, h: number) => {
  const project = projector(REST_POSE, WELL, { w, h });
  const at = (y: number) => {
    const e = extent(ring(y, WELL, 128), project);
    if (!e) throw new Error(`ring at ${y} is not carried`);
    return e;
  };
  return { rim: at(WELL.height), water: at(WELL.water), silt: at(0) };
};

describe('the rails the picture hangs on', () => {
  for (const [w, h] of [
    [800, 600],
    [390, 844],
  ] as const) {
    it(`stacks rim, water and silt down the frame at ${w}x${h}`, () => {
      const { rim, water, silt } = railsAt(w, h);
      // skyBottom < waterTop < siltTop, which is what `bands` is built from.
      expect(rim.bottom).toBeLessThan(water.top);
      expect(water.top).toBeLessThan(silt.top);
      // The rim is up and the floor is down, either side of the frame's middle.
      expect(rim.bottom).toBeLessThan(h / 2);
      expect(silt.top).toBeGreaterThan(h / 2);
    });
  }
});

describe('the opening', () => {
  for (const [w, h] of [
    [800, 600],
    [390, 844],
  ] as const) {
    it(`reads as a coin at ${w}x${h}`, () => {
      const project = projector(REST_POSE, WELL, { w, h });
      const box = extent(ring(WELL.height, WELL, 128), project);
      expect(box).not.toBeNull();
      const { left, right, top, bottom } = box!;
      // Centred, since the camera has no yaw.
      expect((left + right) / 2).toBeCloseTo(w / 2);
      // Round enough to be a hole rather than a slot: the shaft is
      // foreshortened but the lens is not.
      const rx = (right - left) / 2;
      const ry = (bottom - top) / 2;
      expect(rx / ry).toBeGreaterThan(1);
      expect(rx / ry).toBeLessThan(1.5);
      // It fits the width, and the pitch crops a little off the top.
      expect(left).toBeGreaterThan(0);
      expect(right).toBeLessThan(w);
      expect(top).toBeLessThan(0);
    });
  }
});

describe('camSpace', () => {
  it('drops a level forward point below the axis when the camera looks up', () => {
    const eye = eyeAt(REST_POSE, WELL);
    const ahead: Point = { x: eye.x, y: eye.y, z: eye.z + 1 };
    const v = camSpace(ahead, eye, REST_POSE.pitch);
    // Level with the eye, so pitching up puts it under the forward axis.
    expect(v.y).toBeLessThan(0);
    const s = lens(v, { w: 400, h: 800 }, REST_POSE.fov);
    expect(s).not.toBeNull();
    expect(s!.y).toBeGreaterThan(400);
  });

  it('leaves a point on the axis on the axis', () => {
    const v = camSpace({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 0 }, 0);
    expect(v).toEqual({ x: 0, y: 0, z: 1 });
  });
});

describe('lens', () => {
  const frame = { w: 400, h: 800 };

  it('carries what is in front and drops what is behind', () => {
    expect(lens({ x: 0, y: 0, z: 1 }, frame, REST_POSE.fov)).not.toBeNull();
    // Straight back is pi off the forward axis, past anything the lens holds.
    expect(lens({ x: 0, y: 0, z: -1 }, frame, REST_POSE.fov)).toBeNull();
  });

  it('puts the forward axis at the centre of the frame', () => {
    const s = lens({ x: 0, y: 0, z: 1 }, frame, REST_POSE.fov);
    expect(s).not.toBeNull();
    expect(s!.x).toBeCloseTo(frame.w / 2);
    expect(s!.y).toBeCloseTo(frame.h / 2);
  });

  it('is angle-linear: twice the angle is twice the radius', () => {
    const at = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      const s = lens({ x: Math.sin(a), y: 0, z: Math.cos(a) }, frame, REST_POSE.fov);
      return s!.x - frame.w / 2;
    };
    expect(at(60)).toBeCloseTo(at(30) * 2);
  });
});

describe('polyline', () => {
  const pts: Point[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ];
  const runs = (d: string) => d.match(/M/g)?.length ?? 0;

  it('is one run when every point lands', () => {
    const all: Project = (p) => ({ x: p.x, y: 0 });
    expect(runs(polyline(pts, all))).toBe(1);
  });

  it('breaks into two runs across a dropped point', () => {
    const holed: Project = (p) => (p.x === 1 ? null : { x: p.x, y: 0 });
    const d = polyline(pts, holed);
    expect(runs(d)).toBe(2);
    // The dropped point is not in the path at all.
    expect(d).toBe('M 0.0 0.0 M 2.0 0.0 L 3.0 0.0 ');
  });

  it('is empty when nothing lands', () => {
    expect(polyline(pts, () => null)).toBe('');
  });
});

describe('extent', () => {
  it('is null when the lens carries none of it', () => {
    expect(extent(ring(0, WELL, 8), () => null)).toBeNull();
  });

  it('ignores the points that are dropped', () => {
    const pts: Point[] = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ];
    const only = (p: Point) => (p.x === 0 ? { x: 3, y: 7 } : null);
    expect(extent(pts, only)).toEqual({ left: 3, right: 3, top: 7, bottom: 7 });
  });
});
