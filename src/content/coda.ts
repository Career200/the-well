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
      // Never acted, and nothing happened up there either: the run that ends
      // before it starts. An ending, not a failure state.
      id: 'never-woke',
      when: ({ state, door }) => door === 'starved' && !state.flags['presence.has-pressed'] && !state.history.length,
      text: 'You did not find out that you could. The cold came, and the water moved against you the way it moves against the stone, and the walls went up out of reach, and none of it was ever going to be any different. Somewhere above, a season went past, and it did not need you for any of it. That is the end of what there is to tell. It is not the end of it for you.',
    },
    {
      // They are capable of care; the horror is the arithmetic about who got
      // it. Never name the feeling.
      id: 'thrown-cold',
      when: ({ state }) => played(state, 'the-throwing', 'thrown-cold'),
      text: 'They did it in the afternoon, with rope, and nobody hurried. Four days later they came back for him with better rope and a lamp and a man from the next parish who knew the knots, and they had him up before dark. Somebody had thought to bring a sheet. The priest stood out in the rain and said the name twice so the ones at the back would hear it. You were there for all of it, and now you know what it looks like when they mean it.',
    },
    {
      // He is left, and he lasts: company that cannot see you, for weeks —
      // and the weeks are ahead of the ending rather than behind it.
      id: 'thrown-afraid',
      when: ({ state }) => played(state, 'the-throwing', 'thrown-afraid'),
      text: 'It was done fast and badly, by men who could not look at each other afterwards, and then it was not spoken of, which meant nobody came back. He is not dead. He talks, mostly, and not to anybody who is here, and in between he lies still and listens for the rope. That will go on for a while yet. You are a foot from him and he has no idea, and there is nothing to be done about either half of that.',
    },
    {
      // Nothing settled, so it curdles: the man who stopped it carries it
      // instead, and brings it back down himself.
      id: 'stopped',
      when: ({ state }) => state.flags['throwing-prevented'] === true,
      text: 'Somebody said no, out loud, where it could be heard, and the rope went slack, and everyone went home thinking well of themselves. It did not keep. The one who said it stopped sleeping, and then stopped coming to market, and in the spring he walked up the track alone at an hour nobody would see him, and sat on the rim for a while, and then did not sit on it. He had been carrying something for months and he brought it down with him. It is in the silt near your hand now, and it is not like the others.',
    },
    {
      // The boards are temporary; the forgetting is not. Promises a newcomer,
      // arriving at a presence that has starved for years.
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
      text: 'They went on talking about it and never got to the end of the sentence. Somebody was always about to do something. Then the Ferrin place changed hands and a family came down from the north who had not heard any of it, with their own reasons for keeping to themselves and their own way of handling a thing that will not explain itself. The four versions are still going round. Whoever gets to the newcomers first will settle which one they arrive believing.',
    },
  ],

  clauses: [
    {
      id: 'body-found',
      when: ({ state }) => state.flags['body-found'] === true,
      text: 'It was said out loud, once, that there is a person down there. Nobody said whose, and after a while nobody said it at all.',
    },
    {
      id: 'confessed',
      when: ({ state }) => state.flags['tomas-confessed'] === true,
      text: 'One of them told somebody. Whether he was believed is a separate thing, and it was not decided that night either.',
    },
    {
      id: 'a-story',
      when: ({ state }) => state.flags['boy-told-a-story'] === true,
      text: 'The boy tells it wrong, which is better. His version has a shape to it, and shapes are what get repeated.',
    },
    {
      id: 'she-stayed',
      when: ({ state }) => played(state, 'first-water', 'the-word'),
      text: 'She began coming for water she did not need — only when the yard was empty at first, with a few words, and always a look behind her before she said them. By autumn she was talking the whole time the bucket was down, easy about it, the way you talk to somebody in the next room. In the spring she stopped going back to the house, and the ones who walked up to fetch her came down without her, and again. Eventually they stopped trying.',
    },
    {
      // Every other clause is a village fact; this one is what it cost you,
      // and what the sealed ending's newcomer arrives to.
      id: 'nothing-left',
      // Only warmth actually had: counting the whole set would measure things
      // the presence never got its hands on, and lock out anyone who left two
      // in the silt.
      when: ({ state }) => {
        const held = Object.values(state.objects).filter((o) => o.found);
        return held.length > 0 && held.reduce((sum, o) => sum + o.charge, 0) <= 0.2 * held.length;
      },
      text: 'There is nothing down here still warm. You spent it, on people who are not coming back and would not have known it was you, and whatever arrives next will find you exactly as hungry as this.',
    },
  ],

  verdicts: {
    haunted: 'They will tell it as a haunting. Not seriously, mostly — but they will tell it, and the ones who laugh will still take the long way round after dark.',
    mystery: 'They will tell it as something nobody ever got to the bottom of. That version keeps best. It asks nothing of anybody.',
    tragedy: 'They will tell it as a sad thing that happened once, and they will be gentle about it, and the gentleness will be how it gets forgotten.',
    danger: 'They will tell it as a bad place, and they will tell the children first. That version has the shortest words and the longest life.',
    none: 'They never agreed on what it was. Four versions went round the same winter, and none of them beat the others, and what beats all four is having something else to talk about.',
  },

  /**
   * The tier *is* the count: `named` is four belongings looked at, `plain`
   * three, `veiled` two or fewer. A close may state the number but may never
   * name a thing the player did not find — the ending cannot hand over the one
   * they missed.
   */
  closes: {
    veiled:
      'The cold does not go, and you have stopped expecting it to. There are shapes in the silt that you never got as far as knowing, and one of them is close enough to touch.',
    plain:
      'Three things you looked at properly, and they are yours, and you know it the way you know your own handwriting. There is a fourth down here that you never went back for. It is going to stay a shape.',
    named: 'Your ring, in the silt, where your hand is. She gave it back to you by the gate and you carried it in your pocket the whole way here. That is the last thing you did on purpose, and you have been down here a long time since.',
  },
};
