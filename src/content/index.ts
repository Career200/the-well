import type { ContentPack } from '../core/content.js';
import { objects } from './objects.js';
import { people } from './people.js';
import { scenes } from './scenes.js';
import { belowProse, belowSubjects } from './below.js';
import { coda } from './coda.js';

export const pack: ContentPack = {
  people,
  objects,
  scenes,
  well: { attention: 0.1, dread: 0 },
  coda,
  below: belowSubjects,
  belowProse,
  ambient: [
    'Nothing. The stone sweats. Above, the light moves a hand-width and stops.',
    'A beetle comes down the wall, considers you, and goes back up.',
    'The water shifts once, on its own, and is still.',
    'Far off, a dog, and then somebody shouting at the dog, and then neither.',
    'Rain, somewhere. It arrives here later and colder than it does up there.',
    'Somebody passes on the track without slowing. Two steps, and then the field takes the sound.',
    'The rope moves in its groove above you. It is only the wind.',
    'The light goes yellow along one edge. That is the whole of the afternoon.',
    'Something small falls in and does not come back up, and it was not worth watching.',
  ],

  readout: {
    beliefs: {
      haunted: 'Somebody says a prayer over the water before they draw it.',
      mystery: 'Somebody drops a stone in and counts. They do it three times and get three answers.',
      tragedy: 'There are flowers on the rim. Nobody has moved them.',
      danger: 'A man walks his children the long way round the field.',
    },
    attention: [
      'Three people came up to the rim today. One of them drew water.',
      'There is somebody at the rim most of the day now.',
    ],
    dread: [
      'The bucket comes down faster than it used to and goes up before it is full.',
      'Two came for water. Neither would work the winch, and they went down to the stream instead.',
    ],
  },

  noticing: {
    veiled: 'The dark has one more thing in it than it had.',
    plain: 'Something down here has come clear enough to look at.',
    named: "You put your attention on a something, and it's still there.",
  },

  hiding: [
    'You pull the coat over yourself. Somebody is at the rim above you and you do not look up.',
    'You stay under the coat until the noise above has stopped.',
  ],
};
