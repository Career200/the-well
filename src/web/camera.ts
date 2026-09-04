/**
 * The camera as state: which pose the picture stands in, and the move between
 * poses.
 *
 * Poses are authored. Nothing here reads player input, and nothing here writes
 * game state. A move is beat-driven — `aim` is called when a beat changes what
 * the state asks for, and the ease runs on its own clock until it arrives.
 * `jump` stands at a pose with no move, which is what an authoring dial does.
 *
 * Poses add rather than take turns: `attend` comes up while somebody is at the
 * rim and `close` narrows over the beats of the scene they are at the rim for,
 * so `Pose` is what the state asks for and `cameraFor` is where the
 * contributions meet.
 */

import { REST_POSE } from './projection.js';
import type { Camera } from './projection.js';
import type { ShaftState } from './shaft.js';
import { lerp } from './svg.js';

const rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Camera clock period, ms. Faster than the water's 190: the halftone reads as
 * stepped standing still, and as a stutter while the whole field travels.
 */
const TICK_MS = 70;

/** How long a move takes, ms. One narration line's worth of time. */
const MOVE_MS = 780;

/** The dials the poses are built from. */
export interface Dials {
  /** Where the camera rests. */
  rest: Camera;
  /** Pitch added while somebody is at the rim, radians. */
  attend: number;
  /** Field of view taken off at a full close, radians. */
  close: number;
  /** Beats in a scene that reach a full close. At least 1. */
  closeOver: number;
}

/** A copy, so an authoring dial cannot write to the module constant. */
export const DIALS: Dials = {
  rest: { ...REST_POSE },
  attend: rad(10),
  close: rad(12),
  // A scene is three beats, so the close arrives on the last of them.
  closeOver: 2
};

/** What the state asks the camera for. */
export interface Pose {
  /** Somebody is at the rim. */
  attend: boolean;
  /** Beats elapsed in the scene they are at the rim for. */
  beats: number;
}

/**
 * What the state asks for, given how many beats the scene has run. Outside a
 * scene there is nothing to close on, whatever the count says.
 */
export const poseOf = (state: ShaftState, beats: number): Pose =>
  state.occupied ? { attend: true, beats: Math.max(0, beats) } : { attend: false, beats: 0 };

export const samePose = (a: Pose, b: Pose): boolean =>
  a.attend === b.attend && a.beats === b.beats;

/**
 * Where that pose stands. Narrowing the field is exactly a scale about the
 * frame's centre under this lens — the shape on screen does not change, the
 * frame holds less of the bowed periphery — so `close` is a push-in and the
 * straightening is what a push-in looks like.
 */
export function cameraFor(pose: Pose, dials: Dials): Camera {
  const { rest } = dials;
  const shut = Math.min(1, pose.beats / dials.closeOver);
  return {
    ...rest,
    pitch: rest.pitch + (pose.attend ? dials.attend : 0),
    fov: rest.fov - shut * dials.close
  };
}

/** Smoothstep, so a move leaves and arrives at rest rather than at speed. */
const ease = (t: number): number => t * t * (3 - 2 * t);

const between = (a: Camera, b: Camera, t: number): Camera => ({
  eye: lerp(a.eye, b.eye, t),
  wall: lerp(a.wall, b.wall, t),
  pitch: lerp(a.pitch, b.pitch, t),
  fov: lerp(a.fov, b.fov, t)
});

const same = (a: Camera, b: Camera): boolean =>
  a.eye === b.eye && a.wall === b.wall && a.pitch === b.pitch && a.fov === b.fov;

interface Runner {
  /** Where the camera is now. Read once per reprojection. */
  readonly pose: Camera;
  /**
   * Ease to a pose. A beat's business. Retargets from wherever the camera has
   * reached, so a beat landing mid-move is not made to wait for the last one.
   */
  aim(target: Camera): void;
  /**
   * Stand at a pose, this frame. Ignored while a move runs, and when the camera
   * is already standing there.
   */
  jump(target: Camera): void;
  /** Stop for good. */
  stop(): void;
}

interface Options {
  /** Called once per tick, after the pose has advanced. */
  draw: () => void;
  /** Called where a move comes to rest, and by `jump`. Never mid-move. */
  settled: () => void;
  /** Where the camera opens. */
  start: Camera;
}

/**
 * A move is bounded and converges, so unlike the water's clock this one is not
 * held back for a hidden tab: a throttled interval finishes the move late, in a
 * tab nobody is looking at, and arrives at the same pose.
 */
export function makeCamera({ draw, settled, start }: Options): Runner {
  let pose: Camera = { ...start };
  let from: Camera = pose;
  let to: Camera = pose;
  /** Progress through the current move, 0 to 1. At 1 there is no move. */
  let t = 1;
  let timer: ReturnType<typeof setInterval> | undefined;

  const per = TICK_MS / MOVE_MS;

  const halt = (): void => {
    clearInterval(timer);
    timer = undefined;
  };

  function beat(): void {
    t = Math.min(1, t + per);
    pose = t === 1 ? { ...to } : between(from, to, ease(t));
    draw();
    // Standing still there is nothing to advance, so the clock stops itself.
    if (t === 1) {
      halt();
      settled();
    }
  }

  return {
    get pose() {
      return pose;
    },
    aim(target: Camera): void {
      from = pose;
      to = { ...target };
      t = 0;
      timer ??= setInterval(beat, TICK_MS);
    },
    jump(target: Camera): void {
      if (t < 1 || same(target, pose)) return;
      pose = { ...target };
      from = pose;
      to = pose;
      draw();
      settled();
    },
    stop(): void {
      halt();
      t = 1;
    }
  };
}
