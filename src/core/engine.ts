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
 * Three stances and one glance. `still`/`haunt`/`attune` set a stance; `wait`
 * leaves it alone. `look` is not a stance — it makes a thing holdable.
 */
export type PlayerAction =
  | { kind: 'wait' }
  | { kind: 'still' }
  | { kind: 'haunt' }
  | { kind: 'attune'; object: ObjectId }
  | { kind: 'look'; object: ObjectId };

/**
 * Set by the first press that lands. Unread by the sim; the presentation hangs
 * the world coming into view on it, so a run that never acts stays dark.
 */
export const HAS_PRESSED = 'presence.has-pressed';

/** Set by the first refusal, so the one that states the rule is only said once. */
const HAS_BEEN_REFUSED = 'presence.has-been-refused';

/**
 * Pushing with nothing left. Three variants so a run of refusals does not read
 * as a broken button. Only the first states the rule.
 */
const TOO_THIN = [
  'Nothing happens. You are too thin. You have to be still for a while first.',
  'You try again. The water does not even notice.',
  'Nothing moves. Not the water, and not you.',
];

/**
 * What a turn says when everything it had was already said. The one line
 * exempt from beat zero's no-repeat rule.
 */
export const NOTHING_NEW = '…';

const scene = (text: string): NarrationLine => ({ kind: 'scene', text });
const fact = (text: string): NarrationLine => ({ kind: 'fact', text });
const idle = (text: string): NarrationLine => ({ kind: 'idle', text });
const system = (text: string): NarrationLine => ({ kind: 'system', text });

export type Mode =
  /** `lastAmbient` so an empty turn never repeats itself. */
  | { kind: 'idle'; lastAmbient?: string }
  | { kind: 'scene'; scene: SceneId; ctx: SceneContext }
  /** Beat zero. See `core/below.ts`. Disposable once the deck exists. */
  | { kind: 'below'; phase: BelowPhase }
  /** The coda has been said. Nothing further happens. */
  | { kind: 'over'; door: Door; spine: string };

/**
 * Sceneless turns before a still-open run counts as starvation. Stands in for
 * the attention decay the prototype does not have, so quiet runs can end.
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
 * Tunables, kept together so pacing can be felt out in one place.
 *
 * Two resources: presence is renewable and pays for pressing (within-scene);
 * belongings are finite and pay for holding (across-run).
 */
export const TUNING = {
  /** Recovered per turn spent still. Nothing else recovers presence. */
  stillness: 0.14,
  /** Presence burned per turn spent pressing. A full bar buys two presses. */
  pressCost: 0.34,
  /** Pressure added per turn of pressing inside a scene. */
  pressure: 0.3,
  /**
   * Object charge burned per turn held. Never regained. Same as `pressCost`:
   * a belonging is three holds, cheap enough to spend without thinking about.
   */
  holdCost: 0.34,
  /** Below this a belonging cannot be taken up again. */
  spent: 0.05,
  /**
   * Multiplier on what a hold does to the people above. Compensates for three
   * holds carrying ~a quarter of the charge fourteen did; without it resonance
   * stops working as a lever and the reachability sweep catches it.
   */
  resonanceGain: 3.5,
  lucidityPerDiscovery: 0.2,
  /** The first press only. Everything visible is hung off this sliver. */
  lucidityFirstPress: 0.02,
  /** Base chance per idle turn that someone comes to the well. */
  sceneChance: 0.35,
  /**
   * Chance a press into the empty dark turns up another belonging. Beat zero
   * gives two; the rest cost presence that could have gone to the living.
   */
  siltChance: 0.45,
};

/**
 * Holds a belonging has already cost, from what is left. Exact, since only
 * holding drains charge. Indexes the per-use prose.
 */
const usesSpent = (charge: number): number =>
  Math.min(3, Math.max(0, Math.round((1 - charge) / TUNING.holdCost)));

/** Putting a thing down, in the words of the hold that just ended. */
function letGoOf(game: Game, stance: Stance): string {
  const generic = 'You let it go. The cold comes back in around the shape of it.';
  if (stance.kind !== 'holding') return generic;
  const def = objectDef(game, stance.object);
  const charge = game.state.objects[stance.object]?.charge ?? 0;
  return def?.release?.[Math.min(2, Math.max(0, usesSpent(charge) - 1))] ?? generic;
}

/**
 * `below` is opt-in: the sweeps run bulk games on a fixed turn budget and
 * their policies only know `scene`/`idle`. CLI and web pass `{ below: true }`.
 */
export function newGame(pack: ContentPack, seed: number, opts?: { below?: boolean }): Game {
  const rng = makeRng(seed);
  const belongingIds = pack.objects.map((o) => o.id);
  const phase = belongingIds.length >= 2 ? startBelow(() => rng.next(), belongingIds) : undefined;
  const state = initWorld(pack, seed);

  if (opts?.below && phase) return { pack, state, mode: { kind: 'below', phase }, rng };

  // Skipping the phase still starts after it: hand over the two belongings
  // beat zero would have given, or the sweep measures a harsher game.
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

/**
 * `force` skips the arrival roll for a turn that has already decided somebody
 * is there (only beat zero ending). The weighting still chooses who.
 */
function maybeStartScene(game: Game, opts?: { force?: boolean }): { game: Game; lines: NarrationLine[] } {
  const candidates = eligibleScenes(game);
  if (candidates.length === 0) return { game, lines: [] };

  const chance = TUNING.sceneChance + game.state.well.attention * 0.4;
  if (!opts?.force && game.rng.next() > chance) return { game, lines: [] };

  const picked = pickWeighted(game.rng, candidates, (s) => Math.max(0.0001, s.weight?.(game.state) ?? 1));
  if (!picked) return { game, lines: [] };

  const ctx: SceneContext = { pressure: 0, resonance: heldResonance(game), beatIndex: 0 };
  const next: Game = { ...game, mode: { kind: 'scene', scene: picked.id, ctx } };
  const first = picked.beats[0];
  return { game: next, lines: first ? [scene(first.text(next.state, ctx))] : [] };
}

/** Resonance survives idle into a scene: the mood is set before they arrive. */
function heldResonance(game: Game): SceneContext['resonance'] {
  const { stance } = game.state.presence;
  if (stance.kind !== 'holding') return null;
  const def = objectDef(game, stance.object);
  if (!def) return null;
  return { object: def.id, emotion: def.emotion, strength: def.power * (game.state.objects[def.id]?.charge ?? 0) };
}

/**
 * Two doors: a road reaches its last step, or nobody came. Beat zero is exempt
 * — no history yet, so it would read as starved on its twelfth turn.
 */
function doorOut(game: Game): Door | null {
  if (game.mode.kind === 'over') return null;

  // Beat zero's own ending, only for a presence that opened its eyes. One that
  // never does starves in the dark instead.
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
  // A finished run is finished. The controls exist; they do nothing.
  if (game.mode.kind === 'over') return { game, lines: [] };

  const before = runStatus(game).kind;
  const lines: NarrationLine[] = [];
  let next: Game = withState(game, { ...game.state, turn: game.state.turn + 1 });

  // 1. An action only sets a stance, or looks. `wait` leaves the stance alone
  //    and lets it cost. Recovery is the turn's, not the stance's: being still
  //    while doing something else is not being still.
  let gathering = action.kind === 'wait';

  switch (action.kind) {
    case 'wait':
      break;
    case 'still': {
      // Choosing stillness *is* gathering: arriving at it and having been in
      // it are worth the same turn, or the player cannot form the rule.
      gathering = true;
      if (next.state.presence.stance.kind === 'still') {
        // Going on being still is the default, and says nothing.
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

  // 2. The stance costs or recovers once per turn. The whole economy.
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

  // 4. And then, if nothing is left, the run says what it was.
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

    // Being forgotten takes something back as it is told: lucidity goes first,
    // so the close drops to `veiled` and the words erode as they are read.
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

  // The stop lines only speak for a run that has not ended; otherwise they
  // announce an ending the coda is about to tell properly.
  const after = runStatus(result.game).kind;
  if (after !== before && !door) {
    if (after === 'stalled') result.lines.push(system(STALLED_LINE));
    if (after === 'quiet') result.lines.push(system(QUIET_LINE));
  }
  return result;
}

/**
 * One rule, no exceptions: stillness is the only thing that recovers presence.
 * Not looking, not releasing, not holding.
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

    // Pressing at nobody wastes the bar — except it is the only thing that
    // shakes loose what beat zero left in the silt.
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
    // The last hold ends whether or not the player let go, in the thing's own
    // words — the only moment it is ever final.
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
 * Beat zero. `maybeStartScene` never runs while this mode holds: the run does
 * not begin until the light crosses.
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

  // What the player caused is already in `lines` and is never held back.
  // Everything else sorts into what this turn is about (`now`) and what the
  // world merely has ready (`later`).
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
      // The point of the press that found it, so it never waits.
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

  // The phase does not finish while it still owes lines — except at the cap,
  // where whatever is left is said at once.
  const finishing = ended && (queue.length === 0 || phase.turn >= BELOW_TUNING.cap);
  lines.push(...now, ...released);
  if (finishing) {
    lines.push(...queue);
    queue = [];
  }
  ended = finishing;

  // Nothing is said twice down here. Filtering the finished turn covers every
  // source at once: stance lines, subjects, transitions.
  const guard = unsaid(phase, lines.map((line) => line.text));
  let fresh = lines.filter((_, i) => guard.keep[i]);
  const swallowed = lines.length > 0 && fresh.length === 0;

  // A run of silent turns eventually says something about the dark, but not
  // every gap — the water answers on its own. Never on the ending turn:
  // filler in front of an arrival is worse than the silence.
  const silence = fillSilence(guard.phase, fresh.length > 0 || ended);
  let settled = silence.phase;
  if (silence.speak && !ended) {
    const pool = (next.pack.belowProse?.settling ?? []).filter((line) => !settled.said.includes(line));
    const line = pool[Math.floor(next.rng.next() * pool.length)];
    if (line) {
      fresh = [...fresh, idle(line)];
      settled = { ...settled, said: [...settled.said, line] };
    }
  } else if (swallowed && !ended) {
    // Everything this turn had was already said. Say so rather than nothing.
    fresh = [idle(NOTHING_NEW)];
  }

  // The light crossing *is* the run beginning: whoever comes to the rim opens
  // on this same turn and their first beat is the crossing, so it is not
  // narrated twice. `lightCrossing` covers a rim with nobody at it — currently
  // unreachable, since the cast is present from turn one.
  if (ended) {
    const opened = maybeStartScene({ ...next, mode: { kind: 'idle' } }, { force: true });
    if (opened.lines.length > 0) return { game: opened.game, lines: [...fresh, ...opened.lines] };
    return { game: { ...next, mode: { kind: 'idle' } }, lines: [...fresh, ...crossing] };
  }

  next = { ...next, mode: { kind: 'below', phase: { ...settled, pending: queue } } };
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
 * Resonance bleeds into everyone present regardless of the scene's outcome:
 * the quiet channel, a mood arriving. Moves the village too, not just the
 * person — talk is what the late game reads.
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
 * small, and back-to-back repeats read as the machine going round.
 */
function ambient(game: Game, avoid?: string): string {
  const all = game.pack.ambient ?? ['Nothing. The stone sweats. Somewhere above, the light moves a hand-width.'];
  const pool = all.length > 1 ? all.filter((line) => line !== avoid) : all;
  return pool[Math.floor(game.rng.next() * pool.length)] ?? '';
}

// ---------------------------------------------------------------------------
// The stop. Not an ending — only "is anything still capable of happening", so
// a run can say so instead of leaving the player at the bottom of a finished
// world.
// ---------------------------------------------------------------------------

export const STALLED_LINE =
  'The light goes on moving. Nothing more is coming to the well while the well is what it is now.';

export const QUIET_LINE =
  'Nothing is coming that has not already come. The light will go on moving across the water, and that is all it will ever do now.';

/**
 * Three states, because two would lie: a world the player has stalled is not
 * a world that has finished telling itself.
 */
export type RunStatus =
  | { kind: 'open' }
  /** Nothing can fire from the world as it stands. Only the player can change that. */
  | { kind: 'stalled'; reason: string }
  /** Nothing can fire on any future this world can reach. */
  | { kind: 'quiet'; reason: string };

/**
 * Probe worlds for asking whether a gate could ever open. `requires` is an
 * arbitrary predicate, so this is a heuristic: the world as it is, at best,
 * and at worst. Satisfied by none of the three means shut for good.
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
