import type { PersonDef } from '../core/content.js';
import { personNames } from './prose/people.js';

type PersonKey = keyof typeof personNames;

const person = (id: PersonKey, def: Omit<PersonDef, 'id' | 'name'>): PersonDef => ({
  id,
  name: personNames[id],
  ...def,
});

/** Starting emotions are what the village carries before the player acts. */
export const people: PersonDef[] = [
  person('anna', { emotions: { grief: 0.15, curiosity: 0.1 } }),
  person('tomas', { emotions: { guilt: 0.35, fear: 0.1 } }),
  person('anselm', { emotions: { fear: 0.05 } }),
  person('boy', { emotions: { curiosity: 0.5 } }),
  person('stranger', { present: false }),
];
