/**
 * Headless balance pass: plays N games under a stand-in policy and reports
 * which scenes and outcomes get reached, so unreachable branches show up
 * before prose is written for them.
 *
 *   pnpm sim            # all policies, 200 runs each
 *   pnpm sim 500 haunty # one policy, more runs
 */
import { pack } from '../content/index.js';
import { POLICIES, sweep } from '../sim/policies.js';
import type { Policy } from '../sim/policies.js';
import { BELIEFS } from '../core/types.js';

const runs = Number(process.argv[2] ?? 200);
const only = process.argv[3] as Policy | undefined;
const turns = Number(process.argv[4] ?? 60);

for (const policy of only ? [only] : POLICIES) {
  const report = sweep(pack, policy, { runs, turns });
  console.log(`\n─── ${policy} · ${runs} runs · ${turns} turns ${'─'.repeat(Math.max(0, 30 - policy.length))}\n`);

  for (const scene of pack.scenes) {
    console.log(`  ${scene.id}`);
    for (const outcome of scene.outcomes) {
      const hits = report.reached.get(`${scene.id}:${outcome.id}`) ?? 0;
      const pct = ((hits / runs) * 100).toFixed(0).padStart(3);
      console.log(`    ${pct}%  ${outcome.id}${hits === 0 ? '  ·' : ''}`);
    }
  }

  const throwing = pack.scenes
    .find((s) => s.id === 'the-throwing')
    ?.outcomes.reduce((sum, o) => sum + (report.reached.get(`the-throwing:${o.id}`) ?? 0), 0);
  console.log(`\n  reached the throwing: ${(((throwing ?? 0) / runs) * 100).toFixed(0)}%`);
  console.log(`  mean beliefs: ${BELIEFS.map((b) => `${b} ${(report.beliefs[b] ?? 0).toFixed(2)}`).join('  ')}`);
}
console.log();
