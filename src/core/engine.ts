import { applyEffects } from './effects.js';
import type { Effect } from './effects.js';
import { makeRng, pickWeighted } from './rng.js';
import type { Rng } from './rng.js';
import { resolveOutcome } from './scene.js';
import type { Scene, SceneContext } from './scene.js';
import { initWorld } from './content.js';
import type { ContentPack, ObjectDef } from './content.js';
import { advanceBelow, BELOW_TUNING, eyesOpen, fillSilence, lookBelow, startBelow, tierOf, unsaid } from './below.js';
import { erode, resolveCoda, verdictOf } from './coda.js';
import type { CodaContext, Door } from './coda.js';
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
  /** `lastAmbient` so an empty turn never says twice what it just said. */
  | { kind: 'idle'; lastAmbient?: string }
  | { kind: 'scene'; scene: SceneId; ctx: SceneContext }
  /** Beat zero. See `core/below.ts`. Disposable once the deck exists. */
  | { kind: 'below'; phase: BelowPhase }
  /** The coda has been said. Nothing further is read, written or asked for. */
  | { kind: 'over'; door: Door; spine: string };

/**
 * Turns without a scene before a run that *could* still do something is
 * treated as having done nothing. This is starvation in miniature: the design
 * has attention decaying until nothing is dealable, the prototype has no
 * attention decay, and this stands in for it so the quiet run can still end.
 */
const STARVE_TURNS = 12;

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
  /**
   * Object charge burned per turn spent holding it. Never regained, and
   * deliberately the same as `pressCost`: a full presence bar buys two
   * presses, a belonging buys three holds, and both are gone. At 0.07 a
   * belonging lasted fourteen turns, which is long enough to spend without
   * thinking about it — and a resource you can spend without thinking is not
   * the across-run resource the design needs it to be.
   */
  holdCost: 0.34,
  /** Below this a belonging cannot be taken up again. */
  spent: 0.05,
  /**
   * Multiplier on what a hold actually does to the people above. Three holds
   * carry roughly a quarter of the charge fourteen did, so without this the
   * cost change quietly deletes resonance as a lever — the reachability sweep
   * catches it: `resonant` stops out-mourning `haunty`. Same total weight over
   * a run, delivered in three decisive acts instead of fourteen idle ones,
   * which is the regret the design is after.
   */
  resonanceGain: 3.5,
  lucidityPerDiscovery: 0.2,
  /**
   * The first press, and only the first. Pushing is the one act that tells the
   * presence it is a thing that can act at all, so it is worth a sliver of
   * knowing itself — and it is the sliver everything visible is hung off.
   */
  lucidityFirstPress: 0.02,
  /** Base chance per idle turn that someone comes to the well. */
  sceneChance: 0.35,
  /**
   * Chance that a press into the empty dark turns up another belonging. Beat
   * zero gives two; the rest are still in the silt and have to be pressed for,
   * on presence that could have been saved for whoever comes next. That is the
   * competition: knowing yourself is paid for out of the same bar as reaching
   * the living, and a thing never found is a tier of the ending never reached.
   */
  siltChance: 0.45,
};

/**
 * How many holds a belonging has already cost, from what is left of it. Only
 * holding drains charge, so the count is exact — and it is what the per-use
 * prose is indexed on, so a thing reads differently the third time than the
 * first without anything having to remember it separately.
 */
const usesSpent = (charge: number): number =>
  Math.min(3, Math.max(0, Math.round((1 - charge) / TUNING.holdCost)));

/**
 * Putting a thing down, in the words of the hold that just ended. Pressing is
 * let go of generically — there is nothing there to have cooled.
 */
function letGoOf(game: Game, stance: Stance): string {
  const generic = 'You let it go. The cold comes back in around the shape of it.';
  if (stance.kind !== 'holding') return generic;
  const def = objectDef(game, stance.object);
  const charge = game.state.objects[stance.object]?.charge ?? 0;
  return def?.release?.[Math.min(2, Math.max(0, usesSpent(charge) - 1))] ?? generic;
}

/**
 * `below` is opt-in rather than the default: `sim/policies.ts` and the
 * reachability sweep instantiate games in bulk against a fixed turn budget,
 * and beat zero has nothing for a policy that only knows `scene`/`idle` to
 * do with it. CLI and web play pass `{ below: true }`.
 */
export function newGame(pack: ContentPack, seed: number, opts?: { below?: boolean }): Game {
  const rng = makeRng(seed);
  const belongingIds = pack.objects.map((o) => o.id);
  const phase = belongingIds.length >= 2 ? startBelow(() => rng.next(), belongingIds) : undefined;
  const state = initWorld(pack, seed);

  if (opts?.below && phase) return { pack, state, mode: { kind: 'below', phase }, rng };

  // Starting past the dark still starts *after* it: beat zero would have given
  // up two, so a game that skips the phase is handed the same two rather than
  // beginning with everything buried. Otherwise the sweep measures a harsher
  // game than anybody actually plays.
  const given = phase ? phase.found : [];
  return {
    pack,
    state: applyEffects(
      state,
      given.map((object) => ({ kind: 'object' as const, object, field: 'found' as const, value: true })),
    ),
    mode: { kind: 'idle' },
    rng,
  };
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

/**
 * Two doors, as `MECHANICS.md` §4 has them: a road reaches its last step, or
 * nobody came. Beat zero is exempt — it has its own ending, and a phase with
 * no history yet would read as starved on its twelfth turn.
 */
function doorOut(game: Game): Door | null {
  if (game.mode.kind === 'over') return null;

  // Beat zero has its own ending, and it is only for a presence that opened
  // its eyes. One that never does is not waiting for anything: it starves
  // where it lies, before a single person has come to the rim.
  if (game.mode.kind === 'below') {
    return !eyesOpen(game.mode.phase) && game.mode.phase.turn >= BELOW_TUNING.cap ? 'starved' : null;
  }

  const last = game.state.history[game.state.history.length - 1];
  if (last && sceneById(game, last.scene)?.terminal) return 'terminal';

  const status = runStatus(game);
  if (status.kind === 'quiet') return 'starved';
  if (status.kind === 'stalled' && game.state.turn - (last?.turn ?? 0) >= STARVE_TURNS) return 'starved';
  return null;
}

export function step(game: Game, action: PlayerAction): StepResult {
  // A finished run is finished. The controls still exist; they do nothing.
  if (game.mode.kind === 'over') return { game, lines: [] };

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
        lines.push(fact(letGoOf(next, next.state.presence.stance)));
        next = setStance(next, { kind: 'still' });
        if (next.mode.kind === 'scene') next.mode = { ...next.mode, ctx: { ...next.mode.ctx, resonance: null } };
      }
      break;
    }
    case 'look': {
      const def = objectDef(next, action.object);
      if (!def || !next.state.objects[action.object]?.found) {
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
      if (!def || !obj || !obj.found) {
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
      lines.push(
        fact(
          def.hold?.[Math.min(2, usesSpent(obj.charge))] ??
            `You gather yourself around the ${def.name}. It remembers more than you do.`,
        ),
      );
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
    const wasIdle = next.mode.kind === 'idle' ? next.mode : undefined;
    const started = maybeStartScene(next);
    let game = started.game;
    if (started.lines.length === 0 && lines.length === 0) {
      const said = ambient(next, wasIdle?.lastAmbient);
      lines.push(idle(said));
      if (game.mode.kind === 'idle') game = { ...game, mode: { kind: 'idle', lastAmbient: said } };
    }
    result = { game, lines: [...lines, ...started.lines] };
  }

  // 4. And then, if there is nothing left to be, the run says what it was.
  const door = doorOut(result.game);
  if (door && result.game.pack.coda) {
    const coda = result.game.pack.coda;
    const read = (state: WorldState): CodaContext => ({
      state,
      door,
      verdict: verdictOf(state),
      tier: tierOf(state.presence.lucidity, false),
    });

    let state = result.game.state;
    let told = resolveCoda(coda, read(state));

    // Being forgotten is the one ending that takes something back as it is
    // told. Whatever the presence had worked out about itself goes first —
    // there is nobody left for it to be true in front of — so the close drops
    // to `veiled` and the words come apart as they are read.
    if (told.spine === 'forgotten') {
      state = { ...state, presence: { ...state.presence, lucidity: 0 } };
      told = resolveCoda(coda, read(state));
      told = { ...told, lines: erode(told.lines, () => result.game.rng.next()) };
    }

    result.lines.push(...told.lines);
    return {
      game: { ...result.game, state, mode: { kind: 'over', door, spine: told.spine } },
      lines: result.lines,
    };
  }

  // The stop lines only speak for a run that has not ended — once the coda
  // exists they would be announcing an ending that is about to be told properly.
  const after = runStatus(result.game).kind;
  if (after !== before && !door) {
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

    // Pressing at nobody is a waste of the bar — except that the silt is still
    // holding what beat zero did not give up, and this is the only thing that
    // shakes it loose.
    const buried = next.pack.objects.find((o) => !next.state.objects[o.id]?.found);
    if (buried && next.rng.next() < TUNING.siltChance) {
      return {
        game: withState(next, applyEffects(next.state, [{ kind: 'object', object: buried.id, field: 'found', value: true }])),
        lines: [
          fact('You push against nothing at all, and the silt gives something back.'),
          fact(next.pack.below?.[buried.id]?.glimpse ?? buried.glimpse ?? buried.name),
        ],
      };
    }
    return { game: next, lines: [fact('You push against nothing at all. The dark takes it without comment.')] };
  }

  const def = objectDef(game, stance.object);
  const obj = def ? game.state.objects[def.id] : undefined;
  if (!def || !obj || obj.charge <= TUNING.spent) {
    // The last hold ends whether or not the player let go of it, and it ends
    // in the thing's own words — this is the only moment it is ever final.
    return {
      game: setStance(game, { kind: 'still' }),
      lines: [
        fact(def?.release?.[2] ?? 'It goes cold in your hands, and stays cold. There was only ever so much of it.'),
      ],
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

  const { phase, events } = advanceBelow(game.mode.phase, {
    presenceCharge: game.state.presence.charge,
    pressedThisTurn: input.pressedThisTurn,
    exhaustedThisTurn: input.exhaustedThisTurn,
  });

  let next: Game = { ...game, mode: { kind: 'below', phase } };

  // What the player caused is already in `lines` and is never held back — it
  // is the answer to their input. Everything else sorts into two piles: what
  // this turn is *about*, and what the world happens to have ready.
  const now: NarrationLine[] = [];
  const later: NarrationLine[] = [];
  let crossing: NarrationLine[] = [];
  let ended = false;

  // The reflection after burning out is a second thought, not a second event.
  if (input.exhaustedThisTurn) later.push(...(game.pack.belowProse?.exhaustionExtra ?? []).map(fact));

  for (const event of events) {
    if (event.kind === 'end') {
      ended = true;
      crossing = belowEventLines(next, event);
    } else if (event.kind === 'glimpse') {
      // The silt giving something up is the whole point of the press that
      // found it, so it is never made to wait.
      now.push(...belowEventLines(next, event));
      next = withState(next, applyEffects(next.state, [{ kind: 'object', object: event.object, field: 'found', value: true }]));
    } else {
      later.push(...belowEventLines(next, event));
    }
  }

  let queue = [...phase.pending, ...later];
  const budget = Math.max(0, BELOW_TUNING.linesPerTurn - (lines.length + now.length));
  const released = queue.slice(0, budget);
  queue = queue.slice(budget);

  // The phase does not finish while it still owes the player something — but
  // the cap is the cap, and at the cap whatever is left is said at once.
  const finishing = ended && (queue.length === 0 || phase.turn >= BELOW_TUNING.cap);
  lines.push(...now, ...released);
  if (finishing) {
    lines.push(...queue, ...crossing);
    queue = [];
  }
  ended = finishing;

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

  next = {
    ...next,
    mode: ended ? { kind: 'idle' } : { kind: 'below', phase: { ...settled, pending: queue } },
  };
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
    const delta =
      TUNING.resonanceGain * def.power * (def.affinity[person] ?? 0.1) * (game.state.objects[def.id]?.charge ?? 0);
    if (delta <= 0.01) continue;
    effects.push({ kind: 'emotion', person, emotion: def.emotion, delta });
    carried += delta;
  }
  if (carried <= 0.01) return effects;

  effects.push({ kind: 'belief', belief: BELIEF_OF_EMOTION[def.emotion], delta: carried * 0.5 });
  effects.push({ kind: 'well', field: 'attention', delta: carried * 0.3 });
  return effects;
}

/**
 * An empty turn's texture. Never the same line twice running: the pool is
 * small and heard often, and a line repeated back to back stops reading as
 * the world going on and starts reading as the machine going round.
 */
function ambient(game: Game, avoid?: string): string {
  const all = game.pack.ambient ?? ['Nothing. The stone sweats. Somewhere above, the light moves a hand-width.'];
  const pool = all.length > 1 ? all.filter((line) => line !== avoid) : all;
  return pool[Math.floor(game.rng.next() * pool.length)] ?? '';
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
