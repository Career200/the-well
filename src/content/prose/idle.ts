import type { Readout } from '../../core/content.js';

/** Prose for turns nobody is at the rim, and for the world read back. */

/** The texture of an empty turn. Never the same line twice running. */
export const ambient = [
  'Nothing happens. The stone sweats. Above, the light moves a hand-width and stops.',
  'A beetle comes down the wall, considers you, and goes back up.',
  'The water shifts on its own, once, and is still.',
  'Far off, a dog barks, and then somebody shouting at it.',
  'You hear rain. It never touches you.',
  'Footsteps on the track, rushed ones. In a second, the sound disappears.',
  'The rope moves in its groove above you. It is only the wind.',
  'The light blinks and goes yellow along one edge. That is the whole of this afternoon.',
  'Something small falls in. The only thing today, and not worth watching.',
];

/**
 * The village, heard from the bottom. Said instead of an ambient line when a
 * quality is loud enough. The two well dials get a second, louder band.
 */
export const readout: Readout = {
  beliefs: {
    haunted: 'Somebody says a prayer over the water before they draw it.',
    mystery: 'Somebody drops a stone in and count. They do it three times, and get it different each time.',
    tragedy: 'There are flowers on the rim for a long time. When they die, new ones appear.',
    danger: "You hear footsteps approach, then nothing, and then they leave. They didn't dare get closer.",
  },
  attention: [
    'Three people came up to the rim today. One of them drew water.',
    'There is somebody at the rim most of the day now.',
  ],
  dread: [
    'The bucket comes down faster than it used to and goes up before it is full.',
    'Two came for water. Neither would work the winch, and they went down to the stream instead.',
  ],
};

/** One of the five has become lookable. Keyed by tier; never says which. */
export const noticing = {
  veiled: 'The dark has one more thing in it than it had.',
  plain: 'Something down here has come clear enough to look at.',
  named: "You're seeing clearer now.",
} as const;

/** Pulling the coat over yourself, and missing whoever came. */
export const hiding = [
  'You pull the coat over yourself. Somebody is at the rim above you and you do not look up.',
  'You stay under the coat until the noise above has stopped.',
];
