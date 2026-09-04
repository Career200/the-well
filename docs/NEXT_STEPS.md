# Next steps

## For the demo:

- **Diegetic interactions and feedback.** Needs more thought.
- **Ambient camera movement.** Pitch drifting over a beat, as immersion rather
  than control. Not expressible today: `shaftAt()` takes a joint angle, not a
  pitch, so this waits on a projection with a camera in it. A drift on the whole
  SVG is the cheap stand-in and buys no parallax.
- **The waterline as a level.** A push lifts the drawn surface, riding the
  `agitation` kick it already sets; a standing rise would key to `dread`, which
  has no picture at all today. Drawing only: `bands()` must not move or the log
  reflows every beat, the water grain needs headroom generated above the resting
  surface, and a standing rise needs a cap or it eats the dry reading band.

## For the game:

- REWRITE.md

## Open questions

- **Which projection.** `projections.html` compares six. The one in `visuals.ts`
  is a straight-up view squashed 3.6× vertically; a pitched camera is the
  smallest change from it and fisheye the largest. `Bands` assumes throughout
  that the waterline is a shallow arc.

## Parked

- **Sky occludes the walls.** The sky group draws over the wall joints converging
  into the rim, and is opaque where it overlaps them.

## Not yet

3D, audio, art, save/load UI. None of it tells us whether the core loop works, and
all of it gets cheaper if the model is settled first. `step()` is pure client is thin,
so a first-person client is additive when the time comes.
