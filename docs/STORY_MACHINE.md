# The story machine

`NEXT_STEPS.md` is a list of things to fix in a prototype. This is the other
document: what the prototype has to *become* to be a game, and in what order.

The scaffold answered its question — the two levers do move a village, and the
belief model does gate different endings. It answered it weakly, though, because
there is almost nothing for the levers to act on. Five one-shot scenes, a
director that flips a coin, and four meters drawn as bars. Everything below is
the shape that replaces those three things.

The one-sentence version: **the village is a deck, the director deals, and the
narration is the only HUD.**

---

## 1. The deck

### Storylets, not scenes

A scene is a thing that happens. A storylet is a thing that *can* happen, with
its conditions attached. The current `Scene` is already nearly a storylet —
`requires` is a precondition and `outcomes` is a resolution table. What is
missing is that the cast is hard-coded, so a scene is written once and can only
ever mean one thing.

The move that opens everything up is separating the **situation** from the
**people in it**. "Someone comes for water at dusk" is a situation. Who comes,
and what they are already carrying, is cast at deal time. The same authored
prose is a different scene when the person who arrives is the one already sick
with guilt — and it is a different scene *again* the fourth time she comes.

### The four axes

| axis           | what varies           | what selects it                             |
| -------------- | --------------------- | ------------------------------------------- |
| **situation**  | what is happening     | village stats (bands)                       |
| **cast**       | who it happens to     | village stats + who is available + affinity |
| **register**   | how it is played      | dread, cast emotion — *only where relevant* |
| **recurrence** | how many times before | history                                     |

Target for a full game: roughly **15–20 situations**. Not sixty. Sixty flat
scenes is a deck the player can map; twenty situations times cast times register
times recurrence is one they cannot. The multiplication is the point — this is
why "write more scenes" is the wrong instruction and "write deeper scenes" is
the right one.

### Every gate is a band, not a minimum

This is the formalization of *gated in all directions*, and it is the single
highest-leverage schema decision in this document.

Currently every gate is a floor: `history.length >= 3`, `notoriety > 0.4`. Floors
only accumulate — the deck grows monotonically and nothing is ever lost. Bands
have a top and a bottom:

```
two women talking freely at the rim     attention 0.0 – 0.35
a child sent alone for water            attention 0.0 – 0.45,  dread 0.0 – 0.30
someone checking a rumour               attention 0.30 – 0.75
a search party                          attention 0.55 – 1.0
the hearing                             attention 0.70 – 1.0,  notoriety > 0.6
```

Three things fall out of this, all of them good:

- **The world has phases.** Early scenes are intimate because the well is not
  yet a subject. That intimacy is not a tutorial, it is a *resource*, and it is
  spent by the player's own success.
- **Content locks behind you.** Once the village is watching, nobody is careless
  near the well again. The player loses access to a whole register of scene by
  making the well famous, and they will feel that loss without being told about
  it. This is the closest thing this game has to Seedship's decay, and it costs
  nothing but a second number per gate.
- **The dead air problem dissolves.** At any attention level something has just
  become available. The deck is always turning over rather than draining.

### Register is where dread does its work

Register is not a coat of paint on the text. Where a situation has registers, the
register is a **cog**: it changes the outcome table, not just the prose.

The rule that makes dread mechanical rather than decorative: **rising dread
removes registers from the deck.** People stop being willing to show
vulnerability near the well. The tender register, the confiding register, the
careless register — these stop being dealable somewhere around dread 0.5.

With one deliberate exception: certain situations are marked as
dread-exempt — someone drunk, someone who believes they are alone, a child too
young to have heard, someone too old to care. Tenderness does not disappear from
the game, it becomes **rare and therefore devastating**, and it survives only in
people who are not thinking clearly. That is a better horror engine than any
amount of dread-scaled adjectives, and it comes free with the band model.

Not every situation needs registers. Most should have one or two. Register is
for situations where "how this is played" genuinely changes what happens.

### Recurrence is how a random system becomes fate

The base of this machine is a weighted draw, and the honest risk of any such
machine is that it reads as noise. Recurrence is the antidote, and it is the
cheapest content in the whole design.

The rule: **some content is reachable only by repetition.** Not by a stat, not by
a flag — only by the fourth time. Mira comes for water and comes for water and
comes for water, and on the fourth visit the text erodes into something no gate
could have unlocked. The player cannot make it happen except by letting time
pass, which means the thing they most want is the thing they cannot spend a
resource on.

Two effects worth being explicit about. It makes repetition legible as *design*
rather than as the deck running dry — the difference between "this again" and
"this, again." And it is the only mechanism here that produces the feeling of
inevitability out of a stochastic base, because inevitability is just a pattern
you have seen enough times to predict.

---

## 2. The narration is the interface

The bars are a debug view wearing a costume. Every one of them has a channel in
the prose, and two of them are strong enough to be features rather than
substitutions.

### Lucidity rewrites Below

Everything narrated from the bottom of the well has a lucidity register. The
progression is from sensation toward naming:

```
low     the small hard thing. cold, and it will not warm.
mid     a ring. it does not fit anything down here.
high    your ring. she gave it back and you carried it in your pocket ever since.
```

Three properties matter. The narrator's **vocabulary is the meter** — the player
reads their own growing awareness instead of watching a bar fill. There is
**more text at higher lucidity**, not just different text, so awareness is
felt as the world getting louder rather than clearer. And the word *dead* is
never required, because the narration simply stops being evasive.

Belongings should run one step ahead of everything else — they are the surface
where the presence knows itself best, so they reach the direct register before
the walls and the water do.

This applies **only to Below**. Up There is observed, not remembered, and its
prose should not know things the presence has not earned.

### Dread rewrites Up There

Up There narrows as dread rises, and it narrows for a reason inside the
fiction: people stop showing each other anything. Sentences get shorter because
conversations do. Names get used less because people are being careful. The
prose is not describing fear, it is describing *composure*, which is what fear
looks like from underneath.

The dread-exempt situations above are also where this relaxes — a drunk man at
the rim at high dread should read like a break in the weather.

### The rest of the dials, retired

| meter     | channel                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| attention | how often the light above is interrupted; passer-by versus player-targeted storylets; whether people linger |
| dread     | Up There prose narrows; storylets and registers leave the deck                                              |
| lucidity  | Below prose names things; more text; how explicitly the mechanics are presented                             |
| charge    | the water's behaviour; whether the belongings are warm to hold                                              |
| beliefs   | **overheard dialogue only** — the verdict is something you hear people reach                                |

Beliefs are the one to be strict about. There should be no summary of what the
village thinks, ever. The player finds out what the well has become by listening
to two people disagree about it.

Keep the bars behind a debug toggle. They are for balance passes, not for play.

---

## 3. Belongings

### They telegraph before they are used

A belonging should communicate roughly what it will do before the player spends
anything on it, or experimentation is gambling rather than reading. The signal
is affective, not numeric: temperature, weight, whether it seems to want to be
held, whether it goes quiet when a particular person is above.

That last one is the useful one — a belonging **reacts to the cast overhead**
before it is used. If the knife goes heavy when Tomas is at the rim, the player
has learned an affinity without a number appearing anywhere.

### Lucidity aims them — a second mechanic with no second verb

The risk in "belongings need another mechanic" is a new verb, a new key, a new
thing to explain in a game whose whole premise is that nothing is explained. The
way out is that lucidity changes what the *existing* verb does.

- **Low lucidity — broadcast.** Attuning bleeds the object's emotion weakly into
  everyone present. You are a mood in the room. You cannot choose who feels it.
- **High lucidity — aim.** You now know what the object was to *them*, not only
  what it was to you, so attuning can be directed at one person in the cast. The
  same act, the same key, a scalpel instead of a fog.

The player's power is their self-knowledge, exactly as the pitch wants — but now
that is a mechanical statement rather than a thematic one. And there is nothing
new to teach: the player discovers that the thing they have been doing has
started to have a target.

### Two faces

Each belonging has what it meant to the presence, and what it meant to someone
still alive. The first face opens with lucidity, by looking. The second opens
with **recurrence** — by seeing that person, near the well, enough times. So the
belongings deepen along both axes of the deck, and the object that unlocks the
late game is one the player could not have rushed.

---

## 4. The economy

The prototype has two resources and neither is scarce. Presence recovers at +0.12
a turn against a spend of 0.25; every belonging recovers on the same schedule. A
300-run sweep ends with mean object charge at 1.00 under every playstyle,
including the one that never stops attuning. Waiting is strictly dominant and it
is free. There is no debt anywhere in the system.

The rewrite has three jobs: make one resource irreversible, make the other
legible, and turn both from things you *press* into things you *hold*.

### Two resources, two time signatures

**Presence is renewable.** It recovers with stillness and pays for pushing. It is
the within-scene resource, and its tension is arithmetic under a deadline — will
the water settle again before she walks away? That guessing is the best thing
about how the prototype currently plays and it should survive the rewrite intact.
It is not intuitive yet, which is a readout problem, not a model problem.

**Belongings are finite.** A belonging's charge does not come back. Attuning
spends it permanently. This is the across-run resource and its tension is regret:
the ring is quieter than it was, and the hearing has not happened yet.

Two clocks with different characters, neither substitutable for the other. One
gives the run a pulse, the other gives it a shape. This is also the only
irreversible thing in the design, so it carries the whole weight of Seedship's
decay on its own — which it can, because unlike a timer it is spent by choice.

### Stance, not actions

The player is always in exactly one stance, and the input is *changing* it:

```
still            recovering presence. the default.
holding <thing>  resonance active. drains that belonging per beat.
pressing         haunting. drains presence per beat.
```

Mutually exclusive, and that exclusivity is the point. You cannot press and hold
at once, so the two levers become genuinely opposed moment to moment — and
blending them stops being a matter of playstyle and becomes a matter of
**timing within a scene**. Hold for two beats, then press for the last one. The
outcome scorer sees both accumulated and can reward the compound.

That directly fixes the degeneracy the sweep found, where each policy walked its
own column of the outcome table and never touched the other's: 0% `hooked` for
haunty, 0% `terror` for resonant, in 300 runs each. Those zeros are not a content
problem. They are what a game looks like when the levers cannot be interleaved.

Stance also deletes the click-spam without deleting any inputs. Continuing to do
what you are already doing costs nothing to express, so most beats need no key at
all, and the beats where the player *does* act are the ones that meant something.

### One recovery rule

**Only stillness recovers presence.** Not looking, not releasing, not attuning.
Currently `look` and `release` quietly regenerate too, which is why the player
cannot form a model of where their charge comes from. One rule, no exceptions,
learnable inside a minute.

### The water is the readout

Presence has one continuous diegetic display and it is the surface of the water.
Full and settled: glassy, held, waiting. Spent: stirring, then agitated, then
refusing to settle at all.

That gives the player a single sentence of rule — *wait until the water is still
again* — which is exactly the arithmetic they are currently doing blind. The
adrenaline is preserved; the guesswork about the mechanism is not. It is also
the readout that makes stance legible, since a held press keeps the water moving
and the player can watch their own margin disappearing.

Belongings have their own, colder signal: they go from warm to cold as they are
spent, and a spent one stays cold for the rest of the run.

### Affordances — storylet-local verbs, one shared pool

`pressing` is not the same act in every scene. A storylet declares its own
affordances: what pushing *is* here, what it costs per beat, and what it looks
like when it lands. The water goes wrong at the rim; the lamp gutters at the
hearing; the dog's ears go flat. Same stance, same pool, different fiction and
different magnitude.

This is how the game gets variety of action without a growing verb list, and it
is why the action set never has to be enumerated to the player. The storylet
knows what is possible in it; the player finds out by trying. Lucidity governs
how forthcoming the prose is about the opening being there at all.

### Still to settle

Numbers. All of the above is a shape, and the constants — per-beat drain, the
stillness rate, total charge per belonging, how many beats a scene runs — have to
come out of a sim pass, not out of this document. The one commitment worth making
in advance is that a full presence bar should not survive a whole scene of
pressing, or the deadline stops existing.

---

## 5. The director

Deliberately last in this document, and it should be last in the work. Its
drives, once there is a deck worth choosing from:

- **Intensity curve.** Heavy, then quiet. In horror the quiet beat is where the
  work happens — but only if the ambient layer has state of its own.
- **Legibility debt.** Track whether the player's recent actions have produced a
  *visible* consequence. If not, the director owes them a scene where that
  emotion is legible in someone's behaviour. This is how the dials are actually
  retired: the dials become scenes. Hold the payoff a few turns so it reads as
  discovery rather than as a receipt.
- **Contrast.** If the player only ever haunts, deal someone already terrified,
  where haunting overshoots into anger. A model is only learnable if the player
  is shown it failing. The director generates the negative examples that no
  authored branch would think to include.
- **Continuity.** Prefer casting people whose state moved most recently.
  Emotional continuity reads as causation.
- **Escalation by cast size.** Private scene, pair, group, hearing. Cast size is
  the tempo curve, and it needs no timer.
- **The right to decline.** Choosing silence after a large scene is a stronger
  move than always dealing.
- **Hesitancy.** Never take the argmax every time, and never answer the player's
  last action in the same beat. Delay is what makes authorship look like weather.

**Do not build this yet.** A director with five one-shot scenes has no choices to
make; every drive above is a function over *alternatives*, and there aren't any.
Weighted random is the correct director until the deck is large enough that the
choice is interesting.

---

## 6. So: story or mechanics?

Story — but not first, and this is the whole answer to the question.

The expensive mistake available right now is writing twenty storylets into the
wrong container and rewriting all twenty when the schema moves. The other
expensive mistake is building a director with nothing to direct. Both are
avoided by the same ordering.

### Phase 0 — the container. Short. Mechanics.

Decide the schema and prove it on **two or three situations written to full
depth** — every register, three recurrence levels, cast slots rather than fixed
names. Not more. The point is to find out what writing one of these actually
costs before committing to twenty.

The decisions that are cheap now and painful later:

- **Cast slots.** `cast: PersonId[]` becomes roles with their own conditions.
  This touches every scene, so it goes first.
- **Bands.** Gates get a ceiling as well as a floor.
- **Register as a first-class selector**, with the dread-exemption flag.
- **Recurrence count** available to both gates and text.
- **Text variants.** `text: (state, ctx) => string` will not survive register ×
  recurrence × lucidity as hand-rolled template functions. This is the point at
  which `NEXT_STEPS`' open question about ink deserves its second look — and the
  answer is probably still no, because the branching remains computed rather than
  authored, but a small variant-selection helper is no longer optional.
- **Outcome scoring instead of first-match.** `resolveOutcome` takes the first
  matching predicate, so a scene can only ever come out one column. It needs to
  be able to come out grief-*and*-fear.
- **Named sensory cues on outcomes.** Costs nothing now; retrofitting an audio
  channel later means touching every storylet.

### Phase 1 — the deck. Long. Writing.

Fill it out to 15–20 situations. The director stays dumb throughout. This is the
phase where the game is actually made, it is the long pole by a wide margin, and
most of it is prose rather than code.

It is also the only way to find out which director drives matter. You will know
after reading twenty storylets; you cannot know before.

### Phase 2 — the director. Medium. Mechanics.

Now the drives have alternatives to choose between and can be tuned against a
deck that exists.

The reachability test survives all three phases and gets more important in each,
because a banded deck can strand content in a way a floors-only deck cannot.

---

## 7. Risks worth writing down

- **Feeling handled.** A director is invisible only while it is right, and in a
  slow, quiet game there is nothing else for the player to look at. Hesitancy and
  delay are the mitigations, and they should be in from the start.
- **Authoring cost.** This trades a bigger deck for a more expensive one. The
  cost lands almost entirely on the writing. Phase 0's two full-depth situations
  exist to price that honestly before committing.
- **The puzzle trap.** This machine cannot guarantee the player sees the three
  scenes a deduction needs. If the design ever drifts toward "discover the truth
  of the murder," the director becomes an obstacle. The pitch already says the
  truth stays partly ambiguous — that is not coyness, it is a structural
  requirement of the machine being chosen here.
- **Stranding.** Bands mean content can become permanently unreachable. Usually
  that is the feature; occasionally it will cut off a thread mid-arc, and the
  director needs to be able to see that and prefer to close it.
