/** SVG element construction and the scalar helpers the pictures share. */

const NS = 'http://www.w3.org/2000/svg';

export const svgEl = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);

export const attrs = (el: Element, values: Record<string, string | number>): void => {
  for (const [key, value] of Object.entries(values)) el.setAttribute(key, String(value));
};

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Deterministic per-dot noise, 0 to 1. */
export const hash = (x: number, y: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export const gradient = (
  id: string,
  kind: 'radialGradient' | 'linearGradient',
  stops: readonly (readonly [string, string, number])[],
  box?: Record<string, string | number>,
): SVGElement => {
  const grad = svgEl(kind);
  grad.id = id;
  if (box) attrs(grad, box);
  for (const [offset, color, opacity] of stops) {
    const stop = svgEl('stop');
    attrs(stop, { offset, 'stop-color': color, 'stop-opacity': opacity });
    grad.append(stop);
  }
  return grad;
};
