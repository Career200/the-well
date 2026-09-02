# The rewrite

> **Stale as of the road model.** This plan predates `story/HORRORS.md` and
> `story/MECHANICS.md`, and its stages do not account for: parallel pressure
> tracks with cross-feed, cast mortality, objects being *absent* rather than
> spent, lucidity running backwards, the attention floor thinning the presence,
> or attention decay when no track leads. Everything below about the container,
> the five holes and the tests is still correct; the stage list is not, and it
> is deliberately not being re-cut until the deck exists — the ordering is
> guesswork until there are situations to order it around. Re-cut it after
> deliverable 3.

`SCHEMA.md` says what the container should be. This says how to get there from
what is actually in `src/`, in what order, and what gets thrown away — with line
counts, because the honest question about any rewrite is how much of it is one.

The one-sentence version: **the economy survives, the content layer does not, and
the authored vocabulary has to be frozen before anything else moves.**

---

## 1. What is actually being replaced

| file | lines | verdict |
| --- | --- | --- |
| `core/rng.ts` | 38 | untouched |
| `core/effects.ts` | 74 | kept; gains fact-setting variants |
| `core/readout.ts` | 54 | kept — it is already the seed of `Below` |
| `core/types.ts` | 94 | half kept; `PersonState` gains facts and tags, `WorldState` gains facts and a ledger |
| `core/content.ts` | 64 | kept in shape |
| `core/engine.ts` | 413 | ~120 lines kept — `TUNING`, `tick`, the stance switch, `resonanceStrength`. The dealer, the scene runner, `probes`, `couldStillFire`, `runStatus` all go |
| `core/scene.ts` | 58 | deleted |
| `content/scenes.ts` | 228 | structure deleted, prose salvaged |
| `content/people.ts` | 37 | grows roughly 3× (§3.5) |
| `content/objects.ts` | 44 | kept; gains `Below` tiers and second faces |
| `sim/policies.ts` | 74 | rewritten, stance-aware |
| `tests/` | 275 | rewritten **first**, not last (§5) |

About a third of the code survives. **None of the content structure does, and
that is fine, because there are only five scenes and they are worth more as
salvage than as a port.** `first-water` becomes a casting of *someone comes for
water*; `boys-at-the-rim` becomes the passer-by half of the dog; `the-hearing`
and `the-throwing` are canon events that stay canon events. Port the prose by
hand, into the new shape, when the new shape exists. Do not write a migration.

The thing worth noticing before starting: **`STORY_MACHINE` §4 is already
built.** Stances, one recovery rule, presence against belonging charge, the water
as the readout — that is the part of the target that reads most like a rewrite
and is the least of one. What is being replaced is everything that decides
*which fiction the economy runs inside*: the gate, the cast, the text, and the
choice of outcome.

---

## 2. Three corrections to `SCHEMA`'s order of work

The order at the end of `SCHEMA.md` is right in spirit and wrong in three
places, all for the same reason: it is ordered by *how much existing content each
step touches*, and there are five scenes about to be deleted, so that metric is
measuring nothing.

The metric that matters instead is **how much future content a step would force a
rewrite of.** Order by that and three things move.

**1. `Ctx` and `Prose` go first, not roles.** `Ctx` is the interface every
authored line receives, and `Prose` is the shape every authored line has. Get
either wrong and the fix is a pass over 26,000 words. Everything else — casting,
bands, scoring, threads — is engine-internal and can be rewritten repeatedly
without a writer noticing. Freeze the author-facing surface, then churn freely
underneath it.

**2. Facts go before roles.** `Role.requires.facts` is a `FactQuery`, and person
facts need somewhere to live in `PersonState` before a role can ask about them.
Roles-first is a step that cannot compile.

**3. Threads are not last.** `SCHEMA` defers them until two or three situations
exist; the dog plot — the tutorial, the vertical slice, the thing that has to
work first — is specified as a two-step thread with `onMiss: hold` on step 0.
That is thirty lines of pressure accumulator and a due-step weight boost. Build
the minimal version *inside* the dog slice rather than as a general system, and
let the general version fall out of the second thread.

---

## 3. Five holes to close before any of the corpus is written

These are cheap now and structural later. All five are things `SCHEMA.md` and
`the-dog.md` disagree about or leave to convention.

### 3.1 Facts have no namespace, and the two documents use two conventions

`sets: ['first.uneasy-here']` prefixes a **role id**. `sets: ['dog.loose']`
prefixes a **subject that is also a person record**. `sets: ['well.fenced']`
prefixes a place. Three meanings, one string type, and the engine has to know
which one it is holding at resolution time to know whether it is writing to the
world or to a person.

Decide, and write it into `SCHEMA` §1:

```ts
type WorldFact = string                              // 'well.fenced', 'dog.loose'
type PersonFact = string                             // 'unguarded', 'knows-the-body'
type FactRef = WorldFact | { role: RoleId; fact: PersonFact }
```

Bare dotted strings are world facts; a person fact is only ever set through a
role, because at the moment an outcome fires the role binding is the only handle
the engine has on a person. `Role.requires.facts` queries **unqualified** person
facts of the candidate — no role is bound yet during casting, so there is
nothing to qualify with. That is consistent, and it needs to be said once.

### 3.2 `unguarded` has a lifetime nobody specified

*"Both leads carry `unguarded` for the duration, because they believe they are
alone."* That is not a fact an outcome sets — it is granted by the deal and
discarded with it. If it is written as an ordinary set, dread exemption leaks
into every later scene those two people appear in and the soft registers never
close.

Three sources, one query surface:

- **derived** at cast time from tags — `child`, `old`, `drinks`
- **granted** for the duration of one deal — `Casting.grants?: Partial<Record<RoleId, PersonFact[]>>`
- **persistent**, set by outcomes — `believes-alone`, which is the one the player
  can destroy, and therefore the only one that matters

### 3.3 `Ctx` withholds history, but `times` has to come from somewhere

History is not deleted, it is **demoted**. The engine keeps it for replay and for
the sim reports; `Ctx` simply does not expose it. What `Ctx` exposes instead is a
ledger of counters maintained alongside it:

```
ledger['sit:the-dog-at-the-rim']                 → times.situation
ledger['sit:x|cast:anselm,anna']                 → times.withCast
ledger['sit:x|role:the-one=anna']                → times.withRole('the-one')
```

Three keys written on every resolution. This is the concrete piece of new state
the whole recurrence axis rests on, and `DIALS` §1 says that axis is 20–40% of
the runtime — so it is not an optimisation, it is a fifth of the game.

### 3.4 `onMiss: silent` requires every situation to have a zero-input outcome

A silently-resolved step scores its outcomes with `pressure = 0` and
`resonance = null` and nobody watching. If every outcome in a situation gates on
the player having done something, the scorer returns nothing and the thread
stalls invisibly.

This is the same rule the dog doc already argues for on completely different
grounds — *"the well has to be able to be just a well"* — which is a good sign it
is real. State it once as an authoring law and enforce it as a lint:

> **Every situation has at least one outcome that scores finite under an empty
> `Ctx`, and it has to be worth reading.**

### 3.5 The cast pool is too small for the casting system

Four present people. The worked example wants `distinct: [first, second,
witness]` — three of the four — plus `prefer: 'least-seen'` over what is left.
That is not a director making a choice, it is a rotation with the serial numbers
filed off, and `prefer` will be indistinguishable from round-robin for the whole
run.

Casting needs **nine to twelve present people**, with tags, starting emotions,
and a small relation map (`kin`, `married`, `promised`, `estranged`). This is a
content prerequisite for a code feature, which is why it is the first item in the
writing brief rather than something to do while implementing `Casting`.

### 3.6 (bonus) Nothing says who picks the register

The situation lists candidates and dread removes the soft ones. Something still
has to choose among what is left. The cheapest rule that is not a coin flip:
weighted pick over the legal set, biased by the dominant emotion of the cast.
One function, decided now, so that a writer listing `[tender, wary]` knows what
makes the difference.

---

## 4. The stages

Breakage is allowed throughout. What is not allowed is more than one stage being
open at a time — the whole reason this ordering exists is that each stage ends
somewhere you can stand.

### Stage 0 — freeze the vocabulary. Small. No behaviour.

`Ctx`, `Line`/`Prose`, `Below`, `Band`/`Gate`, `FactQuery`, `FactRef`, the fact
naming convention, `Effect` gains fact variants. Close the six holes above in
`SCHEMA.md` as you go — the document is the deliverable of this stage as much as
the types are.

*Ends when:* nothing runs and nothing needs to. The author-facing surface is
fixed.

### Stage 1 — state. Small. Breaks everything.

`WorldState` gains `facts`, `PersonState` gains `facts` and `tags`, the ledger
lands, `history` becomes engine-private. Delete `core/scene.ts` and
`content/scenes.ts`. The build is red and the sim does not run.

*Ends when:* the world can hold what the new content needs, and the old content
is gone rather than half-ported.

### Stage 2 — the dealer. Medium. The actual work.

Gates evaluated as data. Casting: candidate filtering, `distinct`, `relation`,
`prefer`. Register selection with the dread rule stated once. Recurrence counting
off the ledger. Outcome scoring instead of first-match. The beat runner, with
affordance prose printed in the beat it lands.

Author exactly **one** situation to prove the pipe — *someone comes for water*,
cannibalised from `first-water`. Do not write more.

*Ends when:* one situation deals, casts, plays and resolves, with a real register
choice and a real scored outcome.

### Stage 3 — the dog, to full depth. Medium. This is price discovery.

All three situations from `the-dog.md`, every register, three recurrence levels,
authored affordances, the two-step thread, and `Below` tiers for the four
belongings plus the water and the walls.

This is the stage that answers the question `STORY_MACHINE` §6 says the vertical
slice exists to answer, and it should be measured out loud: **hours per
situation, words per situation, and turns per instance against `DIALS`' 17–34.**
If a situation costs a day, twenty situations is a month and the deck size is
wrong.

*Ends when:* a run opens with the dog every time, plays differently depending on
what you did to it, and you know what one of these costs.

### Stage 4 — instrumentation. Small. Buys the corpus.

The static lint and the coverage sweep (§5), plus a word-count report. Cheap, and
it is what makes 15–20 situations authorable by someone who is not holding the
whole graph in their head.

### Stage 5 — the deck, then the director.

`STORY_MACHINE` §6 phases 1 and 2, unchanged. The director stays a weighted
random draw for the whole of phase 1 and that is correct.

---

## 5. The tests get rewritten before the engine, not after

`tests/reachability.test.ts` asserts that every `scene:outcome` is hit by some
policy in 120 runs. Under bands, casting and threads that test becomes a liar in
both directions: it fails on content that is reachable but needs a cast the
policies never assemble, and it passes on content that is reachable only through
a fact nothing else ever sets.

Split it in two.

**A static lint over the content graph** — no simulation, runs in milliseconds,
and it catches the entire class of error a 26,000-word corpus generates:

- every fact read by a gate is set by at least one outcome
- every fact has **two or more origins** (`SCHEMA` §1 asks for this and nothing
  currently checks it)
- every gate band is non-empty, and every gate has at least one ceiling
- every situation has a zero-input outcome (§3.4)
- every role's `requires` is satisfiable by somebody in the cast pool
- every `distinct` group is smaller than the pool that can fill it
- no situation names another situation

**The sweep as a coverage report, not an assertion.** Print what was reached and
what was not, with the deck size and instance count next to it. Assert only the
things that are actually invariants: the canon event is reachable and never
certain, the levers still produce different villages, a player who does nothing
still sees the dog.

`probes()` disappears into this. It exists because `requires` is an opaque
predicate and the only way to ask it a question is to run it against a fabricated
world. Once a gate is data, reachability against the *stat* bands is decidable
rather than guessed — only the fact graph needs searching, and that is what the
lint does.

---

## 6. What is unblocked right now and waits for none of this

Roughly a third of the corpus does not depend on the container at all, and it is
the third `DIALS` §3 identifies as the cheapest:

- **`Below` — all three tiers, ~18 subjects, ~2,500 words.** It is a fixed set
  that does not grow with the deck, and `readout.ts` already demonstrates the
  banding pattern it needs.
- **The cast pool** (§3.5) — names, tags, relations, starting emotions.
- **The fact dictionary** — the shared vocabulary every situation is written
  against, with two origins each.
- **The coda** — 6–10 paragraphs on beliefs × dread band, ~1,600 words, and per
  `DIALS` §6 the only part of the dread design that pays off inside a first run.
- **The overheard channel** — the dialogue through which beliefs are the only way
  they may ever be expressed.

All of it is prose, none of it needs a working build, and the brief for it is
`docs/story/prompts/storylet-brief.md` — and the corpus itself now lives in
`docs/story/`, indexed by its `README.md`.

---

## 7. Risks specific to the rewrite

- **Stage 2 has no natural end.** The dealer touches casting, registers,
  recurrence and scoring at once and every one of them suggests a refinement. The
  single situation is the stop signal: when it deals and resolves, stop, even if
  `prefer` is naive and `relation` is unused.
- **Price discovery gets skipped.** Stage 3 is the only stage whose output is a
  number rather than a feature, and it is the one that decides whether the deck
  is 20 situations or 12. Skipping it means finding out at situation 15.
- **The salvage tempts a port.** The existing prose is good and the existing
  structure is not. Retyping a scene into the new shape is faster than writing an
  adapter and produces better content; the adapter is the trap.
- **Two open questions from `DIALS` still block writing, not building.** Whether
  dread decays, and what the input surface for aimed resonance is. Both are
  cheap to settle and both change how storylets are written, so settle them in
  Stage 3 rather than discovering them in Stage 5.
