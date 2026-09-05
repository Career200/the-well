# Audit of `docs/REVIEW.md`, and the work that follows

`claude/review-prototype` carries `docs/REVIEW.md` (1,451 lines) and five code
commits on top of `52e5c2a`. This checks both against the tree.

Everything below was re-measured. Commands are given so each number can be
re-run.

```sh
pnpm typecheck                     # clean, before and after
pnpm test                          # 125 tests, 5 files
npx vite build                     # clean
npx tsx src/cli/sim.ts             # 4 policies x 200 runs
```

---

## Summary

The prototype is green: `tsc`, 125 tests and `vite build` all pass, and the
dead-code inventory is accurate — every symbol it deletes has exactly one
reference in the tree, its own declaration.

Two things do not hold.

1. **The resonance fix does not fix the bug it is for.** It reads a person's
   headroom from the state *before* the outcome's own effects are applied,
   while the effects it emits are applied *after* them. On
   `tomas-alone:confession` — the one outcome in the demo that fires on a
   belonging's use and moves the same emotion that belonging carries — the
   village still hears `tragedy 0.45` where the people moved by an amount worth
   `0.30`. Measured below, with a patch that drives the error to zero.

2. **Findings 1 and 4 are measured against a configuration that never shipped.**
   `docs/REVIEW.md` labels one sweep column *"as the player plays it"*. That
   column is beat zero switched on with policies that cannot play it — two of
   four stand-in players sitting in the dark for sixteen beats. Against the
   sweep as it actually ran, no outcome was unreachable and the two endings
   called "effectively unreachable" were at 8.0% and 10.3% under `haunty`. The
   document retracts finding 4 but keeps the table the retraction rests on.

The sim change is still worth taking: `sweep` measuring a game the client does
not run is a real defect. Its value is that the numbers describe the played
game, not that it recovers content that was out of reach.

---

## 1. The resonance fix, measured

`resolveScene` (`core/engine.ts:957`) builds one effect list and applies it in
order — outcome first, resonance second:

```ts
const changes = [...outcome.effects(game.state, ctx), ...resonanceEffects(game, playing, ctx)];
const state = applyEffects(game.state, changes);   // effects.reduce(applyEffect, state)
```

The prototype clamps `carried` to `1 - felt`, with `felt` read from
`game.state` — the state before the outcome's effects. Four object emotions
overlap with an outcome that moves the same emotion on the same person:

| belonging | emotion | outcome that also moves it |
| --- | --- | --- |
| `knife` | `guilt` | `tomas-alone:confession` (+0.30), `:terror` (+0.15), `:nothing` (+0.10) |
| `coat` | `grief` | `first-water:the-word` (+0.45), `the-hearing:a-body` (+0.40) |
| `whistle` | `curiosity` | `boys-at-the-rim:hooked` (+0.35) |
| `ring` | `tenderness` | none |

`confession` fires only on `ctx.resonance?.object === 'knife'`, so the knife and
the outcome always land together. Driving that scene at a range of starting
`tomas.guilt`, reading `beliefs.tragedy` against the movement the world took:

| `guilt` before | `guilt` after | moved by resonance | `tragedy` | correct | error |
| --- | --- | --- | --- | --- | --- |
| 0.30 | 1.000 | 0.400 | 0.650 | 0.500 | **+0.150** |
| 0.50 | 1.000 | 0.200 | 0.550 | 0.400 | **+0.150** |
| 0.60 | 1.000 | 0.100 | 0.500 | 0.350 | **+0.150** |
| 0.70 | 1.000 | **0.000** | 0.450 | 0.300 | **+0.150** |
| 0.80 | 1.000 | 0.000 | 0.400 | 0.300 | +0.100 |
| 0.90 | 1.000 | 0.000 | 0.350 | 0.300 | +0.050 |
| 1.00 | 1.000 | 0.000 | 0.300 | 0.300 | 0.000 |

At 0.70 the outcome alone saturates Tomas. Resonance moves him by nothing and
the village hears 0.15 of tragedy for it. That is finding 2 restated, inside the
commit that closes finding 2. The prototype's own probe used the ring on Anna —
`tenderness`, the one object emotion no outcome touches, and the only case its
shortcut gets right.

### The patch

Derive `carried` from applied movement, and give `resonanceEffects` the state
its effects will actually land on.

```diff
-  const changes = [
-    ...outcome.effects(game.state, ctx),
-    ...resonanceEffects(game, playing, ctx)
-  ];
-  const state = applyEffects(game.state, changes);
+  const outcomeChanges = outcome.effects(game.state, ctx);
+  const afterOutcome = applyEffects(game.state, outcomeChanges);
+  const resonance = resonanceEffects(afterOutcome, game, playing, ctx);
+  const changes = [...outcomeChanges, ...resonance];
+  const state = applyEffects(afterOutcome, resonance);
```

```ts
function resonanceEffects(state: WorldState, game: Game, scene: Scene, ctx: SceneContext): Effect[] {
  if (!ctx.resonance) return [];
  const def = objectDef(game, ctx.resonance.object);
  if (!def) return [];

  const emotions: Effect[] = [];
  for (const person of scene.cast) {
    const delta =
      TUNING.resonanceGain * def.power * (def.affinity[person] ?? 0.1) * (state.objects[def.id]?.charge ?? 0);
    if (delta <= 0.01) continue;
    emotions.push({ kind: 'emotion', person, emotion: def.emotion, delta });
  }

  // The village reads the people, so belief follows the movement `applyEffect`
  // let through, not the movement asked for.
  const moved = applyEffects(state, emotions);
  const felt = (w: WorldState, p: PersonId): number => w.people[p]?.emotions[def.emotion] ?? 0;
  const carried = scene.cast.reduce((sum, p) => sum + (felt(moved, p) - felt(state, p)), 0);
  if (carried <= 0.01) return emotions;

  return [
    ...emotions,
    { kind: 'belief', belief: BELIEF_OF_EMOTION[def.emotion], delta: carried * 0.5 },
    { kind: 'well', field: 'attention', delta: carried * 0.3 },
  ];
}
```

`PersonId` joins the type import from `./types.js`. Applied: `tsc` clean, 125
tests pass, and the error column above is `0.000` at every row.

The regression test the fix needs, in `tests/engine.test.ts`: resolve
`tomas-alone` with the knife at `tomas.guilt = 0.7` and assert
`beliefs.tragedy` is `0.3` — the authored outcome alone, because the people had
no room left to move.

---

## 2. What the three sweep configurations measure

| | `newGame` | policies |
| --- | --- | --- |
| **(a) shipped** | `newGame(pack, i)` | no beat-zero branch |
| **(b) `REVIEW.md`'s right-hand column** | `newGame(pack, i, { below: true })` | no beat-zero branch |
| **(c) prototype** | `newGame(pack, i, { below: true })` | beat-zero branch |

Coda spine reached, 400 runs per policy, 1,600 per configuration:

| spine | (a) shipped | (b) "as the player plays it" | (c) prototype |
| --- | --- | --- | --- |
| `never-woke` | 0.0% | 50.0% | 25.0% |
| `thrown-cold` | 14.8% | 14.1% | 21.5% |
| `thrown-afraid` | 20.8% | 5.9% | 19.2% |
| `stopped` | **2.0%** | 0.0% | 1.9% |
| `sealed` | **3.0%** | 0.1% | 2.7% |
| `forgotten` | 46.1% | 21.8% | 13.9% |
| `undecided` | 13.4% | 8.0% | 15.8% |

Under `haunty` alone: `stopped` 8.0% in (a) against 7.2% in (c); `sealed` 10.3%
against 9.5%.

Scene outcomes reached by at least one policy, `pnpm sim` as it runs:

```
outcomes never reached, (a): 0 of 19
outcomes never reached, (c): 0 of 19
the-throwing:stopped, (a): 5% under haunty      (c): 5% under haunty
```

`docs/REVIEW.md` W.2 reports this pair as `3 -> 0` and `0.0% -> 1.9%`. Both
figures are (b) against (c). Column (b) is the configuration the prototype
produced by applying `{ below: true }` to `sweep` without the policy branch;
it is not what `pnpm sim` printed at any commit.

The change to take from this is (a) to (c): the sweep now runs beat zero, so its
numbers describe the game the client starts. `never-woke` at 25% is `idle`
correctly never leaving the dark, and `forgotten` falling from 46.1% to 13.9% is
sixteen beats of the turn budget going to beat zero. Neither is coverage
recovered.

---

## 3. Finding by finding

| # | claim | verdict |
| --- | --- | --- |
| 1 | `sweep` skips beat zero, the client does not | **holds.** `policies.ts:60` vs `main.ts:26`. Fix correct; its measured benefit is validity, not coverage |
| 2 | resonance scored on unapplied deltas | **holds. Fix incomplete** — §1 above |
| 3 | resonance out-scales the outcome it rides on | **holds.** `first-water` 0.346 against 0.300; on `tomas-alone` the corrected engine still gives 0.20 of tragedy from the knife against the outcome's 0.30. A dial, not a break |
| 4 | two endings effectively unreachable | **fails.** 2.0% and 3.0% in the shipped sweep. Retracted in the document, but §1's table still labels (b) as the player's game |
| 5 | nothing runs the tests | **holds.** `pages.yml` was the only workflow. `check.yml` is correct: `pnpm/action-setup` before `setup-node`'s `cache: pnpm`, lockfile committed |
| 6 | two renderers, the tested one does not ship | **holds**, and the document's own E.2 answers it: `NEXT_STEPS.md` names the fisheye as the successor. A decision |
| 7 | engine rules reimplemented in the view | **holds**, unverified by running the client. Not touched |
| 8 | cells name a belonging differently from the narration | **holds.** Fix works; see step 2 below for the phone question it opens |
| 9 | the four places are outside the accessibility tree | **holds.** `role="img"` makes its subtree presentational. Fix is complete in both renderers: `role` on the SVG, `aria-label` through `Shaft.label`, `chrome.regions` a sibling of it |
| 10 | mobile-first stated, not met | **plausible, unmeasured.** Arithmetic on the stylesheet; the document states it never ran the game |
| 11 | `DEMO.md` is wrong about the code | **holds.** 7 spines against 12 claimed; `content/below.ts` does not exist; `PLACES` is in `web/shaft.ts`. Not fixed |
| 12 | determinism unusable from the client | **holds. Fix incomplete** — `makeRng` still reads `seed >>> 0 \|\| 0x9e3779b9`, so `?seed=0` and `sweep`'s run 0 both alias to the constant. Listed as closed |
| 13 | dead code | **holds.** Every deleted symbol had one reference, its own declaration. `CODA_MARGIN` was listed and correctly left alone — it is used in its own file |
| A | the logic is overblown in parts | method sound: measured at the decision point after a confounded first attempt, which it reports |
| B | the comments are prose-poisoned | method sound: 757 comments lexed with literals masked |

---

## Status

Applied on this branch. `pnpm typecheck`, 138 tests and `vite build` are green.

| step | state |
| --- | --- |
| CI workflow | done |
| policies play beat zero, sweep runs it | done |
| `carried` from applied deltas, with three tests | done — the prototype's version is not the one taken |
| dead declarations | done, minus the prose |
| cells from `pack.objects` | done — measured in Chromium, fits at 360px and up |
| `makeRng` takes any integer seed | done, with a test |
| seed written into the URL | **not taken** — it pinned the run against a refresh |
| `role="img"` on the SVG | taken as a structural change; the reported symptom did not reproduce |
| `DEMO.md` and `README.md` counts | done |
| `RunReport` records doors and spines | done |
| one roll per decision | done |
| reachability floor and spine coverage | done |

Finding 9 was tested in Chromium at 360px, on the page as it was before the
change: `#shaft[role="img"]` exposed `button "the water"` in the accessibility
tree, along with the SVG's own descendants. Chromium does not prune the
subtree of `role="img"`, and CSS `:focus-visible` is not affected by ARIA at
all. The change stands on its own terms — the accessible name now sits on the
element it describes — not on the defect the review reported.

Open, and unchanged by this branch: findings 3, 6, 7, 10, the `step()` split,
the beat-zero queue, and the 68 "is not" comments. Each is a decision, listed
under *Decisions, not tasks* below.

---

## The plan as it was written

### Step 1 — take from the prototype unchanged

Green as they stand: `tsc`, 125 tests, `vite build`.

- `.github/workflows/check.yml` — `pnpm typecheck` and `pnpm test` on push and
  pull request.
- The accessibility fix: `role="img"` on the SVG in `visuals.ts` and
  `shaft-fisheye.ts`, `label(text)` on the `Shaft` contract, `role` off
  `#shaft` in `index.html` and `shaft.html`.
- Dead code: `Beat.interactive`, `remaining()`, `isQuiet()`, `nameOf()`,
  `ObjectDef.discovered`, `Rng.state`, `#meters` and its CSS.
- `sim/policies.ts`: the beat-zero branch in `choose`, and
  `newGame(pack, i, { below: true })` in `sweep`. Both lines are needed; either
  alone leaves the tool measuring configuration (a) or (b).

### Step 2 — three items to decide before taking

- **The 7 `extra` strings and the `boy-is-curious` flag.** Both are dead by
  measurement. Both are authored content, and `DEMO.md:269` lists `extra` under
  *Known soft spots* — "All eight strings … are authored and read by no code" —
  which reads as kept on purpose. Deleting them also makes that bullet, and its
  count, wrong in a new way.
- **`CELLS` from `pack.objects`.** `#subjects` is `repeat(4, 1fr)` with
  `white-space: nowrap; text-overflow: ellipsis` on `.cell .label`
  (`style.css:249-268`). At 360px each cell is about 80px. `the ring` fits;
  `the brass ring`, `the tin whistle` and `the short knife` are 14–15
  characters at `0.78em` of `0.85rem` and will clip. The fix is right that one
  name should come from one place; whether that name is the long one is a
  question for a phone. Fallback: carry a short label in `ObjectDef` so both
  registers read from content.
- **`history.replaceState`.** Pinning the seed into the address bar means a
  refresh replays the same run for good; a new run needs the query string
  cleared by hand. Showing the seed without writing it to the URL, or writing it
  only when it was asked for, keeps finding 12's benefit without that.

### Step 3 — replace the resonance fix

The patch in §1, plus the `tomas-alone` regression test. Do this before any
`resonanceGain` decision: the constant is being judged through the bug.

### Step 4 — finish the seed fix

`core/rng.ts`:

```ts
let s = Number.isInteger(seed) ? seed >>> 0 : 0x9e3779b9;
```

`0` becomes a valid seed, and `sweep`'s run 0 stops sharing a stream with every
non-integer seed. Keep the client-side validation; drop `asked > 0` once
`makeRng` accepts 0.

### Step 5 — the corrections nothing has made

`docs/DEMO.md`: 12 spines to 7 (lines 163, 193, 211); `content/below.ts` to
`content/prose/below.ts` (121, 191); `PLACES` to `web/shaft.ts` (127, and
again in the table row at 191, which cites `web/visuals.ts` for the places); the
`extra` bullet's count (269), or the bullet itself if step 2 removes the field.

`docs/REWRITE.md`: the file-size table is 2.9x out on `core/engine.ts` and 5.3x
on `tests/`, and promises the stance switch, which `a47146e` removed. A
staleness note is enough; the table is not load-bearing.

If `docs/REVIEW.md` is kept in the tree, §1's table needs its column relabelled
and W.2's before-column restated against (a). As written they are the two
numbers most likely to be quoted back.

### Step 6 — make the sim answer the questions asked of it

Every spine figure in `REVIEW.md`, and every one in this document, came from a
throwaway script, because `RunReport` records outcomes and beliefs and nothing
else.

- `RunReport` records `door` and `spine`. `game.mode` is
  `{ kind: 'over', door, spine }` at the end of a run, so this is a tally
  alongside the ones already there.
- `tests/reachability.test.ts:16` passes a branch at one hit in 480 runs, and
  takes the maximum across policies. A floor per policy states what the comment
  above it already claims.
- `choose` drives five decisions from one `roll` per turn
  (`policies.ts:27-38`). Under `mixed`, `roll < 0.2` is a subset of
  `roll < 0.3`, so a look always takes a beat that would have pushed, and the
  attune index is only ever evaluated on `roll` in `[0.3, 0.6)`. One roll per
  decision.

### Decisions, not tasks

Unchanged from the review's own reading, and none of them blocked by the steps
above: `resonanceGain` (re-open after step 3); which projection to keep;
splitting `step()`; and whether `CLAUDE.md`'s "what it is not" bans contrastive
definition, which decides 68 comments.

---

# `resonanceGain`, measured

`TUNING.resonanceGain` is 3.5. Everything below was measured on the corrected
engine, 300 runs x 4 policies at each value, 60 turns.

## What the dial does

| gain | terminal | haunted | mystery | tragedy | danger | thrown-cold | forgotten | outcomes under the floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.0 | 22% | 0.11 | 0.08 | 0.07 | 0.13 | 3% | 29% | 0 |
| 1.0 | 29% | 0.11 | 0.09 | 0.11 | 0.16 | 6% | 25% | 0 |
| 2.0 | 35% | 0.11 | 0.10 | 0.15 | 0.18 | 11% | 18% | 0 |
| 2.5 | 38% | 0.11 | 0.11 | 0.17 | 0.19 | 13% | 17% | 0 |
| 3.0 | 40% | 0.11 | 0.11 | 0.19 | 0.19 | 16% | 15% | 0 |
| **3.5** | **42%** | **0.11** | **0.11** | **0.21** | **0.20** | **18%** | **14%** | **0** |
| 4.5 | 46% | 0.11 | 0.12 | 0.24 | 0.22 | 22% | 12% | 0 |

Smooth from 0 to 4.5, no breakpoint. `haunted` sits at 0.11 at every value:
resonance does not touch it. `stopped` and `sealed` hold at 2% and 3%
throughout. **At gain 0 every outcome and every coda spine is still reached**,
so nothing in the demo depends on resonance moving belief at all.

What the dial trades is `forgotten` against `thrown-cold`, with `tragedy` as
the carrier: 29% -> 12% and 3% -> 22% across the range.

## The emotion half moves nothing

`resonanceEffects` emits two things: `emotion` effects on the cast, and the
`belief` and `well` effects derived from them. Holding the emotions and
dropping the other two, then sweeping the gain from 0 to 6:

```
gain    confession      terror     nothing     stopped   mean tomas.guilt
0.00            64         415         421          19   0.453
0.50            64         415         421          19   0.457
2.00            64         415         421          19   0.467
6.00            64         415         421          19   0.471
```

Byte-identical outcome counts across a 60x range. `BELIEF_OF_EMOTION`
(`core/types.ts:98`) is read in exactly one place, `engine.ts:1037`, and the
emotions it converts feed only `tomas-alone`'s `weight` and the `confession`
gate — a mean guilt swing of 0.018 against a `feel >= 0.3` threshold and a
`1 + feel * 3` weight. **Every observable effect of the resonance lever runs
through the belief and attention effects.** Deleting them, on the content as
written, leaves the lever inert.

## Per beat, from a fresh village

Belief moved by the authored outcome against belief moved by the resonance
riding with it, for each scene and belonging:

| | outcome | resonance at 3.5 | ratio | resonance at 2.0 | ratio |
| --- | --- | --- | --- | --- | --- |
| `first-water` + ring (`the-word`) | 0.300 | 0.346 | 1.16x | 0.198 | 0.66x |
| `first-water` + coat (`quiet`) | 0.050 | 0.243 | 4.85x | 0.139 | 2.77x |
| `the-asking` + coat (`settled`) | **0.000** | 0.416 | — | 0.238 | — |
| `the-asking` + ring (`settled`) | **0.000** | 0.381 | — | 0.218 | — |
| `the-hearing` + coat (`under-the-coat`) | 0.100 | 0.416 | 4.16x | 0.238 | 2.38x |
| `tomas-alone` + knife (`confession`) | 0.300 | 0.175 | 0.58x | **0.175** | 0.58x |
| `the-throwing` + knife (`thrown-cold`) | 0.350 | 0.325 | 0.93x | 0.231 | 0.66x |

Across the 14 pairs where the outcome moves belief at all, resonance out-moves
the outcome in 7 of 14 at gain 3.5 and 4 of 14 at 2.0; the range runs 0.09x to
4.85x at 3.5 and 0.05x to 2.77x at 2.0.

**The gain does not scale every case.** Where the clamp already binds, the
value makes no difference: `tomas-alone` + knife is 0.175 at both 3.5 and 2.0,
and `boys-at-the-rim` + whistle is 0.075 at both, because the authored outcome
saturates the person before the resonance is applied. Lowering the gain moves
the cases with headroom and leaves the saturated ones where they are.

Notoriety after one use on the first scene, from zero:

| | at 3.5 | `the-hearing` (>0.4) | `the-throwing` (>0.6) | at 2.0 | (>0.4) | (>0.6) |
| --- | --- | --- | --- | --- | --- | --- |
| ring | 0.646 | open | **open** | 0.498 | open | shut |
| coat | 0.293 | shut | shut | 0.189 | shut | shut |
| whistle | 0.147 | shut | shut | 0.105 | shut | shut |
| knife | 0.090 | shut | shut | 0.073 | shut | shut |

One ring use on `first-water` opens both gates at 3.5. At 2.0 it opens only
the first.

## Two things no value of the constant fixes

1. **Resonance pays the same whether the outcome engaged with the belonging or
   ignored it.** `the-asking:settled` is `effects: () => []`. The coat there
   moves 0.416 of belief — more than any authored outcome in the demo except
   `the-throwing`'s 0.35 — and the scene has nothing to say about it. Half the
   rows above are fallback outcomes (`settled`, `bored`, `nothing`, `quiet`,
   `inconclusive`) where the whole movement is side channel.
2. **Resonance scales with cast size; authored outcomes do not.** `carried`
   sums over `scene.cast`, so the two-person `the-asking` and `the-hearing`
   pay roughly double the one-person scenes for the same use.

## Options

| | change | effect |
| --- | --- | --- |
| **A. Leave 3.5** | none | tragedy 0.21 sits level with danger 0.20; 42% of runs reach an ending |
| **B. 2.0** | one constant | the ring stops out-moving `the-word` and stops opening `the-throwing` on beat one; out-moving pairs 7/14 -> 4/14; costs 7 points of terminal reach, `forgotten` 14% -> 18% |
| **C. Author the lever into the content** | outcomes read `ctx.resonance` and move belief themselves; `resonanceEffects` stops emitting `belief`/`well` | the only model where belief moves through authored content. Measured cost: on the content as written this is gain 0 — the lever goes inert until every scene has something to say about a use |

**B is the recommendation.** It is one constant, it fixes both complaints that
survive measurement, and the cost is legible. C is the right end state and is
a content job, not an engine job: the measurement above says the engine change
alone would remove the lever rather than relocate it. The first step toward C
is giving `the-asking:settled` and the other fallback outcomes something to
say when `ctx.resonance` is set — after which the gain can come down further
without the lever going quiet.

---

# Decisions taken

**Both projections stay.** `visuals.ts` ships and `shaft-fisheye.ts` does not,
and the fisheye is not fully reviewed. The end state is both behind a switch
rather than a deletion, so §6 and E.2 are closed as "keep both"; the work is a
selector in `main.ts`, which already goes through the `Shaft` contract, not a
choice between them.
