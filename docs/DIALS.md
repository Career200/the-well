# The dials

`STORY_MACHINE.md` says what lucidity and dread *do*. `SCHEMA.md` says what shape
the content takes. This document answers a third question that neither does: how
**strong** those two dials are allowed to be.

That turns out to be arithmetic rather than taste, and the arithmetic produced one
result that changed the design rather than merely constraining it: **dread is not
a branch, it is the clock on the run.** Run length is not a number to be chosen.
It is an output of how the game is played.

The one-sentence version: **lucidity is the act clock and costs almost nothing to
strengthen; dread is the clock on the run itself, and it only ever runs one way.**

---

## 1. The budget, and why it is a range

```
turns_per_storylet   = beats + 1 (resolution) + idle_turns_between
seconds_per_turn     = words_per_turn / reading_rate + decision_time
instances_per_run    = minutes × 60 / (seconds_per_turn × turns_per_storylet)
```

The constants, with provenance stated honestly — the current build is a proof of
concept and its prose is not the real prose:

| term | value | where it comes from |
|---|---|---|
| beats + resolution | 4.0 quiet, ~2.0 cut short | authoring choice; the cut-short figure is the design, not a measurement |
| idle turns between | 1.3 | measured, but purely an artefact of `sceneChance`. **A knob, not a finding** |
| words per turn | ~29 | measured on placeholder prose. A *target*, not data |
| reading rate | ~220 wpm | assumption |
| decision time | ~2 s | assumption; low because stances mean most beats need no input |

What transfers from the PoC is not the numbers. It is that `turns_per_storylet`
was **stable to within 4% across every playstyle** — 5.3 / 5.5 / 5.3 for
haunt-heavy, resonance-heavy and mixed. Pacing was a property of the container,
not of how the game was played, which is what made budgeting possible at all.

Truncation deliberately breaks that stability, and that is the point:

| | turns/storylet | instances | run length |
|---|---|---|---|
| played quietly | 5.3 | 10–12 | **9–11 min** |
| played hard | 3.3 | 7–9 | **4–5 min** |

Rounded outward for the tails, that is the pitch's **5–12 minutes**. It is a
consequence, not a target. A player who never presses gets the long, legible run;
a player who presses constantly gets a fast one that ends early and tells them
least.

**Set the instance count, not the minutes.** 10–12 for a quiet run comes from two
bounds: the mandatory spine — the dog, the throwing — must stay under ~30% of the
run, which needs ≥10; and the deck must substantially exceed the run so that
bands can cut freely, which against 20 situations needs ≤12.

## 2. Why the two dials cannot be symmetric

Three lucidity tiers × three dread bands is nine world-states. At 7–12 instances
that is one or two instances per state, far below the threshold where a player
can distinguish a state from noise. **Nine states cannot be shown in this run
length.** Symmetric dials are not affordable.

They also have genuinely different characters, which is the way out:

| | lucidity | dread |
|---|---|---|
| driven by | looking, understanding | playstyle — how hard you press |
| across a run | monotonic, player-paced | monotonic, and it never recovers |
| every run traverses it? | yes, by construction | no — a quiet run barely moves it |
| what it rewrites | Below — a fixed set | nothing. It *removes* |
| what it costs to strengthen | flat | almost nothing, if it stays structural |

So they get different jobs:

- **Lucidity is the act clock.** Guaranteed, ordered, experienced in full by every
  run. It is what makes two runs feel like the same story told twice.
- **Dread is the regulator.** It decides how long the run is, how much of it the
  player is allowed to understand, and which ending they are steering toward.

## 3. Lucidity — as strong as you want it

Because it is nearly free, and for a structural reason: **`Below` is a fixed set
that does not grow with the deck.** Four belongings, the walls, the water, the
silt, the rope, the light, the body, the sky. Roughly eighteen subjects.

```
18 subjects × 3 tiers  ≈  54 blocks
+ `extra` at named     ≈  18 blocks
                       ≈  2,500 words, written once, done
```

Adding the twentieth situation does not add a single word of `Below`. This is the
inversion worth internalising: the dial that rewrites the narrator's entire
vocabulary is the *cheap* one.

**Three tiers is correct.** At 7–12 instances they get 2–4 each, which sounds thin
until you notice that the narrator's voice changing every three scenes is fast,
not imperceptible — the risk is a tier not getting to establish itself, not the
player failing to notice. Four tiers would genuinely be too fine.

### Where the aiming threshold goes

Recomputing this against the shorter run changed the answer. At 10–12 instances,
putting broadcast → aimed at the `plain` → `named` boundary leaves **3–4 scenes**
in which to use it, which is not enough to justify building it.

Put it at the **`veiled` → `plain` boundary instead** — one third in, not two
thirds — which leaves 6–8 instances of aimed play. That also reads better: you
learn to aim as soon as you know *what the things are*, and the final tier is
about knowing what they meant to **you**, which is the emotional payoff rather
than the mechanical one.

There is a contradiction in `STORY_MACHINE` §3 to resolve here. Aiming is
justified by "you now know what the object was to *them*" — but that is the
belonging's **second face**, which the same section says opens by *recurrence*,
not by lucidity. The coherent reading, and the one to build:

- **Lucidity grants the capability.** You can aim at all.
- **The second face grants the target.** You know where to point *this particular
  thing*, and only for the person you have now seen at the rim enough times.

Two gates on one verb, one general and one per-object. That is better than either
alone, and it means an aimed run is one where the player has both understood
themselves and paid attention to somebody.

### Lucidity should still have ceilings

`SCHEMA` §2 gives `Gate` a `lucidity` band, and "write the ceiling first" applies
to it as much as to attention. A situation gated `lucidity: { max: 0.4 }` is
content available **only while you do not yet understand yourself** — the veiled
early game becomes a resource the player spends by paying attention, exactly as
intimacy is spent by making the well famous.

Without ceilings, lucidity is a pure ratchet in a design whose central win was
that nothing else is one. With them, both dials take things away, which is the
right symmetry to have.

## 4. Dread — the regulator

### It cuts scenes short. It does not rewrite them.

The same situation at high dread simply stops early: people do not finish what
they came to say, because saying it here has become a thing one does not do. Not
a register, not a variant — **"shh, not here."**

The authoring cost is therefore close to zero. Each situation declares where it
can be cut and the one line that ends it there. Twenty lines, ~500 words, against
the ~19,000 the corpus would have needed if dread were a prose axis.

It also has to be designed for. A scene that only works at full length will break
when cut, so every situation must be written to survive truncation from the first
draft — which is a constraint on the beats, not an afterthought.

### It never recovers

Resolved, and the answer is no. Nothing decays it; a situation may grant small
relief, nothing grants much. That makes dread the one genuinely irreversible thing
in the design, and it lands the cost that the economy has been missing — presence
regenerates, so pressing has been effectively free. Now it is not:

> **Every press permanently shortens the run.**

The run gets faster and thinner as it goes, with no way back. That is the
narrative analogue of Seedship's decay: an irreversible slide that shapes the
ending rather than a resource bar to be managed.

### The trade it creates

Registers are **tells on the main plot** — a scene playing tender or raw is the
story underneath showing itself. So the rule from `STORY_MACHINE` §1, that soft
registers leave the deck above dread ≈ 0.5, is not merely about warmth
disappearing. It is about the player losing the channel the story is told through.

Combined with truncation and with the early-ending situations that dread opens,
the core tension states cleanly:

> **Haunting trades knowledge for speed. You end sooner, knowing less.**

That is the strongest thing in this design and everything else should be arranged
to make it legible.

### The floor problem

At high dread with the early-ending gates open, a run can land near three minutes.
That reads as the game breaking rather than as a consequence the player caused.

The fix is not a minimum-length rule, which would be a lie the player can feel.
**The coda carries it** — see §6. A three-minute run needs an ending that says,
without flinching, that the player made a place nobody will stand near long enough
for anything to happen. Done well that is the best ending in the game. Done badly
it is a bug report.

### Two bands within a run, not three

Dread is monotonic and playstyle-driven, so a single run should cross **one**
boundary: before and after the village closes up. Two transitions inside 7–12
instances leaves each phase too short to establish. A third band may exist for
extreme runs; it should not be on the expected path.

## 5. Idle pacing is still the cheapest lever

`idle_turns_between` is 1.3, which is an accident of `sceneChance` rather than a
decision, and it is the term that sets how much wall-clock an instance costs:

| idle turns | quiet turns/storylet | 10–12 instances |
|---|---|---|
| 1.3 (now) | 5.3 | 9–11 min |
| 2.5 | 6.5 | 11–13 min |
| 4.0 | 8.0 | 13–16 min |

Given the run length is now supposed to *fall* out of playstyle rather than be
dialled in, the argument for raising it is weaker than it was — but the quiet beat
`STORY_MACHINE` §5 wants still does not exist at 1.3, and the intensity curve has
nowhere to live. **Somewhere near 2.5** buys the quiet without pushing the
long run past the point where a fast one looks broken by comparison.

## 6. The coda carries the whole payoff

Band-locked content is **only legible across runs.** On a first playthrough the
player has no baseline, so "you lost access to a register by making the well
famous" is a run-two feeling. At 5–12 minutes this is plainly a replayed game, so
that is acceptable — but it means dread does almost nothing *perceptible* inside a
single first run except make it shorter.

The coda is what fixes that, and it needs far more weight than a summary
paragraph. **20–30 variants, ~5,000 words, a quarter of the corpus.**

Three reasons it earns that:

- The game hides its state on purpose. Beliefs are overheard and never summarised,
  so unlike a game with a visible score the player has spent the run accumulating
  something they were never allowed to watch. The coda is where they find out.
- It is the most-read content in a game people replay, and the only thing two
  players will compare.
- **The short, frightened run needs the strongest coda of all** — it is the run
  that ends earliest and explains least, and it is the one most likely to be
  mistaken for a malfunction.

The strictness from `STORY_MACHINE` §2 — beliefs overheard, never summarised —
applies during the run. The coda is the single exemption.

## 7. The corpus

| | words |
|---|---|
| 20 situations × 4 beats, one register | ~3,200 |
| registers on the ~5 plot-bearing situations | ~1,600 |
| character recurrence — ~5 arcs × 3 levels | ~1,200 |
| outcomes | ~3,000 |
| cut-short lines, one per situation | ~500 |
| `Below` — eighteen subjects, three tiers | ~2,500 |
| the overheard channel | ~1,400 |
| **endings — 20–30 variants** | **~5,000** |
| ambient | ~600 |
| **total** | **~19,000** |

Two things follow. Dread as a prose axis would have added ~19,000 to this — it
would have *doubled the project* — which is why truncation is not merely a cheaper
implementation but the only affordable one. And `STORY_MACHINE` §6's ordering is
right for a reason it does not state: the container must be settled first not
because schemas are satisfying, but because **19,000 words is not something you
rewrite when the shape moves.**

## 8. Still to settle

- **Every constant in §1**, re-measured against real prose. The formula is the
  deliverable; the values are not.
- **How far a scene may be cut.** Four beats to two is assumed above. Whether it
  can go to one, and whether the cut point is authored per situation or per beat,
  is undecided and it moves the whole budget.
- **Aiming's input surface.** "A second mechanic with no second verb" is true of
  the verb and false of the input — picking a target is a new interaction whatever
  it is called. Prototype before writing situations that assume it.
- **Which situations grant dread relief**, and how little is little enough to keep
  the ratchet honest.
- **Which four situations are barometers.** Chosen when the deck is written, not
  retrofitted: a barometer must be plausible at every temperature *and* still read
  when cut to one beat, which constrains it from the first draft.
- **Whether lucidity ceilings are used at all.** Free, and in the spirit of the
  bands, but content living only in the first third of a 9-minute run is content
  most players see once. That may be exactly the point.
