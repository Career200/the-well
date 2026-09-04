import { applyEffects } from "./effects.js";
import type { Effect } from "./effects.js";
import { makeRng, pickWeighted } from "./rng.js";
import type { Rng } from "./rng.js";
import { resolveOutcome } from "./scene.js";
import type { Scene, SceneContext } from "./scene.js";
import { initWorld } from "./content.js";
import type { ContentPack, ObjectDef } from "./content.js";
import {
  advanceBelow,
  AMBIENT_ORDER,
  BELOW_TUNING,
  eyesOpen,
  fillSilence,
  lookBelow,
  startBelow,
  tierOf
} from "./below.js";
import { erode, resolveCoda, verdictOf } from "./coda.js";
import { choose, EMPTY_LEDGER, filter as unsaid } from "./ledger.js";
import type { Ledger } from "./ledger.js";
import type { CodaContext, Door } from "./coda.js";
import type { BelowEvent, BelowPhase, Tier } from "./below.js";
import { BELIEF_OF_EMOTION, BELIEFS } from "./types.js";
import type {
  Belief,
  NarrationLine,
  ObjectId,
  SceneId,
  WorldState
} from "./types.js";

export type PlayerAction =
  | { kind: "wait" }
  | { kind: "still" }
  | { kind: "haunt" }
  | { kind: "attune"; object: ObjectId }
  | { kind: "look"; object: ObjectId };

/** Read by the presentation, not sim. */
export const HAS_PRESSED = "presence.has-pressed";

/** Set by the first push refusal, so the line stating the rule is said once. */
const HAS_BEEN_REFUSED = "presence.has-been-refused";

/**
 * Per-subject flags for the ambient five after beat zero. A place is closed
 * only against the tier it has already answered at, so a move in lucidity
 * makes it a candidate again.
 */
const QUEUED = (id: string): string => `subject.${id}.queued`;
const OPEN = (id: string): string => `subject.${id}.open`;
const SEEN = (id: string, tier: Tier): string => `subject.${id}.seen.${tier}`;
const isAmbient = (id: string): boolean =>
  (AMBIENT_ORDER as readonly string[]).includes(id);

/** The tier the ambient five answer at. Belongings run one ahead; these do not. */
const ambientTier = (game: Game): Tier =>
  tierOf(game.state.presence.lucidity, false);

/** Has this place already answered at the tier it is on now? */
const answered = (game: Game, id: string): boolean =>
  game.state.flags[SEEN(id, ambientTier(game))] === true;

/** The cold has no region in the shaft to tap, so it is never queued. */
const ASKABLE = AMBIENT_ORDER.filter((id) => id !== "cold");

/** Drawn when lucidity moves, in either direction. */
function queueSubject(game: Game): Game {
  const locked = ASKABLE.filter(
    (id) =>
      !game.state.flags[QUEUED(id)] &&
      !game.state.flags[OPEN(id)] &&
      !answered(game, id)
  );
  const pick = locked[Math.floor(game.rng.next() * locked.length)];
  if (!pick) return game;
  return withState(
    game,
    applyEffects(game.state, [
      { kind: "flag", flag: QUEUED(pick), value: true }
    ])
  );
}

/** Released on an empty turn, so it never lands on top of a scene. */
function openSubject(game: Game): { game: Game; line: string } | undefined {
  const next = AMBIENT_ORDER.find((id) => game.state.flags[QUEUED(id)]);
  const said =
    game.pack.noticing?.[tierOf(game.state.presence.lucidity, false)];
  if (!next || !said) return undefined;
  return {
    game: withState(
      game,
      applyEffects(game.state, [
        { kind: "flag", flag: QUEUED(next), value: false },
        { kind: "flag", flag: OPEN(next), value: true }
      ])
    ),
    line: said
  };
}

/** Exempt from beat zero's no-repeat rule. */
export const NOTHING_NEW = "…";

const scene = (text: string): NarrationLine => ({ kind: "scene", text });
const fact = (text: string): NarrationLine => ({ kind: "fact", text });
/**
 * A `fact` one of the nine subjects is speaking, captioned with which. Only
 * the subject's own prose goes through here; a refusal stays headless.
 */
const spoken = (
  game: Game,
  id: string | undefined,
  text: string
): NarrationLine => {
  const subject = id === undefined ? undefined : subjectName(game, id);
  return subject && id !== undefined
    ? { kind: "fact", text, subject, subjectId: id }
    : fact(text);
};
const idle = (text: string): NarrationLine => ({ kind: "idle", text });

export type Mode =
  | { kind: "idle" }
  | { kind: "scene"; scene: SceneId; ctx: SceneContext }
  /** Beat zero. See `core/below.ts`. */
  | { kind: "below"; phase: BelowPhase }
  /** The coda has been said. Nothing further happens. */
  | { kind: "over"; door: Door; spine: string };

/** Sceneless beats before a still-open run counts as starved. */
const STARVE_TURNS = 12;

export interface Game {
  pack: ContentPack;
  state: WorldState;
  mode: Mode;
  rng: Rng;
  /** What has been said lately. See `core/ledger.ts`. */
  ledger: Ledger;
  /** Turn of the last readout. `READOUT_GAP` is the minimum spacing. */
  lastRead?: number;
}

export interface StepResult {
  game: Game;
  /** Narration for this step, ordered, each line carrying its register. */
  lines: NarrationLine[];
}

/**
 * `lines` is what happened: scene beats, outcomes, whoever arrived. `after` is
 * the readout and the empty-turn line. They are separate because the action's
 * closing falls between them — see the phases in `step`.
 */
interface Answer {
  game: Game;
  lines: NarrationLine[];
  after: NarrationLine[];
}

/**
 * Two resources: presence is renewable and pays for pushing (within-scene);
 * belongings are finite and pay for being used (across-run).
 */
export const TUNING = {
  /** Recovered per beat spent still. Nothing else recovers presence. */
  stillness: 0.14,
  /** Presence burned per push. A full bar buys two. */
  pressCost: 0.34,
  /** Pressure added per push inside a scene. */
  pressure: 0.3,
  /** Object charge burned per use, never regained. Three uses empty one. */
  holdCost: 0.34,
  /** Below this a belonging cannot be taken up again. */
  spent: 0.05,
  /** Multiplier on what a use does to the people above. */
  resonanceGain: 3.5,
  lucidityPerDiscovery: 0.2,
  /** The first press only. */
  lucidityFirstPress: 0.02,
  /** Base chance per idle turn that someone comes to the well. */
  sceneChance: 0.35,
  /** Chance a press into the empty dark turns up a third or fourth belonging. */
  siltChance: 0.3,
  /** The same, while fewer than two are in hand. */
  siltPairChance: 0.7
};

/**
 * What the silt will give up for one press, from what is already in hand. The
 * first is owed outright; the second is loose; the rest is not. Read by both
 * the idle game and beat zero, so a belonging costs the same either side of
 * the crossing.
 */
export function siltChanceOf(game: Game): number {
  const held = game.pack.objects.filter(
    (o) => game.state.objects[o.id]?.found
  ).length;
  if (held === 0) return 1;
  return held < 2 ? TUNING.siltPairChance : TUNING.siltChance;
}

/** Uses already spent, from the charge left. Indexes the per-use prose. */
const usesSpent = (charge: number): number =>
  Math.min(3, Math.max(0, Math.round((1 - charge) / TUNING.holdCost)));

/**
 * `below` is opt-in: the sweeps run on a fixed turn budget and their policies
 * only know `scene`/`idle`. CLI and web pass `{ below: true }`.
 */
export function newGame(
  pack: ContentPack,
  seed: number,
  opts?: { below?: boolean }
): Game {
  const rng = makeRng(seed);
  const belongingIds = pack.objects.map((o) => o.id);
  const phase =
    belongingIds.length >= 2
      ? startBelow(() => rng.next(), belongingIds)
      : undefined;
  const state = initWorld(pack, seed);

  if (opts?.below && phase)
    return {
      pack,
      state,
      mode: { kind: "below", phase },
      rng,
      ledger: EMPTY_LEDGER
    };

  // Skipping the phase still starts after it: hand over the two belongings
  // beat zero would have given.
  const given = phase ? phase.found : [];
  return {
    pack,
    state: applyEffects(
      state,
      given.map((object) => ({
        kind: "object" as const,
        object,
        field: "found" as const,
        value: true
      }))
    ),
    mode: { kind: "idle" },
    rng,
    ledger: EMPTY_LEDGER
  };
}

const objectDef = (game: Game, id: ObjectId): ObjectDef | undefined =>
  game.pack.objects.find((o) => o.id === id);

const withState = (game: Game, state: WorldState): Game => ({ ...game, state });

/** Strength a belonging carries for the people currently in a given scene. */
export function resonanceStrength(
  game: Game,
  def: ObjectDef,
  cast: readonly string[]
): number {
  const charge = game.state.objects[def.id]?.charge ?? 0;
  const affinity = Math.max(0, ...cast.map((p) => def.affinity[p] ?? 0.1));
  return def.power * affinity * charge;
}

export function eligibleScenes(game: Game): Scene[] {
  const { state } = game;
  return game.pack.scenes.filter((scene) => {
    if (!scene.repeatable && state.history.some((h) => h.scene === scene.id))
      return false;
    if (!scene.cast.every((p) => state.people[p]?.present)) return false;
    return scene.requires ? scene.requires(state) : true;
  });
}

/**
 * `force` skips the arrival roll for a beat that has already decided somebody
 * is there. The weighting still chooses who. `used` is the belonging reached
 * for on this same beat, which only the coat does anything with.
 */
function maybeStartScene(
  game: Game,
  opts?: { force?: boolean; used?: ObjectId }
): { game: Game; lines: NarrationLine[] } {
  const candidates = eligibleScenes(game);
  if (candidates.length === 0) return { game, lines: [] };

  const chance = TUNING.sceneChance + game.state.well.attention * 0.4;
  if (!opts?.force && game.rng.next() > chance) return { game, lines: [] };

  const picked = pickWeighted(game.rng, candidates, (s) =>
    Math.max(0.0001, s.weight?.(game.state) ?? 1)
  );
  if (!picked) return { game, lines: [] };

  // Coat pulled over on the beat somebody would have arrived: no scene at all.
  if (opts?.used === "coat") {
    const hidden = hideUnderTheCoat(game);
    if (hidden) return hidden;
  }

  const ctx: SceneContext = { pressure: 0, resonance: null, beatIndex: 0 };
  const next: Game = {
    ...game,
    mode: { kind: "scene", scene: picked.id, ctx }
  };
  const first = picked.beats[0];
  return {
    game: next,
    lines: first ? [scene(first.text(next.state, ctx))] : []
  };
}

/**
 * If called inside a scene, `resolveScene` runs, but lines are cut. `undefined` if the pack has no prose for it.
 */
function hideUnderTheCoat(
  game: Game
): { game: Game; lines: NarrationLine[] } | undefined {
  const hiding = game.pack.hiding;
  if (!hiding?.length) return undefined;
  return {
    game: withState(
      game,
      applyEffects(game.state, [
        {
          kind: "presence",
          field: "lucidity",
          delta: -TUNING.lucidityPerDiscovery
        }
      ])
    ),
    lines: [fact(hiding[game.state.turn % hiding.length]!)]
  };
}

/**
 * What to caption one of the nine with. A belonging answers with its own
 * `ObjectDef` name; a place answers out of the pack.
 */
function subjectName(game: Game, id: string): string | undefined {
  const name = objectDef(game, id)?.name ?? game.pack.below?.[id]?.name;
  return name ? `the ${name}` : undefined;
}

/** A subject at the tier the presence has reached. Belongings run one ahead. */
function subjectAt(
  game: Game,
  id: string,
  isBelonging: boolean
): string | undefined {
  const subject = game.pack.below?.[id];
  if (!subject) return undefined;
  return subject[tierOf(game.state.presence.lucidity, isBelonging)];
}

const glimpseAt = (game: Game, def: ObjectDef): string =>
  game.pack.below?.[def.id]?.glimpse ?? def.name;

/** Two doors: a terminal scene resolves, or nobody came. */
function doorOut(game: Game): Door | null {
  if (game.mode.kind === "over") return null;

  // Beat zero has no history, so it is starved only by the cap, and only for
  // a presence that never opened its eyes.
  if (game.mode.kind === "below") {
    return !eyesOpen(game.mode.phase) &&
      game.mode.phase.turn >= BELOW_TUNING.cap
      ? "starved"
      : null;
  }

  const last = game.state.history[game.state.history.length - 1];
  if (last && sceneById(game, last.scene)?.terminal) return "terminal";

  const status = runStatus(game);
  if (status.kind === "quiet") return "starved";
  if (
    status.kind === "stalled" &&
    game.state.turn - (last?.turn ?? 0) >= STARVE_TURNS
  )
    return "starved";
  return null;
}

export function step(game: Game, action: PlayerAction): StepResult {
  if (game.mode.kind === "over") return { game, lines: [] };

  const said = game.pack.presence;
  const before = runStatus(game).kind;
  const lucidityBefore = game.state.presence.lucidity;
  /**
   * A beat is read in four phases, in this order:
   *
   *   opening   what the action says as it begins
   *   answer    what the world does about it        (`Answer.lines`)
   *   closing   the action finishing, once it has
   *   after     what is said about the beat, now it is over (`Answer.after`)
   */
  let opening: NarrationLine[] = [];
  let closing: NarrationLine[] = [];
  let next: Game = withState(game, {
    ...game.state,
    turn: game.state.turn + 1
  });

  // 1. One click, one effect. Nothing an action does outlives its own beat.
  let gathering = action.kind === "wait";
  /** Used on this beat, for the coat check below. Lives exactly this long. */
  let used: ObjectId | undefined;
  let pressed = false;
  let exhausted = false;

  switch (action.kind) {
    case "wait":
      break;
    case "still":
      gathering = true;
      break;
    case "look": {
      if (isAmbient(action.object)) {
        // A place is not asked while somebody is at the rim.
        if (next.mode.kind === "scene") {
          opening.push(fact(said.busy));
          break;
        }
        if (next.state.flags[OPEN(action.object)] !== true) {
          // Asking a place with nothing to say still costs the beat.
          opening.push(idle(NOTHING_NEW));
          break;
        }
        // No lucidity is spent: the tier is the count of belongings looked at.
        opening.push(
          spoken(
            next,
            action.object,
            subjectAt(next, action.object, false) ?? ""
          )
        );
        next = withState(
          next,
          applyEffects(next.state, [
            { kind: "flag", flag: OPEN(action.object), value: false },
            {
              kind: "flag",
              flag: SEEN(action.object, ambientTier(next)),
              value: true
            }
          ])
        );
        break;
      }
      const def = objectDef(next, action.object);
      if (!def || !next.state.objects[action.object]?.found) {
        opening.push(fact(said.noSuchThing));
        break;
      }
      if (next.mode.kind === "below") {
        const phase = lookBelow(next.mode.phase, def.id);
        if (!phase) {
          opening.push(fact(said.nothingToSee));
          break;
        }
        next = { ...next, mode: { kind: "below", phase } };
      }
      opening.push(
        spoken(next, def.id, subjectAt(next, def.id, true) ?? def.name)
      );
      const wasNew = !next.state.objects[def.id]?.discovered;
      next = withState(
        next,
        applyEffects(next.state, [
          { kind: "object", object: def.id, field: "discovered", value: true },
          ...(wasNew
            ? [
                {
                  kind: "presence" as const,
                  field: "lucidity" as const,
                  delta: TUNING.lucidityPerDiscovery
                }
              ]
            : [])
        ])
      );
      break;
    }
    case "attune": {
      const def = objectDef(next, action.object);
      const obj = def ? next.state.objects[def.id] : undefined;
      if (!def || !obj || !obj.found) {
        opening.push(fact(said.noSuchThing));
        break;
      }
      if (!obj.discovered) {
        opening.push(fact(said.notLookedAt));
        break;
      }
      if (obj.charge <= TUNING.spent) {
        opening.push(fact(said.spentBelonging));
        break;
      }
      // One use, paid for once, on this beat.
      const use = Math.min(2, usesSpent(obj.charge));
      next = withState(
        next,
        applyEffects(next.state, [
          { kind: "objectCharge", object: def.id, delta: -TUNING.holdCost }
        ])
      );
      used = def.id;
      opening.push(
        spoken(
          next,
          def.id,
          def.hold?.[use] ?? said.holdFallback.replace("{thing}", def.name)
        )
      );
      const cooling = def.release?.[use];
      if (cooling) closing.push(spoken(next, def.id, cooling));
      // Only reaches a scene. Kept for the rest of it, like `pressure`.
      if (next.mode.kind === "scene") {
        const scene = sceneById(next, next.mode.scene);
        const strength = resonanceStrength(next, def, scene?.cast ?? []);
        next = {
          ...next,
          mode: {
            ...next.mode,
            ctx: {
              ...next.mode.ctx,
              resonance: { object: def.id, emotion: def.emotion, strength }
            }
          }
        };
      }
      break;
    }
    case "haunt": {
      if (next.state.presence.charge < TUNING.pressCost) {
        const taught = next.state.flags[HAS_BEEN_REFUSED] === true;
        opening.push(
          fact(
            taught ? said.tooThin[1 + (next.state.turn % 2)]! : said.tooThin[0]
          )
        );
        if (!taught) {
          next = withState(
            next,
            applyEffects(next.state, [
              { kind: "flag", flag: HAS_BEEN_REFUSED, value: true }
            ])
          );
        }
        break;
      }
      const pushed = press(next);
      next = pushed.game;
      opening.push(...pushed.lines);
      pressed = true;
      exhausted = pushed.exhausted;
      break;
    }
  }

  // 2. Stillness is the only thing that recovers presence, and only on a beat
  //    that is about being still. The whole economy.
  if (gathering) {
    next = withState(
      next,
      applyEffects(next.state, [
        { kind: "presence", field: "charge", delta: TUNING.stillness }
      ])
    );
  }

  // 3. Only then does the world get its turn.
  let answer: Answer;
  // Coat mid-scene resolves the scene where it stands: the outcome is taken and
  // spent, and only its line is withheld. `unhidable` scenes opt out and play
  // their remaining beats, where the coat is a resonance like any other.
  const hiding =
    next.mode.kind === "scene" &&
    used === "coat" &&
    !sceneById(next, next.mode.scene)?.unhidable;
  const hidFrom = hiding ? hideUnderTheCoat(next) : undefined;
  if (hidFrom && next.mode.kind === "scene") {
    // The hiding line is the action's, not the world's.
    opening.push(...hidFrom.lines);
    const playing = sceneById(next, next.mode.scene);
    answer = playing
      ? resolveScene(hidFrom.game, playing, next.mode.ctx, true)
      : {
          game: { ...hidFrom.game, mode: { kind: "idle" } },
          lines: [],
          after: []
        };
  } else if (next.mode.kind === "scene") {
    answer = advanceScene(next);
  } else if (next.mode.kind === "below") {
    // Beat zero counts a turn's lines against its budget, so both halves go in.
    const acted = [...opening, ...closing];
    opening = [];
    closing = [];
    answer = advanceBelowMode(next, acted, {
      pressedThisTurn: pressed,
      exhaustedThisTurn: exhausted
    });
  } else {
    answer = advanceIdle(next, {
      spoke: opening.length + closing.length > 0,
      ...(used ? { used } : {})
    });
  }

  // 3a. Phase order.
  next = answer.game;
  const lines = [...opening, ...answer.lines, ...closing, ...answer.after];

  // 3b. A move in lucidity, in either direction, queues one of the five. It
  //     comes out on some later quiet turn.
  if (
    next.mode.kind !== "below" &&
    next.state.presence.lucidity !== lucidityBefore
  ) {
    next = queueSubject(next);
  }

  // 4. And then, if nothing is left, the run says what it was.
  const door = doorOut(next);
  if (door && next.pack.coda) {
    const coda = next.pack.coda;
    const read = (state: WorldState): CodaContext => ({
      state,
      door,
      verdict: verdictOf(state),
      tier: tierOf(state.presence.lucidity, false)
    });

    let state = next.state;
    let told = resolveCoda(coda, read(state));

    // `forgotten` takes lucidity first, so the close drops to `veiled` and the
    // words erode as they are read.
    if (told.spine === "forgotten") {
      state = { ...state, presence: { ...state.presence, lucidity: 0 } };
      told = resolveCoda(coda, read(state));
      told = { ...told, lines: erode(told.lines, () => next.rng.next()) };
    }

    return {
      game: { ...next, state, mode: { kind: "over", door, spine: told.spine } },
      lines: [...lines, ...told.lines]
    };
  }

  // The stop line only speaks for a run that has not ended; otherwise it
  // announces an ending the coda is about to tell properly. `quiet` is
  // unreachable here: `doorOut` returns `starved` on the same beat.
  const status = runStatus(next).kind;
  if (status !== before && !door && status === "stalled") {
    lines.push(idle(said.stalled));
  }
  return { game: next, lines };
}

/** No scene playing: start one if the roll allows, else narrate the turn. */
function advanceIdle(
  game: Game,
  opts: { spoke: boolean; used?: ObjectId }
): Answer {
  const started = maybeStartScene(game, ...(opts.used ? [{ used: opts.used }] : []));
  if (started.lines.length > 0 || opts.spoke)
    return { game: started.game, lines: started.lines, after: [] };

  const woken = openSubject(started.game);
  if (woken) return { game: woken.game, lines: [], after: [idle(woken.line)] };

  const heard = readout(started.game);
  const said = heard ?? ambient(started.game);
  return { game: said.game, lines: [], after: [idle(said.line)] };
}

/**
 * A press, whole, on the beat it is clicked: the cost, the pressure and the
 * running dry all land here.
 */
function press(game: Game): {
  game: Game;
  lines: NarrationLine[];
  exhausted: boolean;
} {
  const said = game.pack.presence;
  const lines: NarrationLine[] = [];
  const first = !game.state.flags[HAS_PRESSED];
  let next = withState(
    game,
    applyEffects(game.state, [
      { kind: "presence", field: "charge", delta: -TUNING.pressCost },
      { kind: "well", field: "dread", delta: 0.04 },
      ...(first
        ? [
            { kind: "flag" as const, flag: HAS_PRESSED, value: true },
            {
              kind: "presence" as const,
              field: "lucidity" as const,
              delta: TUNING.lucidityFirstPress
            }
          ]
        : [])
    ])
  );

  /** Running dry belongs to the press that did it, not to a beat of its own. */
  const spent = (): { game: Game; lines: NarrationLine[]; exhausted: boolean } => {
    const exhausted = next.state.presence.charge < TUNING.pressCost;
    if (exhausted) lines.push(fact(said.spent));
    return { game: next, lines, exhausted };
  };

  if (next.mode.kind === "scene") {
    next = {
      ...next,
      mode: {
        ...next.mode,
        ctx: {
          ...next.mode.ctx,
          pressure: next.mode.ctx.pressure + TUNING.pressure
        }
      }
    };
    lines.push(scene(said.pushInScene));
    return spent();
  }

  if (next.mode.kind === "below") {
    // Captioned to the water, so a client can bring it into view.
    lines.push({ kind: "fact", text: said.pushBelow, subjectId: "water" });
    return spent();
  }

  // Pressing at nobody spends the bar, and is the only thing that shakes
  // loose what beat zero left in the silt.
  const buried = next.pack.objects.find((o) => !next.state.objects[o.id]?.found);
  if (buried && next.rng.next() < siltChanceOf(next)) {
    next = withState(
      next,
      applyEffects(next.state, [
        { kind: "object", object: buried.id, field: "found", value: true }
      ])
    );
    lines.push(fact(said.pushFound), fact(glimpseAt(next, buried)));
    return spent();
  }
  lines.push(fact(said.pushEmpty));
  return spent();
}

/**
 * Beat zero. `maybeStartScene` never runs while this mode holds: the run does
 * not begin until the light crosses.
 */
function advanceBelowMode(
  game: Game,
  acted: NarrationLine[],
  input: { pressedThisTurn: boolean; exhaustedThisTurn: boolean }
): Answer {
  const lines = [...acted];
  if (game.mode.kind !== "below") return { game, lines, after: [] };

  const { phase, events } = advanceBelow(game.mode.phase, {
    presenceCharge: game.state.presence.charge,
    pressedThisTurn: input.pressedThisTurn,
    exhaustedThisTurn: input.exhaustedThisTurn,
    siltRolled: game.rng.next() < siltChanceOf(game)
  });

  let next: Game = { ...game, mode: { kind: "below", phase } };

  // What the player caused is already in `lines` and is never held back.
  // Everything else sorts into what this turn is about (`now`) and what the
  // world merely has ready (`later`).
  const now: NarrationLine[] = [];
  const later: NarrationLine[] = [];
  let crossing: NarrationLine[] = [];
  let ended = false;

  if (input.exhaustedThisTurn)
    later.push(...(game.pack.belowProse?.exhaustionExtra ?? []).map(fact));

  for (const event of events) {
    if (event.kind === "end") {
      ended = true;
      crossing = belowEventLines(next, event);
    } else if (event.kind === "ambient" && event.caused) {
      // The floor, answering the press that took something out of it. Goes
      // ahead of the glimpse: the place first, then the thing in it.
      now.push(...belowEventLines(next, event));
    } else if (event.kind === "glimpse") {
      now.push(...belowEventLines(next, event));
      next = withState(
        next,
        applyEffects(next.state, [
          { kind: "object", object: event.object, field: "found", value: true }
        ])
      );
    } else {
      later.push(...belowEventLines(next, event));
    }
  }

  let queue = [...phase.pending, ...later];
  const budget = Math.max(
    0,
    BELOW_TUNING.linesPerTurn - (lines.length + now.length)
  );
  const released = queue.slice(0, budget);
  queue = queue.slice(budget);

  // The phase does not finish while it still owes lines, except at the cap,
  // where whatever is left is said at once.
  const finishing =
    ended && (queue.length === 0 || phase.turn >= BELOW_TUNING.cap);
  lines.push(...now, ...released);
  if (finishing) {
    lines.push(...queue);
    queue = [];
  }
  ended = finishing;

  // Filters every source at once: the presence's lines, subjects, transitions.
  const guard = unsaid(
    next.ledger,
    "below",
    lines.map((line) => line.text)
  );
  next = { ...next, ledger: guard.ledger };
  let fresh = lines.filter((_, i) => guard.keep[i]);
  const swallowed = lines.length > 0 && fresh.length === 0;

  // A run of silent turns eventually says something about the dark, but not
  // every gap, and never on the ending turn.
  const silence = fillSilence(phase, fresh.length > 0 || ended);
  const settled = silence.phase;
  if (silence.speak && !ended) {
    const picked = choose(
      next.ledger,
      "below",
      next.pack.belowProse?.settling ?? [],
      () => next.rng.next()
    );
    if (picked) {
      next = { ...next, ledger: picked.ledger };
      fresh = [...fresh, idle(picked.line)];
    }
  } else if (swallowed && !ended) {
    fresh = [idle(NOTHING_NEW)];
  }

  // The light crossing is the run beginning: whoever comes to the rim opens on
  // this same turn and their first beat is the crossing. `lightCrossing`
  // covers a rim with nobody at it.
  if (ended) {
    const opened = maybeStartScene(
      { ...next, mode: { kind: "idle" } },
      { force: true }
    );
    if (opened.lines.length > 0)
      return {
        game: opened.game,
        lines: [...fresh, ...opened.lines],
        after: []
      };
    return {
      game: { ...next, mode: { kind: "idle" } },
      lines: [...fresh, ...crossing],
      after: []
    };
  }

  next = {
    ...next,
    mode: { kind: "below", phase: { ...settled, pending: queue } }
  };
  return { game: next, lines: fresh, after: [] };
}

function belowEventLines(game: Game, event: BelowEvent): NarrationLine[] {
  const prose = game.pack.belowProse;
  switch (event.kind) {
    case "ambient": {
      const said = subjectAt(game, event.subject, false);
      return said ? [spoken(game, event.subject, said)] : [];
    }
    case "movement":
      return (
        (event.to === 2
          ? prose?.toMovementII
          : event.to === 3
            ? prose?.toMovementIII
            : undefined) ?? []
      ).map(fact);
    case "glimpse": {
      const def = objectDef(game, event.object);
      return def ? [fact(glimpseAt(game, def))] : [];
    }
    case "end":
      return (prose?.lightCrossing ?? []).map(fact);
  }
}

const sceneById = (game: Game, id: SceneId): Scene | undefined =>
  game.pack.scenes.find((s) => s.id === id);

function advanceScene(game: Game): Answer {
  if (game.mode.kind !== "scene") return { game, lines: [], after: [] };
  const playing = sceneById(game, game.mode.scene);
  if (!playing)
    return { game: { ...game, mode: { kind: "idle" } }, lines: [], after: [] };

  const ctx: SceneContext = {
    ...game.mode.ctx,
    beatIndex: game.mode.ctx.beatIndex + 1
  };
  const beat = playing.beats[ctx.beatIndex];

  if (beat)
    return {
      game: { ...game, mode: { kind: "scene", scene: playing.id, ctx } },
      lines: [scene(beat.text(game.state, ctx))],
      after: []
    };

  return resolveScene(game, playing, ctx);
}

/**
 * The end of a scene: the outcome picked, its effects and the resonance
 * applied, the history written, the village given its chance to answer. The
 * readout goes in `after`.
 *
 * `silent` only drops the line
 */
function resolveScene(
  game: Game,
  playing: Scene,
  ctx: SceneContext,
  silent = false
): Answer {
  const outcome = resolveOutcome(playing, game.state, ctx);
  const lines: NarrationLine[] = silent
    ? []
    : [scene(outcome.text(game.state, ctx))];
  const after: NarrationLine[] = [];
  const changes = [
    ...outcome.effects(game.state, ctx),
    ...resonanceEffects(game, playing, ctx)
  ];
  const state = applyEffects(game.state, changes);

  // The village, on the beat it moved. Only when the beat actually moved it:
  // an outcome that touched nobody has nothing new to be said about.
  let next: Game = { ...game, state, mode: { kind: "idle" } };
  const moved = changes.some(
    (effect) => effect.kind === "belief" || effect.kind === "well"
  );
  if (moved && game.rng.next() < READOUT_AFTER_OUTCOME) {
    const heard = readout(next);
    if (heard) {
      next = heard.game;
      after.push(idle(heard.line));
    }
  }

  return {
    game: {
      ...next,
      state: {
        ...state,
        history: [
          ...state.history,
          { scene: playing.id, outcome: outcome.id, turn: state.turn }
        ]
      }
    },
    lines,
    after
  };
}

/**
 * Resonance reaches everyone present regardless of the outcome, and moves the
 * village as well as the person: talk is what the late game reads.
 */
function resonanceEffects(
  game: Game,
  scene: Scene,
  ctx: SceneContext
): Effect[] {
  if (!ctx.resonance) return [];
  const def = objectDef(game, ctx.resonance.object);
  if (!def) return [];

  const effects: Effect[] = [];
  let carried = 0;
  for (const person of scene.cast) {
    const delta =
      TUNING.resonanceGain *
      def.power *
      (def.affinity[person] ?? 0.1) *
      (game.state.objects[def.id]?.charge ?? 0);
    if (delta <= 0.01) continue;
    effects.push({ kind: "emotion", person, emotion: def.emotion, delta });
    carried += delta;
  }
  if (carried <= 0.01) return effects;

  effects.push({
    kind: "belief",
    belief: BELIEF_OF_EMOTION[def.emotion],
    delta: carried * 0.5
  });
  effects.push({ kind: "well", field: "attention", delta: carried * 0.3 });
  return effects;
}

/**
 * A belief has to be this far up before the village has anything to say. Most
 * outcomes move one by 0.1 to 0.4, so this asks for more than a single nudge
 * and less than a verdict.
 */
const READOUT_FLOOR = 0.2;
/** The two well dials get a second band above this. */
const READOUT_LOUD = 0.6;
/** How often an outcome that moved the village is followed by them saying so. */
const READOUT_AFTER_OUTCOME = 0.75;
/** Beats between one reading and the next, or it stops being a reading. */
const READOUT_GAP = 5;

/**
 * The village, said back, no more often than `READOUT_GAP`. Three things it
 * can be, in this order:
 *
 *   a loud dial     past `READOUT_LOUD`, it outranks anything they believe
 *   what they think the loudest belief, once it is past `READOUT_FLOOR`
 *   that they think about it   a dial past the floor, when no belief is
 *
 * Beliefs take the middle band rather than sharing it with the dials, because
 * `attention` opens at 0.1 and takes something from every outcome: ranked
 * against beliefs that open at 0 it wins nearly every early reading, and the
 * village ends up saying it is thinking about the well long before it ever
 * says what it thinks the well is. It still gets to say so — but only while
 * they have not decided.
 */
function readout(game: Game): { game: Game; line: string } | undefined {
  const lines = game.pack.readout;
  if (!lines) return undefined;
  if (game.state.turn - (game.lastRead ?? -READOUT_GAP) < READOUT_GAP)
    return undefined;
  const { beliefs, well } = game.state;
  const loudest = (entries: [string, number][]): [string, number] =>
    entries.sort((a, b) => b[1] - a[1])[0]!;

  const dial = loudest([
    ["attention", well.attention],
    ["dread", well.dread]
  ]);
  const belief = loudest(Object.entries(beliefs));

  const said: [string, string] | undefined =
    dial[1] > READOUT_LOUD
      ? [dial[0], `${dial[0]}.1`]
      : belief[1] > READOUT_FLOOR
        ? [belief[0], belief[0]]
        : dial[1] > READOUT_FLOOR
          ? [dial[0], `${dial[0]}.0`]
          : undefined;
  if (!said) return undefined;

  const [name, key] = said;
  const pool = key.endsWith('.1')
    ? lines[name as "attention" | "dread"][1]
    : key.endsWith('.0')
      ? lines[name as "attention" | "dread"][0]
      : lines.beliefs[name as Belief];
  const picked = choose(game.ledger, `band:${key}`, pool, () => game.rng.next());
  if (!picked) return undefined;
  return {
    game: { ...game, ledger: picked.ledger, lastRead: game.state.turn },
    line: picked.line
  };
}

/** The texture of an empty turn. */
function ambient(game: Game): { game: Game; line: string } {
  const pool = game.pack.ambient ?? [game.pack.presence.ambientFallback];
  const picked = choose(game.ledger, "ambient", pool, () => game.rng.next());
  if (!picked) return { game, line: "" };
  return { game: { ...game, ledger: picked.ledger }, line: picked.line };
}

// ---------------------------------------------------------------------------
// The stop: whether anything is still capable of happening, so a run can say
// so rather than leave the player at the bottom of a finished world.
// ---------------------------------------------------------------------------

export type RunStatus =
  | { kind: "open" }
  /** Nothing can fire from the world as it stands. Only the player can change that. */
  | { kind: "stalled"; reason: string }
  /** Nothing can fire on any future this world can reach. */
  | { kind: "quiet"; reason: string };

/**
 * Worlds to test a gate against: as it is, at best, and at worst. `requires`
 * is an arbitrary predicate, so this is a heuristic — satisfied by none of the
 * three is read as shut for good.
 */
function probes(state: WorldState): WorldState[] {
  const padding = Array.from({ length: 32 }, (_, i) => ({
    scene: "__probe",
    outcome: "__probe",
    turn: state.turn + i
  }));
  const best: WorldState = {
    ...state,
    presence: { ...state.presence, charge: 1, lucidity: 1 },
    well: { attention: 1, dread: 1 },
    beliefs: Object.fromEntries(
      BELIEFS.map((b) => [b, 1])
    ) as WorldState["beliefs"],
    history: [...state.history, ...padding]
  };
  const worst: WorldState = {
    ...state,
    presence: { ...state.presence, charge: 0, lucidity: 0 },
    well: { attention: 0, dread: 0 },
    beliefs: Object.fromEntries(
      BELIEFS.map((b) => [b, 0])
    ) as WorldState["beliefs"]
  };
  return [state, best, worst];
}

/** Could this scene still fire, on any future the world can reach from here? */
export function couldStillFire(game: Game, scene: Scene): boolean {
  const { state } = game;
  if (!scene.repeatable && state.history.some((h) => h.scene === scene.id))
    return false;
  // Nobody comes back once they are out of play.
  if (!scene.cast.every((p) => state.people[p]?.present)) return false;
  if (!scene.requires) return true;
  return probes(state).some((probe) => scene.requires!(probe));
}

export function runStatus(game: Game): RunStatus {
  if (game.mode.kind === "scene") return { kind: "open" };
  if (eligibleScenes(game).length > 0) return { kind: "open" };

  const played = new Set(game.state.history.map((h) => h.scene));
  const total = game.pack.scenes.length;
  const ever = game.pack.scenes.filter((scene) => couldStillFire(game, scene));

  if (ever.length === 0) {
    return {
      kind: "quiet",
      reason:
        played.size === total
          ? "every scene has played"
          : `${played.size} of ${total} scenes played; the rest can no longer be reached by anyone`
    };
  }

  return {
    kind: "stalled",
    reason: `${played.size} of ${total} scenes played; ${ever.length} still possible, but not from here`
  };
}

export const isQuiet = (game: Game): boolean =>
  runStatus(game).kind === "quiet";
