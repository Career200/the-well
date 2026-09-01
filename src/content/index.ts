import type { ContentPack } from '../core/content.js';
import { objects } from './objects.js';
import { people } from './people.js';
import { scenes } from './scenes.js';
import { belowProse, belowSubjects } from './below.js';

export const pack: ContentPack = {
  people,
  objects,
  scenes,
  well: { attention: 0.1, dread: 0 },
  below: belowSubjects,
  belowProse,
  ambient: [
    'Nothing. The stone sweats. Above, the light moves a hand-width and stops.',
    'A beetle comes down the wall, considers you, and goes back up.',
    'The water shifts once, on its own, and is still.',
    'Far off, a dog, and then somebody shouting at the dog, and then neither.',
    'Rain, somewhere. It arrives here later and colder than it does up there.',
  ],
};
