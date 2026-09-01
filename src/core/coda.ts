/**
 * The ending, composed rather than chosen. A coda is not a threshold on a
 * belief: it reads which door the run went out of, what the village settled
 * on, how much the presence understood, and the few facts that change an
 * ending outright. Four slots out of about a dozen blocks multiply past the
 * twenty-odd variants the design asks for.
 *
 * The prose here is disposable; the shape is not.
 */
import { BELIEFS } from './types.js';
import type { Belief, NarrationLine, WorldState } from './types.js';
import type { Tier } from './below.js';

/** How a run stopped. */
export type Door = 'terminal' | 'starved';

export interface CodaContext {
  state: WorldState;
  door: Door;
  /** What the village settled on, or null if it never settled on anything. */
  verdict: Belief | null;
  /** What the presence worked out about itself. Gates what the ending may say. */
  tier: Tier;
}

export interface CodaBlock {
  id: string;
  /** Omitted means unconditional — the last spine must be one. */
  when?: (c: CodaContext) => boolean;
  text: string;
}

export interface Coda {
  /** Most specific first. What happened. */
  spines: CodaBlock[];
  /** Everything also true, in the order it should be said. */
  clauses: CodaBlock[];
  /** What they will tell people who were not there. */
  verdicts: Record<Belief | 'none', string>;
  /** What you are, in as many words as you earned. */
  closes: Record<Tier, string>;
}

/**
 * How far ahead a belief must be to count as what the village decided. Under
 * this nothing led, which is its own ending.
 */
export const CODA_MARGIN = 0.12;
/** Under this, the well was never really a subject at all. */
const CODA_FLOOR = 0.05;

export function verdictOf(state: WorldState): Belief | null {
  const ranked = [...BELIEFS].sort((a, b) => state.beliefs[b] - state.beliefs[a]);
  const [top, second] = ranked as [Belief, Belief];
  if (state.beliefs[top] < CODA_FLOOR) return null;
  if (state.beliefs[top] - state.beliefs[second] < CODA_MARGIN) return null;
  return top;
}

/**
 * Letters going out of the text, more of them the further in you read. Only
 * letters — spaces and stops stay, so what is left keeps the shape of writing
 * and reads as loss rather than noise. Deterministic on the seeded rng.
 */
export function erode(lines: readonly NarrationLine[], pick: () => number, most = 0.62): NarrationLine[] {
  const total = lines.reduce((n, l) => n + l.text.length, 0) || 1;
  let read = 0;
  return lines.map((line) => {
    let out = '';
    for (const ch of line.text) {
      const gone = (read++ / total) * most;
      out += /[a-zA-Z]/.test(ch) && pick() < gone ? ' ' : ch;
    }
    return { ...line, text: out };
  });
}

/** Spine, then what else is true, then what they will say, then what you are. */
export function resolveCoda(coda: Coda, ctx: CodaContext): { spine: string; lines: NarrationLine[] } {
  const line = (text: string): NarrationLine => ({ kind: 'coda', text });
  const spine = coda.spines.find((s) => !s.when || s.when(ctx)) ?? coda.spines[coda.spines.length - 1];

  // A village never given anything to tell has no answer — not even "they
  // never agreed" — so a run nobody came to skips the slot entirely.
  const told = ctx.state.history.length > 0;

  return {
    spine: spine?.id ?? '',
    lines: [
      ...(spine ? [line(spine.text)] : []),
      ...coda.clauses.filter((c) => !c.when || c.when(ctx)).map((c) => line(c.text)),
      ...(told ? [line(coda.verdicts[ctx.verdict ?? 'none'])] : []),
      line(coda.closes[ctx.tier]),
    ],
  };
}
