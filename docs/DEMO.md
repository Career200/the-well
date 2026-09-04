# The demo, as built

There are two games in this repository.

**The demo** is `src/`. It runs, it is playable — engine in `src/core/`, content
in `src/content/`, browser client in `src/web/` — and every claim in this document
is checked against the code.

**The full game** is `docs/story/` and `docs/STORY_MACHINE.md`. It is written
down but not built. Storylets, roads, twelve actors, the dog, deterioration —
none of it exists in code.

Read this file before proposing changes to the demo. Its purpose is to fix the
vocabulary so that a conversation about the demo cannot silently become a
conversation about the full game, which is the failure mode this document was
written to stop.

---

## The line

| These describe **the demo**                       | These describe **the full game**                           |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `README.md`                                       | `docs/PITCH.md`                                            |
| this file                                         | `docs/STORY_MACHINE.md`, `docs/SCHEMA.md`, `docs/DIALS.md` |
| `docs/SHAFT_UI_PLAN.md` (rules the picture obeys) | everything in `docs/story/`                                |

**Nothing in `docs/story/` is a specification for the demo.** It is the target the
demo is evidence for. When a story doc and the code disagree, the code is what the
demo is; the doc is what the demo is not yet.

---

## Vocabulary

Terms in **bold** are the ones to use. Terms marked *not:* are the ones that cause
the misunderstandings.

### Playing

**beat** — one call to `step()`. The unit of play.

**click-is-a-beat** — the rule the whole UI runs on. Every control in the client
calls `act()`, which calls `step()` exactly once. There is no timer, no tick, no
real-time anything: the world only moves when the player touches it, and it always
moves exactly one beat when they do.
*Not:* a turn you spend, a queue, a hold. The player has no way to pass time
without choosing an action.

**turn** — `state.turn`, the integer counter. Use "beat" for play and "turn" for
the number; they advance together but they are not the same word.

**one-click-one-effect** — the rule the engine and the UI both run on. An action
is paid for, and does everything it does, on the beat it is clicked. Nothing
persists into the next beat: there is no mode the presence is left in, and no
action goes on costing after the click that bought it.
*Not:* a stance, a hold, a sustained press. `WorldState` has no field for one.

**verb** — one of the four things the player can do. Named by the button, not by
the `PlayerAction` kind:

| verb         | control                                                   | `PlayerAction` | what it does                                           |
| ------------ | --------------------------------------------------------- | -------------- | ------------------------------------------------------ |
| **push**     | `push` button, footer                                     | `haunt`        | spends charge, adds pressure inside a scene            |
| **be still** | `be still` button, footer                                 | `still`        | the only thing that recovers charge                    |
| **look**     | a place in the picture, or an undiscovered belonging cell | `look`         | reads a subject; a belonging's first look discovers it |
| **use**      | a discovered belonging cell, footer                       | `attune`       | resonance; spends one of that belonging's three uses   |

`wait` also exists in `PlayerAction` and **has no control in the client.** Only the
sim policies emit it.

### The world

**the presence** — the player. Dead, at the bottom, cannot leave.
*Not:* the ghost, the player character, you-the-player.

**the living** — anyone above. **the village** — them collectively, as an opinion.

**charge** — `presence.charge`. Renewable. Recovered only by **be still**, spent
only by **push** — one **push** click, one `pressCost`. Two pushes to a full bar.
*Not:* mana, energy. In the fiction it is how much of you there is.

**lucidity** — how much the presence understands about itself. Rises `0.2` per
belonging discovered; the coat's hiding outcome takes the same back. Drives which
**tier** a subject answers at, and nothing else.

*The coat's hiding outcome:* the coat is the only belonging whose use reaches
outside a scene. Used on a beat where somebody was about to arrive, there is no
scene at all — whoever came is missed, the presence loses that `0.2`, and the
scene is not spent. It hides **that beat only**.

Used *during* a scene it resolves that scene where it stands: the outcome is
picked, its effects and the resonance land, and the history is written, so the
scene is spent and cannot be drawn again. Only the outcome's own line is
withheld — the coat hides how it unfolded, not that it did. On `the-throwing`
this ends the run. Scenes marked `unhidable`, which only `the-hearing` is, play
their remaining beats out instead, and the coat is a resonance like any other.

**attention** and **dread** — the well's two dials. What the living think about it,
and how wrong it has become.

**belief** — one of four (`haunted`, `mystery`, `tragedy`, `danger`). What the
village decides the well *is*. Gates the coda.

**emotion** — one of six (`grief`, `fear`, `guilt`, `curiosity`, `anger`,
`tenderness`), per person. `BELIEF_OF_EMOTION` in `core/types.ts` is the bridge:
private feeling becomes public story.

**the two levers** — **haunting** (push during a scene → fear → `haunted`/`danger`)
and **resonance** (use a belonging *during* a scene → that object's emotion →
`tragedy`/`mystery`). These are the demo's whole strategy space.

Both levers only reach the living from inside a scene. A belonging used at an
empty rim is spent for nothing: nothing carries from an idle beat into a scene
that starts later, and a scene always opens on an empty context. The one
exception is the coat — see **lucidity**.

### The nine subjects

**the nine** — everything `look` can address. Five **ambients** and four
**belongings**. Defined as data in `content/below.ts`.

**ambient** — one of `water`, `cold`, `walls`, `sky`, `silt`. A *subject*: it has
prose at three tiers.

**place** — one of `sky`, `walls`, `water`, `silt`. A *tap region* in the picture
(`PLACES` in `web/visuals.ts`), drawn as a full-width band over the shaft.

The two lists are deliberately different. **The cold is an ambient with no place**:
it has nothing to draw and nowhere to tap, so it is excluded from `ASKABLE` in the
engine. Say "ambient" for the subject and "place" for the thing you touch, or the
cold makes every sentence ambiguous.

**belonging** — one of `ring`, `whistle`, `knife`, `coat`. Finite: three uses
each, never recharged. A use is one beat — taken up, spent, and set down again,
which is why the `hold` and `release` prose in `content/objects.ts` are read as
a pair on the same beat.
*Not:* an item, an inventory, or a pickup. A belonging is a thing you spend.

**tier** — `veiled` / `plain` / `named`. Which register a subject answers in, from
lucidity. Belongings run one tier ahead of ambients.

**found / discovered** — two different flags. **found**: the silt gave it up, the
cell lights, you may look. **discovered**: you have looked, it has a name, you may
use it.

### Structure

**beat zero** (a.k.a. **below**, `mode.kind === 'below'`) — the opening phase in
the dark before the first light crosses. Its own runner in `core/below.ts`. Marked
disposable: it goes away when the full game's storylet deck exists.

**scene** — an authored situation with beats and outcomes (`content/scenes.ts`).
The full game calls these **storylets**; the demo does not have storylets, it has
six hand-written scenes.

**the stop** — `runStatus()`. Three states: `open`, `stalled` (nothing can fire
from here), `quiet` (nothing can fire from any reachable future). Not an ending.

**door** — how a run ends: `terminal` (a scene marked terminal played) or
`starved` (nothing came). Feeds the coda.

**the coda** — the ending. Twelve spines in `content/coda.ts`, first match wins.
`forgotten` is the one that erodes as it is read.

**register** — `LineKind`: `scene`, `fact`, `idle`, `coda`. The engine decides;
the client only dresses it. `idle` carries the texture of an empty turn, the
village said back, and the stop.

### The picture

**the shaft** — the SVG, `web/visuals.ts`. Drawn from the silt looking up.

**band** — where the picture leaves room for words: `skyBottom`, `waterTop`,
`siltTop`. The log fits itself between them so text never crosses the water.

**resolve** — a place coming out of the dark, once, on the beat its own line is
read. Driven by narration timing, not by state.

**signalling** — a place with something to say, animating until it is asked.

---

## What the demo actually contains

|                    | count                                                       | where                                |
| ------------------ | ----------------------------------------------------------- | ------------------------------------ |
| scenes             | 6 (1 terminal: `the-throwing`)                              | `content/scenes.ts`                  |
| people             | 5 (4 present at start; the stranger enters on the throwing) | `content/people.ts`                  |
| belongings         | 4                                                           | `content/objects.ts`                 |
| ambients / places  | 5 / 4                                                       | `content/below.ts`, `web/visuals.ts` |
| beliefs / emotions | 4 / 6                                                       | `core/types.ts`                      |
| coda spines        | 12                                                          | `content/coda.ts`                    |
| doors              | 2                                                           | `core/coda.ts`                       |
| controls on screen | 2 verb buttons + 4 belonging cells + 4 places               | `index.html`, `web/visuals.ts`       |

A run is beat zero (up to 16 beats) plus an idle/scene loop that ends on a terminal
scene or on starvation.

---

## What-is vs what-will-be

| system         | the demo                           | the full game (docs)                                |
| -------------- | ---------------------------------- | --------------------------------------------------- |
| situations     | 6 authored scenes, weighted random | a storylet deck with roads, requires/prefer casting |
| cast           | 5 people, `present` boolean        | 12 actors plus the dog, arrivals and exits          |
| the presence   | 4 verbs, 2 levers                  | same levers, plus deterioration and the stranger    |
| self-knowledge | lucidity, drives tier prose only   | the first act; gates resonance entirely             |
| ambients       | 5 subjects, 3 tiers, `look`        | ordinary situations in the deck                     |
| ending         | 12 coda spines                     | verdict + roads resolving                           |
| escalation     | `dread` colours outcome selection  | `HORRORS.md`, three roads                           |
| stranger       | flag set, nothing happens          | a scene cluster                                     |
| renderer       | scrolling text over an SVG shaft   | first-person 3D, eventually                         |

The demo exists to answer one question — *does "you cannot leave, but you can change
what the living believe happened here" hold up as a system?* — and nothing else.
Changes that do not move that question are out of scope for it.

---

## Constraints on any change to the demo

**The engine invariants** (asserted by `pnpm test`, so breaking them fails the build):

- `step()` is pure: `(game, action) → (game, lines)`. Both clients are dumb views.
- Content never mutates state. It returns `Effect[]`.
- Determinism: seed + action log reproduces a run exactly. Only `core/rng.ts` may
  produce randomness.
- Content speaks only the vocabulary in `core/types.ts`.

**Mobile-first.** The demo is played on a phone. The desktop version currently
looks better, and that is the wrong way round.

Already right: `#app` is a 28rem column with `100dvh`, so the layout is
phone-shaped by construction; `#log` is `pointer-events: none`, so taps pass
through the words to the place behind them; `MIN_SILT_BAND` keeps the floor clear
of the controls on a narrow screen.

Not right yet, and any new interaction has to answer for these:

- **Hover is the main affordance for the places.** `#shaft .places .place:hover`
  and the belonging cells' `title` tooltips do not exist on touch. On a phone the
  only way to learn a place is tappable is to tap it — and most taps currently
  return `…`.
- **Tap targets are under size.** The four belonging cells are a 4-column grid at
  `0.78em` with `0.45rem` padding: roughly 80×30px on a 360px screen, against a
  44px minimum.
- **A belonging's warmth is desktop-only.** `feelOf()` goes into `title`; on touch
  only the `data-feel` colour survives.
- **Mobile browser chrome resizes the viewport on scroll**, which fires the
  `ResizeObserver` and rebuilds every dot in the shaft. Untested under that.

---

## Known soft spots

Honest list, so nobody rediscovers these:

- **The places are nearly dead.** A place only answers when `subject.<id>.open` is
  set, which happens on a lucidity change (2–4 times a run after beat zero) and is
  released only on a beat that produced no other line. Four permanent targets,
  about three payoffs behind them; every other tap burns a beat for `…`.
- **The places are disabled during scenes** (`asking: mode.kind === 'idle'`), so
  the picture goes inert exactly when the game is at stake and the footer becomes
  the whole game.
- **The verbs are not in the picture.** Push and be still live in the footer,
  though the shaft renders nothing but their consequences.
- **`extra` is dead content.** All eight strings in `content/below.ts` are authored
  and read by no code.
- **`readout.ts` is barely connected.** `water()` is used only for the shaft's
  aria-label; `remaining()` is used nowhere at all. `#meters` is still built on
  every render and then hidden by CSS, so it is dead markup.
- **The sim never touches the ambients.** No policy in `sim/policies.ts` emits a
  `look` at a place, so the reachability sweep has zero coverage of that surface.
  Anything added there is untested by `pnpm sim`.
