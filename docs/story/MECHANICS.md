# The plot mechanics, as settled

What has actually been decided, in one place. Everything here is agreed unless
marked **open**.

---

## 1. The loop

```
turn        the presence holds a stance; the world ticks
stance      still | pressing | holding <belonging>   — one at a time, always
beat        a scene advances one beat. Most beats need no input
resolution  outcomes are scored, highest wins, facts and effects land
instances   10–12 per quiet run, 7–9 per hard one
```

Input is two levers, forever. No third verb is ever added. What changes is what
pressing and holding *mean* in a given scene (affordances), never how many there
are.

### How a situation reaches the player

One deck, one draw, one director. Everything the design has — plot lines,
qualities, roads — enters as a term in that draw rather than as a second
scheduler beside it.

```
1  eligible    every situation whose gate passes: stat bands, facts, roles
               fillable from the present cast
2  weighted    each eligible one scores a weight from the world and from the
               player's qualities — lucidity, what is still charged, how
               recently the presence acted, how long since this one last ran,
               and whether a road step is due
3  chosen      the director draws. Not the argmax, and not the same road twice
               running — its drives are in STORY_MACHINE §5
4  cast        roles filled at deal time; `prefer` decides among candidates
5  register    picked from the legal set, soft ones gone above dread ~0.5
               unless someone in the cast is unguarded
6  played      beats run; affordances are available inside them; dread may cut
               it short after beat 2
7  resolved    outcomes score, highest wins, facts and effects land, road
               pressures move
```

**Roads do not bypass this.** A road step becoming due is a large multiplier on
that step's weight, not a separate clock that deals it directly. So a due step
still competes with the deck, can still lose, and when it loses it resolves
`onMiss: silent` — the facts land, nobody narrates it, and the player meets the
consequence later without having seen the cause. One scheduler, and the plot
lines are strong opinions inside it.

### The player's qualities

Village stats gate; the player's qualities weight. These are what a situation
reads to say *deal me now*.

**Available — the engine has these already or has committed to them.** Write
against them freely.

```
lucidity            as a band: veiled | plain | named
presence            how much is in the pool right now
<belonging>         discovered · charge remaining · spent · taken
times.situation     how often this situation has run, any cast
times.withCast      this exact casting
times.withRole(r)   this person in this role
turn                and the instance count
road                each track's stage, and whether a step is due
```

**Requested — anything else.** A sheet may weight on a quality that does not
exist yet, but it must be declared as a request and say **what the engine would
have to remember** to compute it. Likely candidates, none of them built:
recency of action and which lever, a stillness streak, hoarding (charge unspent
late in a run), and **legibility debt** — whether the player's recent action has
yet produced a visible consequence, which is the drive that makes the village
look like it is reacting to the player rather than to a die roll.

That list stays request-driven on purpose. Which derived qualities matter is
knowable from real scenes and not before them.

> **Weight is evaluated before the scene runs**, so it cannot read anything
> scene-local. `pressure` and `resonance` are what the player did *inside* a
> scene; they belong to outcome scoring, never to weight.

## 2. The two economies

| | recovers | spent by | tension |
| --- | --- | --- | --- |
| **presence** | yes, by stillness only | pressing, per beat | will the water settle before she walks away |
| **object charge** | **never** | holding, per beat | the ring is quieter than it was and the hearing has not happened |

Third economy, added by `HORRORS.md`: **objects can be taken from the player**
without being spent. See §6.

## 3. The village stats

Five numbers and four beliefs. The player sees none of them; each has exactly
one channel in the prose.

| stat | range | what moves it | what it gates | how the player reads it |
| --- | --- | --- | --- | --- |
| `well.attention` | 0–1 | scenes resolving loudly; people talking | which situations are dealable at all | how often the light is interrupted; whether people linger |
| `well.dread` | 0–1, **never falls** | pressing | cuts scenes short; removes soft registers | scenes stop early; nobody finishes a sentence |
| `presence.lucidity` | 0–1 | looking, understanding | `Below` tier; aiming | the narrator names things, and says more |
| `presence.charge` | 0–1 | spent pressing, recovers on stillness | whether you can act this beat | the surface of the water |
| `object.charge` | 0–1 each | spent holding, never returns | resonance strength | warm to hold, then cold |
| `beliefs.*` | 0–1 ×4 | emotion moved in people | **which horror the run becomes** | overheard dialogue only |
| `notoriety` | derived: sum of the four beliefs | — | the loudest gates | how many people show up |

Two properties worth stating because they are easy to get wrong:

- **`notoriety` is not `attention`.** Attention is how much the well is thought
  about. Notoriety is how *decided* the village is, summed across all four
  beliefs — a village torn between four readings is loud and certain of nothing.
- **Dread is the clock on the run**, not a branch. It never recovers. Every
  press permanently shortens the run.

### How emotion becomes belief

This is the bridge, and it is already in the engine (`BELIEF_OF_EMOTION`):

```
grief       →  tragedy
tenderness  →  tragedy
guilt       →  tragedy
curiosity   →  mystery
fear        →  haunted
anger       →  danger
```

That is an **effect-level mapping and nothing more.** Beliefs are the readout of
which roads have been getting louder — the thing the player hears two people
disagree about. They do not select a road, do not gate an ending, and are not a
score. Emotion feeds belief, road events feed belief, and belief feeds road
pressure back weakly. Nothing in that loop is a switch.

Two balance notes that fall out of the table rather than driving anything: three
of six emotions feed `tragedy`, so the readout skews there unless outcomes
compensate; and `anger` has one feeder, which `STORY_MACHINE.md` §5 supplies —
haunting someone already terrified overshoots into it.

### Reading a mid-run state

Not playstyle-to-ending. These are director positions: the same state with more
than one legitimate next move.

**Turn 7.** attention .55 · dread .30 · cult 1, asking 0, sealing 1 · two gone,
unnamed. The director can deal the cult step those two deaths just raised, or
push the supply toward being named, or hold both and deal a barometer so the
player feels the gap. The cult step makes the run about what people did *about*
the deaths; naming makes it about the deaths. Neither is an ending.

**Turn 11.** The boards went on at turn 9. Fewer people are drinking, so the
supply has slowed — and the cult gained a lid to leave things on. The most
sensible thing the village has done is the reason the run is now about devotion,
and nobody up there will ever connect the two.

**Nothing was pressed all run.** Every trickle ran anyway. One household is gone
and unnamed, someone came asking because `body.seen` reached them, two things
are on the rim nobody admits to leaving, Bern has fenced it. No track leads by a
margin, so from instance 10 attention starts falling and the run starves out.
Everything began, nothing finished, and the presence watched all of it.

## 4. The roads run in parallel

No selector, no arming roll, no playstyle-to-ending map. **Three roads and one
supply, all live from turn one**, each accumulating pressure, each with steps
the director may deal. Whichever ramps hardest becomes what the run was about;
the others sit at whatever stage they reached, and the coda reads all of them.

```
the cult           devotion. Nothing the presence does reads as "stop"
the investigation  the question. Answered never, abandoned often
the sealing        boards, fence, rule — and then the forgetting
  ·
the sickness       a supply, not a road. People go, and the three consume it
```

### The source

Every road is a failed attempt to deal with the same thing, and the thing cannot
be dealt with.

> **The source is never cut dry.** There is a body in the water. Nobody can take
> it out — not the village, not the presence. Every track therefore has a
> baseline trickle that accumulates with no player input and cannot be stopped,
> and every attempt to stop it feeds a different one.

| track | the trickle that never stops |
| --- | --- |
| the cult | stillness reads as refusal, pressing reads as answer. There is no third thing |
| the investigation | the question is never answered, only abandoned — so another asker comes |
| the sealing | a hole that keeps producing incidents keeps producing reasons to close it |
| the sickness | the water is what it is, and people draw from it because they must |

**The sickness has no steps until it is named.** Unnamed it is a supply: a
household goes, and the three roads react. Named — `water.suspected`, chalked
doors, the cart twice in a week — it gains its own steps and ramps like a road.
That naming is the only thing that distinguishes a bad year from a plague.

### They feed each other

`+` raises another road's pressure, `−` damps it. This is the part that makes it
a system rather than four rails.

| event | cult | investigation | sealing | the supply |
| --- | --- | --- | --- | --- |
| someone is `is-gone` | ++ appease it | ++ why | + blame it | — |
| `offerings.left` | — | + something to notice | ++ Anselm wants it stopped | · |
| `someone.is-asking` | · | — | ++ stop him | + the water gets tested |
| `well.boarded` | + a shrine with a lid | + why board it | — | −− fewer people drink |
| `water.suspected` | −− | ++ | ++ | names it — it becomes a road |
| `well.blessed` | ++ the liturgy is legitimised | · | − | − |
| the throwing | ++ it was accepted | ++ or −− by who went in | ++ | + |

Two things to read off it. **Boarding the well saves lives and builds a shrine**
— the village's most sensible act is the cult's best day, and nobody up there
will ever connect the two. And `water.suspected` is the only event that damps a
road hard: a well people fear is a god, and a well people are poisoned by is a
problem.

### What the director actually chooses

Not the ending. Which of four live tracks gets the next scene, which is a real
choice because two or three always have material:

- prefer the loudest road, **but not every time** — hesitancy is what stops it
  reading as a rail
- prefer the road the player last fed, delayed a beat or two, so consequence
  reads as discovery rather than as a receipt
- contrast: after a loud step, deal the quietest road that still has something
- never advance the same road twice running
- when any road nears its terminal step the throwing becomes dealable, and
  **which road brought it there decides the casting** — given, silenced, blamed
  or disposed of

### Lens scenes

Two condition-gated situations per road: the shared deck's material seen through
that road's eyes. A water scene during a sickness is not a sickness scene — it
is the water scene, and it is unbearable.

### What ends a run

Two doors.

**A terminal.** A road reaches its last step. The run ends on an event.

**Starvation.** Attention falls until nothing is dealable. The run ends because
nobody came.

The rule that connects them punishes indecision:

> From the late instances (**~10–12**, tuning), if **no track leads the others
> by a margin**, attention decays each instance. A village that never settled on
> what this place is stops thinking about it at all.

So a run spread across every road and committed to none does not get a climax.
It gets the forgetting — which is where the sealing road terminates anyway,
reached deliberately rather than by default. One ending, two doors.

The margin and the instance window are both tuning. The shape is not: **a
divided village is a village that loses interest**, and losing interest is the
one thing that takes the presence apart.

### What the ending reads

Not a threshold on a belief. **Which road terminated (or that none did), how far
the others got, whether the sickness was ever named, and the few facts that
change an ending outright.** That product is where the coda's 20–30 variants come
from, and it is why they are not three essays with variations.

## 5. What the player cannot do

The helplessness is mechanical, not thematic:

- Cannot speak, be perceived, or leave. The one exemption is animals.
- Cannot stop the throwing by choosing to — only by having made a different
  village.
- Cannot de-escalate. There is no input that means *stop*; pressing reads as
  answering and stillness reads as displeasure.
- Cannot recover dread, cannot recharge a belonging, cannot get back an object
  the water took.

## 6. Loss is the progress bar

Water level is an **event affordance**, not weather:

```
water.high  the coat lifts, drifts, settles further — three warnings, then gone
water.low   the silt shows, and what is in it can be seen from up there
```

Rules: warned, never random · loss always prints, from below · nothing is ever
recovered · **spent reads cold, taken reads absent**, and the prose keeps going
to where it was.

`ring.taken-up` is the model trade: the village gains a name to say, the presence
loses the lever, in the same beat.

## 7. Deterioration

Attention's floor thins the presence. Affordances go, recovery slows, belongings
go quiet — not spent, unreachable.

**Deterioration is lucidity running backwards** through the tiers already
written: `named` → `plain` → `veiled`. No new prose. Literal text erosion is held
for the last minute and the coda, under rules: never illegible, names go first,
then objects, then places; the last thing standing is a verb with nothing
attached.

## 8. Authoring laws

- Every gate has a ceiling. Every closure opens something.
- The worst thing in a situation happens **before** the cut, not at beat 4.
- Every situation has an outcome reachable with no input, and it must be worth
  reading.
- Situations never name other situations. Needs are declared as facts.
- Every fact has two or more origins.
- Beliefs are overheard, never summarised.
- Facts record what was said and done, never what is true about the death.
- Sound before sight.
- Both ends of every axis hurt.
- Nothing warm survives contact with the well without cost.
- The word is never used.

## 9. Still open

Listed in `FINDINGS.md`. The three that block writing: no ambient setter, no
clock, no run-start facts. The two that block costing: `Below`'s dread block and
the ~1,000 words of affordance prose the budget never counted.
