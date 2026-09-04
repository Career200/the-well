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

const AT_RIM = { ...STATE, occupied: true };

describe('what the state asks for', () => {
  it('asks for nothing until somebody is at the rim', () => {
    expect(poseOf(STATE, 0)).toEqual({ attend: false, beats: 0 });
    expect(poseOf(AT_RIM, 0)).toEqual({ attend: true, beats: 0 });
  });

  it('counts the beats of the scene they are at the rim for', () => {
    expect(poseOf(AT_RIM, 2).beats).toBe(2);
  });

  it('has nothing to close on outside a scene, whatever the count says', () => {
    expect(poseOf(STATE, 5)).toEqual({ attend: false, beats: 0 });
  });

  it('lets go of them on the way out, holding no pose for the exit', () => {
    expect(poseOf({ ...STATE, leaving: true }, 3)).toEqual({ attend: false, beats: 0 });
  });

  it('is not moved by the levers inside a scene', () => {
    const busy = { ...AT_RIM, recoil: 2 as const, resonating: 'ring', reach: 1 };
    expect(poseOf(busy, 1)).toEqual({ attend: true, beats: 1 });
  });
});

describe('where a pose stands', () => {
  const at = (attend: boolean, beats: number) => cameraFor({ attend, beats }, DIALS);

  it('rests where the rest pose does', () => {
    expect(at(false, 0)).toEqual(REST_POSE);
  });

  it('comes up by the attend dial, and only in pitch', () => {
    const up = at(true, 0);
    expect(up.pitch).toBeCloseTo(DIALS.rest.pitch + DIALS.attend);
    expect(up.fov).toBe(DIALS.rest.fov);
    expect(up.eye).toBe(DIALS.rest.eye);
    expect(up.wall).toBe(DIALS.rest.wall);
  });

  it('takes a step off the field on every beat past the first', () => {
    // The beat somebody arrives on is the scene's first and takes the tilt only.
    expect(at(true, 0).fov).toBe(DIALS.rest.fov);
    expect(at(true, 1).fov).toBeCloseTo(DIALS.rest.fov - DIALS.close);
    expect(at(true, 2).fov).toBeCloseTo(DIALS.rest.fov - DIALS.close * 2);
    // The tilt is the same throughout: the two poses add rather than replace.
    expect(at(true, 2).pitch).toBeCloseTo(at(true, 0).pitch);
  });

  it('closes no further than the cap, however long the scene runs', () => {
    const steps = Math.ceil(DIALS.closeMax / DIALS.close);
    expect(at(true, steps).fov).toBeCloseTo(DIALS.rest.fov - DIALS.closeMax);
    expect(at(true, steps + 6).fov).toBeCloseTo(DIALS.rest.fov - DIALS.closeMax);
  });

  it('hands back a copy, so the dials survive the pose', () => {
    const stood = at(false, 0);
    stood.pitch = 99;
    expect(DIALS.rest.pitch).not.toBe(99);
  });
});
