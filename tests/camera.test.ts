import { describe, expect, it } from 'vitest';
import { cameraFor, DIALS, poseOf } from '../src/web/camera.js';
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
