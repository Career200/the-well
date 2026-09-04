import { describe, expect, it } from 'vitest';
import { between, cameraFor, DIALS, ease, poseOf, same } from '../src/web/camera.js';
import { REST_POSE } from '../src/web/projection.js';
import type { ShaftState } from '../src/web/shaft.js';

const STATE: ShaftState = {
  visibility: 1,
  lucidity: 0.4,
  occupied: false,
  occlusion: 0,
  leaving: false,
  charge: 0.5,
  pressing: false,
  turn: 0,
  signals: [],
  asking: true,
  recoil: 0,
  resonating: null,
  reach: 0,
};

describe('which pose the state asks for', () => {
  it('rests until somebody is at the rim', () => {
    expect(poseOf(STATE)).toBe('rest');
    expect(poseOf({ ...STATE, occupied: true })).toBe('attend');
  });

  it('lets go of them on the way out, holding no pose for the exit', () => {
    expect(poseOf({ ...STATE, occupied: false, leaving: true })).toBe('rest');
  });

  it('is not moved by the levers inside a scene', () => {
    const busy = { ...STATE, occupied: true, recoil: 2 as const, resonating: 'ring', reach: 1 };
    expect(poseOf(busy)).toBe('attend');
  });
});

describe('where a pose stands', () => {
  it('rests where the rest pose does', () => {
    expect(cameraFor('rest', DIALS)).toEqual(REST_POSE);
  });

  it('comes up by the attend dial and moves nothing else', () => {
    const at = cameraFor('attend', DIALS);
    expect(at.pitch).toBeCloseTo(DIALS.rest.pitch + DIALS.attend);
    expect(at.fov).toBe(DIALS.rest.fov);
    expect(at.eye).toBe(DIALS.rest.eye);
    expect(at.wall).toBe(DIALS.rest.wall);
  });

  it('hands back a copy, so the dials survive the pose', () => {
    const at = cameraFor('rest', DIALS);
    at.pitch = 99;
    expect(DIALS.rest.pitch).not.toBe(99);
  });
});

describe('the ease', () => {
  it('starts and ends at rest', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // Symmetric about the middle, and moving fastest there.
    expect(ease(0.5)).toBeCloseTo(0.5);
    expect(ease(0.25) + ease(0.75)).toBeCloseTo(1);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });

  it('holds outside its own range', () => {
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
});

describe('between', () => {
  const rest = cameraFor('rest', DIALS);
  const attend = cameraFor('attend', DIALS);

  it('is the ends at the ends', () => {
    expect(between(rest, attend, 0)).toEqual(rest);
    expect(between(rest, attend, 1)).toEqual(attend);
  });

  it('carries every dial, not only the one this pose moves', () => {
    const half = between(rest, { ...attend, fov: attend.fov / 2 }, 0.5);
    expect(half.pitch).toBeCloseTo((rest.pitch + attend.pitch) / 2);
    expect(half.fov).toBeCloseTo(rest.fov * 0.75);
  });
});

describe('same', () => {
  it('is true for a copy and false for a moved dial', () => {
    const rest = cameraFor('rest', DIALS);
    expect(same(rest, { ...rest })).toBe(true);
    expect(same(rest, { ...rest, pitch: rest.pitch + 1e-9 })).toBe(false);
  });
});
