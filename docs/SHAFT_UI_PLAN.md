# The picture

The rules the shaft obeys. Demo-side: this describes a renderer for `src/`, not
the full game's client.

Built **parallel** to the one in `web/visuals.ts`, behind a flag, with
`shaft.html` as its harness. Nothing in the shipping path changes until it holds
parity.

The flag is permanent, not scaffolding. Motion off keeps the flat diagram view;
motion on gives the camera. Both are supported views, and the setting that picks
between them is §Motion.

---

## The projection

**Equidistant fisheye.** `r = f · θ`, where `θ` is the angle off the camera's
forward axis and `f = H / 2 / halfFov`. Panel 6 of `projections.html` is the
reference implementation.

Every straight edge in the world bows on screen, so all geometry is emitted as
subdivided polylines. `projections.html` carries the working subdivision counts:
48 points per wall joint, 128 per ring, 16 per silt spoke.

The camera stands above the silt with its back to the wall, looking up. Position
is fixed within a run. Two degrees of freedom move as poses: **pitch** and
**field of view**. Roll and yaw exist in the model and are unused.

The well's dimensions stop being a solve against the viewport. Reference values,
from the fisheye panel of `projections.html`:

| dial             | value    | kind                          |
| ---------------- | -------- | ----------------------------- |
| diameter         | 3.6      | fixed                         |
| height           | 9.5      | fixed                         |
| water, of height | 11%      | **state-driven** — see below  |
| eye, above silt  | 1.5      | authored; a framing dial      |
| back to wall     | 0.5–1    | authored; a framing dial      |
| pitch            | 27°      | pose                          |
| fov, vertical    | 145°     | pose                          |

Eye height reads cleanly as a compositional dial and is expected to move during
development. At these values the resting surface sits at 1.05 and the eye at 1.5,
so **~0.45 of rise — about 5% of height — puts the water at eye level.** That
figure is the rise budget.

**Narrowing the field of view straightens the bowing.** Scale and distortion move
on one dial, so a push-in relaxes the well and a pull-out closes it in. This is
the picture `dread` keys to.

### The waterline is a level

The only well dimension that moves in play. A push raises it, riding the
`agitation` kick it already sets; the rise modifier grows with turns elapsed, so
late-run pushes displace more than early ones.

Past the rise budget the surface crosses the eye and the camera is under water.
That state draws over the reading band for its duration, and is the one sanctioned
exception to whatever §Open settles.

Consequences: `bands` is state-dependent as well as pose-dependent, the water
grain needs headroom generated above the resting surface, and a standing rise
needs a cap or it takes the reading band permanently rather than temporarily.

### Lucidity

One dial, two effects, both already in `visuals.ts` as arrays indexed by
`stepOf`. Blur (`HAZE`) carries over unchanged. Detail (`DOT_SPACING`, `WALLS`,
`COURSES`) gains a fourth axis under fisheye: **subdivision count.** Low lucidity
draws the bowing faceted; high lucidity draws it smooth.

Subdivision is also the cost dial, so the expensive frame is the late-run one and
the opening is cheap.

---

## The renderer

**SVG, hand-rolled projection.** Ellipses and lines become `<path>` polylines.
Halftone dots stay `<rect>`; their centres are projected and sub-dot distortion
is ignored.

Carried over unchanged: the halftone dot field and its selective update, the
`place-shape` groups, the CSS state classes (`resolved`, `signalling`,
`withdrawing`, `pressing`, `receding`), the `data-subject-id` hue map, the
`.agitation` corners outside the SVG, and the per-place `<button>` overlay.

One forward projection serves three consumers: the drawn geometry, the tap
regions, and the layout numbers. Tap regions and bands are derived by projecting
the three key rings — rim, waterline, silt edge — for the current pose and taking
their screen extremes. **Both become pose-dependent.**

---

## The camera

Authored. No player input drives it, and it introduces no `PlayerAction`.

Poses are a function of `ShaftState` plus scene progress, which `main.ts` already
computes in `beatsLeft`. The vocabulary stays small enough that no per-scene
direction is authored:

| pose        | driven by                    | move                                    |
| ----------- | ---------------------------- | --------------------------------------- |
| **rest**    | idle                         | base pitch and fov                      |
| **attend**  | `occupied`                   | small pitch up at scene start           |
| **close**   | beats elapsed in a scene     | fov narrows toward the coin, then back  |
| **inspect** | a place answered             | pitch and fov centre it, then return    |
| **flinch**  | a refused push               | camera holds; the waterline trembles    |
| **recede**  | run over                     | pull back; runs with `receding`         |

Rules the pose set holds to:

- **All four places stay legible in every pose.** A `signalling` place pushed off
  frame or into heavy peripheral compression signals nothing.
- **`inspect` is keyed to the answer, not the ask.** The move plays when the
  engine returned lines for that place, following the rule `resolve()` already
  uses — timed to the narration, not to the state.
- **A push-in caps before the waterline leaves frame,** or the `.agitation`
  corners carry charge for the duration. The corners read at any `visibility`.
- **Motion is beat-driven.** Poses ease between held positions on a beat; nothing
  free-runs.
- **`flinch` moves no camera.** A couple of percent of tremble on the surface, no
  rise. It runs with `flash()` on the corners and keeps the readout where the
  readout lives.

Timing hangs off the delay array `narrate()` returns, the same mechanism
`hold(rim, lines, delays)` uses for the figure. `STAGGER` sets the pacing both
read.

---

## What holds

- `core/` and `content/` are untouched. The renderer is a view.
- Determinism is unaffected: the camera takes no input and writes no state, and
  the action log is unchanged.
- Click-is-a-beat is unchanged. Every control still calls `step()` exactly once,
  and the picture still has its own clock the world does not.
- `ShaftState` survives as the contract. Every field is a scalar about the world,
  not a drawing instruction. `resolve`, `flash`, `withdraw` and `bands` keep
  their signatures; `bands` changes what it is computed from, and answers per
  pose and per water level rather than per layout.
- Both views satisfy the same `Shaft` interface, so `main.ts` does not know which
  one it is holding.
- Belongings stay pinned cells in the footer. `push` and `be still` stay footer
  buttons.
- Depth ordering falls out of the projection, so the sky group no longer draws
  over the wall joints.

## Costs to hold to

- During a camera move every dot moves, so the selective-update short circuit
  does not fire; the field is ~1–1.5k rects on a phone. The picture's clock runs
  at `TICK_MS` 190 (~5fps) and reads as stepped by design; camera moves want
  10–15fps. The gap between "stepped" and "janky" is the thing to tune.
- Full lucidity is the expensive frame, since subdivision is both the detail dial
  and the cost dial.

---

## Motion

A settings panel, session-local, with one control that picks the view:

| motion | view                                      |
| ------ | ----------------------------------------- |
| off    | the flat diagram; no camera, no poses     |
| on     | the fisheye camera and the pose set       |

`prefers-reduced-motion` sets the initial value and the control overrides it for
the session. The reasoning in `visuals.ts` for not reading the flag — nothing
travels more than a few px — stops applying once a camera and a wide lens exist
together.

The same control is where a performance downgrade is offered. Device probing is
unreliable; measure the real cost of the first few beats and offer the switch
when frames run long.

---

## Open

**Where the prose lives once the picture moves.** Under fisheye the waterline
bows hard and its lowest point is centre-frame, so the dry band between rim and
waterline pinches exactly where a paragraph wants to be. `fitLog` currently wedges
the log between `skyBottom` and `waterTop`.

The probe is independent of the projection and can run first: fix the log to a
strip and move the current picture under it. If reading survives a moving
picture, the fisheye camera is viable. If it does not, no projection changes the
answer.

A rise past the eye is exempt either way — that state draws over the band on
purpose, for as long as it lasts.

---

## Order

**0. The motion setting.** The panel and the flag, against the current renderer,
before any of the geometry. It is what makes the two views a permanent pair
rather than a migration, and everything below lands behind it.

**1. The projection in the harness.** Port panel 6 into a module and drive
`shaft.html` from it with a static camera and no animation. This is where the
subdivision counts get their real cost measured, where lucidity picks up its
fourth axis, and where the well's dimensions get set against a phone-shaped
frame.

**2. Bands and hit regions from the forward projection.** Derive the four tap
regions and the layout numbers by projecting the three key rings per pose. Proves
the tap model survives a moving camera without any change to the interaction
model.

**3. The reading-band probe.** Fix the log to a strip and drift the current
picture under it. Independent of everything above and the one result that can
change the projection decision, so it does not wait for its turn.

**4. The waterline as a level.** The rise on a push, the modifier growing with
turns, the cap, and the grain headroom above the resting surface. Ends with the
crossing: water over the eye, drawn over the band, and back down.

**5. The pose set.** Extend `projections.html` with a pose list, easing and a
scrub. Six poses off `ShaftState` and `beatsLeft`, tuned there rather than in the
game. Proves the vocabulary is small enough that scenes need no direction.

**6. Timing against narration.** Hang poses off the `narrate()` delays and pace
them against `STAGGER`. Proves the camera and the prose do not compete for the
same seconds.

**7. Parity.** Match the current renderer on `resolve`, `signalling`, the figure
and its two levers, `withdraw`, `flash` and `receding`. The motion setting picks
between them from there on.
