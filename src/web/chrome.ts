/**
 * Everything around the picture that is not the picture: the corners outside
 * the SVG, the tap targets over it, the per-place reveal, and the opacity and
 * haze the whole frame takes from the state.
 *
 * A renderer supplies its own geometry and its four place groups; this holds
 * the rest, so both pictures behave the same way without agreeing to twice.
 */

import { HAZE, stepOf } from './grain.js';
import { PLACES } from './shaft.js';
import type { Bands, PlaceId, ShaftState } from './shaft.js';
import { clamp01 } from './svg.js';

/** Charge above which the corners stay open. */
const COMPOSED = 0.7;
/** Share of the corners' remaining headroom one push may take. */
const KICK_SHARE = 0.35;

/** How long the corner spike runs, ms. Matches `.agitation.flash`. */
const FLASH_MS = 1100;

export interface Chrome {
  /** Mounted into the host after the SVG, in this order. */
  readonly corners: HTMLDivElement;
  readonly regions: HTMLDivElement;
  /** A place coming out of the dark. Idempotent. */
  resolve(id: PlaceId, on?: boolean): void;
  /** Stack the four tap targets down the picture. */
  stack(bands: Bands, height: number): void;
  /** Signalling and whether places accept clicks. */
  places(state: ShaftState): void;
  /** Corner opacity: a level from the charge plus a transient flinch. */
  agitate(state: ShaftState, agitation: number): void;
  /** A spike on the corners. */
  flash(): void;
  destroy(): void;
}

export function makeChrome(
  shapes: Record<PlaceId, SVGGElement>,
  onPlace?: (id: PlaceId) => void,
): Chrome {
  // Outside the SVG, so it reads at any `visibility`.
  const corners = document.createElement('div');
  corners.className = 'agitation';

  // Tap targets: transparent full-width bands stacked over the picture.
  const regions = document.createElement('div');
  regions.className = 'places';
  const buttons = {} as Record<PlaceId, HTMLButtonElement>;
  for (const id of PLACES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place';
    button.dataset['place'] = id;
    button.setAttribute('aria-label', `the ${id}`);
    button.onclick = () => onPlace?.(id);
    buttons[id] = button;
    regions.append(button);
  }

  const place = (button: HTMLButtonElement, top: number, bottom: number): void => {
    button.style.top = `${Math.max(0, top)}px`;
    button.style.height = `${Math.max(0, bottom - top)}px`;
  };

  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const chrome: Chrome = {
    corners,
    regions,
    resolve(id: PlaceId, on = true): void {
      shapes[id].classList.toggle('resolved', on);
      // Unresolved places are not targets and are out of the a11y tree.
      buttons[id].hidden = !on;
    },
    stack(bands: Bands, height: number): void {
      place(buttons.sky, 0, bands.skyBottom);
      place(buttons.walls, bands.skyBottom, bands.waterTop);
      place(buttons.water, bands.waterTop, bands.siltTop);
      place(buttons.silt, bands.siltTop, height);
    },
    places(state: ShaftState): void {
      for (const id of PLACES) {
        const lit = state.signals.includes(id);
        shapes[id].classList.toggle('signalling', lit);
        // Presence is `resolve`'s business; this only gates asking.
        buttons[id].disabled = !state.asking;
        buttons[id].classList.toggle('signalling', lit);
      }
    },
    agitate(state: ShaftState, agitation: number): void {
      // The flinch takes only the headroom the level leaves, so the sum stays
      // inside 1.
      const lack = clamp01((COMPOSED - state.charge) / COMPOSED);
      const flinch = agitation * (state.pressing ? 1 : 0.72) * KICK_SHARE;
      corners.style.opacity = String(clamp01(lack + flinch * (1 - lack)));
    },
    flash(): void {
      corners.classList.remove('flash');
      void corners.offsetWidth; // restart it even if one is already running
      corners.classList.add('flash');
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => corners.classList.remove('flash'), FLASH_MS);
    },
    destroy(): void {
      clearTimeout(flashTimer);
    },
  };

  // Places start unresolved; the client reveals them one at a time.
  for (const id of PLACES) chrome.resolve(id, false);

  return chrome;
}

/**
 * What the whole frame takes from the state: one opacity, one filter, and the
 * push. `dim` is brightness taken off on top, 0 to 1, for a picture whose only
 * light is being kept out.
 */
export function veil(svg: SVGSVGElement, state: ShaftState, dim = 0): void {
  svg.classList.toggle('pressing', state.pressing);
  const seen = clamp01(state.visibility);
  const eased = seen * seen * (3 - 2 * seen);
  svg.style.opacity = String(0.05 + eased * 0.95);
  const haze = HAZE[stepOf(state.lucidity)]!;
  const bright = (0.4 + eased * 0.6) * (1 - clamp01(dim));
  svg.style.filter = `brightness(${bright.toFixed(3)})${haze > 0 ? ` blur(${haze.toFixed(2)}px)` : ''}`;
}
