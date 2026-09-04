import type { Coda, CodaBlock, CodaContext } from '../core/coda.js';
import { notoriety } from '../core/types.js';
import type { WorldState } from '../core/types.js';
import { clauseProse, closeProse, spineProse, verdictProse } from './prose/coda.js';

const played = (state: WorldState, scene: string, outcome: string): boolean =>
  state.history.some((h) => h.scene === scene && h.outcome === outcome);

/** The last spine must be unconditional. */
const spine = (id: keyof typeof spineProse, when?: (c: CodaContext) => boolean): CodaBlock => ({
  id,
  text: spineProse[id],
  ...(when ? { when } : {}),
});

const clause = (id: keyof typeof clauseProse, when: (c: CodaContext) => boolean): CodaBlock => ({
  id,
  text: clauseProse[id],
  when,
});

export const coda: Coda = {
  spines: [
    spine(
      'never-woke',
      ({ state, door }) => door === 'starved' && !state.flags['presence.has-pressed'] && !state.history.length,
    ),
    spine('thrown-cold', ({ state }) => played(state, 'the-throwing', 'thrown-cold')),
    spine('thrown-afraid', ({ state }) => played(state, 'the-throwing', 'thrown-afraid')),
    spine('stopped', ({ state }) => state.flags['throwing-prevented'] === true),
    spine('sealed', ({ state }) => state.flags['well-covered'] === true),
    spine('forgotten', ({ state, door }) => door === 'starved' && state.well.attention < 0.3 && notoriety(state) < 0.4),
    spine('undecided'),
  ],

  clauses: [
    clause(
      'body-found',
      ({ state }) => state.flags['body-found'] === true && state.flags['stranger-in-the-well'] !== true,
    ),
    clause(
      'body-found-again',
      ({ state }) => state.flags['body-found'] === true && state.flags['stranger-in-the-well'] === true,
    ),
    clause('confessed', ({ state }) => state.flags['tomas-confessed'] === true),
    clause('a-story', ({ state }) => state.flags['boy-told-a-story'] === true),
    clause('she-stayed', ({ state }) => played(state, 'first-water', 'the-word')),
    clause('nothing-left', ({ state }) => {
      const held = Object.values(state.objects).filter((o) => o.found);
      return held.length > 0 && held.reduce((sum, o) => sum + o.charge, 0) <= 0.2 * held.length;
    }),
  ],

  verdicts: verdictProse,
  closes: closeProse,
};
