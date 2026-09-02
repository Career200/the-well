import { describe, expect, it } from 'vitest';
import { pack } from '../src/content/index.js';
import { POLICIES, sweep } from '../src/sim/policies.js';

/** So that writing a branch nobody can reach fails loudly instead of quietly. */
const reports = POLICIES.map((policy) => ({ policy, report: sweep(pack, policy, { runs: 120, turns: 60 }) }));
const hits = (key: string): number =>
  reports.reduce((max, { report }) => Math.max(max, report.reached.get(key) ?? 0), 0);

describe('reachability', () => {
  const cases = pack.scenes.flatMap((scene) =>
    scene.outcomes.map((outcome) => [`${scene.id}:${outcome.id}`] as const),
  );

  it.each(cases)('%s is reachable by some player', (key) => {
    expect(hits(key)).toBeGreaterThan(0);
  });
});

describe('the levers do different things', () => {
  const of = (policy: string) => reports.find((r) => r.policy === policy)!.report.beliefs;

  it('a player who does nothing changes nothing', () => {
    const idle = of('idle');
    for (const value of Object.values(idle)) expect(value).toBeLessThan(0.01);
  });

  it('haunting makes the well feared, resonance makes it mourned', () => {
    expect(of('haunty')['haunted']!).toBeGreaterThan(of('resonant')['haunted']!);
    expect(of('resonant')['tragedy']!).toBeGreaterThan(of('haunty')['tragedy']!);
  });

  it('the canon event is reachable but never guaranteed', () => {
    const throwing = pack.scenes.find((s) => s.id === 'the-throwing')!;
    const total = throwing.outcomes.reduce((sum, o) => sum + hits(`the-throwing:${o.id}`), 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(120 * throwing.outcomes.length);
  });
});
