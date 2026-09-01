import { describe, expect, it } from 'vitest';
import { couldStillFire, HAS_PRESSED, newGame, runStatus, step, TUNING } from '../src/core/engine.js';
import type { Game, PlayerAction } from '../src/core/engine.js';
import { pack } from '../src/content/index.js';
import { applyEffects } from '../src/core/effects.js';
import { resolveOutcome } from '../src/core/scene.js';
import { scenes } from '../src/content/scenes.js';
import { makeRng } from '../src/core/rng.js';
import { choose } from '../src/sim/policies.js';

const play = (game: Game, actions: PlayerAction[]): Game =>
  actions.reduce((g, a) => step(g, a).game, game);

const wait = (n: number): PlayerAction[] => Array.from({ length: n }, () => ({ kind: 'wait' as const }));

describe('determinism', () => {
  it('same seed and actions produce the same world', () => {
    const actions = [...wait(5), { kind: 'haunt' as const }, ...wait(10)];
    const a = play(newGame(pack, 42), actions);
    const b = play(newGame(pack, 42), actions);
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  it('different seeds diverge', () => {
    const actions = wait(30);
    const a = play(newGame(pack, 1), actions);
    const b = play(newGame(pack, 999), actions);
    expect(a.state.history).not.toEqual(b.state.history);
  });
});

describe('presence economy', () => {
  it('haunting is refused when the presence is too thin', () => {
    let game = newGame(pack, 7);
    game = { ...game, state: { ...game.state, presence: { ...game.state.presence, charge: 0 } } };
    const { lines, game: after } = step(game, { kind: 'haunt' });
    expect(lines[0]!.text).toMatch(/too thin/);
    expect(after.state.presence.charge).toBe(0);
  });

  it('stillness is the only thing that recovers presence', () => {
    let game = newGame(pack, 7);
    game = { ...game, state: { ...game.state, presence: { ...game.state.presence, charge: 0 } } };
    const after = play(game, wait(3));
    expect(after.state.presence.charge).toBeCloseTo(TUNING.stillness * 3, 5);

    // looking is not stillness
    const looked = play(
      { ...game, state: { ...game.state, presence: { ...game.state.presence, charge: 0 } } },
      [{ kind: 'look', object: 'ring' }],
    );
    expect(looked.state.presence.charge).toBe(0);
  });

  it('pressing persists until released, and drains a full bar inside one scene', () => {
    let game = newGame(pack, 7);
    game = { ...game, state: { ...game.state, presence: { ...game.state.presence, charge: 1 } } };
    game = step(game, { kind: 'haunt' }).game;
    expect(game.state.presence.stance.kind).toBe('pressing');

    // waiting does not stop it
    game = step(game, { kind: 'wait' }).game;
    expect(game.state.presence.stance.kind).toBe('pressing');
    expect(game.state.presence.charge).toBeCloseTo(1 - TUNING.pressCost * 2, 5);

    // and a full bar buys exactly two presses, which is exactly UNDENIABLE
    expect(game.state.presence.charge).toBeLessThan(TUNING.pressCost);
    expect(TUNING.pressure * 2).toBeGreaterThanOrEqual(0.6);
  });

  it('the first press that lands is worth a sliver of lucidity, and only the first', () => {
    let game = newGame(pack, 7);
    expect(game.state.flags[HAS_PRESSED]).toBeUndefined();
    expect(game.state.presence.lucidity).toBe(0);

    game = step(game, { kind: 'haunt' }).game;
    expect(game.state.flags[HAS_PRESSED]).toBe(true);
    expect(game.state.presence.lucidity).toBeCloseTo(TUNING.lucidityFirstPress, 5);

    // going on pressing is not a second first time
    const once = game.state.presence.lucidity;
    game = play(game, [...wait(6), { kind: 'haunt' }, { kind: 'wait' }]);
    expect(game.state.presence.lucidity).toBeCloseTo(once, 5);
  });

  it('a run that never presses never sets the flag the world comes into view on', () => {
    const idle = play(newGame(pack, 7), wait(30));
    expect(idle.state.flags[HAS_PRESSED]).toBeUndefined();
  });

  it('choosing stillness returns to stillness', () => {
    let game = newGame(pack, 7);
    game = step(game, { kind: 'haunt' }).game;
    game = step(game, { kind: 'still' }).game;
    expect(game.state.presence.stance.kind).toBe('still');
  });
});

describe('belongings', () => {
  it('cannot be attuned before being looked at', () => {
    const { lines } = step(newGame(pack, 3), { kind: 'attune', object: 'ring' });
    expect(lines[0]!.text).toMatch(/have not yet looked/);
  });

  it('looking raises lucidity exactly once per object', () => {
    let game = newGame(pack, 3);
    game = step(game, { kind: 'look', object: 'ring' }).game;
    const once = game.state.presence.lucidity;
    game = step(game, { kind: 'look', object: 'ring' }).game;
    expect(game.state.presence.lucidity).toBe(once);
    expect(once).toBeCloseTo(TUNING.lucidityPerDiscovery, 5);
  });

  it('looking advances a scene beat — uncovering costs a turn like anything else', () => {
    let game = newGame(pack, 11);
    while (game.mode.kind !== 'scene') game = step(game, { kind: 'wait' }).game;
    const before = game.mode.ctx.beatIndex;
    game = step(game, { kind: 'look', object: 'ring' }).game;
    if (game.mode.kind === 'scene') expect(game.mode.ctx.beatIndex).toBe(before + 1);
    expect(game.state.objects.ring!.discovered).toBe(true);
  });

  it('attuning holds only one thing at a time', () => {
    let game = newGame(pack, 3);
    game = step(game, { kind: 'look', object: 'ring' }).game;
    game = step(game, { kind: 'look', object: 'knife' }).game;
    game = step(game, { kind: 'attune', object: 'ring' }).game;
    game = step(game, { kind: 'attune', object: 'knife' }).game;
    expect(game.state.presence.stance).toEqual({ kind: 'holding', object: 'knife' });
  });

  it('charge spent on a belonging never comes back', () => {
    let game = newGame(pack, 3);
    game = step(game, { kind: 'look', object: 'ring' }).game;
    game = step(game, { kind: 'attune', object: 'ring' }).game;
    const spent = game.state.objects.ring!.charge;
    expect(spent).toBeLessThan(1);
    const after = play(step(game, { kind: 'still' }).game, wait(20));
    expect(after.state.objects.ring!.charge).toBeCloseTo(spent, 5);
  });

  it('a belonging runs out for good, and drops itself when it does', () => {
    let game = newGame(pack, 3);
    game = step(game, { kind: 'look', object: 'ring' }).game;
    game = step(game, { kind: 'attune', object: 'ring' }).game;
    game = play(game, wait(40));
    expect(game.state.objects.ring!.charge).toBeLessThanOrEqual(TUNING.spent);
    expect(game.state.presence.stance.kind).toBe('still');
    expect(step(game, { kind: 'attune', object: 'ring' }).lines[0]!.text).toMatch(/not coming back/);
  });
});

describe('the stop', () => {
  it('a fresh run is open', () => {
    expect(runStatus(newGame(pack, 21)).kind).toBe('open');
  });

  it('a run where the player does nothing stalls, and says so once', () => {
    let game = newGame(pack, 21);
    let announcements = 0;
    for (let i = 0; i < 200; i++) {
      const result = step(game, { kind: 'wait' });
      game = result.game;
      announcements += result.lines.filter((l) => l.text.includes('while the well is what it is now')).length;
    }
    expect(runStatus(game).kind).toBe('stalled');
    expect(announcements).toBe(1);
  });

  it('stalled is not quiet: the gates are shut, not gone', () => {
    let game = newGame(pack, 21);
    for (let i = 0; i < 200; i++) game = step(game, { kind: 'wait' }).game;
    const stillPossible = pack.scenes.filter((s) => couldStillFire(game, s));
    expect(stillPossible.length).toBeGreaterThan(0);
  });

  it('quiet when nobody is left to come', () => {
    let game = newGame(pack, 21);
    for (let i = 0; i < 60; i++) game = step(game, { kind: 'wait' }).game;
    const people = Object.fromEntries(
      Object.entries(game.state.people).map(([id, p]) => [id, { ...p, present: false }]),
    );
    game = { ...game, state: { ...game.state, people } };
    expect(runStatus(game).kind).toBe('quiet');
  });

  it('a run that plays the whole world goes quiet, and says so once', () => {
    const rng = makeRng(13);
    let game = newGame(pack, 0);
    let announcements = 0;
    for (let t = 0; t < 120; t++) {
      const result = step(game, choose(game, pack, 'mixed', rng.next()));
      game = result.game;
      announcements += result.lines.filter((l) => l.text.includes('Nothing is coming')).length;
    }
    expect(game.state.history).toHaveLength(pack.scenes.length);
    expect(runStatus(game).kind).toBe('quiet');
    expect(announcements).toBe(1);
  });
});

describe('scene resolution', () => {
  const firstWater = scenes.find((s) => s.id === 'first-water')!;
  const base = newGame(pack, 1).state;

  it('picks the terrified outcome under heavy pressure', () => {
    const outcome = resolveOutcome(firstWater, base, { pressure: 0.9, resonance: null, beatIndex: 3 });
    expect(outcome.id).toBe('terrified');
  });

  it('picks the quiet outcome when the player does nothing', () => {
    const outcome = resolveOutcome(firstWater, base, { pressure: 0, resonance: null, beatIndex: 3 });
    expect(outcome.id).toBe('quiet');
  });

  it('outcome effects move beliefs', () => {
    const ctx = { pressure: 0.9, resonance: null, beatIndex: 3 };
    const after = applyEffects(base, resolveOutcome(firstWater, base, ctx).effects(base, ctx));
    expect(after.beliefs.haunted).toBeGreaterThan(base.beliefs.haunted);
    expect(after.people.mira!.emotions.fear).toBeGreaterThan(base.people.mira!.emotions.fear);
  });
});

describe('gating', () => {
  it('the throwing cannot fire early', () => {
    const game = newGame(pack, 5);
    const throwing = scenes.find((s) => s.id === 'the-throwing')!;
    expect(throwing.requires!(game.state)).toBe(false);
  });

  it('a scene never repeats unless marked repeatable', () => {
    let game = newGame(pack, 11);
    for (let i = 0; i < 80; i++) game = step(game, { kind: 'wait' }).game;
    const seen = game.state.history.map((h) => h.scene);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('content sanity', () => {
  it('every scene has a fallback outcome and a cast that exists', () => {
    for (const scene of pack.scenes) {
      expect(scene.outcomes.length, scene.id).toBeGreaterThan(0);
      for (const person of scene.cast) {
        expect(pack.people.some((p) => p.id === person), `${scene.id} casts ${person}`).toBe(true);
      }
    }
  });

  it('every effect names something real', () => {
    const people = new Set(pack.people.map((p) => p.id));
    const objects = new Set(pack.objects.map((o) => o.id));
    const base = newGame(pack, 1).state;
    for (const scene of pack.scenes) {
      for (const outcome of scene.outcomes) {
        for (const effect of outcome.effects(base, { pressure: 1, resonance: null, beatIndex: 0 })) {
          if ('person' in effect) expect(people.has(effect.person), `${scene.id}/${outcome.id}`).toBe(true);
          if ('object' in effect) expect(objects.has(effect.object), `${scene.id}/${outcome.id}`).toBe(true);
        }
      }
    }
  });
});
