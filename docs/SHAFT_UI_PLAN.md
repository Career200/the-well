# Shaft UI — things to remember

Not a record of what was built. Only the rules the picture has to keep obeying,
the traps that cost time once already, and what is still open.

## The composition

Underwater, from the bottom, and **the well is half full**. Three ellipses on
one cone — the rim with the coin of sky in it, the waterline across the middle
seen from underneath, the floor of silt near enough to touch. The walls run the
whole way: dry stone above the waterline, drowned below it.

Half-full is load-bearing, not a look. It is the only arrangement where all
four of these hold at once:

- the walls have the top of the picture with nothing drawn over them, so the
  lucidity detail is visible;
- the coin sits at the end of a receding shaft instead of being a cutout on a
  black field;
- **the words sit on dry stone and never cross water** — light text over a
  bright halftone cannot be read;
- the water's light enters at the waterline and dies going down, which is what
  earns the silt the right to be as dark as it is.

Break any one of those and it is worth asking whether the whole arrangement
still pays.

**The waterline is solved for, not fixed.** It is always a cross-section of the
cone so the walls cross it at the right width, but the depth is computed: the
far edge of a cross-section moves linearly with depth, so the depth that leaves
`WATER_BAND` of water above the floor reads straight off. A fixed cone fraction
compounds on phones — the narrow-screen floor raise drags the waterline up and
the words pay for it twice.

**The opening and the coin are one ellipse.** The walls converge to the hole
they actually converge to, and what keeps the sky the size of a coin is
`sky-glow` dying well before the edge — the eye measures the lit core, not the
geometry. Two shapes, an opening three times the sky coming through it, is a
thing no well does, and it is what read as a cutout laid on the picture.

**The column stays narrow on every screen.** Claustrophobia is the point, so
there is no wide-screen layout to escape into. Anything that would solve a
problem by using the gutters — running wall detail or a signal out beside the
text — is not available; solve it inside the column or not at all.

**The floor has no drawn edge.** Its fill fades to transparent at the top and
the coarse grain scatters upward into the water, so the two meet in a band. A
clean elliptical rim is what made the silt read as a shape laid over the
picture rather than as ground.

## Channels

| quality          | driven by      | where                                |
| ---------------- | -------------- | ------------------------------------ |
| water motion     | a push         | halftone dots                        |
| surface shape    | a push         | the waterline, clean to broken       |
| overlay          | a push         | corners (`.agitation`)               |
| legibility       | lucidity       | wall detail, dot fineness, blur      |
| coming into view | lines said     | opacity and brightness on the root   |

The waterline is the strongest of the three water channels: it sits directly
under the last line of text, so it is read without looking for it.

**The water is an event log, not a gauge.** It always returns to glass, so at
rest it says nothing about charge. Charge is legible only in how the last push
looked. If the player ever needs to read their charge while the water is still,
it needs a different channel — not a resting level in this one.

Lucidity moves in steps (`lucidityPerDiscovery`), and everything drawn from it
is indexed by `stepOf`. A discovery has to be one visible event, which is what
makes a full `layout()` rebuild affordable.

## The cycle

A push starts it and the water runs it alone: struck, moving, settled, glass.
Nothing in it waits for the player, and it always ends in the same place.

- Charge shapes the cycle, never its resting point: a composed push is over in
  about a second, a spent one runs nearly three.
- The clock exists only during a cycle. It starts on a push and stops itself
  once the water is glass. At rest the shaft costs nothing.
- An exponential never reaches zero, so the floor (`REST`) is what actually
  ends the cycle. Without it the interval never stops.
- `prefers-reduced-motion` is deliberately **not** honoured by the shaft. The
  dots swell by about a pixel, the waterline wobbles by a few, and the signals
  loop over seven to twenty-six seconds — no travel across the screen, no
  parallax, no sudden onset. Honouring it left the picture a still image, which
  reads as broken rather than as considerate. The buttons still honour it: the
  endless `.calling` pulse is a different kind of motion.
- Only a hidden tab stops the clock.

**The trap:** do not compute agitation from `charge` at draw time. That makes
it a constant between turns — the water churns at a fixed amplitude and snaps
to a new one each beat, and nothing is ever seen settling. The shaft has to
hold its own agitation.

**The other trap:** leave headroom. `(1 - charge) * 1.3` saturates at the
clamp, so a push at low charge lands on an already-maxed surface and cannot be
seen at all.

## Draw discipline

State in, one writer out. There is no other path to the DOM.

- One `draw()`. It is the only function that touches the DOM.
- `update(state)` stores state and draws once, so a beat answers immediately.
  The clock draws through the same function.
- `layout()` rebuilds on resize and on a step of lucidity. `draw()` always
  reads the current arrays.
- Skip writes for dots whose size and offset did not change. Most of the field
  is static for most of a cycle.

## Places

Four bands down the picture — sky, walls, water, silt — as transparent
full-width buttons. The cold has no region; see below.

- Availability is `subject.<id>.open`. The engine owns it; the picture reads it.
- A place is closed only against what it has already **said**: `SEEN(id, tier)`,
  not spent. When lucidity moves, everything that has not answered at the new
  tier is a candidate again, so the same wall says something else later.
- Asking costs a turn. A place with nothing to say answers `NOTHING_NEW`.
- Not askable during a scene or in beat zero. Missing one happens because a
  scene held you, never because a timer ran out.
- A place that has not resolved is `hidden` — no target, and no name in the
  accessibility tree either.
- `#log` is `pointer-events: none` so taps fall through to the bands. `.ended`
  takes them back, because a long coda has to scroll.

## Signals

A place signals by moving. Slow, looped, no text, and never expiring. Several
may be lit at once.

**One weak channel is not a signal.** The root `brightness()` filter eats a
colour shift on its own, and near-black going slightly less near-black is
invisible. Anything that signals needs either real movement or two channels at
once — the water gathers a glow *and* warms its grain; the silt warms *and*
brightens.

Signals do not need a reduced-motion hold — see the cycle notes above.

## Open

- **Reading room on the smallest screens.** Words stop at the waterline,
  strictly: ~9 lines on a 1440×900, ~7 on a 390×780, but only ~4 on a 320×568.
  The lever is letting the log overlap the top of the water — which is exactly
  where the water is brightest, so the falloff would want inverting first.
- **The cold has no place.** Excluded from `queueSubject` (`ASKABLE`) so a step
  of lucidity is never spent on something unreachable. It may work better as
  something intrusive that arrives on its own rather than a region you can ask.
- **Beat zero wants its own arrival.** Each shape should come up slowly on the
  clock, timed with the line that names it, rather than snapping on when
  `phase.revealed` grows. The water arriving is a different event now that it
  has a surface to arrive at.
- **`pressing` and the stance.** Every click is a player action and the stance
  terminology is deprecated, but `tick()` still spends `pressCost` on every
  turn the stance reads `pressing`, and it only clears on `still`, `attune` or
  burnout. So asking a place right after a push silently spends another one.
- **`content.noticing`** may not earn its place now that a signalling place
  says the same thing without words.
- **The walls signal** has the dry half of the shaft to itself, but has not
  been watched over a long run.

## Artstyle

The bottom of a well from the pov of a ghost that only just gathers itself and
cannot leave, or can barely move at all. Depressing, claustrophobic,
unfriendly, and the coin of light above is the only thing that gives any hope,
and it's unreachable.

- **sky** — comes closer and goes back up. Perspective, not brightness.
- **walls** — a light wanders over the stone, slow enough that you are not sure
  it moved until you see it move again.
- **water** — already moves, so it changes colour instead. A glow gathering
  under the surface rather than on it.
- **silt** — the darkest thing, and the last to be understood as a thing at
  all. Slow colour, continuous with the halftone.

Lucidity is the whole room coming into focus a notch at a time. Early, the room
is inferred from shapes. Late, the places you guessed at you can see as they
are — stonework, silt texture, and clouds moving far away in the sky.
