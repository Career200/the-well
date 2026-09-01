# Brief — the first three situations

You are writing playable content for **THE WELL**, a short narrative horror game
about a presence at the bottom of a well that cannot leave, cannot speak, and
cannot be perceived. You will not write or read code. Everything you produce is
fiction inside a fixed vocabulary.

The design is settled and documented. **Your job is not to design it.** Your job
is to write three situations to full depth, in the register the project has
already established, and to report honestly what one costs.

---

## 0. Read first, in this order

Everything is in `docs/story/`.

| | what to take from it |
| --- | --- |
| `HORRORS.md` | what the game is for. Read it whole, first, before anything |
| `MECHANICS.md` | the settled mechanics: the loop, the stats, the roads, the run end, the authoring laws in §8 |
| `CAST.md` | who exists, what each is mechanically for, who can fill which role |
| `FACTS.md` | the vocabulary you write in. You declare needs as facts from here |
| `CURVE.md` | how escalation is written — affordance bands, cut lines, guardrails |
| `plots/the-dog.md` | the one plot already at depth. This is the quality bar |
| `FINDINGS.md` | what is open. Do not resolve any of it — add to it |

Engine-side, one directory up: `SCHEMA.md` for the container shapes you are
authoring into (`Gate`, `Role`, `Outcome`, `Below`, `Affordance`, `Thread`).
`DIALS.md` only if you need the budget arithmetic.

`prompts/storylet-brief.md` is the previous brief. It produced `CAST.md` and
`FACTS.md` and is **superseded** — its cast size, budget and belief model are
all out of date. Do not write against it.

## 1. What you are writing

**Three situations, and then stop.** Not twenty. The point is to find out whether
the corpus is authorable from these documents and what one sheet actually costs,
before anyone commits to seventeen more.

Pick one of each kind:

- **a barometer** — one of the scenes the player sees repeatedly. Must be
  plausible from an empty village to a closed-up one, and must still read when
  cut to one beat. Candidates are nominated in `FACTS.md` Appendix.
- **a road step** — a step on one of the three tracks: the cult, the
  investigation, the sealing. Name which road and which step.
- **a lens scene** — condition-gated, showing shared material through that same
  road's eyes.

**The road step and the lens scene go on the same road**, and the barometer must
be castable in the same village state. That is what makes the three a slice
rather than three samples.

Choose which ones and say why in a sentence each. Prefer expensive ones — at
least one carrying registers and one carrying character recurrence — because
pricing the corpus off three cheap situations will tell you it is half the size
it is.

Full depth means **written, not described**: every register, every recurrence
level, the cut-short line, every affordance's prose, every outcome's prose.

## 2. The two hard requirements

These pull against each other and getting both is the actual difficulty of the
task.

### Coherent as a slice

If these three were the entire deck, a run made only of them must read as a run.

- At least one complete causal chain runs across them: the presence acts → the
  village responds → something changes about who comes or what is dealable.
- Each has an outcome reachable with the player doing nothing at all, and those
  three null outcomes together still read as a run. The well must be able to be
  just a well.
- No sheet may assume another has been dealt. They must play in any order.

### Open to everything unwritten

Nothing you write may constrain what does not exist yet.

- **Never name another situation.** Declare needs as facts.
- Every fact you **set** must already be in `FACTS.md`, or be added to it with
  two or more origins — **at least one of which is outside these three sheets.**
- Every fact you **read** must either be settable inside these three, or already
  have origins elsewhere in the dictionary.
- No role may have fewer than three candidates in `CAST.md` unless the situation
  is plot-bearing.
- No prose may assert anything about the truth of the death, or about which road
  the run is on.

**Declare the seams.** Each sheet ends with a `leans on` list: the facts, roles
and road steps it assumes will exist and be supplied elsewhere. That list is how
the work gets reviewed without re-reading everything, so it must be complete
even where it is embarrassing.

## 3. The sheet format

```
## <name> — <one line of what it is>

kind         barometer | road step <road, step n> | lens <road>

gate         attention 0.30–0.75 · dread 0.0–0.60          may this deal at all
             facts all [...] none [...]
weight       base 1.0 · ×N while <a player quality> · ×N   how much the director
             when <road> is due · ×0.2 if seen recently    wants it right now
roles        <role> (tags, what they must already be) · <role> (optional)
distinct     [...]
registers    [wary, plain]   or  —  (most situations)
recurrence   against <person> · cooldown ~6 · escalates / does not   or  —
cut short    after beat 2 · <the one line that ends it there>
track        pressure it adds · what it feeds or damps on other roads
leans on     <facts, roles, steps assumed to exist elsewhere>

beats
  1  <what is heard. sound before sight, always>
  2  <what is seen through the coin of sky>
  3  <the turn>
  4  <the moment it could still go either way>

affords      what the presence can do to this scene. Never listed to the
             player — found by trying. Every one prints prose in the beat it
             lands, without exception

  press → <name of the act>            beats 2–4 · cost low | medium | high
      below   <what it is from down here, and what prints when it lands>
      above   <what the people do about it>
      late    <the `not yours` variant, if this one carries one — CURVE §1>

  hold <belonging> → <name of the act>  beats 1–4 · cost <that belonging's charge>
      below   <as above>
      above   <what changes in them>

  still   <what this scene does when the presence does nothing at all. Not an
           affordance — it is the null path — and it must be written, because
           it is the outcome most runs of this scene will take>

outcomes
  <name>    scores highest when …
            sets     <facts>
            moves    <who feels what, in words not numbers>
            cues     <named sensory beats>
            prose    <written out>

what it is for     <one line: what this exists to make possible downstream>
what it costs      <what leaves the deck once this can happen, or what the
                    player gives up by reaching it>
```

**`gate` and `weight` are different jobs and the sheet needs both.** The gate is
a hard filter — eligible or not. The weight is what the director reads when
choosing among everything eligible, and it is where a storylet says *deal me
now*. A situation with a gate and no weight is one the director has no opinion
about.

Weight on the player's qualities, listed in `MECHANICS.md` §1. Two rules:

- **The available set is closed** — lucidity band, presence, a belonging's
  charge or discovery, `times.*`, turn, road stage. Use those names exactly; do
  not coin a synonym for one that exists.
- **Anything else is a request.** You may weight on a quality that does not
  exist, but declare it as a request and say what the engine would have to
  remember to compute it. Requests are wanted — they are the evidence for which
  derived qualities the corpus actually needs.

Weight is evaluated **before** the scene runs, so it cannot read `pressure` or
`resonance`. Those are what the player did inside a scene; they belong to
outcome scoring.

**`affords` is the whole of the player's agency in the scene.** Two levers, and
what they mean here. Write it so a reader can see what a player who experiments
would discover, including that they might discover nothing and that the scene
still has to be worth reading.

## 4. The laws, as a checklist

Canonical in `MECHANICS.md` §8; here as a working list.

- Every gate has a ceiling. Write the ceiling first — name what stops being true.
- **Closure opens.** Anything this removes, name what it makes possible.
- **The worst thing happens before the cut.** Dread truncates after beat 2. A
  scene that saves its worst for beat 4 disappears exactly when the run is at
  its most frightening. Consequence goes late; the bad part goes early.
- Every situation has a zero-input outcome, and it has to be worth reading.
- Every affordance prints prose in the beat it lands. Affordances are never
  listed to the player.
- No new verbs. Press and hold are the entire input surface, forever.
- Registers only where they are a tell on the main story. Most situations have
  one implicit register and no variation.
- Recurrence counts against the person, not the situation.
- Outcomes score, they do not match. Write compound outcomes that beat both
  singles when both inputs are present.
- Beliefs are overheard. Never summarised, never shown.
- Facts record what was said and done, never what is true about the death.
- Sound before sight. The player is at the bottom of a hole.
- Nothing warm survives contact with the well without cost.
- The word is never used.

## 5. Anti-patterns

These are craft failures, not plot constraints. Where the plot can go is open;
how it reads is not.

1. **Do not argue for the design.** A sheet contains the scene and its
   machinery. It never contains a case for either. If a line is explaining why
   something works, cut the line.
2. **Do not gloss the scene.** If a beat needs a sentence telling the reader
   what it means, the beat is wrong. Fix the beat.
3. **Strange means wrong, never funny.** A dog is one warm adjective from
   wrecking the register, and so is a drunk, a married couple, and every child.
4. **The narrator is not witty.** Dryness is composure and composure is a kind
   of warmth. An aphorism landing at the end of a paragraph is good once and a
   tic by the third time. Watch for the sentence that turns at the end.
5. **Escalation is never volume.** Louder is not worse. More specific is worse.
   Nothing in this game shouts.
6. **Nobody is a monster.** People doing terrible things are doing a job they
   have talked themselves into.
7. **The village is never stupid.** Closing up, boarding it, keeping children
   away — all of it is competent self-protection by people who are not in a
   horror story.
8. **Describe behaviour, not feeling.** The presence sees a coin of sky and
   hears everything. Interiority of the living is not observable and must be
   inferred from what they do with their hands.
9. **Never summarise state.** No sentence anywhere tells the player where
   anything stands.
10. **Cut anything that carries no fact, beat or image.** If a paragraph can go
    without losing one of those three, it was mush.

## 6. Not yours to decide

- Numbers and tuning. Bands and costs are shapes; the values come from a sim.
- How the director picks.
- Interface, camera, audio.
- Anything listed open in `FINDINGS.md`. If you need a rule that does not exist,
  **do not invent it** — add it to that list and write around the gap.
- The truth of the death. It stays ambiguous; that is structural, not coy.

If two documents contradict each other, say which two and which way you resolved
it. Ask questions in a batch, not one at a time.

## 7. What to hand back

1. **Three sheets**, full depth, in the §3 format.
2. **The seams**, gathered — one list across all three of what they lean on that
   does not exist yet.
3. **Requested qualities** — every quality you weighted on that is not in the
   available set, with what the engine would have to remember for each.
4. **Additions to `FACTS.md`**, if any, each with two or more origins.
5. **Additions to `FINDINGS.md`** — rules you needed and did not have,
   contradictions found, questions.
6. **A cost report.** Words per sheet, **time per sheet**, and the total against
   `DIALS.md` §7's per-situation figures. This is the number the whole exercise
   exists to produce: if a situation costs a day, twenty situations is a month
   and the deck size is wrong. Do not skip the time figure.

Then stop.
