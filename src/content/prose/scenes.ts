/**
 * Scene prose: the beats in order, and one line per outcome id.
 *
 * Keys are matched against `content/scenes.ts` at build time — an outcome
 * declared there must have a line here under the same id.
 */

/** Two outcomes of `the-hearing` land on the same non-answer. */
const NOTHING_CONCLUSIVE =
  'Silt, says the lamp. Silt and old water and a village’s worth of dropped things. They go home slightly ashamed of themselves, which will not last.';

export const sceneProse = {
  'first-water': {
    beats: [
      'A shadow crosses the coin of sky. The rope starts down, and the bucket with it, turning.',
      'The bucket breaks the surface a hand from you. A woman’s face is up there, small as a thumbnail, not looking down so much as looking away.',
      'She hauls. The rope saws in its groove. She is nearly done.',
    ],
    outcomes: {
      'the-word':
        'The rope stops with the last of it still to come. She leans out over the rim, further than anyone leans out over water, and she stays there — both hands flat on the stone, not moving, for a long time. When she goes she leaves the bucket where it is.',
      terrified:
        'The bucket comes apart from her hands. She does not run at first — that is the worst of it — she stands and looks down and lets you look back, and then she runs.',
      unsettled:
        'She stops with the bucket half up. She listens the way you listen for a thing you have decided is not there. Then she takes her water and goes, faster than she came.',
      quiet:
        'She takes her water. At the rim she pauses, one hand flat on the stone, for no reason she could tell you. Then the sky is only sky again.',
    },
  },

  'boys-at-the-rim': {
    beats: [
      'Voices, thin and high, arguing about how deep. A stone comes down and cracks off the wall beside you.',
      'Another. This one goes into the water and the sound of it goes up the shaft like something climbing.',
      'A head leans in over the rim, all haircut and no face, blocking the light.',
    ],
    outcomes: {
      fled: 'You come up the shaft at him. He is off the rim before he has decided to be, and the other one is already running, and by supper there will be a version of this with teeth in it.',
      hooked:
        'He stays. He stays much longer than a boy should stay looking at nothing. When he goes it is slowly, and he looks back twice.',
      bored:
        'They get bored of it, the way the living get bored of anything that will not answer. The light comes back.',
    },
  },

  'the-asking': {
    beats: [
      'Two of them at the rim in the middle of the day. Neither of them has brought a bucket.',
      'The woman is asking about something and keeps starting the same sentence over.',
      'The old man answers before she gets to the end of it, every time.',
    ],
    outcomes: {
      heard:
        'The water knocks against the stone and both of them stop. The old man leans over, looks, and tells her it is frost getting into the wall.',
      settled:
        'He finishes her sentence for her, twice, and then they go back down the track. He does most of the talking on the way.',
    },
  },

  'tomas-alone': {
    beats: [
      'No light at all up there now, and still someone is standing at the rim. He has been standing there a while.',
      'He says a word. Not loudly, and not a prayer. It might be a name. It might be yours.',
      'He leans over. The rope creaks against nothing; there is no wind.',
    ],
    outcomes: {
      confession:
        'Whatever he came to say, he says all of it, and it takes a long time, and nobody hears it but you and the stone. He is different when he walks away. Lighter, and much worse off.',
      terror:
        'He recoils so hard he goes down on the stones. He does not get up straight away. When he does, he is walking backwards, and he keeps walking backwards until the dark takes him.',
      nothing:
        'He waits for something. It does not come. Being forgiven by silence is not the same as being forgiven, and he knows it, and he goes.',
    },
  },

  'the-hearing': {
    beats: [
      'Many feet. More people than have ever stood around this hole at once.',
      'An old man is talking about the well in the third person, the way you talk about a debt.',
      'Somebody has brought a lamp and is lowering it. The light comes down and finds the water, and then it finds what is under the water.',
    ],
    outcomes: {
      'under-the-coat': NOTHING_CONCLUSIVE,
      'seal-it':
        'The lamp goes up fast. The argument that follows is short. Before dark there is a board over the sky, and stones on the board.',
      'a-body':
        'The lamp holds steady a long moment. Then the woman says a name out loud, and the sound the village makes is not fear. It is arithmetic. They are counting backwards to a night they all remember.',
      inconclusive: NOTHING_CONCLUSIVE,
    },
  },

  'the-throwing': {
    beats: [
      'Four sets of feet, and one of them is not walking on purpose.',
      'Boards coming off. Voices low and fast and practical, the voices of men doing a job they have talked themselves into.',
      'The sky opens. Something is held over it that is still arguing.',
    ],
    outcomes: {
      stopped:
        'As the boards come off, you come up the wall with everything you have. They drop something - not the stranger. The lamp light disappears and the stranger stays at the rim. You know that from the sound he makes, a sound you have not heard since you had lungs.',
      'thrown-afraid':
        'He lets go early, badly, the way you drop a thing that has become hot. The water takes it. He does not look down after. The boards go back on in a hurry, and one of them is not straight, and it never will be.',
      'thrown-cold':
        'It is done carefully. That is the part you will keep. The water closes, and above you a board is set down flush, and a man says something to another man about the weather.',
    },
  },
} as const;

/** Scene titles, shown in debug tooling and the sim log. */
export const sceneTitles = {
  'first-water': 'Anna draws water',
  'boys-at-the-rim': 'Stones',
  'the-asking': 'Anselm, at the rim',
  'tomas-alone': 'Tomas, after dark',
  'the-hearing': 'Anselm brings the village',
  'the-throwing': 'The throwing',
} as const satisfies Record<keyof typeof sceneProse, string>;
