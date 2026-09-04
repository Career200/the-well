# THE WELL

**Read `docs/DEMO.md` first.** It defines the vocabulary for this codebase and
draws the line between the two games in this repository.

The short version, because these three get assumed wrong every time:

1. **There are two games here.** The demo is `src/` and it runs. The full game is
   `docs/story/` and `docs/STORY_MACHINE.md` and it is not built. Nothing in
   `docs/story/` is a specification for the demo.

2. **Click-is-a-beat.** Every control calls `step()` exactly once. There is no
   timer and no real-time anything. `stance` is an engine-internal mechanism that
   click-is-a-beat sits on top of — it is not a UI concept and the player never
   sees it.

3. **Mobile-first.** The demo is played on a phone. The desktop version currently
   looks better, which is the wrong way round. `docs/DEMO.md` lists what that
   already gets right and what it does not.

Engine invariants, enforced by `pnpm test`: `step()` is pure; content returns
`Effect[]` and never mutates state; seed plus action log reproduces a run exactly,
and only `core/rng.ts` may produce randomness.

**Two registers, kept apart.** `src/content/prose/**` holds player-facing prose and
is the only place it lives. Everything else — engine, UI, tests, code comments,
commit messages, and anything you write back to me — is plain engineering prose:
state what the code does and in what units. Do not record why a thing changed, what
it used to be, or what it is not; that is what git history is for.

```sh
pnpm dev    # the game, localhost:5173 (?seed=1234 to pin a run)
pnpm sim    # headless balance sweep
pnpm test   # unit + reachability
```
