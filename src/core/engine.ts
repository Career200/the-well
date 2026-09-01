import { applyEffects } from './effects.js';
import type { Effect } from './effects.js';
import { makeRng, pickWeighted } from './rng.js';
import type { Rng } from './rng.js';
import { resolveOutcome } from './scene.js';
import type { Scene, SceneContext } from './scene.js';
import { initWorld } from './content.js';
import type { ContentPack, ObjectDef } from './content.js';
import { advanceBelow, fillSilence, lookBelow, startBelow, unsaid } from './below.js';
import type { BelowEvent, BelowPhase } from './below.js';
import { BELIEF_OF_EMOTION, BELIEFS } from './types.js';
import type { NarrationLine, ObjectId, SceneId, Stance, WorldState } from './types.js';

/**
 * Three stances and one glance. `still`, `haunt` and `attune` each *are* a
 * stance — choosing one is the whole input, and choosing the one you are
 * already in is how you go on doing it. `wait` is the same thing said with no
 * hands: let whatever is happening go on. `look` is not a stance and costs
 * nothing; it is how a thing down here becomes a thing you can hold.
 */
export type PlayerAction =
  | { kind: 'wait' }
  | { kind: 'still' }
  | { kind: 'haunt' }
  | { kind: 'attune'; object: ObjectId }
  | { kind: 'look'; object: ObjectId };

/**
 * Set by the first press that actually lands. Nothing in the simulation reads
 * it; it is what the presentation hangs the world coming into view on, so that
 * a run in which the presence never once acts stays dark.
 */
export const HAS_PRESSED = 'presence.has-pressed';

/** Set by the first refusal, so the one that states the rule is only said once. */
const HAS_BEEN_REFUSED = 'presence.has-been-refused';

/**
 * Pushing with nothing left. Three, because in beat zero the cells push too
 * and a player finding that out will hit this several times in a row — one
 * line said three times reads as a broken button, and no line at all reads as
 * a broken game.
 *
 * The first states the rule and is only ever said once; the others are the
 * same fact without the instruction, because being told twice how to play is
 * worse than not being told at all.
 */
const TOO_THIN = [
  'Nothing happens. You are too thin. You have to be still for a while first.',
  'You try again. The water does not even notice.',
  'Nothing moves. Not the water, and not you.',
];

/**
 * What a turn says when everything it had to say has already been said. Beat
 * zero never repeats itself, and a click that narrates nothing at all reads as
 * a dead control — so the turn admits there is nothing new here and leaves the
 * player to work out that they already have what this was going to give them.
 *
 * Exempt from the no-repeat rule, deliberately: it is the one thing down here
 * allowed to be said over and over.
 */
export const NOTHING_NEW = '…';

const scene = (text: string): NarrationLine => ({ kind: 'scene', text });
const fact = (text: string): NarrationLine => ({ kind: 'fact', text });
const idle = (text: string): NarrationLine => ({ kind: 'idle', text });
const system = (text: string): NarrationLine => ({ kind: 'system', text });

export type Mode =
  | { kind: 'idle' }
  | { kind: 'scene'; scene: SceneId; ctx: SceneContext }
  /** Beat zero. See `core/below.ts`. Disposable once the deck exists. */
  | { kind: 'below'; phase: BelowPhase };

export interface Game {
  pack: ContentPack;
  state: WorldState;
  mode: Mode;
  rng: Rng;
}

export interface StepResult {
  game: Game;
  /** Narration for this step, already ordered, each line carrying its register. */
  lines: NarrationLine[];
}

/**
 * Tunables. Kept together so pacing can be felt out in one place.
 *
 * Two resources with different time signatures. Presence is renewable and pays
 * for pressing: it is the within-scene resource, and a full bar buys exactly two
 * presses, which is exactly `UNDENIABLE`. Belongings are finite and pay for
 * holding: they never come back, so they are the across-run resource.
 */
export const TUNING = {
  /** Recovered per turn spent still. Nothing else recovers presence. */
  stillness: 0.14,
  /** Presence burned per turn spent pressing. A full bar does not last a scene. */
  pressCost: 0.34,
  /** Pressure added per turn of pressing inside a scene. */
  pressure: 0.3,
  /** Object charge burned per turn spent holding it. Never regained. */
  holdCost: 0.07,
  /** Below this a belonging cannot be taken up again. */
  spent: 0.05,
  lucidityPerDiscovery: 0.2,
  /**
   * The first press, and only the first. Pushing is the one act that tells the
   * presence it is a thing that can act at all, so it is worth a sliver of
   * knowing itself — and it is the sliver everything visible is hung off.
   */
  lucidityFirstPress: 0.02,
  /** Base chance per idle turn that someone comes to the well. */
  sceneChance: 0.35,
};

/**
 * `below` is opt-in rather than the default: `sim/policies.ts` and the
 * reachability sweep instantiate games in bulk against a fixed turn budget,
 * and beat zero has nothing for a policy that only knows `scene`/`idle` to
 * do with it. CLI and web play pass `{ below: true }`.
 */
export function newGame(pack: ContentPack, seed: number, opts?: { below?: boolean }): Game {
  const rng = makeRng(seed);
  const belongingIds = pack.objects.map((o) => o.id);
  const mode: Mode =
    opts?.below && belongingIds.length >= 2
      ? { kind: 'below', phase: startBelow(() => rng.next(), belongingIds) }
      : { kind: 'idle' };
  return { pack, state: initWorld(pack, seed), mode, rng };
}

const objectDef = (game: Game, id: ObjectId): ObjectDef | undefined => game.pack.objects.find((o) => o.id === id);

const withState = (game: Game, state: WorldState): Game => ({ ...game, state });

const setStance = (game: Game, stance: Stance): Game =>
  withState(game, { ...game.state, presence: { ...game.state.presence, stance } });

/** Strength a belonging carries for the people currently in a given scene. */
export function resonanceStrength(game: Game, def: ObjectDef, cast: readonly string[]): number {
  const charge = game.state.objects[def.id]?.charge ?? 0;
  const affinity = Math.max(0, ...cast.map((p) => def.affinity[p] ?? 0.1));
  return def.power * affinity * charge;
}

export function eligibleScenes(game: Game): Scene[] {
  const { state } = game;
  return game.pack.scenes.filter((scene) => {
    if (!scene.repeatable && state.history.some((h) => h.scene === scene.id)) return false;
    if (!scene.cast.every((p) => state.people[p]?.present)) return false;
    return scene.requires ? scene.requires(state) : true;
  });
}

function maybeStartScene(game: Game): { game: Game; lines: NarrationLine[] } {
  const candidates = eligibleScenes(game);
  if (candidates.length === 0) return { game, lines: [] };

  const chance = TUNING.sceneChance + game.state.well.attention * 0.4;
  if (game.rng.next() > chance) return { game, lines: [] };

  const picked = pickWeighted(game.rng, candidates, (s) => Math.max(0.0001, s.weight?.(game.state) ?? 1));
  if (!picked) return { game, lines: [] };

  const ctx: SceneContext = { pressure: 0, resonance: heldResonance(game), beatIndex: 0 };
  const next: Game = { ...game, mode: { kind: 'scene', scene: picked.id, ctx } };
  const first = picked.beats[0];
  return { game: next, lines: first ? [scene(first.text(next.state, ctx))] : [] };
}

/**
 * Resonance survives from idle into a scene — you set the mood before they
 * arrive, and pay for the waiting out of the belonging itself.
 */
function heldResonance(game: Game): SceneContext['resonance'] {
  const { stance } = game.state.presence;
  if (stance.kind !== 'holding') return null;
  const def = objectDef(game, stance.object);
  if (!def) return null;
  return { object: def.id, emotion: def.emotion, strength: def.power * (game.state.objects[def.id]?.charge ?? 0) };
}

export function step(game: Game, action: PlayerAction): StepResult {
  const before = runStatus(game).kind;
  const lines: NarrationLine[] = [];
  let next: Game = withState(game, { ...game.state, turn: game.state.turn + 1 });

  // 1. An action only ever sets a stance, or looks at something. `wait` leaves
  //    the stance alone and lets it cost.
  // Recovery is the turn's, not the stance's: being still while doing something
  // else is not being still. One rule, and the player can feel all of it.
  let gathering = action.kind === 'wait';

  switch (action.kind) {
    case 'wait':
      break;
    case 'still': {
      // Choosing stillness *is* gathering. Arriving at it and having been in
      // it are the same turn's worth, or the player cannot form the rule.
      gathering = true;
      if (next.state.presence.stance.kind === 'still') {
        // Going on being still is the default, and the default says nothing.
        // The turn still passes and the water still settles.
      } else {
        lines.push(fact('You let it go. The cold comes back in around the shape of it.'));
        next = setStance(next, { kind: 'still' });
        if (next.mode.kind === 'scene') next.mode = { ...next.mode, ctx: { ...next.mode.ctx, resonance: null } };
      }
      break;
    }
    case 'look': {
      const def = objectDef(next, action.object);
      if (!def) {
        lines.push(fact('There is nothing like that down here.'));
        break;
      }
      if (next.mode.kind === 'below') {
        const phase = lookBelow(next.mode.phase, def.id);
        if (!phase) {
          lines.push(fact('There is nothing to see there yet.'));
          break;
        }
        lines.push(fact(next.pack.below?.[def.id]?.plain ?? def.look));
        next = { ...next, mode: { kind: 'below', phase } };
      } else {
        lines.push(fact(def.look));
      }
      const wasNew = !next.state.objects[def.id]?.discovered;
      next = withState(
        next,
        applyEffects(next.state, [
          { kind: 'object', object: def.id, field: 'discovered', value: true },
          ...(wasNew ? [{ kind: 'presence' as const, field: 'lucidity' as const, delta: TUNING.lucidityPerDiscovery }] : []),
        ]),
      );
      break;
    }
    case 'attune': {
      const def = objectDef(next, action.object);
      const obj = def ? next.state.objects[def.id] : undefined;
      if (!def || !obj) {
        lines.push(fact('There is nothing like that down here.'));
        break;
      }
      if (!obj.discovered) {
        lines.push(fact('You cannot hold on to a thing you have not yet looked at.'));
        break;
      }
      if (obj.charge <= TUNING.spent) {
        lines.push(fact('It is quiet now. Whatever was in it has gone out, and it is not coming back.'));
        break;
      }
      if (next.state.presence.stance.kind === 'holding' && next.state.presence.stance.object === def.id) break;
      next = setStance(next, { kind: 'holding', object: def.id });
      lines.push(fact(`You gather yourself around the ${def.name}. It remembers more than you do.`));
      break;
    }
    case 'haunt': {
      if (next.state.presence.charge < TUNING.pressCost) {
        const taught = next.state.flags[HAS_BEEN_REFUSED] === true;
        lines.push(fact(taught ? TOO_THIN[1 + (next.state.turn % 2)]! : TOO_THIN[0]!));
        if (!taught) {
          next = withState(next, applyEffects(next.state, [{ kind: 'flag', flag: HAS_BEEN_REFUSED, value: true }]));
        }
        break;
      }
      if (next.state.presence.stance.kind !== 'pressing') {
        next = setStance(next, { kind: 'pressing' });
      }
      break;
    }
  }

  // 2. The stance costs, or recovers, once per turn. This is the whole economy.
  const ticked = tick(next, gathering);
  next = ticked.game;
  lines.push(...ticked.lines);

  // 3. Only then does the world get its turn.
  let result: StepResult;
  if (next.mode.kind === 'scene') {
    result = advanceScene(next, lines);
  } else if (next.mode.kind === 'below') {
    const pressedThisTurn = next.state.presence.stance.kind === 'pressing';
    result = advanceBelowMode(next, lines, { pressedThisTurn, exhaustedThisTurn: ticked.exhausted === true });
  } else {
    const started = maybeStartScene(next);
    if (started.lines.length === 0 && lines.length === 0) lines.push(ambient(next));
    result = { game: started.game, lines: [...lines, ...started.lines] };
  }

  const after = runStatus(result.game).kind;
  if (after !== before) {
    if (after === 'stalled') result.lines.push(system(STALLED_LINE));
    if (after === 'quiet') result.lines.push(system(QUIET_LINE));
  }
  return result;
}

/**
 * One rule, no exceptions: stillness is the only thing that recovers presence.
 * Looking does not, releasing does not, holding does not. A player has to be
 * able to tell where their charge comes from without being told.
 */
function tick(game: Game, gathering: boolean): { game: Game; lines: NarrationLine[]; exhausted?: boolean } {
  const { stance } = game.state.presence;

  if (stance.kind === 'still') {
    if (!gathering) return { game, lines: [] };
    return {
      game: withState(game, applyEffects(game.state, [{ kind: 'presence', field: 'charge', delta: TUNING.stillness }])),
      lines: [],
    };
  }

  if (stance.kind === 'pressing') {
    if (game.state.presence.charge < TUNING.pressCost) {
      return {
        game: setStance(game, { kind: 'still' }),
        lines: [fact('It goes out of you all at once. There is nothing left to push with.')],
        exhausted: true,
      };
    }
    const first = !game.state.flags[HAS_PRESSED];
    let next = withState(
      game,
      applyEffects(game.state, [
        { kind: 'presence', field: 'charge', delta: -TUNING.pressCost },
        { kind: 'well', field: 'dread', delta: 0.04 },
        ...(first
          ? [
              { kind: 'flag' as const, flag: HAS_PRESSED, value: true },
              { kind: 'presence' as const, field: 'lucidity' as const, delta: TUNING.lucidityFirstPress },
            ]
          : []),
      ]),
    );
    if (next.mode.kind === 'scene') {
      next = { ...next, mode: { ...next.mode, ctx: { ...next.mode.ctx, pressure: next.mode.ctx.pressure + TUNING.pressure } } };
      return { game: next, lines: [scene('You push. The water goes wrong for a moment; the sound of it climbs the wall.')] };
    }
    if (next.mode.kind === 'below') {
      return { game: next, lines: [fact('The water answers. It is the only thing down here that does.')] };
    }
    return { game: next, lines: [fact('You push against nothing at all. The dark takes it without comment.')] };
  }

  const def = objectDef(game, stance.object);
  const obj = def ? game.state.objects[def.id] : undefined;
  if (!def || !obj || obj.charge <= TUNING.spent) {
    return {
      game: setStance(game, { kind: 'still' }),
      lines: [fact('It goes cold in your hands, and stays cold. There was only ever so much of it.')],
    };
  }

  let next = withState(game, applyEffects(game.state, [{ kind: 'objectCharge', object: def.id, delta: -TUNING.holdCost }]));
  if (next.mode.kind === 'scene') {
    const scene = sceneById(next, next.mode.scene);
    const strength = resonanceStrength(next, def, scene?.cast ?? []);
    next = {
      ...next,
      mode: { ...next.mode, ctx: { ...next.mode.ctx, resonance: { object: def.id, emotion: def.emotion, strength } } },
    };
  }
  return { game: next, lines: [] };
}

/**
 * Beat zero. `maybeStartScene` never runs while this mode holds — the run
 * does not begin until the light crosses (`BEAT_ZERO.md`, "ending").
 */
function advanceBelowMode(
  game: Game,
  lines: NarrationLine[],
  input: { pressedThisTurn: boolean; exhaustedThisTurn: boolean },
): StepResult {
  if (game.mode.kind !== 'below') return { game, lines };

  if (input.exhaustedThisTurn) lines.push(...(game.pack.belowProse?.exhaustionExtra ?? []).map(fact));

  const { phase, events } = advanceBelow(game.mode.phase, {
    presenceCharge: game.state.presence.charge,
    pressedThisTurn: input.pressedThisTurn,
    exhaustedThisTurn: input.exhaustedThisTurn,
  });

  let next: Game = { ...game, mode: { kind: 'below', phase } };
  let ended = false;
  for (const event of events) {
    lines.push(...belowEventLines(next, event));
    if (event.kind === 'end') ended = true;
  }

  // Nothing is said twice down here. The guard covers every source at once —
  // the stance lines from `tick`, the subjects, the transitions — because it
  // filters the finished turn rather than each place that writes one.
  const guard = unsaid(phase, lines.map((line) => line.text));
  let fresh = lines.filter((_, i) => guard.keep[i]);
  const swallowed = lines.length > 0 && fresh.length === 0;

  // A run of silent turns eventually says something about the dark — but not
  // every gap, because down here the water answers on its own.
  const silence = fillSilence(guard.phase, fresh.length > 0);
  let settled = silence.phase;
  if (silence.speak) {
    const pool = (next.pack.belowProse?.settling ?? []).filter((line) => !settled.said.includes(line));
    const line = pool[Math.floor(next.rng.next() * pool.length)];
    if (line) {
      fresh = [...fresh, idle(line)];
      settled = { ...settled, said: [...settled.said, line] };
    }
  } else if (swallowed) {
    // Everything this turn had was already said. Say so, rather than nothing.
    fresh = [idle(NOTHING_NEW)];
  }

  next = { ...next, mode: ended ? { kind: 'idle' } : { kind: 'below', phase: settled } };
  return { game: next, lines: fresh };
}

function belowEventLines(game: Game, event: BelowEvent): NarrationLine[] {
  const subjects = game.pack.below ?? {};
  const prose = game.pack.belowProse;
  switch (event.kind) {
    case 'ambient':
      return subjects[event.subject] ? [fact(subjects[event.subject]!.veiled)] : [];
    case 'movement':
      return ((event.to === 2 ? prose?.toMovementII : event.to === 3 ? prose?.toMovementIII : undefined) ?? []).map(fact);
    case 'glimpse': {
      const subject = subjects[event.object];
      if (subject?.glimpse) return [fact(subject.glimpse)];
      const def = objectDef(game, event.object);
      return def ? [fact(def.glimpse ?? def.name)] : [];
    }
    case 'end':
      return (prose?.lightCrossing ?? []).map(fact);
  }
}

const sceneById = (game: Game, id: SceneId): Scene | undefined => game.pack.scenes.find((s) => s.id === id);

function advanceScene(game: Game, lines: NarrationLine[]): StepResult {
  if (game.mode.kind !== 'scene') return { game, lines };
  const playing = sceneById(game, game.mode.scene);
  if (!playing) return { game: { ...game, mode: { kind: 'idle' } }, lines };

  const ctx: SceneContext = { ...game.mode.ctx, beatIndex: game.mode.ctx.beatIndex + 1 };
  const beat = playing.beats[ctx.beatIndex];

  if (beat) {
    lines.push(scene(beat.text(game.state, ctx)));
    return { game: { ...game, mode: { kind: 'scene', scene: playing.id, ctx } }, lines };
  }

  const outcome = resolveOutcome(playing, game.state, ctx);
  lines.push(scene(outcome.text(game.state, ctx)));
  const state = applyEffects(applyEffects(game.state, outcome.effects(game.state, ctx)), resonanceEffects(game, playing, ctx));
  return {
    game: {
      ...game,
      mode: { kind: 'idle' },
      state: { ...state, history: [...state.history, { scene: playing.id, outcome: outcome.id, turn: state.turn }] },
    },
    lines,
  };
}

/**
 * Resonance bleeds into everyone present regardless of what the scene's own
 * outcome did. This is the quiet channel: no phenomena, just a mood arriving.
 *
 * It has to move the *village*, not only the person — a mood people cannot
 * account for is talked about, and talk is what the late game reads.
 */
function resonanceEffects(game: Game, scene: Scene, ctx: SceneContext): Effect[] {
  if (!ctx.resonance) return [];
  const def = objectDef(game, ctx.resonance.object);
  if (!def) return [];

  const effects: Effect[] = [];
  let carried = 0;
  for (const person of scene.cast) {
    const delta = def.power * (def.affinity[person] ?? 0.1) * (game.state.objects[def.id]?.charge ?? 0);
    if (delta <= 0.01) continue;
    effects.push({ kind: 'emotion', person, emotion: def.emotion, delta });
    carried += delta;
  }
  if (carried <= 0.01) return effects;

  effects.push({ kind: 'belief', belief: BELIEF_OF_EMOTION[def.emotion], delta: carried * 0.5 });
  effects.push({ kind: 'well', field: 'attention', delta: carried * 0.3 });
  return effects;
}

function ambient(game: Game): NarrationLine {
  const pool = game.pack.ambient ?? ['Nothing. The stone sweats. Somewhere above, the light moves a hand-width.'];
  return idle(pool[Math.floor(game.rng.next() * pool.length)] ?? '');
}

// ---------------------------------------------------------------------------
// The stop
//
// Not an ending — there is no coda yet, and this is not it. This only answers
// "is anything still capable of happening", so a run can say so out loud
// instead of leaving the player waiting at the bottom of a finished world.
// ---------------------------------------------------------------------------

export const STALLED_LINE =
  'The light goes on moving. Nothing more is coming to the well while the well is what it is now.';

export const QUIET_LINE =
  'Nothing is coming that has not already come. The light will go on moving across the water, and that is all it will ever do now.';

/**
 * Three states, because two would lie. A world where the player has stopped the
 * story is not the same as a world that has finished telling it, and a run that
 * says "nothing will happen" when haunting once would open the next gate has
 * told the player something false.
 */
export type RunStatus =
  | { kind: 'open' }
  /** Nothing can fire from the world as it stands. Only the player can change that. */
  | { kind: 'stalled'; reason: string }
  /** Nothing can fire on any future this world can reach. */
  | { kind: 'quiet'; reason: string };

/**
 * Probe worlds for asking whether a gate *could* ever open. `requires` is an
 * arbitrary predicate, so this is a heuristic, not a proof: it tries the world
 * as it is, as good as it could get, and as bad. A gate satisfied by none of
 * the three is treated as shut for good.
 */
function probes(state: WorldState): WorldState[] {
  const padding = Array.from({ length: 32 }, (_, i) => ({ scene: '__probe', outcome: '__probe', turn: state.turn + i }));
  const best: WorldState = {
    ...state,
    presence: { ...state.presence, charge: 1, lucidity: 1 },
    well: { attention: 1, dread: 1 },
    beliefs: Object.fromEntries(BELIEFS.map((b) => [b, 1])) as WorldState['beliefs'],
    history: [...state.history, ...padding],
  };
  const worst: WorldState = {
    ...state,
    presence: { ...state.presence, charge: 0, lucidity: 0 },
    well: { attention: 0, dread: 0 },
    beliefs: Object.fromEntries(BELIEFS.map((b) => [b, 0])) as WorldState['beliefs'],
  };
  return [state, best, worst];
}

/** Could this scene still fire, on any future the world can reach from here? */
export function couldStillFire(game: Game, scene: Scene): boolean {
  const { state } = game;
  if (!scene.repeatable && state.history.some((h) => h.scene === scene.id)) return false;
  // Nobody comes back once they are out of play.
  if (!scene.cast.every((p) => state.people[p]?.present)) return false;
  if (!scene.requires) return true;
  return probes(state).some((probe) => scene.requires!(probe));
}

export function runStatus(game: Game): RunStatus {
  if (game.mode.kind === 'scene') return { kind: 'open' };
  if (eligibleScenes(game).length > 0) return { kind: 'open' };

  const played = new Set(game.state.history.map((h) => h.scene));
  const total = game.pack.scenes.length;
  const ever = game.pack.scenes.filter((scene) => couldStillFire(game, scene));

  if (ever.length === 0) {
    return {
      kind: 'quiet',
      reason:
        played.size === total
          ? 'every scene has played'
          : `${played.size} of ${total} scenes played; the rest can no longer be reached by anyone`,
    };
  }

  return {
    kind: 'stalled',
    reason: `${played.size} of ${total} scenes played; ${ever.length} still possible, but not from here`,
  };
}

export const isQuiet = (game: Game): boolean => runStatus(game).kind === 'quiet';
