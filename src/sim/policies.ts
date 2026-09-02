import type { Game, PlayerAction } from '../core/engine.js';
import { newGame, step, TUNING } from '../core/engine.js';
import { makeRng } from '../core/rng.js';
import type { ContentPack } from '../core/content.js';

/**
 * Stand-in players: enough of a hand on the controls to prove a branch is
 * reachable and show what each lever does to a village at scale.
 */
export type Policy = 'idle' | 'haunty' | 'resonant' | 'mixed';
export const POLICIES: Policy[] = ['idle', 'haunty', 'resonant', 'mixed'];

export function choose(game: Game, pack: ContentPack, policy: Policy, roll: number): PlayerAction {
  const discovered = pack.objects.filter((o) => game.state.objects[o.id]?.discovered);
  const undiscovered = pack.objects.filter((o) => {
    const state = game.state.objects[o.id];
    return state?.found && !state.discovered;
  });
  const buried = pack.objects.some((o) => !game.state.objects[o.id]?.found);
  const inScene = game.mode.kind === 'scene';

  // Belongings have to be dug for: the silt gives them up to pressing at
  // nobody. Only policies that intend to use one bother, and only out of spare
  // charge — emptying the bar leaves nothing for whoever arrives.
  const digs = policy === 'resonant' || policy === 'mixed';
  if (!inScene && buried && digs) {
    return game.state.presence.charge >= TUNING.pressCost * 2 ? { kind: 'haunt' } : { kind: 'still' };
  }

  // Stances persist, so a stand-in has to know when to stop. Nobody keeps
  // pushing at an empty rim; holding on is a gamble on who arrives.
  const stance = game.state.presence.stance;
  if (!inScene) {
    if (stance.kind === 'pressing') return { kind: 'still' };
    if (stance.kind === 'holding' && roll < 0.5) return { kind: 'still' };
  }

  // Every policy but `idle` at least looks around; discovery is the tutorial.
  if (policy !== 'idle' && undiscovered.length > 0 && roll < 0.2) {
    return { kind: 'look', object: undiscovered[Math.floor(roll * 5) % undiscovered.length]!.id };
  }

  // Pressing at nobody wastes the bar, and the narration says so.
  const wantsHaunt = !inScene ? 0 : policy === 'haunty' ? 0.6 : policy === 'mixed' ? 0.3 : 0;
  const wantsAttune = policy === 'resonant' ? 0.5 : policy === 'mixed' ? 0.3 : 0;

  if (roll < wantsHaunt) return { kind: 'haunt' };
  if (roll < wantsHaunt + wantsAttune && discovered.length > 0) {
    return { kind: 'attune', object: discovered[Math.floor(roll * 13) % discovered.length]!.id };
  }
  return { kind: 'wait' };
}

export interface RunOptions {
  runs?: number;
  turns?: number;
}

export interface RunReport {
  /** "scene:outcome" → how many runs reached it. */
  reached: Map<string, number>;
  beliefs: Record<string, number>;
  runs: number;
}

export function sweep(pack: ContentPack, policy: Policy, { runs = 200, turns = 60 }: RunOptions = {}): RunReport {
  const reached = new Map<string, number>();
  const beliefs: Record<string, number> = {};

  for (let i = 0; i < runs; i++) {
    const rng = makeRng(i * 7919 + 13);
    let game = newGame(pack, i);
    for (let t = 0; t < turns; t++) game = step(game, choose(game, pack, policy, rng.next())).game;

    for (const entry of game.state.history) {
      const key = `${entry.scene}:${entry.outcome}`;
      reached.set(key, (reached.get(key) ?? 0) + 1);
    }
    for (const [belief, value] of Object.entries(game.state.beliefs)) {
      beliefs[belief] = (beliefs[belief] ?? 0) + value / runs;
    }
  }

  return { reached, beliefs, runs };
}
