import type { InstrumentProse, PresenceProse } from '../../core/content.js';

/** What the presence's own actions say, and what the world says back to them. */
export const presence: PresenceProse = {
  tooThin: [
    'Nothing happens. You are too thin. You have to be still for a while first.',
    'You try again. The water does not even notice.',
    'Nothing moves. Not the water, and not you.',
  ],
  spent: 'It goes out of you all at once. There is nothing left to push with.',

  pushInScene: 'You push. The water goes wrong for a moment; the sound of it climbs the wall.',
  pushBelow: 'The water answers. It is the only thing down here that does.',
  pushFound: 'You push against nothing at all, and the silt gives something back.',
  pushEmpty: 'You push against nothing at all. The dark takes it without comment.',

  busy: 'Not now. There is somebody up there.',
  noSuchThing: 'There is nothing like that down here.',
  nothingToSee: 'There is nothing to see there yet.',
  notLookedAt: 'You cannot hold on to a thing you have not yet looked at.',
  spentBelonging: 'It is quiet now. Whatever was in it has gone out, and it is not coming back.',

  /** `{thing}` is the belonging's name. Used only if it has no `hold` line. */
  holdFallback: 'You gather yourself around the {thing}. It remembers more than you do.',

  stalled: 'The light goes on moving. Nothing more is coming to the well while the well is what it is now.',
  nothingFurther: 'nothing further will happen',

  ambientFallback: 'Nothing. The stone sweats. Somewhere above, the light moves a hand-width.',
};

/**
 * The dials, as the presence reads them: charge as the surface of the water,
 * a belonging as warmth. Both ordered fullest first.
 */
export const instrument: InstrumentProse = {
  water: [
    'The water is glass. Nothing moves on it at all.',
    'The water is almost still. A ring goes out from the wall and dies.',
    'The water turns slowly against the stone, the way it does after something.',
    'The water will not settle. It keeps finding the wall.',
    'The water is going nowhere and going there fast. There is nothing of you left in it.',
  ],
  feel: ['warm', 'cooling', 'nearly cold', 'cold, and staying cold'],
  atTheRim: ' Somebody is at the rim.',
};
