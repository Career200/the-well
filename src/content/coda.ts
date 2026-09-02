import type { Coda } from '../core/coda.js';
import { notoriety } from '../core/types.js';

const played = (state: Parameters<typeof notoriety>[0], scene: string, outcome: string): boolean =>
  state.history.some((h) => h.scene === scene && h.outcome === outcome);

/**
 * Prototype endings. The prose is placeholder; the shape is not.
 *
 * Tone: nothing is confirmed on the way out, the village is never stupid,
 * nobody is a monster, and the word is not used. The one place beliefs may be
 * stated plainly — but only what the village decided, never what is true.
 */
export const coda: Coda = {
  // Most specific first.
  spines: [
    {
      id: 'never-woke',
      when: ({ state, door }) => door === 'starved' && !state.flags['presence.has-pressed'] && !state.history.length,
      text: 'You did not find out that you could. The cold came, and the water moved against you the way it moves against the stone, and the walls went up out of reach, and none of it was ever going to be any different. Somewhere above, a season went past, and it did not need you for any of it. That is the end of what there is to tell. It is not the end of it for you.',
    },
    {
      id: 'thrown-cold',
      when: ({ state }) => played(state, 'the-throwing', 'thrown-cold'),
      text: 'They did it in the afternoon, with rope, and nobody hurried. Four days later they came back for him with better rope and a lamp and a man from the next parish who knew the knots, and they had him up before dark. Somebody had thought to bring a sheet. The priest stood out in the rain and said the name twice so the ones at the back would hear it. You were there for all of it, and now you know what it looks like when they actually try.',
    },
    {
      id: 'thrown-afraid',
      when: ({ state }) => played(state, 'the-throwing', 'thrown-afraid'),
      text: 'It was done fast and badly, by men who could not look at each other afterwards, and then it was not spoken of, and nobody came back. He is not dead. Yet. He talks, and mostly not to anybody specific, and in between he moans in pain and listens for the rope. That will go on for a while. You are a foot from him and he has no idea, and there is nothing to be done about either of that.',
    },
    {
      id: 'stopped',
      when: ({ state }) => state.flags['throwing-prevented'] === true,
      text: 'Somebody said no, out loud, and the rope went slack, and everyone went home thinking better of themselves. But the one who said it stopped sleeping, and then stopped coming to market, and in the spring he walked up the track alone at an hour nobody would see him, sat on the rim for a while, talked, but not with you. He had been carrying something for months and now he brought it down with him. It is in the silt near your hand now, and the well grows colder still.',
    },
    {
      id: 'sealed',
      when: ({ state }) => state.flags['well-covered'] === true,
      text: 'The boards went on before the frost, and were seen to for a while, and then were not, and nobody decided to stop. Years go like that. There is a boy in the village now who was not born when any of this happened, and he has started asking which one it was, and coming up to look, and working out how to be here on his own.',
    },
    {
      // `erode` eats this one as it is read, so it has to survive half gone.
      id: 'forgotten',
      when: ({ state, door }) => door === 'starved' && state.well.attention < 0.3 && notoriety(state) < 0.4,
      text: 'The path stopped going near it. The ground grew over the short way and the long way became the way, and nobody decided that either. After that it is the cold, and the cold is not company. Whatever is down here goes on wanting and has nothing left to want at, and it does not stop, and nobody has ever found the bottom of it.',
    },
    {
      id: 'undecided',
      text: "They went on talking about it and nobody ever got to the end of the sentence. They were always about to do something. Then the Ferrin place changed hands and a family came down from the north who had not heard anything, with their own reasons for keeping to themselves and their own way of handling a thing that will not explain itself. Ferrin kids weren't there to tell them. Still, the versions are all round. Whoever gets to the newcomers first settles which one they will believe.",
    },
  ],

  clauses: [
    {
      id: 'body-found',
      when: ({ state }) => state.flags['body-found'] === true,
      text: "It was said out loud, once, that there is a person down there. Whose they didn't dare say. But they knew.",
    },
    {
      id: 'confessed',
      when: ({ state }) => state.flags['tomas-confessed'] === true,
      text: 'And the one who knew more told somebody else. Somebody else who absolves sins and offers absolution.',
    },
    {
      id: 'a-story',
      when: ({ state }) => state.flags['boy-told-a-story'] === true,
      text: 'The boy will remember this as long as he lives. He tells all of it wrong, though, but better. His version has a shape to it, and shapes become stories.',
    },
    {
      id: 'she-stayed',
      when: ({ state }) => played(state, 'first-water', 'the-word'),
      text: 'And she... She began coming for water she did not need — at first, only when the yard was empty, with a few words, and always looking behind before she said anything. By autumn she was talking the whole time the bucket was down, easy about it, the way you talk to somebody in the next room. In the spring she stopped going back to the house, and the ones who walked up to fetch her came down without her, and again. Eventually they stopped trying.',
    },
    {
      id: 'nothing-left',
      when: ({ state }) => {
        const held = Object.values(state.objects).filter((o) => o.found);
        return held.length > 0 && held.reduce((sum, o) => sum + o.charge, 0) <= 0.2 * held.length;
      },
      text: "And down here nothing keeps the warmth no more. You've spent it on people who are won't reach you and who would not have known it was you, and whatever arrives next will find you all the hungrier.",
    },
  ],

  verdicts: {
    haunted: "They will tell that there's as a haunt. Some will laugh and some will take the long way around, and some would do both.",
    mystery: "They will tell it's something nobody ever got to the bottom of. And really, that's an easier path. It asks nothing of anybody in this place.",
    tragedy: 'They will tell it as a sad thing that happened once, and they will be gentle about it, and with gentleness they will forget.',
    danger: 'They will tell it is a bad place, and they will keep the children away. You will see one next to you soon, despite that.',
    none: 'They never agreed on what it was. Many versions went around the same winter, and until they find something else to talk about, it will be remembered.',
  },

  closes: {
    veiled:
      'And you, the cold does not let you go, and you have stopped expecting it to. There are warm shapes in the silt that you never got as far as knowing, and one of them is close enough to touch.',
    plain:
      "Three things you looked at properly, and they are yours, and you know it the way you know your own handwriting. There is a fourth down here that you never quite reached. It's warmth is fainter with every passing year.",
    named: 'Your ring, in the silt, where your hand is. She gave it back to you by the gate and you carried it in your pocket the whole way here. That is your last thought and the last thing you ever did, and you have been down here a long time since then.',
  },
};
