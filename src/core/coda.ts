/**
 * The ending, as a product rather than an essay.
 *
 * `MECHANICS.md` §4 is explicit that a coda is not a threshold on a belief: it
 * reads which door the run went out of, what the village settled on, how much
 * the presence ever understood, and the few facts that change an ending
 * outright. So it is composed from four slots rather than written as N whole
 * endings — six spines, five verdicts and three closes already multiply past
 * `DIALS.md` §6's twenty-to-thirty variants, out of about a dozen blocks.
 *
 * The prototype's version is small and its prose is disposable. The shape is
 * not: this is how the finished coda has to be built, so it is built that way
 * now, while it costs nothing.
 */
import { BELIEFS } from './types.js';
import type { Belief, NarrationLine, WorldState } from './types.js';
import type { Tier } from './below.js';

/** How a run stopped. Two doors, exactly as the design has them. */
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
 * this, nothing led: a village torn between readings is loud and certain of
 * nothing, and that is its own ending.
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
 * letters: spaces and stops stay, so what is left keeps the shape of writing
 * and reads as something being taken rather than as noise.
 *
 * Deterministic on the seeded rng, so a run still replays exactly — an ending
 * that came apart differently on the same seed would undercut everything the
 * rest of the engine is careful about.
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

  // The verdict answers *what will they tell people who were not there*, and a
  // village that was never given anything to tell has no answer — not even
  // "they never agreed". A run nobody came to skips the slot entirely.
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
