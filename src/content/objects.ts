import type { ObjectDef } from '../core/content.js';
import { belongingNames, belongingProse } from './prose/belongings.js';

type BelongingId = keyof typeof belongingProse;
type Mechanics = Omit<ObjectDef, 'id' | 'name' | 'hold' | 'release'>;

const belonging = (id: BelongingId, mechanics: Mechanics): ObjectDef => ({
  id,
  name: belongingNames[id],
  hold: [...belongingProse[id].hold],
  release: [...belongingProse[id].release],
  ...mechanics,
});

export const objects: ObjectDef[] = [
  belonging('ring', { emotion: 'tenderness', affinity: { anna: 1, tomas: 0.4 }, power: 0.3 }),
  belonging('whistle', { emotion: 'curiosity', affinity: { boy: 1, anna: 0.3 }, power: 0.28 }),
  belonging('knife', { emotion: 'guilt', affinity: { tomas: 1, anselm: 0.2 }, power: 0.35 }),
  belonging('coat', { emotion: 'grief', affinity: { anna: 0.7, anselm: 0.5, tomas: 0.6 }, power: 0.3 }),
];
