import { describe, expect, it } from 'vitest';
import { newGame, NOTHING_NEW, step, TUNING } from '../src/core/engine.js';
import type { PlayerAction } from '../src/core/engine.js';
import { pack } from '../src/content/index.js';
import { AMBIENT_ORDER, BELOW_TUNING, TIMED_ORDER, tierOf } from '../src/core/below.js';

describe('tierOf', () => {
  it('bands lucidity into veiled, plain, named', () => {
    expect(tierOf(0, false)).toBe('veiled');
    expect(tierOf(0.6, false)).toBe('plain');
    expect(tierOf(0.9, false)).toBe('named');
  });

  it('is pinned to how many belongings were looked at', () => {
    // one thing never found is one tier of the ending never reached
    const after = (looks: number) => TUNING.lucidityFirstPress + looks * TUNING.lucidityPerDiscovery;
    expect(tierOf(after(4), false)).toBe('named');
    expect(tierOf(after(3), false)).toBe('plain');
    expect(tierOf(after(2), false)).toBe('veiled');
  });

  it('belongings run one tier ahead of ambient subjects', () => {
    expect(tierOf(0, true)).toBe('plain');
    expect(tierOf(0.9, true)).toBe('named');
    // never past named, however far ahead
    expect(tierOf(1, true)).toBe('named');
  });
});

describe('beat zero', () => {
  it('always leaves the dark inside the cap, whatever the player does', () => {
    for (const action of [{ kind: 'wait' } as const, { kind: 'haunt' } as const] as PlayerAction[]) {
      let game = newGame(pack, 5, { below: true });
      let turns = 0;
      while (game.mode.kind === 'below' && turns <= BELOW_TUNING.cap) {
        game = step(game, action).game;
        turns++;
      }
      expect(game.mode.kind).not.toBe('below');
      expect(turns).toBeLessThanOrEqual(BELOW_TUNING.cap);
    }
  });

  it('the light does not cross for a presence that never opened its eyes', () => {
    // Waiting it out is not a way through: no ending for someone who never
    // began, so the run starves instead.
    let game = newGame(pack, 5, { below: true });
    for (let i = 0; i < BELOW_TUNING.cap - 1; i++) game = step(game, { kind: 'still' }).game;
    expect(game.mode.kind, 'left the dark without ever acting').toBe('below');

    game = step(game, { kind: 'still' }).game;
    expect(game.mode.kind).toBe('over');
    if (game.mode.kind === 'over') expect(game.mode.door).toBe('starved');

    // one press, however late, and the way out exists again
    let woken = newGame(pack, 5, { below: true });
    for (let i = 0; i < BELOW_TUNING.cap - 1; i++) {
      woken = step(woken, i === 6 ? { kind: 'haunt' } : { kind: 'still' }).game;
    }
    expect(woken.mode.kind).toBe('below');
    woken = step(woken, { kind: 'still' }).game;
    // the way out is somebody arriving: the phase hands straight to them
    expect(woken.mode.kind).toBe('scene');
  });

  it('uncovering what the silt gives up ends the phase without the cap', () => {
    // The soft ending is "the ambient five, and one belonging at plain" —
    // reachable only by looking at what pressing turned up, at a turn each.
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
      expect(game.mode.kind, `seed ${seed}`).toBe('scene');
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
    // looking at it is not using it
    expect(game.state.objects[object]!.charge).toBe(1);
  });

  it('stops at the walls until the presence has acted once', () => {
    const veiled = (id: string): string => pack.below![id]!.veiled;
    const play = (act: (turn: number) => PlayerAction): string[] => {
      let game = newGame(pack, 3, { below: true });
      const said: string[] = [];
      let turns = 0;
      while (game.mode.kind === 'below' && turns < BELOW_TUNING.cap + 4) {
        const result = step(game, act(turns));
        game = result.game;
        turns++;
        for (const line of result.lines) said.push(line.text);
      }
      return said;
    };

    // Never acts: the cold, the water and the walls press against you anyway,
    // but the sky and the silt have to be looked at.
    const asleep = play(() => ({ kind: 'still' }));
    expect(asleep).toContain(veiled('walls'));
    expect(asleep).not.toContain(veiled('sky'));
    expect(asleep).not.toContain(veiled('silt'));

    // One push, however late, opens the sky — the rest resume on their own
    // clock. Not the silt: the floor resolves when it gives a belonging up,
    // and one push never reaches one.
    const woken = play((turn) => (turn === 7 ? { kind: 'haunt' } : { kind: 'still' }));
    expect(woken).toContain(veiled('sky'));
    expect(woken).not.toContain(veiled('silt'));
  });

  it('the floor resolves with the first thing it gives up', () => {
    // The silt is not on the clock the other four run on. It is the one place
    // that has to be *shown* something before it is worth looking at, so it
    // arrives in the same beat as the glimpse, immediately ahead of it: the
    // floor, then the thing in it.
    const glimpses = new Set(
      Object.values(pack.below!)
        .map((subject) => subject.glimpse)
        .filter((line): line is string => line !== undefined),
    );
    const floor = pack.below!['silt']!.veiled;

    for (const seed of [1, 3, 8, 42]) {
      let game = newGame(pack, seed, { below: true });
      let turns = 0;
      let paired = false;
      while (game.mode.kind === 'below' && turns < BELOW_TUNING.cap + 4) {
        const glimpsed = Object.entries(game.mode.phase.seen).find(([, seen]) => seen === 'glimpse');
        const action: PlayerAction = glimpsed
          ? { kind: 'look', object: glimpsed[0]! }
          : game.state.presence.charge >= TUNING.pressCost
            ? { kind: 'haunt' }
            : { kind: 'still' };
        const result = step(game, action);
        game = result.game;
        turns++;
        const said = result.lines.map((line) => line.text);
        const at = said.findIndex((text) => glimpses.has(text));
        if (at < 0) {
          expect(said, `seed ${seed} showed the floor before it gave anything up`).not.toContain(floor);
          continue;
        }
        expect(said[at - 1], `seed ${seed} did not resolve the silt with the glimpse`).toBe(floor);
        paired = true;
        break;
      }
      expect(paired, `seed ${seed} never reached a glimpse`).toBe(true);
    }
  });

  it('a push names the water, so the water is never answered by nothing on screen', () => {
    // The client brings a place out of the dark as the line naming it surfaces.
    // The water's own line waits on the ambient clock and on the line budget
    // behind it, but a push answers on the turn it is made — so that line
    // carries the id itself, and whichever comes first puts the water up.
    // Headless: this is the presence talking about the water, not the water.
    for (const seed of [1, 3, 8, 42]) {
      const game = newGame(pack, seed, { below: true });
      const pushed = step(game, { kind: 'haunt' });
      const answer = pushed.lines.find((line) => line.subjectId === 'water');
      expect(answer, `seed ${seed} pushed and left the water unnamed`).toBeDefined();
      expect(answer!.subject, `seed ${seed} captioned the presence's own voice`).toBeUndefined();
      // and the phase's own clock is untouched by it
      expect(pushed.game.mode.kind === 'below' && pushed.game.mode.phase.revealed).not.toContain('water');
    }
  });

  it('never says the same thing twice', () => {
    // Short and linear enough that a repeated sentence reads as the machine
    // showing through. Repetition is the run's tool, not this one's.
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
        // the ellipsis is the one line allowed to repeat
        for (const line of result.lines) if (line.text !== NOTHING_NEW) said.push(line.text);
      }
      expect(said.length, `seed ${seed} said nothing`).toBeGreaterThan(8);
      expect(new Set(said).size, `seed ${seed} repeated a line`).toBe(said.length);
    }
  });

  it('never narrates more than a turn can carry, and never drops what it held back', () => {
    // Three clocks can come due at once. What the player caused is always
    // said; the world's own lines wait, but never go away or reorder.
    //
    // Widely seeded on purpose: what the player caused skips the budget, so a
    // new `now` line is exactly the kind of thing that quietly makes a beat
    // three sentences long on some fraction of runs and not on others.
    for (const seed of [1, 2, 3, 5, 8, 13, 21, 34, 42, 55, 89, 144]) {
      let game = newGame(pack, seed, { below: true });
      const said: string[] = [];
      let turns = 0;
      while (game.mode.kind === 'below' && turns < BELOW_TUNING.cap + 4) {
        const glimpsed = Object.entries(game.mode.phase.seen).find(([, seen]) => seen === 'glimpse');
        const action: PlayerAction = glimpsed
          ? { kind: 'look', object: glimpsed[0]! }
          : game.state.presence.charge >= TUNING.pressCost
            ? { kind: 'haunt' }
            : { kind: 'still' };
        const result = step(game, action);
        game = result.game;
        turns++;
        expect(result.lines.length, `seed ${seed}, turn ${turns} narrated too much`).toBeLessThanOrEqual(
          BELOW_TUNING.linesPerTurn,
        );
        for (const line of result.lines) said.push(line.text);
      }

      // every ambient subject still arrives, and the four on the clock keep
      // their authored order. The silt is not among them: it resolves with the
      // belonging it gives up, wherever in the sequence that falls.
      const at = AMBIENT_ORDER.map((id) => said.indexOf(pack.below![id]!.veiled));
      expect(at.some((i) => i < 0), `seed ${seed} lost an ambient subject`).toBe(false);
      const timed = TIMED_ORDER.map((id) => said.indexOf(pack.below![id]!.veiled));
      expect([...timed].sort((a, b) => a - b), `seed ${seed} reordered the subjects`).toEqual(timed);
      // The crossing is the run beginning: the phase hands off to whoever is
      // at the rim, and their opening beat *is* the crossing.
      expect(game.mode.kind, `seed ${seed} never crossed the light`).toBe('scene');
      if (game.mode.kind !== 'scene') throw new Error('unreachable');
      const opened = pack.scenes.find((s) => s.id === (game.mode as { scene: string }).scene)!;
      expect(said[said.length - 1], `seed ${seed} did not open on the arrival`).toBe(
        opened.beats[0]!.text(game.state, { pressure: 0, resonance: null, beatIndex: 0 }),
      );
      expect(said, `seed ${seed} announced the crossing as well as playing it`).not.toContain(
        pack.belowProse!.lightCrossing[0],
      );
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
    // different seeds may match, but the pair must always be two real
    // belongings, no more and no fewer
    for (const id of c.mode.phase.found) expect(pack.objects.some((o) => o.id === id)).toBe(true);
  });
});
