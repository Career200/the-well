import { describe, expect, it } from 'vitest';
import { newGame, NOTHING_NEW, step, TUNING } from '../src/core/engine.js';
import type { PlayerAction } from '../src/core/engine.js';
import { pack } from '../src/content/index.js';
import { BELOW_TUNING, tierOf } from '../src/core/below.js';

describe('tierOf', () => {
  it('bands lucidity into veiled, plain, named', () => {
    expect(tierOf(0, false)).toBe('veiled');
    expect(tierOf(0.5, false)).toBe('plain');
    expect(tierOf(0.9, false)).toBe('named');
  });

  it('belongings run one tier ahead of ambient subjects', () => {
    expect(tierOf(0, true)).toBe('plain');
    expect(tierOf(0.9, true)).toBe('named');
    // never past named, however far ahead
    expect(tierOf(1, true)).toBe('named');
  });
});

describe('beat zero', () => {
  it('always terminates inside the cap, whatever the player does', () => {
    for (const action of [{ kind: 'wait' } as const, { kind: 'haunt' } as const] as PlayerAction[]) {
      let game = newGame(pack, 5, { below: true });
      let turns = 0;
      while (game.mode.kind === 'below' && turns <= BELOW_TUNING.cap) {
        game = step(game, action).game;
        turns++;
      }
      expect(game.mode.kind).toBe('idle');
      expect(turns).toBeLessThanOrEqual(BELOW_TUNING.cap);
    }
  });

  it('uncovering what the silt gives up ends the phase without the cap', () => {
    // The phase's soft ending is "the ambient five, and one belonging at
    // plain" — reachable only if the player can look at what pressing turned
    // up. It is a beat like any other: looking costs a turn.
    for (const seed of [1, 3, 8, 42]) {
      let game = newGame(pack, seed, { below: true });
      let turns = 0;
      while (game.mode.kind === 'below' && turns < BELOW_TUNING.cap) {
        const glimpsed = Object.entries(game.mode.phase.seen).find(([, seen]) => seen === 'glimpse');
        const action: PlayerAction = glimpsed
          ? { kind: 'look', object: glimpsed[0]! }
          : game.state.presence.charge >= TUNING.pressCost
            ? { kind: 'haunt' }
            : { kind: 'still' };
        game = step(game, action).game;
        turns++;
      }
      expect(game.mode.kind, `seed ${seed}`).toBe('idle');
      expect(turns, `seed ${seed} should not need the cap`).toBeLessThan(BELOW_TUNING.cap);
    }
  });

  it('uncovering is a beat, and it is not activating', () => {
    let game = newGame(pack, 5, { below: true });
    while (game.mode.kind === 'below' && !Object.keys(game.mode.phase.seen).length) {
      game = step(game, game.state.presence.charge >= TUNING.pressCost ? { kind: 'haunt' } : { kind: 'still' }).game;
    }
    if (game.mode.kind !== 'below') throw new Error('nothing was ever uncovered');
    const object = Object.keys(game.mode.phase.seen)[0]!;

    const before = game.state.turn;
    game = step(game, { kind: 'look', object }).game;
    expect(game.state.turn).toBe(before + 1);
    // looking at it is not taking it up
    expect(game.state.presence.stance.kind).not.toBe('holding');
  });

  it('never says the same thing twice', () => {
    // The phase is short and linear enough that a repeated sentence reads as
    // the machine showing through. Repetition is the run's tool, not this one's.
    for (const seed of [1, 3, 8, 42]) {
      let game = newGame(pack, seed, { below: true });
      const said: string[] = [];
      let turns = 0;
      while (game.mode.kind === 'below' && turns < BELOW_TUNING.cap) {
        const glimpsed = Object.entries(game.mode.phase.seen).find(([, seen]) => seen === 'glimpse');
        const action: PlayerAction = glimpsed
          ? { kind: 'look', object: glimpsed[0]! }
          : game.state.presence.charge >= TUNING.pressCost
            ? { kind: 'haunt' }
            : { kind: 'still' };
        const result = step(game, action);
        game = result.game;
        turns++;
        // The ellipsis is the one thing allowed to repeat: it is what a turn
        // says when everything it had was already said.
        for (const line of result.lines) if (line.text !== NOTHING_NEW) said.push(line.text);
      }
      expect(said.length, `seed ${seed} said nothing`).toBeGreaterThan(8);
      expect(new Set(said).size, `seed ${seed} repeated a line`).toBe(said.length);
    }
  });

  it('exactly two belongings are reachable, and the pair is stable for a seed', () => {
    const a = newGame(pack, 99, { below: true });
    const b = newGame(pack, 99, { below: true });
    expect(a.mode.kind).toBe('below');
    if (a.mode.kind !== 'below' || b.mode.kind !== 'below') throw new Error('unreachable');
    expect(a.mode.phase.found).toEqual(b.mode.phase.found);
    expect(new Set(a.mode.phase.found).size).toBe(2);

    const c = newGame(pack, 7, { below: true });
    if (c.mode.kind !== 'below') throw new Error('unreachable');
    // different seeds are not guaranteed to differ, but the pair itself must
    // always be drawn from the real belongings, no more and no fewer than two.
    for (const id of c.mode.phase.found) expect(pack.objects.some((o) => o.id === id)).toBe(true);
  });
});
