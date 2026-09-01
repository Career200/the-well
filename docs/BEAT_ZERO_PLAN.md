# Beat zero — implementation plan

A spike, not the rewrite. Builds the phase specced in `story/BEAT_ZERO.md`
against the engine that exists, deletes nothing, and touches no content
structure.

**What it buys:** the first real measurement of words-per-turn, seconds-per-turn
and phase length — the three constants `DIALS.md` §1 admits are assumptions and
on which the entire 22,500-word budget rests. Plus answers to the four questions
in `BEAT_ZERO.md`, of which "does the player understand that holding cost them
something" is load-bearing for the whole economy.

---

## 1. What is already there

More than expected. From `engine.ts`:

```
TUNING            stillness .14 · pressCost .34 · holdCost .07 · spent .05
                  lucidityPerDiscovery .20
tick()            stillness recovery (only when gathering), press cost,
                  hold cost, and both exhaustion paths already written:
                  'It goes out of you all at once. There is nothing left to
                   push with.'
                  'It goes cold in your hands, and stays cold. There was only
                   ever so much of it.'
readout.ts        water() bands, feelOf(), and band() — the tier-lookup pattern
PlayerAction      wait · look · attune · haunt · release
```

**No new player actions are needed.** The beat-zero ladder maps onto the
existing set exactly: `haunt` disturbs and reveals, `look` takes a glimpse to
plain, `wait` recovers, `attune` spends. The two exhaustion lines the phase is
built around are already written and already good.

## 2. What is explicitly not touched

Any of these appearing in a diff means the spike has become the rewrite:

```
content/scenes.ts · core/scene.ts        untouched, undeleted
Scene, Outcome, resolveOutcome           unchanged
casting · roles · facts · gates-as-data  not started
registers · recurrence · threads         not started
roads · director · weights               not started
sim/policies.ts · tests/                 untouched until §7
```

## 3. Changes

| file | change | ~lines |
| --- | --- | --- |
| `src/content/below.ts` | **new.** The nine subjects as data | 120 (mostly prose) |
| `src/core/below.ts` | **new.** Tier lookup + phase state machine | 130 |
| `src/core/types.ts` | `Mode` gains a third kind; `WorldState` gains `below?` | 8 |
| `src/core/engine.ts` | route `step()` to the phase while in it; suppress `maybeStartScene` | 25 |
| `src/web/main.ts` | render the phase; hide meters/belongings until the phase ends | 20 |
| `src/cli/play.ts` | same, for timing runs | 10 |

Roughly **300 lines, half of them prose.**

### `content/below.ts`

```ts
export interface BelowSubject {
  id: string
  glimpse?: string        // belongings only
  veiled: string
  plain: string
  named: string           // authored now, unreachable in beat zero
  extra?: string
}
```

Populated from `story/descriptions/below.md`, which already has veiled, plain
and named for all nine and glimpses for the four belongings. `named` goes in
unused — it is late-game payoff and beat zero must not reach it.

### `core/below.ts`

```ts
type Movement = 1 | 2 | 3

interface BelowPhase {
  movement: Movement
  turn: number
  revealed: SubjectId[]              // ambient, fixed: cold, water, walls, sky, silt
  found: [ObjectId, ObjectId]        // the two, drawn from rng at phase start
  seen: Record<ObjectId, 'glimpse' | 'plain'>
  exhausted: boolean
}

tierOf(lucidity, isBelonging): 'veiled' | 'plain' | 'named'
```

`tierOf` uses `readout.ts`'s `band` helper and applies the one-tier-ahead rule
for belongings. **This function is permanent** — every subject in the finished
game reads through it. Get it right; the phase runner around it is disposable.

### Transitions

Conditions, not a script. Each is a threshold on state that already exists:

```
I → II    presence has been spent at least twice (or exhaustion fired)
II → III  presence has recovered above a floor after having been below it
end       ambient five revealed AND ≥1 belonging at plain
          hard cap at N turns regardless
```

The two belongings are drawn at phase start from the seeded rng so a run is
reproducible from its seed.

## 4. Two numbers that need deciding at the keyboard

Both fall straight out of the existing tuning and neither can be settled on
paper:

**Recovery is slow.** At `stillness .14`, empty to full is **seven still
turns**. Movement II is the stillness lesson, and seven turns of nothing at
Seedship pace is dead air. Either the lesson lands on partial recovery — enough
to press again, not full — or beat zero needs its own rate. Try partial first;
it is free.

**The phase may be too long.** 12–16 turns at ~29 words and ~10s per turn is
**120–160 seconds** against the 90 assumed. Either the phase is shorter than
specced or the per-turn text is. This is exactly the measurement the spike
exists to take, so do not pre-correct it — build it, time it, then decide.

## 5. Prose

Use `below.md` verbatim. Stub the ten missing blocks as one-liners:

```
the opening dark        3–4    before any subject resolves
movement transitions    3      I→II→III, felt not announced
exhaustion              2      partly written already in tick()
the light crossing      1      the end, and the run beginning
```

**Write the real ~400 words after playing it**, against a rhythm that has been
felt rather than specified.

## 6. Order

1. `content/below.ts` — data only, no behaviour. Typechecks.
2. `tierOf` + a unit test. The permanent half, done first.
3. `BelowPhase` + transitions, driven from the CLI. Playable, ugly.
4. **Play it. Time it.** Record turns, seconds, words per turn.
5. Web rendering.
6. Write the ten blocks.
7. Play it again, timed, and record the same three numbers.

Checkpoint after 4: if the answer to *does holding read as irreversible* is no,
stop and fix the economy before any more prose is written.

## 7. Tests

Three, no more. `tests/` is otherwise untouched.

```
tierOf bands correctly, and belongings run one tier ahead
the phase always terminates — every stance sequence, including all-still
        and all-press, reaches the end inside the cap
exactly two belongings are reachable, and the pair is stable for a seed
```

## 8. Done when

`pnpm play` opens in the dark, resolves the ambient five whatever the player
does, reveals two belongings to a player who acts, ends on the light crossing,
and never starts a scene before it does — with the three timing numbers written
down.
