/**
 * The shaft with no game attached: every input `ShaftState` carries is a
 * control here. Dev only — nothing imports this and `vite build` never sees
 * `shaft.html`.
 *
 * Push and pause live in an always-visible bar, since the panel covers the
 * picture on a phone. Single-stepping stays in the panel.
 */
import './shaft-debug.css';
import { TUNING } from '../core/engine.js';
import { makeShaft, PLACES, TICK_MS } from './visuals.js';
import type { PlaceId, ShaftState } from './visuals.js';

const host = document.getElementById('shaft') as HTMLElement;
const form = document.getElementById('controls') as HTMLFormElement;

// Kept outside the panel, which covers the picture on a phone.
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
  // Not a full bar: glass is indistinguishable from a stopped clock.
  charge: 0.5,
  pressing: false,
  turn: 0,
  signals: [],
  asking: true,
  recoil: 0,
  resonating: null,
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

/** A one-of-many row. The value is a string; the caller reads it back. */
function choice(box: HTMLElement, label: string, options: readonly string[], set: (value: string) => void): void {
  const row = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = label;
  const select = document.createElement('select');
  for (const option of options) {
    const item = document.createElement('option');
    item.value = option;
    item.textContent = option;
    select.append(item);
  }
  select.onchange = () => {
    set(select.value);
    sync();
  };
  row.append(name, select);
  box.append(row);
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

// The figure. Only legible with `occupied` on — there is nobody there
// otherwise, and nobody is what an empty rim is supposed to look like.
choice(stats, 'recoil', ['0', '1', '2'], (value) => (state.recoil = Number(value) as 0 | 1 | 2));
choice(stats, 'resonating', ['none', 'ring', 'whistle', 'knife', 'coat'], (value) => {
  state.resonating = value === 'none' ? null : value;
});

const chargeBox = (): HTMLInputElement => stats.querySelector<HTMLInputElement>('input[data-key="charge"]')!;

/** Redraw the panel's own numbers after a beat has moved them. */
function show(): void {
  const input = chargeBox();
  input.value = String(state.charge);
  input.dispatchEvent(new Event('input'));
  pressingBox.checked = state.pressing;
}

// A push starts the cycle; it runs itself and stops at glass. Charge shapes it.
barButton('push', () => {
  state.turn++;
  state.pressing = true;
  state.charge = Math.max(0, state.charge - TUNING.pressCost);
  show();
  note(`push — charge ${state.charge.toFixed(2)}`);
});

// Runs against an empty rim, which is the only state it ever plays in.
barButton('withdraw', () => {
  shaft.withdraw();
  note('under the coat — somebody came and was missed');
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
// While paused, the only way to advance the settle a frame at a time.
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
