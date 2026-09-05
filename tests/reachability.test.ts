import { describe, expect, it } from 'vitest';
import { pack } from '../src/content/index.js';
import { POLICIES, sweep } from '../src/sim/policies.js';

const RUNS = 120;

/** So that writing a branch nobody can reach fails loudly instead of quietly. */
const reports = POLICIES.map((policy) => ({ policy, report: sweep(pack, policy, { runs: RUNS, turns: 60 }) }));
const hits = (key: string): number =>
  reports.reduce((max, { report }) => Math.max(max, report.reached.get(key) ?? 0), 0);
const endings = (spine: string): number =>
  reports.reduce((max, { report }) => Math.max(max, report.spines.get(spine) ?? 0), 0);

/**
 * Hits under the policy that finds a branch most often. Three in 120 runs is
 * 2.5%; the rarest outcome today sits at 7. A branch below the floor is
 * reachable in principle and not in play.
 */
const FLOOR = 3;

describe('reachability', () => {
  const cases = pack.scenes.flatMap((scene) =>
    scene.outcomes.map((outcome) => [`${scene.id}:${outcome.id}`] as const),
  );

  it.each(cases)('%s is reached by some player', (key) => {
    expect(hits(key)).toBeGreaterThanOrEqual(FLOOR);
  });

  it.each((pack.coda?.spines ?? []).map((s) => [s.id] as const))('the %s ending is reached', (id) => {
    expect(endings(id)).toBeGreaterThanOrEqual(FLOOR);
  });

  it('every run ends', () => {
    for (const { report } of reports) {
      const ended = [...report.doors.values()].reduce((sum, n) => sum + n, 0);
      expect(ended).toBe(RUNS);
    }
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
    // A run takes exactly one outcome of a terminal scene, so this counts the
    // runs that got there.
    const reached = reports.map(({ report }) =>
      throwing.outcomes.reduce((sum, o) => sum + (report.reached.get(`the-throwing:${o.id}`) ?? 0), 0),
    );
    expect(Math.max(...reached)).toBeGreaterThan(0);
    expect(Math.max(...reached)).toBeLessThan(RUNS);
  });
});
