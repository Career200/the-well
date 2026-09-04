/**
 * The shaft with no game attached. Dev only — nothing imports this and
 * `vite build` never sees `shaft.html`.
 *
 * The toolbar imitates the game events that drive the picture, in the order
 * and with the timing `web/main.ts` drives them; the panel holds the two
 * continuous inputs and the per-place toggles. The panel covers the picture on
 * a phone, so anything needed while watching stays on the bar.
 */
import './shaft-debug.css';
import { DIALS } from './camera.js';
import type { Dials } from './camera.js';
import { REST_POSE, WELL } from './projection.js';
import { PLACES } from './shaft.js';
import type { PlaceId, Shaft, ShaftFactory, ShaftState } from './shaft.js';
import { makeFisheyeShaft } from './shaft-fisheye.js';
import { makeShaft } from './visuals.js';

const host = document.getElementById('shaft') as HTMLElement;
const form = document.getElementById('controls') as HTMLFormElement;

const bar = document.createElement('div');
bar.id = 'toolbar';
document.body.append(bar);

const barButton = (label: string, run: (button: HTMLButtonElement) => void): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = () => run(button);
  bar.append(button);
  return button;
};

const handle = barButton('hide', () => {
  form.hidden = !form.hidden;
  handle.textContent = form.hidden ? 'controls' : 'hide';
});

const state: ShaftState = {
  visibility: 1,
  lucidity: 0.4,
  occupied: false,
  occlusion: 0,
  leaving: false,
  // Not a full bar: glass is indistinguishable from a stopped clock.
  charge: 0.5,
  pressing: false,
  turn: 0,
  signals: [],
  asking: true,
  recoil: 0,
  resonating: null,
  reach: 0,
};

const signals = new Set<PlaceId>();

// Every place is resolved up front; the staged arrival is the game's business.
const resolvedNow = new Set<PlaceId>(PLACES);

/**
 * Which picture is drawn, in the shape the motion setting takes: off is the
 * flat diagram, on is the camera.
 */
type Motion = 'off' | 'on';
/** The camera's own dials, so the panel can find the numbers by eye. */
const dials: Dials = { rest: { ...DIALS.rest }, attend: DIALS.attend };

const RENDERERS: Record<Motion, ShaftFactory> = {
  off: makeShaft,
  on: (host, opts) => makeFisheyeShaft(host, opts, () => dials),
};

// The camera is what the harness is for; the flat picture is the comparison.
let motion: Motion = 'on';
let shaft = build();

/** A renderer, with whatever the harness has resolved replayed onto it. */
function build(): Shaft {
  const made = RENDERERS[motion](host, {
    floor: () => window.innerHeight,
    onPlace: (id) => note(`asked: the ${id}`),
  });
  for (const id of resolvedNow) made.resolve(id);
  return made;
}

const sync = (): void => {
  shaft.update({ ...state, signals: [...signals] });
};

// The swap tears the old picture down and replays the state onto the new one,
// so flipping mid-scene keeps the same moment on screen.
const motionButton = barButton(`motion: ${motion}`, () => {
  motion = motion === 'off' ? 'on' : 'off';
  shaft.destroy();
  shaft = build();
  sync();
  motionButton.textContent = `motion: ${motion}`;
  note(`${motion === 'off' ? 'the flat diagram' : 'the camera'}`);
});

// ---- game events ----------------------------------------------------------

/** Matches `LEAVING_MS` in `web/main.ts`. */
const LEAVING_MS = 1100;

/**
 * Three phases of a scene, one per click: somebody arrives and takes the
 * light; the last beat gives it back; the scene resolves and they go, holding
 * whatever pose the beat left on them.
 */
const SCENE = ['scene start', 'last beat', 'scene end'] as const;
let phase = 0;
let leaveTimer: ReturnType<typeof setTimeout> | undefined;

/** Up the pressure ladder and back down, so one button reaches every level. */
const PRESSES = [1, 2, 1, 0] as const;
let pressed = 0;

/**
 * One belonging per click, at a reach that walks the range the game produces:
 * a first use on somebody who cares, a later use, a last one, and a thing
 * nobody up there has any feeling about.
 */
const BELONGINGS = [
  { object: 'ring', reach: 1 },
  { object: 'whistle', reach: 0.66 },
  { object: 'knife', reach: 0.32 },
  { object: 'coat', reach: 0.1 },
  { object: null, reach: 0 },
] as const;
let reached = 0;

barButton(SCENE[0], (button) => {
  clearTimeout(leaveTimer);
  phase = (phase + 1) % SCENE.length;
  state.pressing = false;
  switch (phase) {
    case 1:
      Object.assign(state, { occupied: true, occlusion: 1, leaving: false, recoil: 0, resonating: null, reach: 0 });
      pressed = 0;
      reached = 0;
      break;
    case 2:
      state.occlusion = 0;
      break;
    default:
      // Both levers stay on them until the exit is over, as the client's hold
      // keeps them: the pose is what they leave with.
      Object.assign(state, { occupied: false, leaving: true });
      leaveTimer = setTimeout(() => {
        Object.assign(state, { leaving: false, recoil: 0, resonating: null, reach: 0 });
        sync();
      }, LEAVING_MS);
  }
  button.textContent = SCENE[phase]!;
  note(SCENE[phase === 0 ? 2 : phase - 1]!);
  sync();
});

barButton('push', () => {
  state.recoil = PRESSES[pressed % PRESSES.length]!;
  pressed++;
  state.turn++;
  state.pressing = true;
  note(`push — recoil ${state.recoil}`);
  sync();
});

barButton('resonate', () => {
  const next = BELONGINGS[reached % BELONGINGS.length]!;
  reached++;
  state.resonating = next.object;
  state.reach = next.reach;
  state.turn++;
  state.pressing = false;
  note(next.object ? `the ${next.object} — reach ${next.reach}` : 'resonance cleared');
  sync();
});

barButton('withdraw', () => {
  shaft.withdraw();
  note('under the coat — somebody came and was missed');
});

barButton('flash', () => {
  shaft.flash();
  note('refused — not enough charge');
});

// ---- the panel ------------------------------------------------------------

const group = (title: string): HTMLElement => {
  const box = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = title;
  box.append(legend);
  form.append(box);
  return box;
};

/** A range with its value shown, in whatever units the dial is in. */
interface Dial {
  min: number;
  max: number;
  step: number;
  value: number;
  /** Decimals on the readout, and what follows the number. */
  decimals: number;
  unit: string;
  onInput?: (value: number) => void;
}

function slider(box: HTMLElement, label: string, dial: Dial): void {
  const row = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('b');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(dial.min);
  input.max = String(dial.max);
  input.step = String(dial.step);
  input.value = String(dial.value);
  name.textContent = label;
  const show = (n: number): void => {
    value.textContent = `${n.toFixed(dial.decimals)}${dial.unit}`;
  };
  show(dial.value);
  input.oninput = () => {
    const next = Number(input.value);
    show(next);
    dial.onInput?.(next);
  };
  row.append(name, input, value);
  box.append(row);
}

function toggle(box: HTMLElement, label: string, get: () => boolean, set: (on: boolean) => void): void {
  const row = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = get();
  input.onchange = () => {
    set(input.checked);
    sync();
  };
  const name = document.createElement('span');
  name.textContent = label;
  row.append(input, name);
  box.append(row);
}

const stats = group('state');
const scalar = (label: string, key: 'lucidity' | 'charge'): void =>
  slider(stats, label, {
    min: 0,
    max: 1,
    step: 0.01,
    value: state[key],
    decimals: 2,
    unit: '',
    onInput: (n) => {
      state[key] = n;
      sync();
    },
  });
scalar('lucidity', 'lucidity');
scalar('charge', 'charge');

// The projection's own dials, in the units the dimensions table in
// `docs/SHAFT_UI_PLAN.md` uses, opening on what the renderer currently holds.
// A dial is not a beat, so moving one lands on the picture at once; only a
// scene start or end plays the move between them.
const panel = group('projection');
const deg = (rad: number): number => (rad * 180) / Math.PI;
const rad = (turn: number): number => (turn * Math.PI) / 180;

slider(panel, 'tilt', {
  min: 0,
  max: 60,
  step: 1,
  value: Math.round(deg(dials.rest.pitch)),
  decimals: 0,
  unit: '°',
  onInput: (n) => {
    dials.rest.pitch = rad(n);
    sync();
  },
});
// How far the camera comes up while somebody is at the rim. Past about 12° the
// silt leaves the frame on a phone and its band closes; the readout under the
// picture says what the bands are doing.
slider(panel, 'attend', {
  min: 0,
  max: 25,
  step: 1,
  value: Math.round(deg(dials.attend)),
  decimals: 0,
  unit: '°',
  onInput: (n) => {
    dials.attend = rad(n);
    sync();
  },
});
// Inert: the field of view is one held angle and the water one held level, and
// taking either from here is its own step.
slider(panel, 'fov', { min: 70, max: 175, step: 1, value: Math.round(deg(REST_POSE.fov)), decimals: 0, unit: '°' });
slider(panel, 'waterline', {
  min: 0,
  max: 30,
  step: 0.5,
  value: (WELL.water / WELL.height) * 100,
  decimals: 1,
  unit: '%',
});

const places = group('places');
for (const id of PLACES) {
  toggle(places, `${id} — signal`, () => signals.has(id), (on) => (on ? signals.add(id) : signals.delete(id)));
  toggle(places, `${id} — resolved`, () => resolvedNow.has(id), (on) => {
    if (on) resolvedNow.add(id);
    else resolvedNow.delete(id);
    shaft.resolve(id, on);
  });
}

const readout = document.createElement('p');
readout.className = 'note';
form.append(readout);
function note(text: string): void {
  readout.textContent = text;
}

sync();
note('scene start, then push and resonate; scene end lets them go');
