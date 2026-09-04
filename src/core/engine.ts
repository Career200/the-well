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
  tierOf,
  unsaid
} from "./below.js";
import { erode, resolveCoda, verdictOf } from "./coda.js";
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

/** Four verbs and one glance. Each is paid for on the beat it is taken. */
export type PlayerAction =
  | { kind: "wait" }
  | { kind: "still" }
  | { kind: "haunt" }
  | { kind: "attune"; object: ObjectId }
  | { kind: "look"; object: ObjectId };

/** Set by the first press that lands. Read by the presentation, not the sim. */
export const HAS_PRESSED = "presence.has-pressed";

/** Set by the first refusal, so the line stating the rule is said once. */
const HAS_BEEN_REFUSED = "presence.has-been-refused";

/** A press that found nothing; the next one cannot. */
const SILT_REFUSED = "silt.refused";
const SILT_TAUGHT = "silt.taught";

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
const system = (text: string): NarrationLine => ({ kind: "system", text });

export type Mode =
  /** `lastAmbient` and `lastReadout` are the lines this mode must not repeat. */
  | { kind: "idle"; lastAmbient?: string; lastReadout?: string }
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
}

export interface StepResult {
  game: Game;
  /** Narration for this step, ordered, each line carrying its register. */
  lines: NarrationLine[];
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
  /** Chance a press into the empty dark turns up a belonging. */
  siltChance: 0.4
};

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
    return { pack, state, mode: { kind: "below", phase }, rng };

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
    rng
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
 * Whoever came is missed, at the cost of one discovery. Writes no history, so
 * the scene can come again. `undefined` if the pack has no prose for it.
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
  /** What the action opens the beat with, before the world answers. */
  const lines: NarrationLine[] = [];
  /** And what it closes with, after. The world's turn happens between them. */
  const closing: NarrationLine[] = [];
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
          lines.push(fact(said.busy));
          break;
        }
        if (next.state.flags[OPEN(action.object)] !== true) {
          // Asking a place with nothing to say still costs the beat.
          lines.push(idle(NOTHING_NEW));
          break;
        }
        // No lucidity is spent: the tier is the count of belongings looked at.
        lines.push(
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
        lines.push(fact(said.noSuchThing));
        break;
      }
      if (next.mode.kind === "below") {
        const phase = lookBelow(next.mode.phase, def.id);
        if (!phase) {
          lines.push(fact(said.nothingToSee));
          break;
        }
        next = { ...next, mode: { kind: "below", phase } };
      }
      lines.push(
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
        lines.push(fact(said.noSuchThing));
        break;
      }
      if (!obj.discovered) {
        lines.push(fact(said.notLookedAt));
        break;
      }
      if (obj.charge <= TUNING.spent) {
        lines.push(fact(said.spentBelonging));
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
      lines.push(
        spoken(
          next,
          def.id,
          def.hold?.[use] ?? said.holdFallback.replace("{thing}", def.name)
        )
      );
      // A scene answers back, so the use is held across that answer: taken up,
      // the beat happens, set down. At an empty rim the two halves stay
      // together, and beat zero counts its lines.
      const cooling = def.release?.[use];
      if (cooling) {
        const line = spoken(next, def.id, cooling);
        if (next.mode.kind === "scene") closing.push(line);
        else lines.push(line);
      }
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
        lines.push(
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
      lines.push(...pushed.lines);
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
  let result: StepResult;
  // Coat mid-scene drops the scene: no outcome, no history, can come again.
  // `unhidable` scenes opt out and play on.
  const hidFrom =
    next.mode.kind === "scene" &&
    used === "coat" &&
    !sceneById(next, next.mode.scene)?.unhidable
      ? hideUnderTheCoat(next)
      : undefined;
  if (hidFrom) {
    result = {
      game: { ...hidFrom.game, mode: { kind: "idle" } },
      lines: [...lines, ...hidFrom.lines]
    };
  } else if (next.mode.kind === "scene") {
    result = advanceScene(next, lines);
  } else if (next.mode.kind === "below") {
    result = advanceBelowMode(next, lines, {
      pressedThisTurn: pressed,
      exhaustedThisTurn: exhausted
    });
  } else {
    const wasIdle = next.mode.kind === "idle" ? next.mode : undefined;
    const started = maybeStartScene(next, ...(used ? [{ used }] : []));
    let game = started.game;
    const woken =
      started.lines.length === 0 && lines.length === 0
        ? openSubject(game)
        : undefined;
    if (woken) {
      game = woken.game;
      lines.push(idle(woken.line));
    } else if (started.lines.length === 0 && lines.length === 0) {
      const heard = readout(game, wasIdle?.lastReadout);
      const line = heard?.line ?? ambient(next, wasIdle?.lastAmbient);
      lines.push(idle(line));
      const lastAmbient = heard ? wasIdle?.lastAmbient : line;
      const lastReadout = heard?.key ?? wasIdle?.lastReadout;
      if (game.mode.kind === "idle") {
        game = {
          ...game,
          mode: {
            kind: "idle",
            ...(lastAmbient ? { lastAmbient } : {}),
            ...(lastReadout ? { lastReadout } : {})
          }
        };
      }
    }
    result = { game, lines: [...lines, ...started.lines] };
  }

  // 3a. The action finishes, now that the world has answered it.
  result = { ...result, lines: [...result.lines, ...closing] };

  // 3b. A move in lucidity, in either direction, queues one of the five. It
  //     comes out on some later quiet turn.
  if (
    result.game.mode.kind !== "below" &&
    result.game.state.presence.lucidity !== lucidityBefore
  ) {
    result = { ...result, game: queueSubject(result.game) };
  }

  // 4. And then, if nothing is left, the run says what it was.
  const door = doorOut(result.game);
  if (door && result.game.pack.coda) {
    const coda = result.game.pack.coda;
    const read = (state: WorldState): CodaContext => ({
      state,
      door,
      verdict: verdictOf(state),
      tier: tierOf(state.presence.lucidity, false)
    });

    let state = result.game.state;
    let told = resolveCoda(coda, read(state));

    // `forgotten` takes lucidity first, so the close drops to `veiled` and the
    // words erode as they are read.
    if (told.spine === "forgotten") {
      state = { ...state, presence: { ...state.presence, lucidity: 0 } };
      told = resolveCoda(coda, read(state));
      told = {
        ...told,
        lines: erode(told.lines, () => result.game.rng.next())
      };
    }

    result.lines.push(...told.lines);
    return {
      game: {
        ...result.game,
        state,
        mode: { kind: "over", door, spine: told.spine }
      },
      lines: result.lines
    };
  }

  // The stop lines only speak for a run that has not ended; otherwise they
  // announce an ending the coda is about to tell properly.
  const after = runStatus(result.game).kind;
  if (after !== before && !door) {
    if (after === "stalled") result.lines.push(system(said.stalled));
    if (after === "quiet") result.lines.push(system(said.quiet));
  }
  return result;
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
  const owed =
    !next.state.flags[SILT_TAUGHT] || next.state.flags[SILT_REFUSED] === true;
  if (buried && (owed || next.rng.next() < TUNING.siltChance)) {
    next = withState(
      next,
      applyEffects(next.state, [
        { kind: "object", object: buried.id, field: "found", value: true },
        { kind: "flag", flag: SILT_TAUGHT, value: true },
        { kind: "flag", flag: SILT_REFUSED, value: false }
      ])
    );
    lines.push(fact(said.pushFound), fact(glimpseAt(next, buried)));
    return spent();
  }
  if (buried)
    next = withState(
      next,
      applyEffects(next.state, [
        { kind: "flag", flag: SILT_REFUSED, value: true }
      ])
    );
  lines.push(fact(said.pushEmpty));
  return spent();
}

/**
 * Beat zero. `maybeStartScene` never runs while this mode holds: the run does
 * not begin until the light crosses.
 */
function advanceBelowMode(
  game: Game,
  lines: NarrationLine[],
  input: { pressedThisTurn: boolean; exhaustedThisTurn: boolean }
): StepResult {
  if (game.mode.kind !== "below") return { game, lines };

  const { phase, events } = advanceBelow(game.mode.phase, {
    presenceCharge: game.state.presence.charge,
    pressedThisTurn: input.pressedThisTurn,
    exhaustedThisTurn: input.exhaustedThisTurn,
    siltRolled: game.rng.next() < TUNING.siltChance
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
          { kind: "object", object: event.object, field: "found", value: true },
          { kind: "flag", flag: SILT_TAUGHT, value: true }
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

  // Nothing is said twice down here. Filtering the finished turn covers every
  // source at once: the presence's own lines, subjects, transitions.
  const guard = unsaid(
    phase,
    lines.map((line) => line.text)
  );
  let fresh = lines.filter((_, i) => guard.keep[i]);
  const swallowed = lines.length > 0 && fresh.length === 0;

  // A run of silent turns eventually says something about the dark, but not
  // every gap, and never on the ending turn.
  const silence = fillSilence(guard.phase, fresh.length > 0 || ended);
  let settled = silence.phase;
  if (silence.speak && !ended) {
    const pool = (next.pack.belowProse?.settling ?? []).filter(
      (line) => !settled.said.includes(line)
    );
    const line = pool[Math.floor(next.rng.next() * pool.length)];
    if (line) {
      fresh = [...fresh, idle(line)];
      settled = { ...settled, said: [...settled.said, line] };
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
      return { game: opened.game, lines: [...fresh, ...opened.lines] };
    return {
      game: { ...next, mode: { kind: "idle" } },
      lines: [...fresh, ...crossing]
    };
  }

  next = {
    ...next,
    mode: { kind: "below", phase: { ...settled, pending: queue } }
  };
  return { game: next, lines: fresh };
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

function advanceScene(game: Game, lines: NarrationLine[]): StepResult {
  if (game.mode.kind !== "scene") return { game, lines };
  const playing = sceneById(game, game.mode.scene);
  if (!playing) return { game: { ...game, mode: { kind: "idle" } }, lines };

  const ctx: SceneContext = {
    ...game.mode.ctx,
    beatIndex: game.mode.ctx.beatIndex + 1
  };
  const beat = playing.beats[ctx.beatIndex];

  if (beat) {
    lines.push(scene(beat.text(game.state, ctx)));
    return {
      game: { ...game, mode: { kind: "scene", scene: playing.id, ctx } },
      lines
    };
  }

  const outcome = resolveOutcome(playing, game.state, ctx);
  lines.push(scene(outcome.text(game.state, ctx)));
  const state = applyEffects(
    applyEffects(game.state, outcome.effects(game.state, ctx)),
    resonanceEffects(game, playing, ctx)
  );
  return {
    game: {
      ...game,
      mode: { kind: "idle" },
      state: {
        ...state,
        history: [
          ...state.history,
          { scene: playing.id, outcome: outcome.id, turn: state.turn }
        ]
      }
    },
    lines
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

/** A quality has to be this loud before the village has anything to say. */
const READOUT_FLOOR = 0.3;
/** The two well dials get a second band above this. */
const READOUT_LOUD = 0.6;

/**
 * The village, said back. Loudest quality wins, and only when it is not the
 * one said last.
 */
function readout(
  game: Game,
  avoid?: string
): { key: string; line: string } | undefined {
  const lines = game.pack.readout;
  if (!lines) return undefined;
  const { beliefs, well } = game.state;
  // A dial this far up outranks any belief.
  const dials: [string, number][] = [
    ["attention", well.attention],
    ["dread", well.dread]
  ];
  const loud = dials
    .filter(([, v]) => v > READOUT_LOUD)
    .sort((a, b) => b[1] - a[1])[0];
  const ranked: [string, number][] = [...Object.entries(beliefs), ...dials];
  const [name, value] = loud ?? ranked.sort((a, b) => b[1] - a[1])[0]!;
  if (value <= READOUT_FLOOR) return undefined;

  const dial = name === "attention" || name === "dread";
  const band = dial && value > READOUT_LOUD ? 1 : 0;
  const key = dial ? `${name}.${band}` : name;
  if (key === avoid) return undefined;
  const line = dial
    ? lines[name as "attention" | "dread"][band]
    : lines.beliefs[name as Belief];
  return line ? { key, line } : undefined;
}

/** Never the same line twice running: the pool is small. */
function ambient(game: Game, avoid?: string): string {
  const all = game.pack.ambient ?? [game.pack.presence.ambientFallback];
  const pool = all.length > 1 ? all.filter((line) => line !== avoid) : all;
  return pool[Math.floor(game.rng.next() * pool.length)] ?? "";
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
