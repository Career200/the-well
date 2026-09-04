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
| fov, vertical    | 132°     | pose                          |

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

One dial, every table indexed by `stepOf` in `grain.ts`. Blur (`HAZE`) and detail
(`DOT_SPACING`, `WALLS`, `COURSES`) carry over. Under a curvilinear lens they are
joined by **subdivision** — `RING_STEPS` and `JOINT_STEPS`, which decide whether
the bowing draws faceted or smooth — and by `SILT_RINGS` for the floor scatter.

Subdivision is also the cost dial, so the expensive frame is the late-run one and
the opening is cheap.

---

## The renderer

**SVG, hand-rolled projection.** Ellipses and lines become `<path>` polylines.
Halftone dots stay `<rect>`; their centres are projected and sub-dot distortion
is ignored.

Carried over unchanged: the selective dot update, the `place-shape` groups, the
CSS state classes (`resolved`, `signalling`, `withdrawing`, `pressing`,
`receding`), the `data-subject-id` hue map, the `.agitation` corners outside the
SVG, and the per-place `<button>` overlay.

The floor grain is a polar scatter on the plane at `y = 0`, culled to the frame,
sized from how many px the lens puts on one cell at that distance. Whether the
water's grain is world-space too, or a fixed screen-space print, is decided in
step E.

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

## Standing

`web/projection.ts` holds the lens and the well as geometry, with no DOM and its
own tests. `web/shaft-fisheye.ts` draws rim, waterline, silt edge, joints cut at
the surface, courses, and the floor grain, at one held pose. `web/chrome.ts`
holds what both pictures share — corners, tap targets, reveal, `veil` —
`web/sky.ts` the light through the opening, and `web/clock.ts` the agitation.
The motion selector in `shaft-debug.ts` swaps the two views; the camera is what
it opens on.

The opening is a filled region: one projected rim polyline serves as the lip,
the coin and the clip, with `sky-glow` placed in px off its own box and the
signal disc orbiting inside it. Every ring below the rim projects outside that
outline, so the sky draws last and covers nothing. Occlusion takes the coin's
opacity and the picture's brightness. The rim's box is 1.18:1 at every viewport
and the pitch crops about 1% of height off its top edge.

Provisional: `bands` is the screen extremes of the three rings, enough to stack
the tap targets and nothing more. The halo pooling under the lip is not drawn —
it is light on the upper wall and may want to be real rather than a screen-space
ellipse.

---

## Order

**B. Pitch, on scene start.** The camera becomes state the renderer holds rather
than a constant it reads. Two things follow. `layout` splits into reprojecting
the elements that exist and rebuilding the set, because an eased move cannot
recreate every path and speck per frame. And `bands` starts moving per pose,
which is where the tap regions and the reading band have to line up for real.

**C. Field of view, with early cancel.** The same dial machinery as B, so the
new work is an interruptible ease: a current pose, a target, and retargeting
mid-move when the coat cuts a scene short. Pose timing hangs off the delay array
`narrate()` returns, the way `hold` already times the figure. Narrowing the
field straightens the bowing, so a push-in relaxes the well as well as closing
on it.

**D. The figure and its states.** `occupied`, `leaving`, `recoil`, and
`resonating` with `reach`. Every anchor the flat picture takes from the rim's
centre and radii is a projected point here — the body scaling about the rim's
near edge, the head about its own chin. `withdraw` stops being a no-op.

**E. Water, and the push.** The grain in both modes, screen-space and
world-space, switchable and then decided. Waves displace the ring's world `y`
before projecting rather than bending a screen-space path. Then the level: the
rise on a push, the modifier growing with turns, the cap, and the crossing past
the eye. `Well` stops being a module constant and becomes a per-frame value.

**Unplaced.** The reading-band probe, which is independent of all of the above
and is still the one result that can invalidate the projection. Deriving `bands`
properly. Parity against the flat picture on everything the motion selector
switches between.
