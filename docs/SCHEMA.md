# The container

The authoring shape for the machine in `STORY_MACHINE.md`. Types here are a
thinking shape, not a diff — the point is to fix the vocabulary a storylet is
written in before twenty of them exist.

Three stress cases drove every decision below:

1. **Storylets must survive random order.** Any storylet can be dealt at any
   time its gate allows, with no guarantee about what came before.
2. **Scenes have more than one person in them**, and who those people are is
   decided at deal time, not at write time.
3. **Some plots run whether or not the player is watching.**

---

## 1. Facts are the connective tissue

The current gates read history: `history.length >= 3`. History is
order-dependent by construction, so nothing gated on it can survive a shuffle.
Replace it with **facts** — small named truths about the world and about people.

```ts
type WorldFact  = string   // 'village.searching', 'well.fenced', 'body.found'
type PersonFact = string   // 'knows-the-body', 'has-stopped-coming', 'unguarded'

interface FactQuery {
  all?:  string[]   // every one of these must hold
  none?: string[]   // none of these may hold
  any?:  string[]   // at least one
}
```

Facts are set by outcomes, never by the engine. The rule that makes random order
work: **a storylet declares everything it needs as facts, and never names another
storylet.** If a piece of prose wants to say *as she said before*, that is a fact
that has not been written yet.

Give a fact **more than one origin** wherever it is plausible. `body.found` should
be reachable from the search party, from a child at the rim, and from the
hearing. A fact with a single origin is a hostage to one deal; a fact with three
is a piece of world that will be true eventually.

## 2. Bands

Every gate has a floor and a ceiling. This is the one change that turns the deck
from an accumulating pile into something that turns over.

```ts
interface Band { min?: number; max?: number }   // omitted end = unbounded

interface Gate {
  attention?: Band
  dread?:     Band
  lucidity?:  Band
  notoriety?: Band
  beliefs?:   Partial<Record<Belief, Band>>
  facts?:     FactQuery
  turn?:      Band        // last resort; prefer state to clocks
}
```

Authoring discipline: write the ceiling first. A storylet with no `max` anywhere
is usually one that has not been thought about — ask what stops being true once
the village is watching.

## 3. Roles

Cast is a set of slots filled at deal time. This is what multiplies twenty
situations into a deck.

```ts
interface Role {
  id: RoleId                      // 'the-one-who-comes', 'the-other'
  requires?: {
    facts?:    FactQuery          // person facts
    emotion?:  Partial<Record<Emotion, Band>>
    attached?: { object: ObjectId; band: Band }   // this belonging means something to them
    tags?:     string[]           // 'child', 'old', 'devout', 'drinks'
  }
  prefer?: 'recently-moved' | 'least-seen' | 'most-attached' | 'any'
  optional?: boolean              // the situation plays with or without them
}

interface Casting {
  roles: Role[]
  distinct?: RoleId[][]           // these groups must be different people
  relation?: { a: RoleId; b: RoleId; is: Relation }[]
}

type Relation = 'kin' | 'married' | 'promised' | 'estranged' | 'strangers'
```

`prefer` is where the director's continuity drive lives — `'recently-moved'`
casts the person whose emotions the player just touched, which is most of what
makes a village look like it is reacting to you rather than to a die roll.

`optional` roles are the cheapest variation in the whole system: the same
situation with a witness and without one is two scenes.

## 4. Registers

Registers are global vocabulary. A situation lists the ones it can be played in;
omitting the list means it has one implicit register and no variation.

```ts
type RegisterId = 'plain' | 'tender' | 'wary' | 'careless' | 'formal' | 'raw'

const SOFT: RegisterId[] = ['tender', 'careless', 'raw']   // suppressed by dread
```

The dread rule, stated once in the engine rather than in every situation: **soft
registers are unavailable above `dread ≈ 0.5`, unless someone in the cast is
unguarded.** Exemption rides on people, not on situations — it is carried by the
`unguarded` person fact, which is set by being drunk, by being a child, by being
old enough not to care, or by believing you are alone.

That last one is the good one, because *believing you are alone* is a fact the
player can destroy.

```ts
// situation-level override, for the rare case where the situation itself is the
// exemption rather than anyone in it
dreadExempt?: boolean
```

## 5. Recurrence

Counted three ways, because "the fourth time" usually means the fourth time
*with her*, not the fourth time at all.

```ts
interface Recurrence {
  max?: number        // hard cap; omit for unlimited
  cooldown?: number   // turns before it can deal again
  escalate?: boolean  // later repeats weight up instead of down
}

// available in Ctx:
times.situation            // this situation, any cast
times.withCast             // this exact casting
times.withRole('the-one')  // this person in this role
```

Content reachable only by repetition gates on `times`, never on a stat. That is
the whole point of it: the player cannot spend anything to get there.

## 6. Prose

One shape, reused for beats, outcomes, ambient and object descriptions. Ordered
candidates, first match wins, last entry unconditional — the same discipline
outcomes already use, so there is only one rule to remember.

```ts
interface Line {
  when?: Gate & { register?: RegisterId; times?: Band; role?: RoleId }
  text: string | ((c: Ctx) => string)
}
type Prose = Line[]
```

**Below is different.** Lucidity rewrites everything narrated from the bottom of
the well, and it does it as tiers rather than as a band, because three named
tiers is a legible writing task and a continuum is not:

```ts
interface Below {
  veiled: string   // sensation. no names, no certainty.
  plain:  string   // the thing named, its history not yet claimed
  named:  string   // yours. said so.
  extra?: string   // only appears at `named` - awareness as more world, not just clearer world
}
```

Belongings run one tier ahead of walls and water. Up There never uses `Below` —
it is observed, not remembered, and its prose must not know things the presence
has not earned.

## 7. Outcomes score, they do not match

```ts
interface Outcome {
  id: string
  score:  (c: Ctx) => number      // -Infinity = ineligible
  prose:  Prose
  effects: (c: Ctx) => Effect[]
  sets?:   string[]               // facts established
  clears?: string[]
  cues?:   CueId[]                // named sensory cues; costs nothing now, unretrofittable later
}
```

Highest score wins, ties broken on the seeded rng. This is what lets a scene come
out grief-*and*-fear: a compound outcome can be written to outscore both singles
when both inputs are present, instead of the first predicate in the list
swallowing the scene.

## 8. Situations

```ts
interface Situation {
  id: SituationId
  gate: Gate
  casting: Casting
  registers?: RegisterId[]
  dreadExempt?: boolean
  recurrence?: Recurrence
  weight?: (c: Ctx) => number
  beats: Beat[]
  outcomes: Outcome[]
  affords?: Affordance[]
  thread?: { id: ThreadId; step: number }
}

interface Beat {
  prose: Prose
  interactive?: boolean   // false for beats too fast to act in. actually read this time.
}
```

### Affordances

What pushing *is* in this storylet. Every affordance draws on the same two pools
— presence for `press`, the held belonging for `hold` — so the resource model
stays global while the fiction and the magnitude stay local.

```ts
interface Affordance {
  id: string                     // 'move-the-water', 'go-cold', 'be-looked-at'
  stance: 'press' | 'hold'
  cost: number                   // per beat held, not per press
  when?: Gate & { beat?: Band; register?: RegisterId; role?: RoleId }
  prose: Prose                   // printed in the beat it lands
  weight?: number                // contribution to ctx.pressure / resonance strength
}
```

Two rules that matter more than the shape. **Affordances are never listed to the
player** — the storylet knows what is possible in it, and the player finds out by
trying; how forthcoming the prose is about an opening existing at all is governed
by lucidity. And **every affordance prints prose in the beat it lands**, without
exception. Silent input is what makes players spam.

A storylet with no `affords` falls back to the generic pair, which is correct for
most of them. Author an affordance when the scene has a specific thing the
presence can do to it.

## 9. Threads — plots that run without the player

A thread is a chain whose internal order is guaranteed while the global deal
stays random. It carries its own pressure, so it advances on its own.

```ts
interface Thread {
  id: ThreadId
  gate?: Gate                          // when the thread may start at all
  pressure: {
    perTurn: number
    modifiers?: (c: Ctx) => number     // dread accelerates, a fact stalls it
  }
  steps: ThreadStep[]
}

interface ThreadStep {
  situation: SituationId
  at: number                           // pressure at which it becomes due
  window: number                       // pressure units before it is missed
  onMiss: 'silent' | 'hold' | 'drop'
}
```

`onMiss` is the mechanism that makes a side-plot independent of the player:

- **`silent`** — the director never dealt it, so it resolves off-screen. Facts
  are set, effects apply at reduced strength, no prose is printed. The player
  meets the consequences later without having seen the cause.
- **`hold`** — the thread waits. For steps that genuinely cannot happen
  unobserved.
- **`drop`** — the thread ends here. The plot simply does not happen, and
  whatever it would have established never becomes true.

`silent` is the default and it earns its place twice: it is the only way to have
things happening up there while the player is not paying attention, and it is
what stops a banded deck from stranding a half-told plot when its window closes.

Threads may branch: a step's outcome sets a fact, and later steps gate on it like
anything else. Nothing about a thread is privileged — it is ordinary storylets
with a pressure clock and a guaranteed sequence.

## 10. Ctx — and what it deliberately withholds

```ts
interface Ctx {
  world:     WorldView                     // stats, no history
  role:      (id: RoleId) => PersonView | undefined
  register:  RegisterId
  times:     Times
  fact:      (id: string) => boolean
  resonance: Resonance | null
  pressure:  number
  rng:       Rng                           // prose flavour only
}
```

**`Ctx` does not expose `history`.** That is not an oversight; it is how the
schema enforces stress case 1. An author who cannot read the history cannot write
a storylet that depends on the order of the deal. Everything they might have
wanted from history is available in a form that survives shuffling: `fact()` for
what is true, `times` for how often, `world` for where the village has got to.

---

## Worked example — *the meeting place*

A side-plot that is multi-person, runs on its own clock, and is destroyed by the
player's success rather than by the player's choice. It exercises every
mechanism above, and its arc is the thesis of `STORY_MACHINE.md`: intimacy is an
early-game resource that the player spends by making the well famous.

```
thread: the-meeting-place
  gate:     attention 0.0–0.45,  facts none: ['well.fenced']
  pressure: 0.06 per turn,  ×1.5 while attention < 0.25  (quiet lets them come)

  step 0  they-meet-here      at 0    window 3.0   onMiss silent
  step 1  they-are-seen       at 4.0  window 2.0   onMiss silent
  step 2  the-last-evening    at 7.0  window 2.5   onMiss drop
```

**Casting**, shared across the thread:

```
roles
  first     tags: [], prefer: least-seen
  second    tags: [], prefer: least-seen
  witness   optional, requires facts none: ['knows-about-them']
distinct  [first, second, witness]
relation  first–second is 'promised'
```

**`they-meet-here`** — gate `attention 0.0–0.45`, registers `[tender, careless,
wary]`, recurrence unlimited with cooldown 6, escalate false.

Both leads carry `unguarded` for the duration, because they believe they are
alone. That single fact is what keeps the tender register legal while dread
climbs — and it is exactly what the player takes away by haunting hard enough
that the whole village is thinking about this place.

Outcomes score on register and on whether the player was present in the scene:

```
tender    score  register=tender ? 1.0 : -inf
          sets   ['they.have-a-place']
          effect tenderness on both, small tragedy on the village

startled  score  pressure > 0.35 ? 0.8 + pressure : -inf
          sets   ['they.have-a-place', 'first.uneasy-here']
          effect fear on both, haunted on the village
          cues   ['water-wrong', 'stone-tick']

overheard score  witness present ? 0.9 : -inf
          sets   ['witness.knows-about-them']
```

Prose is authored once per register; `times.withCast` supplies the erosion, so
the third meeting is written as a variant rather than as a new situation.

**`they-are-seen`** — gate `attention 0.30–0.75`, requires
`they.have-a-place`. The witness role becomes mandatory here. `onMiss: silent`
means that if the deal never comes up, the village finds out anyway: the facts
land, the effects apply weakly, and the player simply never learns how.

**`the-last-evening`** — gate `attention 0.55–1.0`. Registers `[wary, raw]`; the
soft registers are gone unless someone is still `unguarded`, and by this point
nobody near this well is. They come to say they cannot come here any more. Sets
`they.have-stopped-coming`, which several unrelated storylets read as an
ambient fact about the village.

`onMiss: 'drop'` on the final step is deliberate. If attention never rises that
far — a quiet run, a player who barely acts — then the thread simply never ends,
and two people go on meeting at the well for the rest of the game. That is a
better outcome than forcing the coda, and it is only available because the
thread is allowed to not finish.

### What the example demonstrates

| stress case | mechanism |
|---|---|
| survives random order | every step gates on facts; `Ctx` has no history |
| multi-person | three roles, one optional, with `distinct` and `promised` |
| runs without the player | thread pressure plus `onMiss: silent` |
| register as a cog | `unguarded` keeps tender legal, and the player can revoke it |
| bands doing work | the thread's own gate closes as attention rises |
| recurrence | `times.withCast` erodes step 0 without new situations |

---

## Order of work on the container

1. **Roles and casting.** Touches every storylet, so it goes first.
2. **Facts**, replacing all history-based gates.
3. **Bands** on gates.
4. **`Prose` and `Below`.** The variant helper — hand-rolled template functions
   do not survive register × recurrence × lucidity.
5. **Outcome scoring** in place of first-match.
6. **Stances and affordances**, with the economy rewrite in
   `STORY_MACHINE.md` §4. Storylets cannot be written until it is settled what
   the player can do inside one.
7. **Threads.** Last, and only once two or three ordinary situations exist to
   confirm the shape.

Then write two or three situations to full depth — every register, three
recurrence levels — before writing twenty. The point of the vertical slice is to
find out what one of these actually costs.
