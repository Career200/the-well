# Next steps

Written after getting the scaffold to the point where `pnpm sim` runs. Ordered by
what I think buys the most information per hour, not by what is easiest.

## The three things I'd do next

### 1. Give the runs an ending

There is currently no coda. Runs just stop, which makes them impossible to compare
and impossible to feel. An epilogue that reads final beliefs and tells you what the
village decided — one paragraph, four or five variants — turns every playtest into a
result you can hold up next to another one. Cheapest possible change with the
largest effect on whether this is a *game* yet.

Implementation is small: an `epilogues` array in content with the same
`when`/`text` shape as outcomes, resolved when a run ends.

### 2. Make lucidity load-bearing

Right now the player's discovery that they are dead is a number that goes up and
does nothing. That's backwards — the pitch makes that realization the first act.

The fix that makes it mechanical rather than narrated: **you cannot use resonance
until you have understood what the belongings are.** Looking at the ring, the coat
and the knife is what teaches you they are yours; only then does holding one do
anything to the people above. The player's power *is* their self-knowledge. Nobody
ever has to say the word "dead".

Concretely: scale resonance strength by `lucidity`, and have low lucidity produce
outcome text where the object "does not answer".

### 3. Build the stranger

The throwing fires, `stranger-in-the-well` gets set, and then nothing happens,
which is a shame because it is the best idea in the pitch. Someone alive is now in
the room with you and you cannot speak to them. Everything the player learned about
influencing people at a distance now has a target three feet away.

This is a scene cluster, not one scene: the first hours, the shouting, the silence
after the shouting, and whatever the player chooses to do with the belongings while
it happens. It also needs the player to be able to affect a person who is *inside*
the well, which the current `cast`/affinity model handles fine.

## After that

- **A scene economy.** Five one-shot scenes is a demo, not a game. Split content
  into recurring beats (Anna comes for water, again, and again, and the text erodes
  with `dread`) and one-shot story scenes. Add a cooldown field so repeatable
  scenes don't fire back to back.
- **Blended resonance.** Holding two belongings at once, or holding one shortly
  after another, could produce a compound emotion — grief plus guilt reads very
  differently to a village than either alone. This is the cheapest way to multiply
  the state space without writing more scenes.
- **Diegetic feedback instead of meters.** The web client currently shows bars,
  which is a debug view wearing a costume. The real version: charge is how much the
  water moves on its own, attention is how often the light above is interrupted,
  dread is how the prose itself narrows. Keep the bars behind the `state` toggle.
- **Replay logs.** The sim is deterministic, so `seed + action list` is a complete
  recording. A `pnpm replay <file>` that reprints a run makes playtest feedback
  ("it went weird around turn 30") actually actionable.
- **Sound cues in the model.** Even with no audio yet, outcomes should be able to
  emit named cues alongside text. Retrofitting an audio channel into content later
  means touching every scene; adding an optional field now costs nothing.

## Open questions

**Does ink earn its place?** My read: not for the state layer. Ink is built for
authored branching prose, and here the branching is *computed* from a numeric model
of what people feel — the interesting structure lives in the emotion and belief
graph, not in the text tree. Wiring ink under that would mean maintaining the model
twice.

Where ink would genuinely help is one layer up, if scene prose grows to the point
where variant text (by dread, by who is present, by how many times this has
happened) gets unwieldy in TypeScript template functions. That is a real problem,
just not yet. I'd revisit at roughly 20 scenes, and if the answer is still no, a
tiny text-variant helper covers it.

**How long is a run?** The pitch says 15–30 minutes. At the current pacing that's
somewhere near 60–100 turns. Worth deciding, because it determines whether scenes
should be scarce and heavy or frequent and light — right now they're accidentally
frequent and heavy.

**Should the player be able to do nothing successfully?** The `idle` policy
currently produces a world where literally nothing changes. That's honest, but it
may be the wrong kind of honest: a player who is being cautious for their first ten
minutes should still see the story move, or they'll conclude the game is broken.
Probably the well needs a slow ambient drift toward *something* even under total
inaction.

## Parked, and worth doing before the deck grows

### Looking at the nine subjects, and the lucidity queue

The nine cells exist in the UI — five ambient, four belongings — but only the
belongings do anything. Two halves, and the first is a prerequisite for the
second:

**`look` should take a subject, not just an object.** Half done: a belonging
now reads through `tierOf` (`subjectAt` in `engine.ts`), so the fourth thing
found is the one that gets named. The ambient five still have no verb. Same
verb, same cost of a beat, and re-reading becomes a player's choice rather than
an interruption — which is what `HORRORS.md` §7 needs, since deterioration is
only savage if re-reading is a habit by the time it runs backwards.

**A tier crossing queues, it never interrupts.** When lucidity crosses a tier,
enqueue the subjects the player has actually met — an unmet subject cannot take
your attention — and release **one per idle turn, never during a storylet**.
The line is a lead-in plus the subject at its new tier: *"The X takes your
attention again. <the full block>"*.

Wants two authorial decisions first: the lead-in wording (2–3 variants, since it
will be the most repeated line in the run — the same trap the two beat-zero
stance lines fell into), and names for the ambient five, which the grid is
currently hardcoding as `the cold` / `the water` / `the walls` / `the sky` /
`the silt`.

## Not doing yet

3D, audio, art, save/load UI, anything about the camera. None of it tells us
whether the core loop works, and all of it gets cheaper if the model is settled
first. `step()` is pure and both clients are thin views over it, so a first-person
client is additive when the time comes.
