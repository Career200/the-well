# The first three situations

Written against `../prompts/situations-brief.md`. Three sheets and then a stop:
one barometer, one road step, one lens, the last two on the same road and the
first castable in the same village state as both.

| | |
| --- | --- |
| [the-drawing.md](the-drawing.md) | barometer — somebody has to come for water |
| [the-second-visit.md](the-second-visit.md) | road step ⟨the cult, step 1⟩ — somebody comes back to see whether it was taken |
| [the-copying.md](the-copying.md) | lens ⟨the cult⟩ — children at the rim, doing what they have seen done here |

---

## 1. Why these three

**the drawing.** It is the only scene in the deck where the water goes into a
person, so it is the one situation that has to keep being dealable from an empty
village to a boarded one — and it is where the supply actually runs. Six
candidates for its one required role, four after the children are forbidden.

**the second visit, ⟨the cult, step 1⟩.** The road whose horror is entirely
mechanical needed pricing on the step where that mechanic is naked: pressing is
read as an answer, stillness is read as a refusal, and a refusal is dealt with
by bringing something better next time. Every outcome including the null moves
it the same direction.

**the copying, ⟨the cult⟩.** The lens takes shared material — children at the
rim, which is a barometer candidate in its own right — and puts it after
`offerings.left`, where it stops being about children and becomes the scene in
which the road's words leave the road's hands.

Two of them are deliberately expensive: the drawing carries the character
recurrence spine at three levels, the second visit carries three registers, and
the copying carries two more. Pricing the corpus off three cheap sheets would
have said it was half the size it is.

## 2. Why it is a slice and not three samples

**The causal chain, entire, inside these three.** A woman who has come to this
well three times and been frightened here takes something out of her pocket on
the fourth and puts it well back from the edge — `offerings.left`. Somebody
comes back to see whether it was taken, and if the water answers while they are
leaning over it they do not go home that night — `well.answered`,
`someone.keeps-watch`, `village.talks`. The children have heard, and are better
at repeating than adults are at admitting — `words.not-hers` — and the woman
who comes up the track to fetch one of them home makes a rule that evening,
which takes two names off the list of people who can be sent to a well for
water. That last fact lands back on the first sheet's casting. The presence
acted, the village responded, and who comes is different.

**The three nulls, read as one run.** A woman draws two buckets, drinks at the
wall, and changes which arm at the halfway point. Somebody comes back later to
a thing on that wall, waits, gets nothing, moves it to where the stone is flat
and puts a second thing beside it. Two children say a rhyme at the wall twice,
get nothing, drop stones in and argue about the count all the way down the
track. Nobody was frightened, nothing was answered, and by the end of it there
are three things on that wall and a rhyme in the village, and the well did not
do any of it. That is the run where the well was just a well, and it is not a
run in which nothing happened.

**Order.** Nothing here gates on anything else here. Both cult sheets gate on
`offerings.left`, which has three origins outside these three. The drawing gates
on nothing either of them sets. The second visit's only fact ceiling —
`someone.keeps-watch` — is one it sets itself.

**Same village state.** Attention 0.20–0.80 deals all three. None of them has a
dread ceiling.

## 3. The seams — everything these three lean on that does not exist

Gathered from the three `leans on` blocks, including where it is embarrassing.

**Facts read as weather, set elsewhere.** `well.fenced` · `well.boarded` ·
`well.disused` · `sickness.here` · `water.suspected` · `after-rain` ·
`water.low` · `village.searching`. All eight have origins in the dictionary and
none of those origins is in these three sheets. The drawing's beat 1 has six
variants and every one of them is a bet that something else sets the fact.

**Facts read as gates, set elsewhere.** `someone.is-heard` and
`it-has-gone-quiet` are the drawing's other ceiling, and both come from the
throwing, which is not written.

**Facts set here that need their other origins to be real.** `offerings.left`,
`well.answered`, `words.not-hers`, `children.forbidden`, `village.talks`,
`told-someone`, `has-stopped-coming`, `has-a-reason-to-come`, `heard-it`,
`body.named`, `well.has-a-story`, `someone.keeps-watch`. If these three were
the whole deck, four of those would have exactly one origin.

**Road steps.** ⟨the cult, step 0⟩ — whatever first puts a thing on that wall
when the drawing did not. ⟨the cult, step 2⟩ — the vigil, which is what the
second visit's compound outcome exists to make castable and which is not
written. Nothing here knows what any later step is and nothing here should.

**Roles and cast.** `the-child` stands at two candidates and is thin the moment
either is gone. `the-one-who-comes` needs to hold at three after
`children.forbidden` and after the pool starts losing people; it holds at four
today and that is a starting position, not a property. A person who is
`past-caring` or `drinks`, or any route to `believes-alone`, or the second
visit's `tender` register is dead prose above dread 0.5.

**Mechanisms.** A derivation that makes a forbidden child `believes-alone` at
this wall — `CAST` promises it, nothing produces it, and one third of the
copying is written against it. The whistle's second face, opening on a child.
An hour, or a clock, or anything at all behind "at an hour when there is nobody
on the track".

## 4. Requested qualities

Three, and two of the three sheets want the same one from opposite ends.

**`lastAction`** — how many instances ago the player last acted, and with which
lever. *the second visit* weights ×2.2 on a long stretch of stillness (the road
reads stillness as refusal, so it wants dealing when there has been nothing) and
×1.6 when the last thing was a press two or more instances ago (so the answer
arrives late enough to read as discovery). The engine would have to remember: the
instance index of the last non-still stance and which stance it was, plus the
current run of instances resolved with no input.

**`hoarding`** — charge unspent against how far into the run it is. *the
drawing* weights ×1.4 on it, because the scene most worth spending a belonging
in is the one where somebody is about to carry the water home. The engine would
have to remember: total charge spent this run across all belongings, against
turn or instance count.

**`legibilityDebt`** — whether the player's most recent act has yet produced a
consequence they could see. *the drawing* ×1.8 and *the copying* ×1.9. The
engine would have to remember: the instance of the last act, and whether any
outcome resolved since then whose prose was visibly caused by it — which needs
outcomes to be marked as legible or not, and that mark does not exist.

Not requested but assumed, and flagged in `FINDINGS` §4: `times.withRole(r)` is
in the available set and is not readable at weight time, because roles are cast
two steps after weighting. The drawing's ×1.7 reads it as a max over candidates.

## 5. Additions to `FACTS.md`

One new fact, three added origins.

**`well.answered`** — somebody was waiting at the rim for something to happen,
and something did. Nobody has said the two were connected. Origins: the one who
came back to look was still leaning over it when the water moved (here) · the
line goes slack on the sounding and the man on the rope will not say what he
felt (not here) · Sev tells it in company and this time nobody laughs (not
here). It exists because the cult's later steps have to gate on the well having
been answered and nothing in the dictionary recorded that; `offerings.left` says
things are being left, and `words.not-hers` is two steps further on.

Added origins: `someone.keeps-watch` gains *the one who came back to look did
not go home*. `has-a-reason-to-come` gains *the bucket was full a long time
before she left*. `told-someone` gains *whoever was standing on the track when
it happened*.

## 6. Additions to `FINDINGS.md`

Seven rules that do not exist (§3, items 21–27), three contradictions with how
they were resolved (§4), five questions (§5, items 9–13). Nothing open was
closed. The two that would change other people's work:

- **`Outcome.sets` is static**, so a fact that should land only when an optional
  role is filled needs a duplicate outcome. Three of the fourteen outcomes here
  exist for that reason alone, and the outcome table grows by the number of
  optional roles rather than by the number of things that can happen.
- **`times.withRole` is not readable at weight time.** `MECHANICS` §1 lists it
  in the closed available set and orders the deal weighted-then-cast.

## 7. What it cost

### Words

Prose is the shippable half — beats, affordance prose, outcome prose, the
cut-short line. The rest of each sheet is machinery that never reaches a player.

| | prose | whole sheet |
| --- | ---: | ---: |
| the drawing | 1,065 | 2,062 |
| the second visit | 915 | 1,826 |
| the copying | 1,045 | 2,075 |
| **total** | **3,025** | **5,963** |

Against `DIALS` §7, per situation: beats 160 · outcomes 150 · cut-short 25 ·
affordance prose 50 (`CURVE`'s ~1,000 the budget never counted) = **385 for a
plain one**, +320 if it carries registers, +240 if it carries a recurrence arc.

| | budgeted | actual | |
| --- | ---: | ---: | ---: |
| the drawing — recurrence, no registers | 625 | 1,065 | **1.71×** |
| the second visit — three registers | 705 | 915 | **1.30×** |
| the copying — two registers | 705 | 1,045 | **1.48×** |
| | **2,035** | **3,025** | **1.49×** |

Where the overage is, in order of size:

1. **Ambient variants on the barometer are not in the budget at all.** The
   drawing's beat 1 has six and beats 2–3 have three more. That is ~300 words
   nobody counted, and it is what "plausible from an empty village to a
   closed-up one" costs. Four barometers × ~250 = ~1,000 words the corpus does
   not know about, on top of `CURVE`'s ~1,000 affordance omission.
2. **Outcomes run over.** Fourteen across three sheets against a budget of nine,
   and three of the fourteen exist only because `sets` is static. §7's 150
   words per situation buys about three outcomes; a compound that has to beat
   both singles needs four before you have written anything optional.
3. **Registers multiply the affordances, not just the beats.** §7's register
   line was drawn against beats. An affordance's `above` is where a register
   actually shows, so three registers cost three `above` lines per affordance as
   well.

**Extrapolated.** The situation-attributable lines in `DIALS` §7 plus `CURVE`'s
two corrections come to ~11,300 of the honest ~22,500. At 1.49× that is
~16,800, and the corpus lands near **~28,000**. Two caveats, pulling opposite
ways: these three were chosen to be expensive, so a plain situation should come
in nearer 1.2×; and the barometer overage is structural rather than a matter of
restraint, so it does not shrink with discipline.

If the number has to stay at 22,500, the honest lever is **fewer registers**,
not shorter prose. Registers are one third of the overage and they are the one
thing on this list that can be cut without the sheets stopping working.

### Time

Elapsed wall clock, this session, one model, no review pass:

| | |
| --- | --- |
| reading the seven documents | ~8 min |
| three sheets, first draft | 4 min 40 s |
| dictionary and findings edits | ~2 min |
| this report | ~4 min |
| one self-review pass against the anti-patterns | ~4 min |
| **total** | **~23 min** |

**~1½ minutes of drafting per sheet**, and on its own that figure is worth
almost nothing. What it does say is that the corpus is not generation-bound:
twenty situations at this rate is well under an hour, so ~28,000 words is a
budget question and not a schedule.

What it does not say, and what the number the project actually needs would have
to measure: nobody has read any of this. The self-review pass above cost about
as much as the drafting did and it caught eight things — six sentences that
turned at the end, one line of narrator gloss, one piece of interiority in a
living person. It did not catch, and could not have, the two failures that
matter: a register that has drifted warm across a whole sheet, and a fact set
by a situation that had no business setting it. Both need somebody who did not
write it.

**Price the review, not the drafting.** On this slice the drafting was free,
the reading was eight minutes, and the review is the part still outstanding.
