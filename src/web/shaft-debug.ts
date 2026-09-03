/**
 * The shaft, alone, with the game taken off it.
 *
 * Everything the picture reads is a control here, so a state that takes a
 * dozen turns to reach in play is one drag away. Dev only — nothing imports
 * this, and `vite build` never sees `shaft.html`.
 *
 * A push is what starts the water moving, so it and the pause live in a bar
 * that is always there — the panel covers the picture on a phone, and the
 * thing you most want to do is drive the cycle while looking at it. Stepping
 * one tick at a time stays in the panel with the rest of the instruments.
 */
import { TUNING } from '../core/engine.js';
import { makeShaft, PLACES, TICK_MS } from './visuals.js';
import type { PlaceId, ShaftState } from './visuals.js';

const host = document.getElementById('shaft') as HTMLElement;
const form = document.getElementById('controls') as HTMLFormElement;

// Always there, over the picture. On a phone the panel is the whole screen,
// which is no use for looking at a shaft, so the two things worth doing while
// watching it live out here instead. Plain show/hide for the rest — this page
// is dev only and does not need to be clever about it.
const bar = document.createElement('div');
bar.id = 'toolbar';
document.body.append(bar);

const barButton = (label: string, run: () => void): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = run;
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
  // Where a run starts. A full bar is glass — nothing moves at all — which
  // looks exactly like a stopped clock, so the panel never opens on it.
  charge: 0.5,
  pressing: false,
  turn: 0,
  signals: [],
  asking: true,
};

const signals = new Set<PlaceId>();

const shaft = makeShaft(host, {
  floor: () => window.innerHeight,
  onPlace: (id) => note(`asked: the ${id}`),
});

// The bench opens on the whole room. Beat zero's one-at-a-time arrival is the
// game's business; here every place has to be there to be poked at.
const resolvedNow = new Set<PlaceId>(PLACES);
for (const id of PLACES) shaft.resolve(id);

const sync = (): void => {
  shaft.update({ ...state, signals: [...signals] });
};

// ---- the panel ------------------------------------------------------------

const group = (title: string): HTMLElement => {
  const box = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = title;
  box.append(legend);
  form.append(box);
  return box;
};

function slider(box: HTMLElement, label: string, key: 'visibility' | 'lucidity' | 'charge'): void {
  const row = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('b');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = String(state[key]);
  input.dataset['key'] = key;
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

function toggle(
  box: HTMLElement,
  label: string,
  get: () => boolean,
  set: (on: boolean) => void,
): HTMLInputElement {
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
  return input;
}

function action(box: HTMLElement, label: string, run: () => void): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.onclick = run;
  box.append(button);
}

const stats = group('state');
slider(stats, 'visibility', 'visibility');
slider(stats, 'lucidity', 'lucidity');
slider(stats, 'charge', 'charge');
toggle(stats, 'occupied', () => state.occupied, (on) => (state.occupied = on));
const pressingBox = toggle(stats, 'pressing', () => state.pressing, (on) => {
  state.pressing = on;
  if (on) state.turn++;
});

const chargeBox = (): HTMLInputElement => stats.querySelector<HTMLInputElement>('input[data-key="charge"]')!;

/** Redraw the panel's own numbers after a beat has moved them. */
function show(): void {
  const input = chargeBox();
  input.value = String(state.charge);
  input.dispatchEvent(new Event('input'));
  pressingBox.checked = state.pressing;
}

// A push is the only thing that starts the water: the cycle runs itself from
// there and stops at glass. Charge shapes it, so drag that first.
barButton('push', () => {
  state.turn++;
  state.pressing = true;
  state.charge = Math.max(0, state.charge - TUNING.pressCost);
  show();
  note(`push — charge ${state.charge.toFixed(2)}`);
});

let paused = false;
const pause = barButton('pause', () => {
  paused = !paused;
  if (paused) shaft.freeze();
  else shaft.resume();
  pause.textContent = paused ? 'play' : 'pause';
  note(paused ? 'paused — step one tick at a time' : 'running');
});

const beats = group('beats');
action(beats, 'be still', () => {
  state.turn++;
  state.pressing = false;
  state.charge = Math.min(1, state.charge + TUNING.stillness);
  show();
  note(`still — charge ${state.charge.toFixed(2)}`);
});
action(beats, 'flash()', () => shaft.flash());

const places = group('places');
for (const id of PLACES) {
  toggle(places, `${id} — signal`, () => signals.has(id), (on) => (on ? signals.add(id) : signals.delete(id)));
  toggle(places, `${id} — resolved`, () => resolvedNow.has(id), (on) => {
    if (on) resolvedNow.add(id);
    else resolvedNow.delete(id);
    shaft.resolve(id, on);
  });
}

const clock = group('clock');
const rate = document.createElement('label');
const rateInput = document.createElement('input');
rateInput.type = 'number';
rateInput.min = '16';
rateInput.step = '5';
rateInput.value = String(TICK_MS);
rateInput.oninput = () => shaft.rate(Number(rateInput.value));
const rateName = document.createElement('span');
rateName.textContent = 'tick ms';
rate.append(rateName, rateInput);
clock.append(rate);
// Paused, this is the only way to look at the settle a frame at a time.
action(clock, 'step', () => {
  shaft.tick();
  note('one tick');
});

const readout = document.createElement('p');
readout.className = 'note';
form.append(readout);
function note(text: string): void {
  readout.textContent = text;
}

sync();
note('push to start a cycle; pause and step to walk it');
