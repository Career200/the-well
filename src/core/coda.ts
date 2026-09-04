/**
 * The ending, composed from four slots rather than chosen: which door the run
 * went out of, what the village settled on, how much the presence understood,
 * and the facts that change an ending outright.
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
  /** What the presence worked out about itself. Picks the close. */
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

/** How far ahead a belief must be to count as what the village decided. */
export const CODA_MARGIN = 0.12;
/** Below this the top belief does not count at all. */
const CODA_FLOOR = 0.05;

export function verdictOf(state: WorldState): Belief | null {
  const ranked = [...BELIEFS].sort((a, b) => state.beliefs[b] - state.beliefs[a]);
  const [top, second] = ranked as [Belief, Belief];
  if (state.beliefs[top] < CODA_FLOOR) return null;
  if (state.beliefs[top] - state.beliefs[second] < CODA_MARGIN) return null;
  return top;
}

/**
 * Blanks letters at a rate rising from 0 to `most` across the whole passage.
 * Only letters: spaces and punctuation stay. Deterministic on the seeded rng.
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

  // A run no scene played in skips the verdict slot entirely.
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
