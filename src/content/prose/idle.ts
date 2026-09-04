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
    haunted: [
      'Somebody says a prayer over the water before they draw it.',
      'A woman crosses herself and then works the winch anyway.',
      'There is salt along the rim, laid in a line the whole way round.',
      'Somebody reads aloud over the water for a long while and draws nothing.',
    ],
    mystery: [
      'Somebody drops a stone in and counts. They do it three times, and get it different each time.',
      'Two of them argue above about how deep it goes.',
      "A rope comes down past you with a knot at every arm's length, and goes back up.",
      'Somebody lowers a lamp on a string. It stops well short of the water and hangs there for some time.',
    ],
    tragedy: [
      'There are flowers on the rim for a long time. When they die, new ones appear.',
      'A woman sits at the rim through the middle of the day and draws nothing.',
      'Someone came alone, stood silent above the water, and then left.',
      'There is a shadow travelling across the rim every day. A new shape somewhere next to the coin of the sky.',
    ],
    danger: [
      "You hear footsteps approach, then nothing, and then they leave. They didn't dare get closer.",
      "You expected someone to come for the water long ago, but there's only the cold.",
      "There is a plank across the mouth. You can't remember who put it there",
      'Somebody shouts at a child by the rim. The child is taken away.',
    ],
  },
  attention: [
    [
      'Three people came up to the rim today. One of them drew water.',
      'Two came and looked in and drew nothing.',
      'There is talking above, longer than it takes to fill a bucket.',
      'Somebody has been up to the rim twice since morning.',
    ],
    [
      'There is somebody at the rim most of the day now.',
      'The light at the mouth keeps being broken by heads.',
      'They come in twos and threes now, and stand about.',
      'The talking above has not stopped since morning.',
    ],
  ],
  dread: [
    [
      'The bucket comes down faster than it used to and goes up before it is full.',
      'Somebody draws water without looking down.',
      'A child is pulled back from the rim by the arm.',
      'The bucket knocks the wall twice going down. Nobody steadies it.',
    ],
    [
      'Two came for water. Neither would work the winch, and they went down to the stream instead.',
      'Nobody has drawn from here since yesterday.',
      'The bucket has been left down at the water for a day and a night.',
      "The cover goes on, and a stone on top of that. It's dark for some time.",
    ],
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
  'You hide again, but still see glimpses through the hole.'
];
