import type { BelowSubject } from '../../core/below.js';

/**
 * The nine subjects: five ambient places, four belongings. Each answers at the
 * tier the presence has reached. `named` is authored but unreachable in beat
 * zero.
 */
export const belowSubjects: Record<string, BelowSubject> = {
  cold: {
    id: 'cold',
    name: 'cold',
    veiled: 'A weight that paralyzes you, without a chance to fight.',
    plain:
      'The cold of deep stone and dark, heavy air. It settles in the joints first, then the teeth, then the place behind the eyes where thought used to happen.',
    named:
      'The absolute and still of yours. At some point you were left with nothing but this heavy, hollow freezing. You thought it came from here, but the well was waiting for you to bring it.',
  },
  water: {
    id: 'water',
    name: 'water',
    veiled: 'A heavy shifting against the ears. It gives way and presses back.',
    plain:
      'The water is deep and thick. It rises and lowers with no apparent pattern, and turns slowly with every slight motion.',
    named:
      'The water is yours now. It has taken the shape of your ribs, your lungs, the small of your back against the mud. It is the only thing down here that answers when you press.',
  },
  walls: {
    id: 'walls',
    name: 'walls',
    veiled: 'A flat echo bounces off flat shapes. Closed on every side, they cling to each other and curve upward.',
    plain:
      'Courses of stone laid by hand, each set a little back from the one beneath, going up out of reach. Green moss grows in the lime mortar where the damp is thickest, smelling of old cellars.',
    named:
      'The stone you hit on the way down. Your shoulder left a dark smear on the fourth course up, where the moss was scraped away by your coat. You can trace the curve of it with your mind without moving a finger.',
  },
  sky: {
    id: 'sky',
    name: 'sky',
    veiled: 'A bright silence falling from a round cutaway in darkness. It is impossibly far up.',
    plain: "Sky the size of a coin held at arm's length. It goes white, then yellow along one edge, then out.",
    named:
      'The sky is still up there, indifferent, holding the same three stars every night until the morning washes them out. It is the only thing that changes on its own, still entirely out of reach.',
  },
  silt: {
    id: 'silt',
    name: 'silt',
    veiled: 'Soft and deep beneath everything. It swallows whatever sinks into it.',
    plain:
      'The thick mud at the bottom, built of dead leaves, dropped bucket-slats, and forty years of rain. It tastes of river dirt and old rot.',
    named:
      'The silt holds everything you brought down here. It coats the ankles, yielding to the weight with a quiet patience. It will bury the rest of you with time.',
  },
  ring: {
    id: 'ring',
    glimpse: 'a small brightness in the silt',
    glimpseName: 'bright',
    veiled: 'A hard pinch of metal on a pale shape. The edges are crusted green.',
    plain: 'A brass ring, turning green in the damp. It is stuck on a finger, resting on a clenched fist.',
    named:
      'Your ring. She gave it back to you by the gate, and you kept it in your waistcoat pocket until the air went out. Your last thought was of it.',
  },
  whistle: {
    id: 'whistle',
    glimpse: 'something with a hole in it',
    glimpseName: 'hollow',
    veiled: 'A narrow strip of metal, crushed flat at one end. The other end is choked with mud.',
    plain:
      'A tin whistle, flattened on one side where a boot came down on it. The mouthpiece is clogged with gray silt, its six stops turned sideways to the light.',
    named:
      'The whistle you carried for someone who never got it. The metal is bent completely flat by a heavy tread, silencing the notes before they could be played. It rests in the muck, forever quiet.',
  },
  knife: {
    id: 'knife',
    glimpse: 'a straight line where nothing should be straight',
    glimpseName: 'straight',
    veiled: 'A sharp, heavy line buried deep. The grip is rough and bound tight.',
    plain:
      'A short knife, driven straight down into the mud between two flagstones. The handle is bound with tarred hemp cord, double-knotted at the butt.',
    named:
      "Your knife. You wrapped the hilt yourself on the bench behind the barn, pulling the cord tight with your teeth so it wouldn't slip in the wet. It went into the silt when you hit the water, or right after.",
  },
  coat: {
    id: 'coat',
    glimpse: 'a dark spread against the dark',
    glimpseName: 'dark',
    veiled: 'A light wool thing spread wide, and it moves slowly in the water.',
    plain:
      'A summer wool coat, torn at the left shoulder seam. The cloth is heavy, soaked through, floating an inch off the silt like seaweed.',
    named:
      'Your coat. The tail of it is trapped under your hips, and the tear at the seam gives you no answers. You keep thinking of it as warm, though nothing down here is warm.',
  },
};

/** Beat zero's transition blocks, keyed by the event that releases them. */
export const belowProse = {
  opening: [
    "It's dark and cold.",
    'You get used to darkness. Not to the cold.',
    'You are at the bottom. You have been at the bottom for some time.',
  ],
  toMovementII: ['Something in you goes still on its own, before you choose it to.'],
  toMovementIII: ['The water has stopped answering back. There is room, now, for something else.'],
  exhaustionExtra: ['Whatever is still warm down here is not you.'],
  lightCrossing: ['Something crosses the coin of sky, and the dark stops being only yours.'],
  settling: [
    'Nothing. The dark goes on being the dark.',
    'The water moves against the stone and comes back to you.',
    'Somewhere above the rim, weather. You wait for it to arrive here, and it does not.',
  ],
};
