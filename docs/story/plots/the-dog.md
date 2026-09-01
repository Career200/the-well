# The dog

The first plot, and the tutorial. Three storylets, six outcomes, three facts.

Deliberately small. Everything it teaches, it teaches by being the only thing
happening — so the temptation to give it more outcomes should be resisted every
time it comes up.

## Why a dog

**A dog can perceive the presence and people cannot.** That is a fiction-legal
exemption from the game's central constraint, and it buys the one thing act one
has no other way to get: an entity that visibly reacts, in the same beat, to what
the player just did.

Which makes the dog a **diegetic instrument panel**. It goes quiet near the coat.
It won't look at the ring. It stares at the exact spot the player occupies. That
is affinity, presence and attunement taught with no number and no bar anywhere —
and it is only available while the well is still an ordinary well, which is
precisely when it is needed.

It also teaches the game's whole grammar on something disposable: player → dog →
what people make of the dog → what the village starts to believe. Three links,
nothing at stake.

**Tone warning.** A dog is one warm adjective from wrecking the register. It is
only ever heard and glimpsed from below: claws on stone, breathing at the rim, a
shape interrupting the light. Strange means *wrong*, never funny — it stops
barking, it lies down at the rim, it looks directly at the player and does not
stop.

## Facts

```
dog.loose     the dog did not go home
dog.wrong     whatever happened to it at the well stayed with it
dog.gone      it was never found
```

Three, and none of them is a scene name. Everything downstream reads these.

## Guaranteed, without persisted state

Every run should open with the dog — a tutorial that fires sometimes is not a
tutorial. But this needs no first-run flag and no save file:

```
thread  the-dog
  step 0  the-dog-at-the-rim   at 0    window ∞    onMiss hold
  step 1  the-owner-calls      at 6.0  window 6.0  onMiss silent
```

`onMiss: hold` on step 0 guarantees it in-run without forcing it into turn one.
Weight it high, let the deal decide when — the variation the player feels is
*when* the dog came and *what they did about it*, not whether the plot exists.
Same opening every run is correct here; it is the floor the rest is measured
from.

Step 1 is the only guaranteed *consequence* in the plot, and its `onMiss: silent`
is the good one: if the calling never deals, `dog.gone` is set quietly and the
player simply never hears the dog again.

## 1 · the-dog-at-the-rim — the trigger

```
gate      attention 0.0–0.50, dread 0.0–0.60, facts none ['dog.loose']
roles     dog (tags: animal) · passer-by (optional)
affords   press → 'the water moves'      the dog's head comes up
          hold  → 'the cold gathers'     the dog goes still and will not look away
recurrence  none
```

The dog is an actor, not a prop: a person record with `tags: ['animal']` and only
`fear`, `curiosity` and `tenderness` legal. That lets it fill roles, be preferred
by `most-attached`, and be the subject of other people's conversation.

**Two outcomes.**

```
it-goes-home    score: no pressure and no resonance
                sets nothing

it-stays        score: any pressure or any resonance
                sets dog.loose
                sets dog.wrong  if pressure was high
```

The null result is the more important of the two. **The well has to be able to be
just a well.** If the dog always stays, the player never learns that they were
the difference, and the tutorial teaches nothing.

Which lever was used does not need a third outcome — it needs two prose variants
of `it-stays`, one for pressure and one for resonance. Both levers get taught,
the outcome table stays at two.

## 2 · asking-after-the-dog — optional, independent

```
gate      facts all ['dog.loose'], attention 0.0–0.75
roles     first · second (distinct)
affords   none
```

A pure overheard-dialogue storylet: two people at the rim, talking about the dog,
and the player can do nothing but listen. It exists to establish the channel the
whole game reads its state through — **the village's verdict is something you
overhear, never something you are shown.**

Two outcomes, separated only by whether `dog.wrong` is set: with it, one of them
mentions the well without being able to say why. That single unprompted mention
is the first time the player sees their own influence arrive in someone else's
mouth.

Gated on the fact, not on step 1, so it can deal before or after the calling, or
never. Nothing downstream requires it.

## 3 · the-owner-calls — the consequence

```
gate      facts all ['dog.loose']
roles     owner (prefer most-attached) · child (optional)
affords   press, hold — same as the trigger
```

**Outcome is causal, timing is random.** Whether the dog comes is determined by
what the player did to it; *when* the owner comes looking is the die roll. The
tutorial fails if the player cannot feel they caused this.

```
it-comes-back    score: not dog.wrong, and no pressure now
                 the well is just a well. the owner goes home.

it-comes-wrong   score: dog.wrong
                 sets nothing new
                 fear on the owner → haunted

it-will-not-come score: dog.wrong and pressure now, or the dog is still at the rim
                 sets dog.gone
                 grief on the owner, and the owner now has a reason
                 to stand at the mouth of the well
```

`it-will-not-come` is the prize. It manufactures a specific named person with a
standing reason to come back to the rim, which is a hook into everything after
this. `it-comes-back` is the null result again, and it must stay reachable.

## What it teaches, in order

1. Something down here can notice me.
2. What I do changes what it does — and doing nothing is also a thing I did.
3. The two stances feel different and the dog reacts to each differently.
4. The belongings are not all the same to it.
5. People up there talk about what they saw, and what they say is not what
   happened.

## What it deliberately does not do

No belief is moved by more than a trickle. No belonging is meaningfully spent —
charge costs here should be small enough that the player can experiment freely,
because this is where they are forming their model and the run should not be
decided by it. Nothing in this plot gates anything except `dog.gone`, which one
later storylet may read as an ambient fact about the village.
