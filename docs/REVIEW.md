# Code review

A pass over everything in `src/`, `tests/`, the root HTML, the build and the
docs, read against what the repository says about itself in `CLAUDE.md`,
`README.md` and `docs/DEMO.md`.

Every number here was measured, not estimated. The commands are given so each
one can be re-run.

```sh
pnpm typecheck   # clean
pnpm test        # 125 tests, 5 files, all pass
pnpm sim         # balance sweep, 4 policies × 200 runs
```

Findings are ordered by what they cost, not by where they live. Each carries a
severity and the evidence for it.

---

## Summary

The engine is sound and well tested. The problems are at the seams:

1. The balance tool and the reachability test both measure a configuration of
   the game the player is never in, because two of the four stand-in players
   cannot get through the opening at all.
2. Resonance is scored on deltas that were never applied, so it keeps paying at
   full rate against a person who cannot feel any more, and it moves belief
   further than the authored outcome it accompanies does.
3. Two of the seven endings are effectively unreachable, one of them the only
   ending in which the player prevents the murder.
4. Nothing runs `pnpm test`. The one CI workflow builds and deploys.
5. Half of `src/web` is a second renderer that never reaches a player, and it
   is the half that has tests.

Below that line the findings are ordinary: duplicated rules, dead code, an
accessibility bug in the picture, and a reference document that is wrong about
the thing it exists to be right about.

### The shape of the tree, measured

| | lines |
| --- | --- |
| `src/core` | 2,023 |
| `src/content` (514 of it prose) | 863 |
| `src/web` — reaches the player | 1,755 |
| `src/web` — does not | 1,764 |
| `src/sim` + `src/cli` | 109 |
| `tests` | 1,462 |
| CSS | 838 |
| root HTML (`index` 26, `shaft` 16, `projections` 545) | 587 |
| docs about the demo (`DEMO`, `SHAFT_UI_PLAN`, `NEXT_STEPS`, `README`, `CLAUDE`) | 751 |
| docs about the unbuilt game | 5,435 |

27% of `src/` is a renderer nobody plays. The docs describing the unbuilt game
are 83% the size of the entire source tree.

---

## 1. The balance tool measures a game nobody plays

**Severity: high.** This is the finding the other balance findings hang off.

`sweep` starts every run with `newGame(pack, i)` — no `{ below: true }`
(`src/sim/policies.ts:60`). The web client starts with it
(`src/web/main.ts:26`). So `pnpm sim` and `tests/reachability.test.ts` measure a
game that begins after beat zero, hands the player two belongings for free, and
skips the first sixteen beats.

That is not a considered simplification. The policies cannot play beat zero:

```
src/sim/policies.ts:32-33
const wantsHaunt  = !inScene ? 0 : policy === 'haunty' ? 0.6 : ...
const wantsAttune = !inScene ? 0 : policy === 'resonant' ? 0.5 : ...
```

`inScene` is `mode.kind === 'scene'`. In beat zero the mode is `below`, so both
weights are zero and every policy falls through to `{ kind: 'wait' }`. Only the
dig branch at `policies.ts:22` fires, and only for `resonant` and `mixed`, which
push by accident while looking for buried belongings.

Sixteen beats of beat zero, per policy, seed 1:

```
idle      wait wait wait wait wait wait wait wait wait wait wait wait wait wait wait wait
haunty    wait wait wait wait wait wait wait wait wait wait wait wait wait wait wait wait
resonant  still still haunt still still haunt still still still haunt still ...
mixed     still still haunt still still haunt still still still haunt still ...
```

`haunty` — the policy whose whole purpose is to press — is byte-for-byte
identical to `idle` in the dark. It never presses, `eyesOpen` stays false, the
light never crosses, and `doorOut` starves it at the cap.

Turning beat zero on changes the answer to nearly every balance question. Coda
spine reached, 400 runs per policy, both configurations:

| spine | as `pnpm sim` runs it | as the player plays it |
| --- | --- | --- |
| `never-woke` | 0.0% | **50.0%** |
| `thrown-cold` | 15.0% | 14.2% |
| `thrown-afraid` | 20.8% | **5.9%** |
| `stopped` | 2.0% | **0.0%** |
| `sealed` | 3.0% | **0.1%** |
| `forgotten` | 46.1% | 21.9% |
| `undecided` | 13.2% | 7.9% |
| starved / terminal | 62% / 38% | **80% / 20%** |

Per policy, with beat zero on:

```
policy     never-wok thrown-co thrown-af   stopped    sealed forgotten undecided   turns
idle            100%        0%        0%        0%        0%        0%        0%   16
haunty          100%        0%        0%        0%        0%        0%        0%   16
resonant          0%       30%        0%        0%        0%       54%       16%   45
mixed             0%       27%       24%        0%        1%       33%       15%   44
```

Two of four stand-in players end 100% of their runs having never left the dark.

**What follows from it.** `tests/reachability.test.ts` is the repository's
stated guard against writing a branch nobody can reach
(`README.md:58`: "fails the build if a branch becomes impossible"). It runs the
same `sweep`, so it inherits the same blind spot. `the-throwing:stopped` passes
the test at 6 hits in 480 runs and is unreachable by every policy in the mode
the player is actually in.

The test's threshold is also `> 0` (`reachability.test.ts:16`). One hit in 480
runs passes. It proves "not literally impossible", which is not what the comment
above it claims.

Two of the three assertions in `the levers do different things` are close to
vacuous. `a player who does nothing changes nothing` tests a policy that returns
`{ kind: 'wait' }` unconditionally — it asserts that `wait` does nothing.
`the canon event is reachable but never guaranteed` bounds the hit total below
`120 × 3 = 360`, a ceiling the terminal scene cannot approach because a run
takes exactly one of its outcomes.

**Also:** `choose` consumes a single `roll` per turn and reuses it for every
decision — the look gate, the look target, the haunt gate, the attune gate and
the attune target (`policies.ts:27-38`). The decisions are therefore correlated
rather than independent. Under `mixed`, `roll < 0.2` (look) is a strict subset
of `roll < 0.3` (haunt), so looking always steals the rolls that would have
pushed; and the attune target `Math.floor(roll * 13) % len` is only ever
evaluated on `roll ∈ [0.3, 0.6)`, which for four belongings yields indices
`{3,0,1,2,3}` — never uniform. The reported per-object rates are biased.

**Fix.** Give the policies a beat-zero branch, run the sweep with
`{ below: true }`, draw an independent roll per decision, and record doors and
spines in `RunReport` so endings get the same coverage outcomes get.

---

## 2. Resonance is scored on deltas that were never applied

**Severity: high.** A correctness bug in the model the demo exists to test.

`resonanceEffects` (`src/core/engine.ts:999-1029`) builds one `emotion` effect
per cast member, sums the *nominal* deltas into `carried`, and derives the
belief and attention movement from that sum:

```ts
const delta = TUNING.resonanceGain * def.power * (def.affinity[person] ?? 0.1) * charge;
if (delta <= 0.01) continue;
effects.push({ kind: 'emotion', person, emotion: def.emotion, delta });
carried += delta;
...
effects.push({ kind: 'belief', belief: BELIEF_OF_EMOTION[def.emotion], delta: carried * 0.5 });
effects.push({ kind: 'well', field: 'attention', delta: carried * 0.3 });
```

`applyEffect` clamps every emotion to `[0,1]` (`src/core/effects.ts:31`).
`carried` does not know that. Using the ring on Anna in `first-water`:

```
anna.tenderness before 0.00 -> after 0.693   tragedy 0.646   attention 0.508
anna.tenderness before 0.50 -> after 1.000   tragedy 0.646   attention 0.508
anna.tenderness before 1.00 -> after 1.000   tragedy 0.646   attention 0.508
```

Anna at 1.00 cannot move. The village still hears the full 0.346 of tragedy and
0.308 of attention. The stated model — resonance reaches the people, and the
village reads the people — is short-circuited: the belief is computed from the
number the effect asked for, not the number the world took.

The same reasoning applies to a person already at 1.0 from a previous scene, so
the error compounds over a run rather than appearing once.

**Fix.** Apply the emotion effects first, diff the people before and after, and
derive `carried` from the applied movement.

---

## 3. Resonance out-scales the content it accompanies

**Severity: high.** Same probe, read the other way.

The authored outcome `first-water:the-word` moves tragedy by 0.30 and attention
by 0.20 (`src/content/scenes.ts:49-55`). The resonance riding alongside it moves
tragedy by 0.346 and attention by 0.208. **The side channel moves belief further
than the hand-written outcome does.**

The gates that structure the back half of the run are `notoriety(s) > 0.4` for
`the-hearing` and `> 0.6` for `the-throwing` (`scenes.ts:163,193`). One ring use
on the first scene puts notoriety at 0.646 — past both. The late game is not
gated by play; it is gated by one click.

`TUNING.resonanceGain` is 3.5 against `power` values of 0.28–0.35, so the
product is near 1.0 before affinity and charge. That single constant is doing
more work than every outcome in `content/scenes.ts` put together, and there is
no test asserting a relationship between the two.

**Fix.** Either bring `resonanceGain` down until an outcome's own effects
dominate, or make resonance shape which outcome fires rather than adding belief
alongside it. A test asserting that no resonance moves a belief further than the
outcome it lands with would keep it there.

---

## 4. Two endings are effectively unreachable

**Severity: medium-high.** From the sweep in §1, with beat zero on:

- `stopped` — 0.0% across all four policies, 1,600 runs. The scene outcome
  behind it (`the-throwing:stopped`) requires `pressure >= UNDENIABLE` **and**
  `beliefs.haunted > 0.4` on the same beat. `UNDENIABLE` is 0.6, so two pushes
  inside one three-beat scene, at `pressCost` 0.34 each, from a bar that
  recovers 0.14 a beat. And `haunted > 0.4` needs a run spent haunting, which is
  the play style that starves in the dark.
- `sealed` — 0.1%.

`stopped` is the only ending in which the player changes what happens rather
than what is believed about it.

> **Corrected by the work plan below.** This finding blamed the game. It was the
> measurement. Both outcomes are reachable once the stand-in players can leave
> beat zero — an 11-line change to `sim/policies.ts` — after which `stopped`
> runs at 7% and `sealed` at 10% under `haunty`, and all 19 outcomes fire.
> Nothing about the scenes had to change. See *Work plan* §W.2.

`README.md:64` tells a contributor adding a scene to "run `pnpm sim` and check
the new outcomes are not at 0%". `the-throwing:stopped` prints `0%  stopped  ·`
in three of the four policies today.

---

## 5. Nothing runs the tests

**Severity: high.** `.github/workflows/pages.yml` is the only workflow. Its
steps are `checkout`, `pnpm install`, `pnpm build`, `configure-pages`,
`upload-pages-artifact`, `deploy-pages`. There is no `pnpm test` and no
`pnpm typecheck` step.

`vite build` uses esbuild, which strips types without checking them, so a green
deploy says nothing about either the tests or the types.

Three claims in the repository depend on a CI that does not exist:

- `CLAUDE.md:21` — "Engine invariants, enforced by `pnpm test`".
- `README.md:45` — "`pnpm test` asserts it."
- `README.md:58` — "fails the build if a branch becomes impossible."

The tests are good and they pass. Nothing makes them a gate.

Related: `package.json` defines `"lint": "tsc --noEmit"`, which is the same
command as `typecheck`. There is no linter, no formatter, no `.editorconfig`,
no Prettier or ESLint config anywhere in the tree. The result shows:
`core/engine.ts` (292 double quotes to 11 single) and `core/ledger.ts` (all
double) are formatted one way; the other 24 TypeScript files are formatted the
other. Two files also carry a comment truncated mid-sentence with trailing
whitespace (`src/web/visuals.ts:226`, `src/web/main.ts:303`), which a formatter
would not fix but a review gate would.

**Fix.** One workflow on push and pull request running `pnpm typecheck` and
`pnpm test`. Add Prettier with the settings the majority of the tree already
uses, and make `lint` mean something.

---

## 6. Half of `src/web` never reaches a player, and it is the tested half

**Severity: medium.** There are two complete implementations of the `Shaft`
contract in `src/web/shaft.ts`:

```
index.html → main.ts → visuals.ts    → chrome, clock, grain, sky, svg     1,755 lines, shipped
shaft.html → shaft-debug.ts → shaft-fisheye.ts
                                     → camera, figure, projection, water  1,764 lines, not shipped
```

`vite build` takes only the root `index.html`, so `shaft.html` and
`projections.html` never leave a developer's machine — `shaft-debug.ts:2-3`
says so explicitly. That is a defensible way to keep a harness around. What is
not defensible is the test distribution:

- `tests/projection.test.ts` (18 tests) and `tests/camera.test.ts` (10 tests)
  cover `projection.ts` and `camera.ts` — the unshipped renderer.
- `visuals.ts` (595 lines), `main.ts` (577), `chrome.ts`, `clock.ts` — the
  renderer and client the player actually touches — have **no tests at all**.

The geometry itself now exists in three places, none of which share code:

1. `visuals.ts:272-295` — homothetic sections solved by binary search on a joint
   angle.
2. `projection.ts` + `shaft-fisheye.ts` — an equidistant fisheye camera.
3. `projections.html:136-545` — 545 lines of untyped inline JavaScript with its
   own `ring()`, `camSpace()`, `fisheye()` and section solver, importing nothing
   from `src/`. `tsconfig.json` includes only `src`, `tests` and
   `vite.config.ts`, so this file is never typechecked and never built.

`src/web/water.ts:18-19` carries the same indecision inside one file: *"How a
rise draws is two candidates, kept side by side until one is chosen"*. Both are
implemented and shipped in the module.

`docs/NEXT_STEPS.md` lists "Which projection" as an open question, so this is a
known state rather than an oversight. It is still 1,764 lines of maintenance
surface plus a third untyped copy, held open indefinitely.

**Fix.** Pick a projection, delete the other, and move `projections.html`'s
math into `src/` behind a test or delete the page. Then write the first test
for `visuals.ts`.

---

## 7. Engine rules reimplemented in the view

**Severity: medium.** `README.md:43` states the invariant: *"`step()` is pure.
Both clients are dumb views over it."* The web client is not a dumb view.

**The resonance formula exists three times.**
`resonanceStrength` (`engine.ts:262-270`) computes it for `ctx.resonance`;
`resonanceEffects` (`engine.ts:1010-1015`) recomputes it from scratch and
ignores `ctx.resonance.strength` entirely; and `strengthOf`
(`main.ts:359-368`) builds it a third time in the client by applying an
`objectCharge` effect to a copy of the state and calling `resonanceStrength`.

`Resonance.strength` is documented in `src/core/scene.ts:23` as *"Post-affinity
strength for the cast of the current scene"* and is read by nothing in the
engine — only by `main.ts:414` and `dev.ts:66`. It is a cached value the code
that would use it recomputes, which is the arrangement that lets the two drift.

**The pressure banding exists twice.** `afterAction` (`main.ts:408-423`)
reconstructs `recoilOf(pressed ? pressure + TUNING.pressure : pressure)` —
reimplementing what `press()` does in the engine, including the affordability
test.

**"Can the presence push?" — `charge < TUNING.pressCost` — is written five
times:** `engine.ts:544`, `main.ts:280`, `main.ts:411`, `main.ts:556`, and
`engine.ts:720` inside `press`. Five places to change to move one number.

**The client authors a narration line.** `main.ts:228-233` calls `runStatus`
itself, decides the run has gone quiet, and speaks `pack.presence.nothingFurther`
into the log with `kind: 'idle'`. `docs/DEMO.md:166` says of `register`: *"The
engine decides; the client only dresses it."* Here the client decides.

**Fix.** Have the engine expose the derived values the picture needs — the
current resonance strength as applied, the pressure band, whether a push is
affordable — and have `step` emit the quiet line the way it emits the stalled
one (`engine.ts:665`).

---

## 8. The belonging cells show a different name from the narration

**Severity: medium.** A visible inconsistency, and a direct breach of the
one-place-for-prose rule in `CLAUDE.md`.

`src/web/main.ts:42-47` hardcodes the cell labels:

```ts
const CELLS = [
  { id: 'ring',    label: 'the ring' },
  { id: 'whistle', label: 'the whistle' },
  { id: 'knife',   label: 'the knife' },
  { id: 'coat',    label: 'the coat' },
];
```

`src/content/prose/belongings.ts:60-65` gives the real names:

```
ring: 'brass ring'   whistle: 'tin whistle'   knife: 'short knife'   coat: 'coat'
```

`subjectName` (`engine.ts:347-350`) captions narration with `the ${def.name}`,
so the log says **the brass ring** while the button under it says **the ring**.
Same screen, same object, two names.

`main.ts:243` defines exactly the helper that fixes this —

```ts
const nameOf = (id: string): string => pack.objects.find((o) => o.id === id)?.name ?? id;
```

— and nothing calls it.

`src/web/chrome.ts:57` has the same shape of problem for the places: it builds
`aria-label` as `the ${id}` from the place id rather than reading
`pack.below[id].name`. It happens to agree today because all four ids equal
their names, which means the bug is invisible until someone renames a place.

`src/web/main.ts:522` hardcodes `'look closer'` as a button title.

**Fix.** Delete `CELLS`' labels, build the cells from `pack.objects`, use
`nameOf`, and pass the place names through `pack.below`.

---

## 9. The four places are invisible to a screen reader

**Severity: medium.** `index.html:11` is `<div id="shaft" role="img">`.
`makeShaft` mounts everything into that host, including the tap targets:

```ts
host.replaceChildren(svg, chrome.corners, chrome.regions);   // visuals.ts:210
```

`chrome.regions` holds the four `<button class="place">` elements
(`chrome.ts:52-61`). ARIA treats the subtree of `role="img"` as presentational,
so those four buttons — a third of the game's controls — are removed from the
accessibility tree. Their `aria-label`s and the `:focus-visible` outline at
`style.css:558` are both unreachable.

The same pattern is in `shaft.html:12`.

**Fix.** Move `chrome.regions` out of the `role="img"` element, or drop
`role="img"` from `#shaft` and put the label on the SVG.

---

## 10. Mobile-first is stated, not met

**Severity: medium.** `CLAUDE.md` and `docs/DEMO.md:232` both say the demo is
played on a phone. `docs/DEMO.md:240-262` lists four gaps honestly; all four are
still open, and the measurements are worse than "roughly":

**Tap targets.** `.cell` is `font-size: 0.78em` inside a `button` at
`0.85rem`, with `padding: 0.45rem 0.3rem` (`style.css:255-261`). On a 360px
viewport the base font resolves to 14.14px, so a cell is ≈80 × 33 px against the
44px minimum in WCAG 2.5.5. `.actions button` at `padding: 0.5rem 1.15rem`
lands at ≈40px — also under.

**Hover is the affordance.** `#shaft .places .place:hover` (`style.css:551`) and
the `title` tooltips at `main.ts:522` do not exist on touch. A belonging's
warmth — `feelOf` — reaches a phone only as the `data-feel` border colour.

**Resize rebuilds the picture.** `visuals.ts:566` attaches
`new ResizeObserver(layout)` with no coalescing and no dimension check.
`layout()` calls `replaceChildren()` on four groups and then constructs every
dot individually: on a 1400×900 viewport that is on the order of 3,000
`createElementNS` + four `setAttribute` calls + `append`. Mobile browser chrome
resizes the viewport continuously during a scroll, so this runs on every frame
of a scroll gesture on the target platform.

**Fix.** `requestAnimationFrame`-coalesce the observer and return early when
`clientWidth`/`clientHeight` are unchanged. Raise the cells to a 44px minimum.
Replace `title` with something that survives touch.

---

## 11. `docs/DEMO.md` is wrong about the code it exists to describe

**Severity: medium.** The document opens with *"every claim in this document is
checked against the code"* and exists to stop the demo and the full game being
confused. Checked against the code:

| claim | where | actual |
| --- | --- | --- |
| "Twelve spines in `content/coda.ts`" | `DEMO.md:163` | **7** |
| "coda spines \| 12" | `DEMO.md:193` | **7** |
| "12 coda spines" | `DEMO.md:211` | **7** |
| belongings "defined as data in `content/below.ts`" | `DEMO.md:121` | no such file; it is `content/prose/below.ts` |
| "ambients / places … `content/below.ts`" | `DEMO.md:191` | same |
| "`PLACES` in `web/visuals.ts`" | `DEMO.md:127` | `PLACES` is in `web/shaft.ts` |
| "All eight strings" of `extra` | `DEMO.md:269` | **7** |

`docs/REWRITE.md:24-37` is worse, because its argument depends on its numbers.
Its table sizes the rewrite file by file and concludes *"About a third of the
code survives."* Against the tree today:

| file | REWRITE says | actual | drift |
| --- | --- | --- | --- |
| `core/engine.ts` | 413 | 1,185 | **2.9×** |
| `core/content.ts` | 64 | 131 | 2.0× |
| `core/types.ts` | 94 | 109 | |
| `content/people.ts` | 37 | 19 | |
| `tests/` | 275 | 1,462 | **5.3×** |

The same table promises to keep "the stance switch", a mechanism removed in
commit `a47146e`, and the surrounding text says "there are only five scenes"
where there are six. The document already carries a staleness warning about the
road model; the line counts and the survival estimate need one too.

---

## 12. Determinism is real in the engine and unusable from the client

**Severity: low-medium.** `tests/engine.test.ts:31-58` genuinely asserts that
seed plus action log reproduces both world and narration. That holds.

The client throws the seed away. `main.ts:25`:

```ts
const seed = Number(new URLSearchParams(location.search).get('seed') ?? Math.floor(Math.random() * 1e5));
```

A run started without `?seed=` picks a random seed, never displays it, and never
writes it back to the URL. A player who hits an interesting run cannot reproduce
or report it, and neither can a developer watching over their shoulder. The
invariant the engine pays for is not spendable.

The seed is also unvalidated: `?seed=abc` gives `NaN`, and `makeRng`
(`rng.ts:11`) does `seed >>> 0 || 0x9e3779b9` — `NaN >>> 0` is `0`, which is
falsy, so it silently becomes the golden-ratio constant. `?seed=0` aliases to
the same stream, which also means `sweep`'s run 0 (`policies.ts:60` passes
`i = 0`) is not an independent sample.

**Fix.** `history.replaceState` the chosen seed into the URL on start; reject a
non-finite seed instead of coercing it; use `Number.isInteger(seed) ? seed : …`
in `makeRng` so `0` is a valid seed.

---

## 13. Dead code and vestigial generality

**Severity: low**, individually. Together they are the reason the engine reads
as larger than the game it runs.

**Declared, never used:**

| | where |
| --- | --- |
| `Beat.interactive` | `core/scene.ts:30` — declared, set by no scene, read by no code |
| `remaining()` | `core/readout.ts:51` — exported, called nowhere |
| `isQuiet()` | `core/engine.ts:1184` — exported, called nowhere |
| `nameOf()` | `web/main.ts:243` — see §8 |
| `ObjectDef.discovered` | `core/content.ts:28` — no object sets it |
| `BelowSubject.extra` | `core/below.ts:18` — 7 authored strings, read by nothing |
| `boy-is-curious` | `content/scenes.ts:103` — flag set, read by nothing |
| `#meters` | `web/main.ts:526-540` — rebuilt on every render, then `display: none` (`style.css:422`) |
| `Resonance.strength` | `core/scene.ts:23` — see §7 |
| `CODA_MARGIN` | `core/coda.ts:41` — exported, used only in the same file |

**Generality nothing uses.** `Beat.text` and `Outcome.text` are typed
`(state, ctx) => string` (`core/scene.ts:28,37`). Every one of the 6 scenes and
19 outcomes is built by `content/scenes.ts:22-23` as `() => line` — a constant.
No prose in the demo reads state or context. Every scene has exactly three
beats, so variable-length scenes are also untested generality.

**Optionality modelling a plugin system that does not exist.** `ContentPack`
marks eight fields optional — `well`, `ambient`, `readout`, `hiding`,
`noticing`, `coda`, `below`, `belowProse` (`core/content.ts:83-105`). There is
exactly one pack and it supplies all eight (`content/index.ts:10-23`). The cost is paid
across the engine as `?.`, `?? []`, `?? ''`, `?? def.name` — each an untested
branch. `engine.ts:635` is the sharpest: `if (door && next.pack.coda)`. A pack
without a coda never ends; the run continues past its own door forever.

**Fix.** Delete the unused declarations. Make the pack fields required and
delete the fallbacks with them, or add a pack that omits them and test the
fallback paths.

---

## 14. Smaller things

**A refused push still agitates the water.** `main.ts:216` sets
`pushedThisBeat = action.kind === 'haunt'` before `step`, without checking
affordability. `render` passes it as `pressing`, and `visuals.ts:573` strikes
the clock on it. So a push the engine refused for want of charge produces the
full ripple, the `.pressing` grain colour (`style.css:474`) and the corner
flinch (`chrome.ts:97`). The words say the presence is too thin; the picture
says the push landed.

**Redundant work per beat.** `runStatus` is computed three times in one `step` —
`engine.ts:396` (`before`), inside `doorOut` at `engine.ts:382`, and again at
`engine.ts:664` — and the client computes a fourth at `main.ts:228`. Measured on
a real run: 6 scene `requires` evaluations per beat during beat zero, where
`doorOut` short-circuits; more once `couldStillFire` starts building probe
worlds, each of which allocates a fresh 32-element history array
(`engine.ts:1124`). Trivial at six scenes. The demo exists to justify a much
larger deck, and this is `O(scenes × probes)` per call, four calls a beat.

**Two magic strings for one flag.** `engine.ts:41` exports
`HAS_PRESSED = "presence.has-pressed"` with the comment "Read by the
presentation, not sim." The presentation does not read it. `content/coda.ts:26`
does, and does so by retyping the literal rather than importing the constant.

**An unguarded throw in the engine.** `resolveOutcome`
(`core/scene.ts:63`) throws `Scene ${id} has no outcomes` at runtime. A content
error that a type or a test could catch instead crashes a player's run.

**`pickWeighted` does not enforce its own contract.** `rng.ts:28` documents
"Weights must be positive". Nothing checks. With `roll` exactly 0 — which
`mulberry32` can return — the first item is selected regardless of its weight,
and a negative weight corrupts the total. `maybeStartScene` guards its own call
with `Math.max(0.0001, …)` (`engine.ts:298`), which is the workaround, in the
caller, for a contract the callee does not hold.

**A latent division by zero in the layout.** `visuals.ts:276` divides by
`1 - SECTION_ASPECT * a`. With `SECTION_ASPECT = 0.28` that is zero at
`a = 3.571`, i.e. a joint angle of 74.4°. The search range is `[22, 40]`
(`visuals.ts:34`), so it is safe today and silently unsafe if either constant
moves.

**Comments that describe code that is not there.**
`visuals.ts:474-477` — *"only re-walk it when the number that shapes it has
moved"* — the guard only fires when agitation is exactly zero, and `clock.phase`
also shapes the path, so it necessarily re-walks every tick while agitated.
`engine.ts:946` — *"`silent` only drops the line"* — an unfinished sentence.
`engine.ts:321` reads as two half-merged sentences.

**A dead condition.** `engine.ts:119-120`: `subject && id !== undefined` —
`subject` is only truthy when `id` was defined.

**A layering inversion.** `BelowPhase.pending` is typed `NarrationLine[]`
(`core/below.ts:60`), putting rendered narration inside the phase runner's
state. `advanceBelow` never writes it; only `engine.ts:887` does. The field
belongs to the engine, not to `below.ts`.

**A dead initialiser.** `visuals.ts:287`: `let angle = SHAFT_ANGLE[1]!` is
overwritten on the first iteration of the loop below it.

**Third-party script with no integrity check.** `web/analytics.ts:9` injects
`//gc.zgo.at/count.js` over a protocol-relative URL, with no `integrity`, no
`crossorigin`, and no Content-Security-Policy anywhere in the tree. It is
PROD-gated and GoatCounter is a reasonable choice; the loading is still
unpinned.

---

## What is good

Worth stating, because the findings above are not a verdict on the whole thing.

- **The effect system.** `Effect` as a data union with `applyEffect` as the only
  writer (`core/effects.ts`) is the right shape. It makes content inspectable,
  diffable and testable without playing it, and the discipline holds throughout
  `content/` — no content file mutates state.
- **The test suite.** 125 tests over determinism, the presence economy,
  belongings, the silt, the places, the stop, the coda, hiding under the coat,
  and who is speaking. They read as specifications rather than as coverage, and
  several — `a use on the beat that ends a scene is set down before the village
  speaks`, `being forgotten takes the words back as it says them` — pin
  behaviour that would otherwise be impossible to change safely.
- **The ledger.** `core/ledger.ts` is 80 lines and solves repetition across
  every narration channel with one configurable mechanism. `depth: Infinity` +
  `exhausted: 'silent'` for beat zero, `depth: 3` for the village, is the right
  amount of structure.
- **The prose split.** `src/content/prose/**` really is the only place
  player-facing prose lives, with two exceptions (§8). The `satisfies
  Record<keyof typeof belongingProse, string>` at `belongings.ts:65` and the
  `OutcomeKey<K>` machinery at `scenes.ts:8-13` make `tsc` check that every
  mechanic has prose and every piece of prose has a mechanic.
- **`runStatus`.** Distinguishing `stalled` from `quiet`, and probing best- and
  worst-case worlds to tell them apart, is more care than a prototype usually
  gets, and it is what stops a played-out run leaving the player at the bottom
  of a finished world.
- **The unshipped renderer.** `projection.ts` and `camera.ts` are clean, pure,
  DOM-free and tested. The problem in §6 is that they exist alongside a second
  renderer, not that they are bad.
- **The comments.** Consistently explain why a threshold is where it is, in
  units. `engine.ts:1044-1058` on why beliefs take the middle readout band is a
  model of the form.

---

## Order of work

Ordered by evidence bought per unit of effort.

1. **Add a CI workflow running `pnpm typecheck` and `pnpm test`** (§5). Nothing
   else on this list stays fixed without it.
2. **Teach the policies beat zero and run the sweep with `{ below: true }`**
   (§1). Until this is done, every balance number in the repository describes a
   configuration no player is in, and the reachability test guards the wrong
   game.
3. **Derive `carried` from applied deltas** (§2). A correctness fix in the model
   the demo exists to test, and the test that catches it is three lines.
4. **Re-tune `resonanceGain` against the outcomes' own effects** (§3), then look
   at `stopped` and `sealed` again (§4) with the corrected sweep from step 2.
5. **Move the place buttons out of `role="img"`** (§9) and raise the cells to
   44px (§10). Small, and the demo is played on a phone.
6. **Build the cells from `pack.objects`** (§8). One deletion and one call to a
   function that already exists.
7. **Correct `docs/DEMO.md`'s counts and paths** (§11), and put a staleness note
   on `REWRITE.md`'s table.
8. **Pick a projection and delete the other** (§6), or write down what evidence
   would settle it. 1,764 lines and a third untyped copy is a lot to hold open.
9. **Collapse the duplicated rules** (§7) and delete the dead declarations
   (§13).

---

# Appendix: two claims, tested

Two concerns were put to this review directly. Both were tested rather than
judged. The commands are in the sections below; the instrumentation ran against
the same 1,200-run sweep used above, plus `vitest --coverage`.

Neither claim survives intact. The first is right about four mechanisms and
wrong about the three that look most elaborate. The second is wrong on every
metric except one, where it is right on a technicality worth 68 comments.

---

## A. "The logic complexity is overblown in parts without any benefit"

### A.1 Method

For each mechanism, the question asked was: *does removing it change an answer?*
Where a cheaper version could be written, both were run against the same states
and the outputs compared, over the same 1,200-run sweep used above. Coverage
figures come from:

```sh
pnpm add -D @vitest/coverage-v8@2.1.9
npx vitest run --coverage.enabled --coverage.provider=v8 \
  --coverage.reporter=text --coverage.include='src/**'
```

The dependency is not committed; add it to reproduce the numbers.

### A.2 The three most elaborate mechanisms all earn their keep

**`probes()` and `couldStillFire` — the strongest disconfirmation.**
`core/engine.ts:1123-1158` builds three hypothetical worlds (as-is, best, worst,
the best padded with 32 synthetic history entries) and tests each scene's
`requires` against all three. It looks like the most speculative code in the
engine. It is load-bearing:

```
times runStatus reached couldStillFire at all: 4723
verdict "quiet" WITH probe worlds:               95
verdict "quiet" WITHOUT probe worlds:          4723
the two disagreed:                             4628  (98.0%)
```

Without the probe worlds, every one of those 4,723 states is judged `quiet` —
"nothing can fire on any future this world can reach" — because the history-count
gates on `tomas-alone`, `the-hearing` and `the-throwing` fail against the
*current* history. `doorOut` reads `quiet` as `starved`, so the cheaper version
ends the run the first beat no scene happens to be eligible. The 25 lines prevent
4,628 false endings.

**`Scene.weight()` and `pickWeighted`.** Measured at each director decision, so
diverging trajectories cannot confound it — the weighted distribution against the
uniform one the director would use without them:

```
decisions with more than one candidate:                    3619
decisions where the weights were all equal (a no-op):       849  (23.5%)
mean total-variation distance from uniform:               0.160
worst:                                                    0.357
```

0.160 means 16% of the probability mass moves, on average, every time the
director picks. That is a real dial, not decoration.

*A note on method:* the first attempt at this compared full sweeps with weights
on and off and produced deltas of −2, +1, +5, −12 — apparently nothing. That
measurement was wrong: changing which scene fires changes the whole run, so the
noise from divergent trajectories swamped the effect. The two unweighted scenes
moved further than three of the four weighted ones, which is the tell. Measuring
at the decision point removes the confound.

**The four-phase narration order.** `step` splits a beat into
`opening → answer.lines → closing → answer.after` (`engine.ts:398-405, 622`)
rather than concatenating. The phases are distinguishable on 1,640 beats — an
`attune` whose `release` line has to sit *after* the world's response to the use
and *before* the readout. Across the sweep:

```
multi-line beats:                                  7638
attune beats needing the interleave:               1640
```

### A.3 Four mechanisms that do not

**The beat-zero line queue.** `BelowPhase.pending`, `BELOW_TUNING.linesPerTurn`,
and the `budget`/`released`/`queue`/`finishing` block at `engine.ts:816-833` are
roughly 40 lines of scheduling. Measured over every beat-zero turn in 1,200 runs:

```
turns where pending held anything:  600   (~3% of beat-zero turns)
deepest the queue ever got:           2
```

A two-deep queue that fills on 3% of turns.

**The places.** `QUEUED` / `OPEN` / `SEEN(id, tier)` are three flag families
(`engine.ts:51-53`) driving `queueSubject`, `openSubject`, `ambientTier`,
`answered`, `ASKABLE` and `isAmbient` — about 45 lines of engine. What they
deliver:

```
times a place became answerable, across 1200 runs: 1324  (1.10 per run)
```

`docs/DEMO.md:265` estimates "2–4 times a run"; measured, it is 1.10. And since
no policy ever emits a `look` at a place, none of those 1,324 openings is ever
consumed by the sim — the surface is both thin and unmeasured.

**`core/readout.ts`.** A generic `band()` helper plus `water()` (5 bands),
`feelOf()` (4) and `feelBand()` (4) — 13 authored thresholds:

```
core/readout.ts   21.62% stmts | 100% branch | 20% funcs | lines 15-24, 28-36, 40-48, 52 uncovered
```

Every function except `band` is untested. Their consumers, in full: one
`aria-label` (`main.ts:490`), one `title` that does not exist on touch
(`main.ts:522`), one CSS data attribute (`main.ts:521`), and `remaining()`, which
nothing calls. `band()` itself has exactly one real caller — `tierOf` in
`below.ts`.

**Guards that cannot fire.** Coverage names them precisely:

| guard | where | why it cannot fire |
| --- | --- | --- |
| `if (!person) return state` ×2, `if (!object) return state` ×2 | `effects.ts:22,51,56,64` | content ids are checked by `tsc` and by `every effect names something real` |
| `resolveOutcome`'s no-match fallback and `throw` | `scene.ts:62-65` (file at 55.55%) | every scene ends in `when: () => true` |
| `pickWeighted`'s final `return items[items.length-1]` | `rng.ts:37-38` | unreachable when weights are positive |
| `CHANNELS[...] ?? DEFAULT` | `ledger.ts:31` | every channel key used maps to `ambient`, `band` or `below` |
| `Rng.state` getter | `rng.ts:13-15` | declared on the public interface; read by nothing in `src/` or `tests/` |

The ledger's channel table is the interesting case: two of its three
configurations are exercised, `DEFAULT` is dead, and the comment above it —
"Anything unlisted remembers one line" — describes a case that cannot arise.
Channel depths observed: `ambient` 1, `band:*` up to 3, `below` up to 11.

### A.4 Function size

Approximate branch counts, by keyword:

| function | file | lines | branch points |
| --- | --- | --- | --- |
| `makeFisheyeShaft` | web/shaft-fisheye.ts | 557 | 52 |
| `makeShaft` | web/visuals.ts | 507 | 36 |
| `step` | core/engine.ts | 278 | 37 |
| `advanceBelowMode` | core/engine.ts | 124 | 15 |
| `render` | web/main.ts | 102 | 15 |

The two 500-line ones are closure factories — module-shaped, and their length is
mostly declarations. `step` at 278 lines and 37 branch points is the real one:
it holds the action switch, the gathering rule, the coat special case, the four
phases, the lucidity queue, the coda and the stop line.

### A.5 Verdict on A

**Partly true, and not where it looks.** The elaborate-seeming machinery —
probing hypothetical worlds, weighted scene selection, four-phase narration —
is all doing measurable work. What is overblown is smaller and duller: a
two-deep queue with 40 lines of scheduler, a three-flag system delivering 1.1
events a run, a banding layer with 13 thresholds and no test, and eight guards
that cannot fire. The single largest complexity cost is not a mechanism at all;
it is `step` being one 278-line function.

---

## B. "The comments are still poisoned by prose language, and there are more of
them than needed"

### B.1 Method

All 757 comments in `src/` outside `content/prose/**` were extracted with a
hand-written lexer that masks string and template literals first, so `'//gc.zgo.at'`
and `'http://www.w3.org/2000/svg'` cannot be mistaken for comments. Each was
classified against the rule in `CLAUDE.md`:

> Everything else — engine, UI, tests, code comments, commit messages — is plain
> engineering prose: state what the code does and in what units. Do not record
> why a thing changed, what it used to be, or what it is not.

### B.2 On register

| | count | share |
| --- | --- | --- |
| use second person (`you` / `your`) | **3** | 0.4% |
| record history, supersession or what a thing used to be | **0** | 0% |
| hedge (`probably`, `might`, `unclear`) | 1 (a false positive: "keeps the button honest") | 0.1% |
| name something from the fiction | 197 | 26% |
| say what a thing **is not** | **68** | **9%** |

All three second-person comments are in one place, describing what a coda slot's
*prose* says rather than what the code does:

```
core/coda.ts:36     What you are, in as many words as you earned.
core/coda.ts:70     Spine, then what else is true, then what they will say, then what you are.
core/content.ts:88  Pulling the coat over yourself, and missing whoever came.
```

The 26% that "name something from the fiction" are not a breach. `docs/DEMO.md`
sets that vocabulary deliberately — "Terms in **bold** are the ones to use" —
and *presence*, *rim*, *silt*, *village*, *belonging* are the project's domain
terms, several of them literal field names in `types.ts`. A comment reading
"A place is not asked while somebody is at the rim" is a precise statement about
the `mode.kind === 'scene'` guard at `engine.ts:429`, in the vocabulary the
repository mandates.

**The one real breach is the 9%.** `CLAUDE.md` forbids recording "what it is
not", and 68 comments do exactly that:

```
core/effects.ts:4     A data union rather than callbacks, so effects can be inspected …
web/analytics.ts:3    Injected from JS rather than the HTML so `PROD` can gate it.
web/camera.ts:90      Smoothstep, so a move leaves and arrives at rest rather than at speed.
core/below.ts:36      … The silt is not on it: it resolves when the first belonging comes out of it.
```

In mitigation, these are contrastive *definitions*, not change history, and the
rule's stated reason — "that is what git history is for" — does not apply to
them. But the letter of the rule is the letter of the rule, and 68 is the
largest single deviation found.

Nine more comments carry an aphoristic tail clause — "never a write", "the whole
ending stays", "never says which". Stylistic, 1%.

### B.3 On volume

| | |
| --- | --- |
| comments in `src/` outside `content/prose/**` | 757 |
| comment-only lines vs code lines | 1,272 / 4,143 = **31%** |
| comment characters vs file characters | 61,801 / 209,626 = **29%** |
| mean words per comment | 15.0 |
| comments of 40+ words | 38 (5%) |
| comments of 3+ sentences | 35 (5%) |

31% is high in absolute terms. But the density tracks how non-obvious the code
is, which is the opposite of decoration:

| densest | | sparsest | |
| --- | --- | --- | --- |
| `web/shaft.ts` | 61% | `content/coda.ts` | 2% |
| `web/water.ts` | 57% | `content/scenes.ts` | 4% |
| `web/grain.ts` | 53% | `core/effects.ts` | 5% |
| `web/sky.ts` | 48% | `web/svg.ts` | 8% |
| `core/types.ts` | 48% | `content/prose/**` | 12% |

The four densest are a pure interface file, a geometry module, a table of
unlabelled tuning constants, and a table of gradient stops — the four places
where a name genuinely cannot carry the units. The sparsest are declarative
content and one-line helpers. **The least-commented directory in the repository
is `content/prose/`**, at 12%: the files that actually hold prose are the ones
that need no explaining. The register split holds in both directions.

### B.4 On self-documentation

For every comment, its content words were compared against the identifiers on
the three lines of code it introduces (camelCase and snake_case split into
parts, stopwords removed):

```
comments with adjacent code to compare against:                  754
restate the identifiers below them (≤34% new words):               9   (1%)
carry information the identifiers do not:                        745  (99%)
```

The nine, in full, are mostly section banners (`---- the silt ----`) and one
genuine redundancy: `web/camera.ts:34`, "Where the camera rests." above
`rest: Camera`.

**The limit of this metric, stated plainly:** it detects a comment that reuses
the identifier's words. It cannot detect a comment that introduces new words
without introducing new understanding. Hand-reading the densest files did not
turn up a class of those — `DOT_SPACING = [14, 13, 12, 11, 10]` needs "Halftone
dot spacing, px. Larger is coarser and cheaper to draw," and no name would carry
it — but that half of the claim is judgement, and this measurement does not
settle it.

### B.5 Verdict on B

**Disproved on register and on volume; upheld on one clause.** Second person
appears 3 times in 757 comments. Nothing in the repository records what a thing
used to be or why it changed — the part of the rule most codebases break, this
one keeps completely. One comment in a hundred restates the code beneath it. The
fictional vocabulary is the mandated domain vocabulary, not leakage.

What is true: 68 comments (9%) say what a thing is not, which the rule forbids in
those words; three comments record an unsettled decision (all three about the
same `wash`/`grain` fork in `web/water.ts`); and 31% comment-to-code is high
enough that it is worth knowing it is concentrated in the files that need it.

### B.6 What this changes in the review above

Nothing is retracted. One item is added to §14 (*Smaller things*):

> **68 comments say what a thing is not.** `CLAUDE.md` forbids recording "what
> it is not". `effects.ts:4`, `analytics.ts:3`, `camera.ts:90` and 65 others do.
> They are contrastive definitions rather than change history, so they miss the
> rule's stated reason while breaking its wording — worth a decision either way,
> since it is the most-repeated deviation in the tree.

---

# Work plan, measured

Every fix below was either applied in a throwaway worktree and measured, or
sized by counting its edit sites. Nothing here is estimated by feel. The
prototype passes `tsc --noEmit`, all 125 tests, and `vite build`.

The headline: **the two highest-value fixes are 16 lines between them, and they
change the answer to most of the rest.**

---

## W.1 What was prototyped, and what it cost

| fix | findings closed | files | diff | verified by |
| --- | --- | --- | --- | --- |
| `carried` from applied deltas | 2 | 1 | **+5 −1** | probe + 125 tests |
| policies can play beat zero | 1, 4 | 1 | **+11** | full re-sweep |
| delete dead code | 13 | 11 | **+2 −50** | `tsc`, 125 tests |
| cells from the pack, seed in the URL, places out of `role="img"`, CI workflow | 5, 8, 9, 12 | 7 | **+38 −13** | `tsc`, tests, `vite build` |
| **total** | **1, 2, 4, 5, 8, 9, 12, 13** | **17** | **+56 −64** | net **−8 lines** |

Eight of the fourteen findings, for a change that leaves the tree smaller than
it started.

## W.2 The 16 lines that re-measure the game

`sim/policies.ts` gains a beat-zero branch (11 lines) and `resonanceEffects`
clamps to headroom (5 lines). Same 1,600-run sweep, before and after:

| | before | after |
| --- | --- | --- |
| outcomes never reached (of 19) | 3 | **0** |
| `the-throwing:stopped` | 0.0% | 1.9% overall, **7% under `haunty`** |
| `sealed` | 0.1% | 2.7% overall, **10% under `haunty`** |
| runs reaching the terminal scene | 20% | **43%** |
| runs that starve | 80% | 57% |
| `never-woke` | 50% | 25% (all of it `idle`, which is the point) |
| `forgotten` | 21.9% | 13.9% |
| policies that cannot leave beat zero | 2 of 4 | **0 of 4** |

The correctness fix behaves as intended: a saturated Anna now yields
`tragedy 0.300` — the authored outcome alone — where she previously yielded
`0.646`.

**This retracts most of finding 4.** The two "unreachable" endings were
reachable the whole time. The stand-in players could not get out of the dark to
find them, and the tool that was supposed to notice was running with beat zero
switched off. Fix the instrument before re-tuning anything it measures.

## W.3 Sized but not prototyped

| fix | finding | size | what makes it cost that |
| --- | --- | --- | --- |
| correct `DEMO.md` and `REWRITE.md` | 11 | 7 edit sites + 1 table | pure clerical |
| `ResizeObserver` coalescing | 10 | ~6 lines, `visuals.ts:566` | mechanical, but `visuals.ts` is 0% covered — needs a manual check on a phone |
| raise cells to 44px | 10 | 2 CSS rules (`style.css:255-261`, `287`) | needs a visual judgement call, not just a number |
| refused push must not agitate the water | 14 | 1 line, `main.ts:216` | trivial once decided |
| collapse the push-cost rule | 7 | 5 sites → 1 predicate | 5 call sites, all in code with tests |
| collapse the three resonance implementations | 7 | 3 sites; delete `Resonance.strength` | the client needs a value the engine does not expose yet |
| move the quiet line into `step` | 7 | ~8 lines across `engine.ts`, `main.ts` | changes narration order; the tests will say if it is wrong |
| re-tune `resonanceGain` | 3 | 1 constant + a re-sweep | **a design decision.** Cheap to evaluate now that the sim works |
| first test for `visuals.ts` | 6 | new harness | needs jsdom or a headless DOM; nothing exists to build on |
| pick a projection | 6 | deleting the loser is ~1,764 lines | the deletion is trivial; **the decision is the whole cost** |
| split `step()` | A.4 | 278 lines → ~5 functions | mechanical, and the 62 engine tests make it safe — but it is a day, not an hour |
| the 68 "is not" comments | B.2 | 68 sites | **a ruling, not a task.** Decide whether the rule means change-history or also contrastive definition, then it is find-and-replace or nothing |

## W.4 Order

1. **W.1's four commits.** Net −8 lines, closes eight findings, and the CI
   workflow makes everything after it hold.
2. **Re-read the sweep.** It now describes the game as played. Nothing about
   balance is worth arguing before this.
3. **Re-tune `resonanceGain`** against the corrected numbers (finding 3), which
   is the only balance decision left with real evidence behind it.
4. **The mobile pass** — tap targets, the resize rebuild, the refused push.
   Small, and the demo is played on a phone.
5. **The duplication** (finding 7), then **`step()`**. Both are safe under the
   existing tests and neither is urgent.
6. **Pick a projection** when there is a reason to. It is the largest single
   deletion available and the only one blocked purely on taste.
