# Findings

Open rules, forks and resolutions. Kept out of the content docs on purpose.

## 1. Decided

| | |
| --- | --- |
| **dog's owner** | Sev, with `prefer: most-attached` retained so it can land elsewhere |
| **`old` derives `unguarded`** | no. Derive from `child`, `drinks`, `past-caring`. `old` alone would make Anselm — the most guarded person in the game — unguarded |
| **who is thrown** | not an authoring choice. Whichever road got there first; on three of four it is the one who came asking |
| **stranger = investigator** | one record, present from `someone.is-asking` |
| **the roads** | three roads and one supply, all live from turn one, feeding and damping each other. No arming roll, no belief threshold. The run is about whichever ramps hardest; the coda reads all of them |
| **beliefs** | a readout of how loud each track has got, never a selector |
| **the sickness** | a supply, not a road. It has no steps until the village names it (`water.suspected`, chalked doors, the cart); named, it ramps like anything else. Its trickle runs every run because the source is never cut dry |
| **the sealing** | a road whose terminal is the forgetting. Deliberate: the same ending a starved run reaches, arrived at on purpose |
| **run end** | a road terminal, or starvation. From ~instance 10, if no track leads by a margin, attention decays each instance and the run starves. A divided village loses interest |
| **one scheduler** | roads do not bypass the deck. A due road step is a large weight multiplier, competes in the same draw, can lose, and resolves `onMiss: silent` when it does |
| **ambient facts** | zero-beat ambient situations, not an engine weather layer — keeps facts single-authored and gives the director something to deal in a quiet turn |
| **mutual exclusion** | `clears`, until there are three pairs |
| **recognition facts** | one (`ring.recognised`). `coat.recognised` second if the belongings' second faces need it |
| **person-scoped belief facts** | rejected. They would put the truth of the death into the fact graph where a lint can see it and an author will resolve it |
| **pool size** | twelve present actors |

## 2. Open forks

**`opposed` as a sixth relation.** The overheard channel's engine is two people
who disagree in public, and `kin/married/promised/estranged/strangers` cannot
say it. Recommend adding it; Anselm–Orla are written `estranged` meanwhile.

**How does a track's pressure accumulate?** Trickle + player action + cross-feed
is the shape; the rates are a sim question. One commitment worth making now: the
trickle alone must reach stage 1 on every road within a quiet run, or "they are
all live" is a claim the player never sees evidence for.

**What counts as a margin?** The starvation rule needs a definition of one track
leading the others. Absolute gap, ratio to the runner-up, or stage difference —
and whether the supply counts as a track for this purpose. Recommend stage
difference against the runner-up, and the supply counts only once named.

**Does a damped road ever go backwards?** `well.boarded` damps the sickness.
Pressure falling is fine; a *stage* un-advancing is not — chalked doors do not
get scrubbed off. Recommend pressure damps, stages ratchet.

**Sev carries two jobs** — the dread exemption and the discounted rumour
channel. Splitting the rumour half onto Kell is available. Recommend keeping
both: the reason nobody adjusts their day for him is the same reason he still
says warm things at dread 0.8.

**Bern's null affinity** is deliberate (he is the calibration instrument) and
will read as an oversight to whoever maintains `objects.ts`. Wants a comment.

## 3. Rules that do not exist

Blocking the writing:

0. **Player qualities: available set listed, derived set request-driven.**
   Settled in `MECHANICS.md` §1. The engine already has lucidity, presence,
   belonging charge and discovery, `times.*`, turn and road stage — those are
   the closed vocabulary situations weight on. Anything derived (recency of
   action, stillness streak, hoarding, **legibility debt**) is declared as a
   request by the sheet that wants it, stating what the engine would have to
   remember. What remains open is which of those requests come back, and
   legibility debt is the one most likely to be worth building regardless: it is
   the drive that makes the village look like it is reacting to the player
   rather than to a die roll.

1. **Nothing sets an ambient fact.** Facts come from outcomes; weather does not
   come from a scene.
2. **There is no clock.** *At the wrong hour*, *after dark*, *the same evening*
   have no state behind them, and `believes-alone` has no cheap source without
   one.
3. **Nothing sets facts at run start.** `water.high`/`water.low` want deciding
   before turn one.

Blocking the costing:

4. **`Below` has no dread block** (six subjects, one field).
5. **Affordance prose is missing from the corpus budget** — ~1,000 words.

The price of `HORRORS.md`:

6. **People cannot leave the pool.** `is-gone` needs casting, `prefer`,
   recurrence and `distinct` to survive a person ceasing to exist — mid-thread,
   and including sole candidates.
7. **Objects have no state but charge.** `coat.out-of-reach` and `ring.taken-up`
   need *absent* as distinct from *spent*, plus the three-warning drift.
8. **Lucidity cannot go backwards.** Deterioration is the tiers in reverse;
   lucidity is monotonic by construction and `DIALS.md` §2 treats that as
   defining.
9. **Attention's floor does nothing.** Thinning must remove affordances, slow
   recovery and mute belongings. No state to hang it on.
10. **Four parallel pressure tracks do not exist.** Threads have a clock; the
    roads need a clock *plus* cross-feed from each other's events, and the
    director needs to see all four to choose between them. This is the largest
    engine consequence of `HORRORS.md` after mortality.
11. **Terminal text erosion has no home** — a renderer concern no layer owns.

Workaroundable:

12. Fact lifetime is unspecified in `SCHEMA` (per-deal grants live only in
    `REWRITE` §3.2).
13. Facts cannot be set on an absent person, and the throwing wants to.
14. Relations are undirected and unqualified — `kin` cannot distinguish a mother
    from a cousin.
15. Ownership is neither a relation nor an affinity, but "the dog is Sev's" is.
16. No per-speaker credibility, so Sev's discount cannot be expressed in effects.
17. Dread relief is undefined; the blessing is the only proposed source.
18. Person facts have no object — `is-suspected` cannot say by whom.
19. No lint for exclusive facts.
20. `Below` cannot gain a subject mid-run, which `offerings.left` wants.

Found while writing the first three situations (`situations/`):

21. **`Outcome.sets` is a static array.** A fact that should land only when an
    optional role happens to be filled, or only when the person filling it is
    kin to somebody, has nowhere to go. Three of the fourteen outcomes across
    the three sheets exist only to carry a different `sets` for the same event.
    Recommend `sets?: string[] | ((c: Ctx) => string[])`; the alternative is
    that the outcome table grows by the number of optional roles.
22. **Prose cannot select on which belonging is held.** `Line.when` is
    `Gate & { register, times, role }` — no object, no resonance. Both `hold`
    affordances written here want a per-object variant (the whistle in front of
    a child, the ring in front of the one it was). Workaroundable with
    `text: (c) => …` reading `c.resonance`, at the price of hiding the variant
    from anything that walks `Prose`.
23. **Beat prose has no lucidity policy.** `Line.when` is a `Gate`, so beats
    *may* tier on lucidity; `DIALS` §7 budgets four beats at one variant each.
    Written here lucidity-neutral, with everything the presence knows pushed
    into `Below`. If beats may tier, that line of the budget triples.
24. **`CURVE` §1's three affordance bands have no stated home.** They are
    expressible as `Line.when.dread` inside one affordance's `prose`, which is
    what these sheets do, rather than as three `Affordance` records with three
    ids and duplicated `cost`. Worth stating once, or twenty sheets each decide
    it separately.
25. **Nothing distinguishes a thing on the wall from a thing that has gone off
    it.** `offerings.left` covers the wall, §8 says things come down, and a
    child pocketing one is written here as behaviour with no fact behind it.
26. **Attention has no barometer floor.** A barometer must stay dealable at
    every temperature, and §4's starvation rule decays attention from ~instance
    10 — so the end of a starved run is exactly the window where a barometer's
    gate still passes and every road-lens gate does not. That is probably the
    intent and it is written down nowhere.
27. **Per-speaker credibility (#16) can live in outcome scoring.** `the
    copying`'s `somebody-saw` scores below its own null when the witness
    `drinks`. That works and means #16 need not be built — at the cost of every
    situation that casts Sev restating it.

## 4. Contradictions resolved

| | |
| --- | --- |
| dog's three situations inside or outside the 15–20 budget | **inside**; 12–17 remain |
| `unguarded` from "too old to care" vs the tag `old` | **`past-caring`** |
| nine-to-twelve people from a starting five | **twelve present actors**, reading the range as castable-now |
| beliefs never summarised, yet `village.knows-who` is a fact | facts about what the village decided may **gate**, never **print** |
| facts set only by outcomes, yet weather is a fact | ambient situations (§1) |
| "the deck turns over" vs dread only subtracting | the turnover claim is correct and dread was never held to it. Closure now opens, as a lint |
| `MECHANICS` §1 lists `times.withRole(r)` among the qualities a situation weights on, and the same section deals in the order *weighted* (2) then *cast* (4) — at weight time there is no role holder | kept, read as **max over the candidates who could fill the role**. `the drawing`'s ×1.7 uses that reading. It is a materially more expensive computation than the others in the available set and the engine should be told which one it is doing |
| `DIALS` §8 lists "whether a scene can be cut to one beat" as undecided; `prompts/situations-brief.md` §1 requires a barometer to still read when cut to one beat | **toward the brief.** `the drawing`'s beat 1 stands alone in all six of its ambient variants. Note that its cut-short line is authored for the beat-2 cut, so a one-beat cut has no line and currently ends on nothing |
| "every gate has a ceiling" vs a barometer having to be dealable at every dread | a barometer's ceilings are on **attention and facts**. `the drawing` has no dread ceiling and names what stops being true instead — the errand, not the well |

## 5. Questions

1. Add `opposed` to the relation vocabulary?
2. Pressure damps but stages ratchet — agreed? And what counts as a margin?
3. Ambient situations approved as the fact setter?
4. Is there a clock, or does `believes-alone` need another source?
5. Run-start facts: setup step, or a turn-zero ambient deal?
6. Per-speaker credibility: build it, or leave Sev's discount in prose only?
7. Confirm the corpus at ~22,500 rather than ~19,000.
8. Sign off the pool at twelve so coverage becomes the thing situations are
   written against.
9. May an **outcome** be effectively single-cast on a barometer? `the
   drawing`'s `she-says-it` needs near-total attachment to the ring, which is
   one person in the pool. Roles on a barometer need three candidates; outcomes
   have no such rule, and an outcome only one person can reach is exactly where
   recurrence pays.
10. Is `well.answered` the right grain, or should the cult read a count of
    offerings rather than a fact? A fact cannot say *how many times*.
11. What produces `believes-alone` for a forbidden child? `CAST` promises it as
    the conversion, §3.2 says there is no clock, and the `tender` register of
    `the copying` — a third of that sheet — is written against a state nothing
    currently sets.
12. Three requested qualities came back from three sheets: **lastAction**
    (recency and which lever, signed), **hoarding**, **legibility debt**. Build
    which?
13. Confirm the per-situation prose figures in `situations/README.md` against
    `DIALS` §7, or move §7.
