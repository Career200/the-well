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
import { makeShaft, PLACES } from './visuals.js';
import type { PlaceId, ShaftState } from './visuals.js';

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

const shaft = makeShaft(host, {
  floor: () => window.innerHeight,
  onPlace: (id) => note(`asked: the ${id}`),
});

// Every place is resolved up front; the staged arrival is the game's business.
const resolvedNow = new Set<PlaceId>(PLACES);
for (const id of PLACES) shaft.resolve(id);

const sync = (): void => {
  shaft.update({ ...state, signals: [...signals] });
};

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

function slider(box: HTMLElement, label: string, key: 'lucidity' | 'charge'): void {
  const row = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('b');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = String(state[key]);
  name.textContent = label;
  value.textContent = state[key].toFixed(2);
  input.oninput = () => {
    state[key] = Number(input.value);
    value.textContent = state[key].toFixed(2);
    sync();
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
slider(stats, 'lucidity', 'lucidity');
slider(stats, 'charge', 'charge');

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
