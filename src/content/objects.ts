import type { ObjectDef } from '../core/content.js';

/**
 * The belongings. Each `look` is a piece of the death told sideways: the
 * player is handed evidence, never told.
 *
 * `hold` and `release` run first use to last — three holds is the whole of a
 * belonging, so the arc is in the prose rather than a bar. Each cools in its
 * own material (brass, tin, cord, wool), which is how they are told apart
 * without a number.
 */
export const objects: ObjectDef[] = [
  {
    id: 'ring',
    name: 'brass ring',
    glimpse: 'a small brightness in the silt',
    look: 'A ring, brass, green at the edges. It is on a finger. The finger is on a hand that is in the silt, palm up, and you know the shape of that hand better than you know your own name.',
    hold: [
      'The brass warms before you have properly taken hold of it, the way it used to warm in a pocket.',
      'It comes up warm again, but not as far, and you catch yourself waiting for the rest of it.',
      'There is a warmth in it about the size of a held breath, and you are using all of it at once.',
    ],
    release: [
      'You set it down and it keeps the warmth a while after, the way it would have.',
      'It cools quicker this time. You have started to be able to tell.',
      'It goes cold under your hand and stays that way. Whatever she gave back is spent, and it was only ever the once.',
    ],
    emotion: 'tenderness',
    affinity: { anna: 1, tomas: 0.4 },
    power: 0.3,
  },
  {
    id: 'whistle',
    name: 'tin whistle',
    glimpse: 'something with a hole in it',
    look: 'A child’s tin whistle, flattened on one side where a boot came down. Somebody carried it a long way for someone who never got it.',
    hold: [
      'The tin is thin enough to warm all the way through, and it does, all at once.',
      'It warms unevenly now, along the flattened side and nowhere else.',
      'Only the mouthpiece takes any heat at all, and not for long.',
    ],
    release: [
      'You let it go and it ticks quietly while it cools, the way tin does.',
      'It gives the heat up nearly as fast as it took it.',
      'Cold, and light, and no different now from any other scrap of tin in the silt.',
    ],
    emotion: 'curiosity',
    affinity: { boy: 1, anna: 0.3 },
    power: 0.28,
  },
  {
    id: 'knife',
    name: 'short knife',
    glimpse: 'a straight line where nothing should be straight',
    look: 'A short knife, bedded in the silt to the hilt, as though it went in after you did. The handle is wrapped in cord. You have wrapped cord like that. Your hands knew how.',
    hold: [
      'The cord takes the warmth first. Your hands know the wrapping of it without being asked.',
      'The cord is warm and the blade is not, and the difference is wider than it was.',
      'Only the knot warms now, and only across the part a thumb would sit on.',
    ],
    release: [
      'You let go, and the cord holds the heat a moment longer than it has any business holding it.',
      'It cools from the blade inward, which is the wrong way round, and it does it fast.',
      'It goes cold to the knot and stays cold. Whatever your hands remembered, they have finished remembering it.',
    ],
    emotion: 'guilt',
    affinity: { tomas: 1, anselm: 0.2 },
    power: 0.35,
  },
  {
    id: 'coat',
    name: 'coat',
    glimpse: 'a dark spread against the dark',
    look: 'A coat, or the idea of one, spread and heavy with water. There is a tear at the shoulder that did not come from the fall. You keep expecting it to be cold, and it is not, and that is the wrong thing about it.',
    hold: [
      'The wool takes an age to warm and then holds it, spread out and heavy across a good deal of the dark.',
      'It warms in patches now, and none of them near the tear.',
      'A hand’s width of it comes up warm. The rest stays exactly as cold as the water.',
    ],
    release: [
      'You let it go and it keeps the warmth long after, the way a coat off a back does.',
      'The warmth goes out of it in minutes rather than in hours.',
      'It is cold through, and heavy, and it will not do that again.',
    ],
    emotion: 'grief',
    affinity: { anna: 0.7, anselm: 0.5, tomas: 0.6 },
    power: 0.3,
  },
];
