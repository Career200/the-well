import { describe, expect, it } from 'vitest';
import { couldStillFire, HAS_PRESSED, newGame, NOTHING_NEW, runStatus, siltChanceOf, step, TUNING } from '../src/core/engine.js';
import { resolveCoda, verdictOf } from '../src/core/coda.js';
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

/**
 * The silt having given something up. These tests are about what `look` and
 * `attune` do once a thing is there, not how it got there.
 */
const found = (game: Game, ...ids: string[]): Game => ({
  ...game,
  state: {
    ...game.state,
    objects: Object.fromEntries(
      Object.entries(game.state.objects).map(([id, o]) => [id, ids.includes(id) ? { ...o, found: true } : o]),
    ),
  },
});

describe('determinism', () => {
  it('same seed and actions produce the same world', () => {
    const actions = [...wait(5), { kind: 'haunt' as const }, ...wait(10)];
    const a = play(newGame(pack, 42), actions);
    const b = play(newGame(pack, 42), actions);
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  it('same seed and actions produce the same narration', () => {
    const actions = [...wait(40)];
    const said = (): string[] => {
      let game = newGame(pack, 7);
      return actions.flatMap((action) => {
        const result = step(game, action);
        game = result.game;
        return result.lines.map((l) => `${l.kind}:${l.text}`);
      });
    };
    expect(said()).toEqual(said());
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

  it('a push is paid for once, on the beat it is clicked', () => {
    let game = newGame(pack, 7);
    game = { ...game, state: { ...game.state, presence: { ...game.state.presence, charge: 1 } } };
    game = step(game, { kind: 'haunt' }).game;
    const afterOne = game.state.presence.charge;
    expect(afterOne).toBeCloseTo(1 - TUNING.pressCost, 5);

    // no later beat pays for it again
    game = step(game, { kind: 'look', object: 'walls' }).game;
    expect(game.state.presence.charge).toBeCloseTo(afterOne, 5);

    // a full bar buys exactly two presses, which is exactly UNDENIABLE
    game = step(game, { kind: 'haunt' }).game;
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

  it('being still is the only thing that gathers', () => {
    let game = newGame(pack, 7);
    const start = game.state.presence.charge;
    game = step(game, { kind: 'still' }).game;
    expect(game.state.presence.charge).toBeCloseTo(start + TUNING.stillness, 5);

    const gathered = game.state.presence.charge;
    game = step(game, { kind: 'look', object: 'walls' }).game;
    expect(game.state.presence.charge).toBeCloseTo(gathered, 5);
  });
});

describe('belongings', () => {
  it('cannot be attuned before being looked at', () => {
    const { lines } = step(found(newGame(pack, 3), 'ring'), { kind: 'attune', object: 'ring' });
    expect(lines[0]!.text).toMatch(/have not yet looked/);
  });

  it('looking raises lucidity exactly once per object', () => {
    let game = found(newGame(pack, 3), 'ring');
    game = step(game, { kind: 'look', object: 'ring' }).game;
    const once = game.state.presence.lucidity;
    game = step(game, { kind: 'look', object: 'ring' }).game;
    expect(game.state.presence.lucidity).toBe(once);
    expect(once).toBeCloseTo(TUNING.lucidityPerDiscovery, 5);
  });

  it('looking advances a scene beat — uncovering costs a turn like anything else', () => {
    let game = found(newGame(pack, 11), 'ring');
    while (game.mode.kind !== 'scene') game = step(game, { kind: 'wait' }).game;
    const before = game.mode.ctx.beatIndex;
    game = step(game, { kind: 'look', object: 'ring' }).game;
    if (game.mode.kind === 'scene') expect(game.mode.ctx.beatIndex).toBe(before + 1);
    expect(game.state.objects.ring!.discovered).toBe(true);
  });

  it('using a belonging costs it once and leaves nothing running', () => {
    let game = found(newGame(pack, 3), 'ring', 'knife');
    game = step(game, { kind: 'look', object: 'ring' }).game;
    game = step(game, { kind: 'look', object: 'knife' }).game;

    const before = game.state.objects.ring!.charge;
    game = step(game, { kind: 'attune', object: 'ring' }).game;
    expect(game.state.objects.ring!.charge).toBeCloseTo(before - TUNING.holdCost, 5);

    // Everything a player might do next, none of which is about the ring.
    const after = game.state.objects.ring!.charge;
    game = step(game, { kind: 'look', object: 'knife' }).game;
    game = play(game, wait(4));
    expect(game.state.objects.ring!.charge).toBeCloseTo(after, 5);
  });

  it('a use in a scene is held across the beat that answers it', () => {
    const start = found(newGame(pack, 5), 'ring');
    const game: Game = {
      ...start,
      state: {
        ...start.state,
        objects: { ...start.state.objects, ring: { ...start.state.objects['ring']!, discovered: true } },
      },
      mode: { kind: 'scene', scene: 'first-water', ctx: { pressure: 0, resonance: null, beatIndex: 0 } },
    };

    // taken up, the scene moves, set down — not both halves before the beat
    const { lines } = step(game, { kind: 'attune', object: 'ring' });
    expect(lines.map((l) => l.kind)).toEqual(['fact', 'scene', 'fact']);
    expect(lines[0]!.subjectId).toBe('ring');
    expect(lines[2]!.subjectId).toBe('ring');
  });

  it('a use on the beat that ends a scene is set down before the village speaks', () => {
    const playing = pack.scenes.find((s) => s.id === 'first-water')!;
    const lastBeat = (seed: number): Game => {
      const start = found(newGame(pack, seed), 'ring');
      return {
        ...start,
        state: {
          ...start.state,
          objects: { ...start.state.objects, ring: { ...start.state.objects['ring']!, discovered: true } },
        },
        // One past the last beat, so this use is answered by the outcome.
        mode: { kind: 'scene', scene: playing.id, ctx: { pressure: 0, resonance: null, beatIndex: playing.beats.length - 1 } },
      };
    };

    // The ring's outcome moves the village, so some seed has them answer it.
    for (let seed = 1; seed < 60; seed++) {
      const { lines } = step(lastBeat(seed), { kind: 'attune', object: 'ring' });
      if (!lines.some((l) => l.kind === 'idle')) continue;
      expect(lines.map((l) => l.kind)).toEqual(['fact', 'scene', 'fact', 'idle']);
      expect(lines[2]!.subjectId).toBe('ring');
      return;
    }
    throw new Error('the village never answered the outcome');
  });

  it('charge spent on a belonging never comes back', () => {
    let game = found(newGame(pack, 3), 'ring');
    game = step(game, { kind: 'look', object: 'ring' }).game;
    game = step(game, { kind: 'attune', object: 'ring' }).game;
    const spent = game.state.objects.ring!.charge;
    expect(spent).toBeLessThan(1);
    const after = play(step(game, { kind: 'still' }).game, wait(20));
    expect(after.state.objects.ring!.charge).toBeCloseTo(spent, 5);
  });

  it('a belonging runs out after three uses, and only from being used', () => {
    let game = found(newGame(pack, 3), 'ring');
    game = step(game, { kind: 'look', object: 'ring' }).game;

    // Three is the whole of a belonging, and time alone never takes any of it.
    game = play(game, wait(16));
    expect(game.state.objects.ring!.charge).toBeCloseTo(1, 5);
    for (let i = 0; i < 3; i++) game = step(game, { kind: 'attune', object: 'ring' }).game;
    expect(game.state.objects.ring!.charge).toBeLessThanOrEqual(TUNING.spent);

    // asked for again, mid-run: a cold thing stays cold
    const fresh = found(newGame(pack, 3), 'ring');
    const ring = fresh.state.objects.ring!;
    const spent: Game = {
      ...fresh,
      state: { ...fresh.state, objects: { ...fresh.state.objects, ring: { ...ring, found: true, discovered: true, charge: 0 } } },
    };
    expect(step(spent, { kind: 'attune', object: 'ring' }).lines[0]!.text).toMatch(/not coming back/);
  });
});

describe('the silt', () => {
  /** The first `n` belongings in pack order, in hand. */
  const holding = (game: Game, n: number): Game => ({
    ...game,
    state: {
      ...game.state,
      objects: Object.fromEntries(
        pack.objects.map((o, i) => [o.id, { ...game.state.objects[o.id]!, found: i < n }]),
      ),
      presence: { ...game.state.presence, charge: 1 },
    },
  });

  const held = (game: Game): number => pack.objects.filter((o) => game.state.objects[o.id]?.found).length;

  it('owes the first, is loose about the second, and rolls for the rest', () => {
    const game = newGame(pack, 1);
    expect(siltChanceOf(holding(game, 0))).toBe(1);
    expect(siltChanceOf(holding(game, 1))).toBe(TUNING.siltPairChance);
    expect(siltChanceOf(holding(game, 2))).toBe(TUNING.siltChance);
    expect(siltChanceOf(holding(game, 3))).toBe(TUNING.siltChance);
  });

  it('gives the first up to any press, on every seed', () => {
    for (let seed = 0; seed < 50; seed++) {
      const after = step(holding(newGame(pack, seed), 0), { kind: 'haunt' }).game;
      expect(held(after), `seed ${seed} kept the first belonging`).toBe(1);
    }
  });

  it('refuses two presses running, on some seed: a refusal buys nothing', () => {
    const twice = Array.from({ length: 200 }, (_, seed) => {
      let game = holding(newGame(pack, seed), 2);
      let refusals = 0;
      for (let i = 0; i < 2 && game.mode.kind === 'idle'; i++) {
        const before = held(game);
        game = step(game, { kind: 'haunt' }).game;
        if (held(game) === before) refusals++;
      }
      return refusals;
    });
    expect(Math.max(...twice)).toBe(2);
  });
});

/** A place with something to say. The engine owns the flag; the picture reads it. */
const opened = (game: Game, id: string): Game => ({
  ...game,
  state: applyEffects(game.state, [{ kind: 'flag', flag: `subject.${id}.open`, value: true }]),
});

const lucid = (game: Game, lucidity: number): Game => ({
  ...game,
  state: { ...game.state, presence: { ...game.state.presence, lucidity } },
});

describe('the places', () => {
  it('a place with nothing to say still costs the turn', () => {
    const game = newGame(pack, 7);
    const result = step(game, { kind: 'look', object: 'walls' });
    expect(result.lines[0]).toEqual({ kind: 'idle', text: NOTHING_NEW });
    expect(result.game.state.turn).toBe(game.state.turn + 1);
  });

  it('an open place answers at the tier the presence is on, and closes', () => {
    const game = opened(newGame(pack, 7), 'walls');
    const result = step(game, { kind: 'look', object: 'walls' });
    expect(result.lines[0]!.text).toBe(pack.below!.walls!.veiled);
    expect(result.game.state.flags['subject.walls.open']).toBe(false);
    expect(result.game.state.flags['subject.walls.seen.veiled']).toBe(true);
  });

  it('the same place answers differently once lucidity has moved', () => {
    const first = step(opened(newGame(pack, 7), 'walls'), { kind: 'look', object: 'walls' }).game;
    expect(first.state.flags['subject.walls.seen.plain']).toBeUndefined();

    // Two belongings' worth of knowing yourself: the walls have not spoken at
    // this tier, so they are a candidate again and they say something else.
    const later = step(opened(lucid(first, 0.6), 'walls'), { kind: 'look', object: 'walls' });
    expect(later.lines[0]!.text).toBe(pack.below!.walls!.plain);
    expect(later.game.state.flags['subject.walls.seen.plain']).toBe(true);
  });

  it('the named tier is reachable', () => {
    const game = opened(lucid(newGame(pack, 7), 0.8), 'silt');
    expect(step(game, { kind: 'look', object: 'silt' }).lines[0]!.text).toBe(pack.below!.silt!.named);
  });

  it('a place cannot be asked while somebody is at the rim', () => {
    const idle = opened(newGame(pack, 7), 'sky');
    const inScene: Game = {
      ...idle,
      mode: { kind: 'scene', scene: scenes[0]!.id, ctx: { pressure: 0, resonance: null, beatIndex: 0 } },
    };
    const result = step(inScene, { kind: 'look', object: 'sky' });
    expect(result.lines[0]!.text).toMatch(/somebody up there/);
    // Held, not spent: the scene is why you missed it, so it is still there.
    expect(result.game.state.flags['subject.sky.open']).toBe(true);
  });

  it('the cold is never opened — it has no place to be asked from', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let game = found(newGame(pack, seed), 'ring', 'whistle', 'knife', 'coat');
      for (const id of ['ring', 'whistle', 'knife', 'coat']) {
        game = play(step(game, { kind: 'look', object: id }).game, wait(6));
      }
      expect(game.state.presence.lucidity).toBeGreaterThan(0);
      expect(game.state.flags['subject.cold.queued']).toBeUndefined();
      expect(game.state.flags['subject.cold.open']).toBeUndefined();
    }
  });
});

describe('the stop', () => {
  it('a fresh run is open', () => {
    expect(runStatus(newGame(pack, 21)).kind).toBe('open');
  });

  it('a run where the player does nothing runs out of world', () => {
    let game = newGame(pack, 21);
    for (let i = 0; i < 200; i++) game = step(game, { kind: 'wait' }).game;
    // it used to sit in `stalled` forever announcing itself
    expect(game.mode.kind).toBe('over');
  });

  it('stalled is not quiet: the gates are shut, not gone', () => {
    let game = newGame(pack, 21);
    for (let i = 0; i < 8; i++) game = step(game, { kind: 'wait' }).game;
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

  it('a played-out run reaches an ending, and is told it exactly once', () => {
    const rng = makeRng(13);
    let game = newGame(pack, 0);
    let codas = 0;
    for (let t = 0; t < 120; t++) {
      const result = step(game, choose(game, pack, 'mixed', rng.next()));
      game = result.game;
      if (result.lines.some((l) => l.kind === 'coda')) codas++;
    }
    expect(game.mode.kind).toBe('over');
    expect(codas).toBe(1);
  });
});

describe('the coda', () => {
  const playOut = (seed: number, policy: 'idle' | 'mixed' = 'mixed'): Game => {
    const rng = makeRng(seed * 7919 + 13);
    let game = newGame(pack, seed);
    for (let t = 0; t < 160 && game.mode.kind !== 'over'; t++) {
      game = step(game, choose(game, pack, policy, rng.next())).game;
    }
    return game;
  };

  it('every run ends, and ends only once', () => {
    for (const seed of [0, 1, 5, 13, 42]) {
      const game = playOut(seed);
      expect(game.mode.kind, `seed ${seed} never ended`).toBe('over');
      // a finished run is finished: the controls exist and do nothing
      const after = step(game, { kind: 'haunt' });
      expect(after.lines).toHaveLength(0);
      expect(after.game).toBe(game);
    }
  });

  it('a run where nobody ever comes starves rather than hanging', () => {
    const game = playOut(21, 'idle');
    expect(game.mode.kind).toBe('over');
    if (game.mode.kind === 'over') expect(game.mode.door).toBe('starved');
  });

  it('is composed, not chosen: spine, then what else is true, then the verdict, then you', () => {
    const fresh = newGame(pack, 1).state;
    const base = { ...fresh, history: [{ scene: 'first-water', outcome: 'quiet', turn: 3 }] };
    const ctx = { state: base, door: 'starved' as const, verdict: null, tier: 'veiled' as const };
    const bare = resolveCoda(pack.coda!, ctx).lines;
    // spine + verdict + close, with no clauses true in a fresh world
    expect(bare).toHaveLength(3);
    expect(bare.every((l) => l.kind === 'coda')).toBe(true);

    // a fact that changes the ending outright adds to it rather than replacing it
    const withBody = { ...ctx, state: { ...base, flags: { 'body-found': true } } };
    expect(resolveCoda(pack.coda!, withBody).lines).toHaveLength(4);

    // and a village that was never given anything to tell says nothing at all
    expect(resolveCoda(pack.coda!, { ...ctx, state: fresh }).lines).toHaveLength(2);
  });

  it('says nothing the presence never worked out', () => {
    const base = newGame(pack, 1).state;
    const ctx = { state: base, door: 'starved' as const, verdict: null };
    const veiled = resolveCoda(pack.coda!, { ...ctx, tier: 'veiled' }).lines.at(-1)!.text;
    const named = resolveCoda(pack.coda!, { ...ctx, tier: 'named' }).lines.at(-1)!.text;
    expect(veiled).not.toEqual(named);
    // the veiled close cannot name her, and no close may use the word
    expect(veiled.toLowerCase()).not.toMatch(/\bshe\b/);
    for (const tier of ['veiled', 'plain', 'named'] as const) {
      expect(resolveCoda(pack.coda!, { ...ctx, tier }).lines.at(-1)!.text.toLowerCase()).not.toMatch(/\bdead\b|\bdied\b/);
    }
  });

  it('being forgotten takes the words back as it says them', () => {
    const forgotten = (seed: number) => {
      let game = newGame(pack, seed);
      let coda: string[] = [];
      for (let t = 0; t < 200 && game.mode.kind !== 'over'; t++) {
        const result = step(game, { kind: 'wait' });
        game = result.game;
        const said = result.lines.filter((l) => l.kind === 'coda');
        if (said.length) coda = said.map((l) => l.text);
      }
      return { game, coda };
    };

    const { game, coda } = forgotten(21);
    if (game.mode.kind !== 'over') throw new Error('never ended');
    expect(game.mode.spine).toBe('forgotten');

    // whatever it had worked out about itself goes first
    expect(game.state.presence.lucidity).toBe(0);

    // the words come apart as they are read — more of them, further in
    const authored = pack.coda!.spines.find((s) => s.id === 'forgotten')!.text;
    expect(coda[0]).not.toEqual(authored);
    const holes = (s: string) => (s.match(/ {2,}/g) ?? []).length / s.length;
    expect(holes(coda.at(-1)!)).toBeGreaterThan(holes(coda[0]!));

    // still a seeded run: the same seed comes apart the same way
    expect(forgotten(21).coda).toEqual(coda);
  });

  it('never hands over a belonging the player did not go and find', () => {
    // Below `named` a close may say how many there were but never which: the
    // one that was missed cannot arrive in the ending for free.
    const base = newGame(pack, 1).state;
    const ctx = { state: base, door: 'starved' as const, verdict: null };
    const names = pack.objects.map((o) => o.id);

    for (const tier of ['veiled', 'plain'] as const) {
      const close = resolveCoda(pack.coda!, { ...ctx, tier }).lines.at(-1)!.text.toLowerCase();
      for (const name of names) {
        expect(close, `the ${tier} close names the ${name}`).not.toContain(name);
      }
    }
  });

  it('needs a margin before it says the village decided anything', () => {
    const base = newGame(pack, 1).state;
    const tied = { ...base, beliefs: { ...base.beliefs, haunted: 0.4, tragedy: 0.35 } };
    expect(verdictOf(tied)).toBeNull();
    const decided = { ...base, beliefs: { ...base.beliefs, haunted: 0.6, tragedy: 0.2 } };
    expect(verdictOf(decided)).toBe('haunted');
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
    expect(after.people.anna!.emotions.fear).toBeGreaterThan(base.people.anna!.emotions.fear);
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

describe('the village, said back', () => {
  const idle = (game: Game): Game => ({ ...game, mode: { kind: 'idle' } });
  const lines = new Set([
    ...Object.values(pack.readout!.beliefs).flat(),
    ...pack.readout!.attention.flat(),
    ...pack.readout!.dread.flat(),
  ]);

  /** Every reading heard came out of this band, and the band did speak. */
  const onlyFrom = (heard: Set<string>, band: readonly string[]): void => {
    expect(heard.size).toBeGreaterThan(0);
    expect([...heard].filter((line) => !band.includes(line))).toEqual([]);
  };

  it('says nothing about a village that has not decided anything', () => {
    let game = idle(newGame(pack, 5));
    for (let i = 0; i < 20; i++) {
      const { game: next, lines: said } = step(game, { kind: 'wait' });
      game = next;
      expect(said.filter((l) => lines.has(l.text))).toEqual([]);
    }
  });

  it('reads the loudest quality once, not every turn', () => {
    let game = idle(newGame(pack, 5));
    game = { ...game, state: applyEffects(game.state, [{ kind: 'belief', belief: 'tragedy', delta: 0.5 }]) };
    // Said when it is news, and after a scene it is news again — but never on
    // two turns running, or it stops being a reading and becomes weather.
    let heard = 0;
    let last = false;
    for (let i = 0; i < 20; i++) {
      const { game: next, lines: said } = step(game, { kind: 'wait' });
      game = next;
      const now = said.some((l) => pack.readout!.beliefs.tragedy.includes(l.text));
      expect(now && last).toBe(false);
      last = now;
      if (now) heard++;
    }
    expect(heard).toBeGreaterThan(0);
  });

  const heardOver = (game: Game, turns: number): Set<string> => {
    const said = new Set<string>();
    let next = game;
    for (let i = 0; i < turns; i++) {
      const result = step(next, { kind: 'wait' });
      next = result.game;
      for (const line of result.lines) if (lines.has(line.text)) said.add(line.text);
    }
    return said;
  };

  it('says they are thinking about it while they have decided nothing', () => {
    const start = idle(newGame(pack, 5));
    const game = { ...start, state: applyEffects(start.state, [{ kind: 'well', field: 'attention', delta: 0.3 }]) };
    onlyFrom(heardOver(game, 20), pack.readout!.attention[0]);
  });

  it('says what they believe instead, as soon as they believe it', () => {
    const start = idle(newGame(pack, 5));
    const game = {
      ...start,
      state: applyEffects(start.state, [
        { kind: 'well', field: 'attention', delta: 0.3 },
        { kind: 'belief', belief: 'tragedy', delta: 0.5 },
      ]),
    };
    // The dial is still up, and is outranked for as long as they have a story.
    onlyFrom(heardOver(game, 20), pack.readout!.beliefs.tragedy);
  });

  it('a loud dial outranks the belief again', () => {
    const start = idle(newGame(pack, 5));
    const game = {
      ...start,
      state: applyEffects(start.state, [
        { kind: 'well', field: 'dread', delta: 0.9 },
        { kind: 'belief', belief: 'tragedy', delta: 0.5 },
      ]),
    };
    onlyFrom(heardOver(game, 20), pack.readout!.dread[1]);
  });

  /**
   * A scene one beat from resolving, with a village that already has something
   * to say, so the only thing under test is whether the outcome lets it.
   */
  const closing = (seed: number, pressure: number): Game => {
    const start = newGame(pack, seed);
    const scene = scenes.find((s) => s.id === 'first-water')!;
    return {
      ...start,
      state: applyEffects(start.state, [{ kind: 'belief', belief: 'tragedy', delta: 0.5 }]),
      mode: {
        kind: 'scene',
        scene: scene.id,
        ctx: { pressure, resonance: null, beatIndex: scene.beats.length - 1 },
      },
    };
  };

  const saidOnClose = (seed: number, pressure: number): boolean =>
    step(closing(seed, pressure), { kind: 'wait' }).lines.some((l) => lines.has(l.text));

  it('speaks on the beat an outcome moves the village', () => {
    // Heavy pressure takes `terrified`, which moves a belief and both dials.
    const heard = Array.from({ length: 200 }, (_, seed) => saidOnClose(seed, 0.9)).filter(Boolean).length;
    expect(heard).toBeGreaterThan(120);
    expect(heard).toBeLessThan(180);
  });

  it('says nothing when the outcome moved nobody', () => {
    // No pressure and no resonance takes `quiet`, whose effects are empty.
    for (let seed = 0; seed < 200; seed++) expect(saidOnClose(seed, 0)).toBe(false);
  });

  it('does not repeat itself on the turn after an outcome', () => {
    for (let seed = 0; seed < 60; seed++) {
      const closed = step(closing(seed, 0.9), { kind: 'wait' });
      if (!closed.lines.some((l) => lines.has(l.text))) continue;
      const said = closed.lines.filter((l) => lines.has(l.text)).map((l) => l.text);
      const next = step(closed.game, { kind: 'wait' }).lines.map((l) => l.text);
      for (const line of said) expect(next).not.toContain(line);
    }
  });
});

describe('hiding under the coat', () => {
  /** An idle rim, the coat known, and whoever is coming very likely to come. */
  const ready = (seed: number): Game => {
    const start = found(newGame(pack, seed), 'coat');
    return {
      ...start,
      mode: { kind: 'idle' },
      state: {
        ...start.state,
        presence: { ...start.state.presence, lucidity: 0.6 },
        well: { ...start.state.well, attention: 1 },
        objects: { ...start.state.objects, coat: { ...start.state.objects['coat']!, discovered: true } },
      },
    };
  };

  it('misses whoever came, and costs a discovery', () => {
    // The coat is the one belonging that reaches outside a scene, and it does
    // it on the beat it is pulled over you — not for as long as it is worn,
    // because it is not worn for any length of time any more.
    let hid = false;
    for (const seed of [1, 3, 5, 8, 11, 21, 42]) {
      let game = ready(seed);
      for (let i = 0; i < 3 && game.mode.kind === 'idle' && !hid; i++) {
        const before = game.state.presence.lucidity;
        const { game: next, lines } = step(game, { kind: 'attune', object: 'coat' });
        game = next;
        if (!lines.some((l) => pack.hiding!.includes(l.text))) continue;
        hid = true;
        expect(game.mode.kind, `seed ${seed} hid and let the scene start anyway`).not.toBe('scene');
        expect(game.state.presence.lucidity).toBeLessThan(before);
      }
      if (hid) break;
    }
    expect(hid, 'the coat never hid anything').toBe(true);
  });

  it('spends the scene it is used inside, and withholds only the outcome', () => {
    // Hiding is not skipping. Whatever the living were going to do, they did:
    // the scene resolves where it stands and goes into the history, so it
    // cannot be drawn again. The player is only kept from watching.
    const start = found(newGame(pack, 5), 'coat');
    const game: Game = {
      ...start,
      state: {
        ...start.state,
        objects: { ...start.state.objects, coat: { ...start.state.objects['coat']!, discovered: true } },
      },
      mode: { kind: 'scene', scene: 'first-water', ctx: { pressure: 0, resonance: null, beatIndex: 0 } },
    };
    const { game: after, lines } = step(game, { kind: 'attune', object: 'coat' });

    expect(after.state.history.map((h) => h.scene)).toEqual(['first-water']);
    expect(after.mode.kind).not.toBe('scene');
    expect(lines.some((l) => pack.hiding!.includes(l.text)), 'the coat did not say it hid').toBe(true);

    const outcomes = scenes.find((s) => s.id === 'first-water')!.outcomes;
    const spoken = outcomes.map((o) => o.text(after.state, { pressure: 0, resonance: null, beatIndex: 0 }));
    expect(lines.some((l) => spoken.includes(l.text)), 'the outcome was narrated anyway').toBe(false);
  });

  it('an unhidable scene plays its remaining beats out', () => {
    const start = found(newGame(pack, 5), 'coat');
    const hearing = scenes.find((s) => s.unhidable)!;
    const game: Game = {
      ...start,
      state: {
        ...start.state,
        objects: { ...start.state.objects, coat: { ...start.state.objects['coat']!, discovered: true } },
      },
      mode: { kind: 'scene', scene: hearing.id, ctx: { pressure: 0, resonance: null, beatIndex: 0 } },
    };
    const { game: after } = step(game, { kind: 'attune', object: 'coat' });
    expect(after.mode.kind).toBe('scene');
    expect(after.state.history).toHaveLength(0);
  });

  it('hides only the beat it is used on', () => {
    // A beat that does not reach for the coat is a beat the well is open on.
    for (const seed of [1, 3, 5, 8, 11, 21, 42]) {
      let game = ready(seed);
      game = step(game, { kind: 'attune', object: 'coat' }).game;
      for (let i = 0; i < 8 && game.mode.kind === 'idle'; i++) {
        const { game: next, lines } = step(game, { kind: 'wait' });
        game = next;
        expect(lines.some((l) => pack.hiding!.includes(l.text)), `seed ${seed} went on hiding`).toBe(false);
      }
    }
  });
});

/**
 * The caption over a line: which of the nine is speaking. The register says
 * how loud a line is; this says who it is about, so a belonging's prose stops
 * arriving from nowhere.
 */
describe('who is speaking', () => {
  it('a place answers under its own name', () => {
    const result = step(opened(newGame(pack, 7), 'walls'), { kind: 'look', object: 'walls' });
    expect(result.lines[0]!.subject).toBe('the walls');
  });

  it('a belonging is named through the whole of a use', () => {
    let game = found(newGame(pack, 3), 'ring');

    const looked = step(game, { kind: 'look', object: 'ring' });
    expect(looked.lines[0]!.subject).toBe('the brass ring');
    game = looked.game;

    // Taking it up and setting it down are both the ring's own prose, wherever
    // the beat puts them — in a scene the answering beat falls between the two.
    const used = step(game, { kind: 'attune', object: 'ring' });
    const spoken = used.lines.filter((l) => l.subjectId === 'ring');
    expect(spoken.map((l) => l.subject)).toEqual(['the brass ring', 'the brass ring']);
  });

  it('a glimpse has no name yet', () => {
    // The silt gives something up on a press that lands. Whatever comes back
    // is a shape, so nothing in that turn may be captioned.
    for (let seed = 1; seed < 30; seed++) {
      let game = newGame(pack, seed);
      for (let i = 0; i < 20; i++) {
        const { game: next, lines } = step(game, { kind: i % 3 === 2 ? 'haunt' : 'wait' });
        game = next;
        const glimpsed = lines.find((l) =>
          Object.values(pack.below!).some((s) => s.glimpse !== undefined && s.glimpse === l.text),
        );
        if (glimpsed) {
          expect(glimpsed.subject).toBeUndefined();
          return;
        }
      }
    }
    throw new Error('the silt never gave anything up');
  });

  it('the presence talking about itself stays headless', () => {
    const game = found(newGame(pack, 3), 'ring');
    // A refusal is the presence's own voice, not the ring's.
    expect(step(game, { kind: 'attune', object: 'ring' }).lines[0]!.subject).toBeUndefined();
    // So is an empty turn, and so is a place with nothing to say.
    expect(step(newGame(pack, 7), { kind: 'look', object: 'walls' }).lines[0]!.subject).toBeUndefined();
  });

  it('every belonging can be told apart before it has been looked at', () => {
    const glimpseNames = pack.objects.map((o) => pack.below![o.id]!.glimpseName);
    expect(glimpseNames.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
    expect(new Set(glimpseNames).size).toBe(pack.objects.length);
  });
});
