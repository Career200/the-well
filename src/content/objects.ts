import type { ObjectDef } from '../core/content.js';

/**
 * The belongings. Each `look` is a piece of the death, told sideways — the
 * player is never told they are dead, only handed the evidence.
 */
export const objects: ObjectDef[] = [
  {
    id: 'ring',
    name: 'brass ring',
    glimpse: 'a small brightness in the silt',
    look: 'A ring, brass, green at the edges. It is on a finger. The finger is on a hand that is in the silt, palm up, and you know the shape of that hand better than you know your own name.',
    emotion: 'tenderness',
    affinity: { mira: 1, tomas: 0.4 },
    power: 0.3,
  },
  {
    id: 'whistle',
    name: 'tin whistle',
    glimpse: 'something with a hole in it',
    look: 'A child’s tin whistle, flattened on one side where a boot came down. Somebody carried it a long way for someone who never got it.',
    emotion: 'curiosity',
    affinity: { boy: 1, mira: 0.3 },
    power: 0.28,
  },
  {
    id: 'knife',
    name: 'short knife',
    glimpse: 'a straight line where nothing should be straight',
    look: 'A short knife, bedded in the silt to the hilt, as though it went in after you did. The handle is wrapped in cord. You have wrapped cord like that. Your hands knew how.',
    emotion: 'guilt',
    affinity: { tomas: 1, anselm: 0.2 },
    power: 0.35,
  },
  {
    id: 'coat',
    name: 'coat',
    glimpse: 'a dark spread against the dark',
    look: 'A coat, or the idea of one, spread and heavy with water. There is a tear at the shoulder that did not come from the fall. You keep expecting it to be cold, and it is not, and that is the wrong thing about it.',
    emotion: 'grief',
    affinity: { mira: 0.7, anselm: 0.5, tomas: 0.6 },
    power: 0.3,
  },
];
