# THE WELL — narrative state prototype

The story and simulation layer of [the pitch](docs/PITCH.md), with no 3D in it.
The point of this repo right now is to answer one question before any art exists:

**does "you cannot leave, but you can change what the living believe happened here" hold up as a system?**

Everything here is a testbed for that. The renderer is a scrolling column of text
precisely so that nothing pretty can hide a broken model.

## Running it

```sh
pnpm install
pnpm dev      # the game, at localhost:5173 (?seed=1234 to pin a run)
pnpm sim      # headless balance pass across all stand-in policies
pnpm test     # unit + reachability tests
```

## How it is put together

```
src/core/      the simulation. knows nothing about content or presentation
  types.ts       emotions, beliefs, world shape, emotion→belief mapping
  effects.ts     the only way anything is allowed to change the world
  scene.ts       what a scene is; outcome selection
  engine.ts      the step function: action in, narration + new world out
  rng.ts         seeded; nothing else may call Math.random()
src/content/   the game itself, in the vocabulary core defines
src/sim/       stand-in players, for balance passes and reachability tests
src/cli/       headless balance sweeps (sim only — the game itself is the web client)
src/web/       browser client
```

The invariants worth keeping:

- **`step()` is pure.** `(game, action) → (game, lines)`. Both clients are dumb
  views over it, which is what will make a 3D client cheap later.
- **Content never mutates state directly.** It returns `Effect[]`. That is why a
  scene's consequences can be diffed and tested without playing it.
- **Determinism.** Seed + action log reproduces a run exactly. `pnpm test` asserts it.

## The two levers

Both are discovered, never explained:

| | how | what it produces |
|---|---|---|
| **Haunting** | spend presence charge during a scene | fear → `haunted`, `danger` |
| **Resonance** | hold attention on a belonging when someone is up there | that object's emotion → `tragedy`, `mystery` |

Beliefs gate the late game, so the two levers reach different endings. `pnpm sim`
prints how often each outcome is actually reached per playstyle; `tests/reachability.test.ts`
fails the build if a branch becomes impossible.

## Adding a scene

Add it to `src/content/scenes.ts` with beats, `requires`, and outcomes ordered
most-specific first (the last outcome should always be a `when: () => true`
fallback). Then run `pnpm sim` and check the new outcomes are not at 0%.
