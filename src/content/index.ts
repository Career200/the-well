import type { ContentPack } from '../core/content.js';
import { coda } from './coda.js';
import { objects } from './objects.js';
import { people } from './people.js';
import { belowProse, belowSubjects } from './prose/below.js';
import { ambient, hiding, noticing, readout } from './prose/idle.js';
import { instrument, presence } from './prose/presence.js';
import { scenes } from './scenes.js';

export const pack: ContentPack = {
  people,
  objects,
  scenes,
  presence,
  instrument,
  well: { attention: 0.1, dread: 0 },
  coda,
  below: belowSubjects,
  belowProse,
  ambient,
  readout,
  noticing,
  hiding,
};
