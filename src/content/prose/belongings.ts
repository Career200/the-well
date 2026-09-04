/**
 * Taking a belonging up and letting it go, first hold to last. Three holds is
 * the whole of one, so the arc is in the wording: the warmth arrives smaller
 * each time and the third entry says it is over. Each cools in its own material.
 *
 * Everything else a belonging says is in `prose/below.ts` under the same id.
 */
export const belongingProse = {
  ring: {
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
  },
  whistle: {
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
  },
  knife: {
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
  },
  coat: {
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
  },
} as const;

/** How the presence refers to a belonging once it knows what it is looking at. */
export const belongingNames = {
  ring: 'brass ring',
  whistle: 'tin whistle',
  knife: 'short knife',
  coat: 'coat',
} as const satisfies Record<keyof typeof belongingProse, string>;
