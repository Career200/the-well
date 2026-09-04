import type { Outcome, Scene } from '../core/scene.js';
import { notoriety } from '../core/types.js';
import type { Emotion, PersonId, WorldState } from '../core/types.js';

const feel = (state: WorldState, person: PersonId, emotion: Emotion): number =>
  state.people[person]?.emotions[emotion] ?? 0;

/** Pressure bands. Below `noticed` the living explain it away. */
const NOTICED = 0.25;
const UNDENIABLE = 0.6;

/**
 * A coin fixed for the length of a run.
 */
const coin = (seed: number): boolean => ((Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 16) & 1) === 1;

const NOTHING_CONCLUSIVE: Pick<Outcome, 'text' | 'effects'> = {
  text: () => 'Silt, says the lamp. Silt and old water and a village’s worth of dropped things. They go home slightly ashamed of themselves, which will not last.',
  effects: () => [{ kind: 'belief', belief: 'mystery', delta: 0.1 }],
};

export const scenes: Scene[] = [
  {
    id: 'first-water',
    title: 'Anna draws water',
    cast: ['anna'],
    weight: (s) => (s.history.length === 0 ? 4 : 1),
    beats: [
      { text: () => 'A shadow crosses the coin of sky. The rope starts down, and the bucket with it, turning.' },
      { text: () => 'The bucket breaks the surface a hand from you. A woman’s face is up there, small as a thumbnail, not looking down so much as looking away.' },
      { text: () => 'She hauls. The rope saws in its groove. She is nearly done.' },
    ],
    outcomes: [
      {
        id: 'the-word',
        when: (_s, ctx) => ctx.resonance?.object === 'ring',
        text: () => 'The rope stops with the last of it still to come. She leans out over the rim, further than anyone leans out over water, and she stays there — both hands flat on the stone, not moving, for a long time. When she goes she leaves the bucket where it is.',
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'grief', delta: 0.45 },
          { kind: 'belief', belief: 'tragedy', delta: 0.3 },
          { kind: 'well', field: 'attention', delta: 0.2 },
        ],
      },
      {
        id: 'terrified',
        when: (_s, ctx) => ctx.pressure >= UNDENIABLE,
        text: () => 'The bucket comes apart from her hands. She does not run at first — that is the worst of it — she stands and looks down and lets you look back, and then she runs.',
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'fear', delta: 0.45 },
          { kind: 'belief', belief: 'haunted', delta: 0.3 },
          { kind: 'well', field: 'attention', delta: 0.2 },
          { kind: 'well', field: 'dread', delta: 0.15 },
        ],
      },
      {
        id: 'unsettled',
        when: (_s, ctx) => ctx.pressure >= NOTICED,
        text: () => 'She stops with the bucket half up. She listens the way you listen for a thing you have decided is not there. Then she takes her water and goes, faster than she came.',
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'fear', delta: 0.15 },
          { kind: 'belief', belief: 'mystery', delta: 0.15 },
          { kind: 'well', field: 'attention', delta: 0.1 },
        ],
      },
      {
        id: 'quiet',
        when: () => true,
        text: () => 'She takes her water. At the rim she pauses, one hand flat on the stone, for no reason she could tell you. Then the sky is only sky again.',
        effects: (s, ctx) => (ctx.resonance ? [{ kind: 'belief', belief: 'tragedy', delta: 0.05 }] : []),
      },
    ],
  },

  {
    id: 'boys-at-the-rim',
    title: 'Stones',
    cast: ['boy'],
    beats: [
      { text: () => 'Voices, thin and high, arguing about how deep. A stone comes down and cracks off the wall beside you.' },
      { text: () => 'Another. This one goes into the water and the sound of it goes up the shaft like something climbing.' },
      { text: () => 'A head leans in over the rim, all haircut and no face, blocking the light.' },
    ],
    outcomes: [
      {
        id: 'fled',
        when: (_s, ctx) => ctx.pressure >= UNDENIABLE,
        text: () => 'You come up the shaft at him. He is off the rim before he has decided to be, and the other one is already running, and by supper there will be a version of this with teeth in it.',
        effects: () => [
          { kind: 'emotion', person: 'boy', emotion: 'fear', delta: 0.5 },
          { kind: 'belief', belief: 'haunted', delta: 0.25 },
          { kind: 'well', field: 'attention', delta: 0.25 },
          { kind: 'flag', flag: 'boy-told-a-story', value: true },
        ],
      },
      {
        id: 'hooked',
        when: (s, ctx) => ctx.resonance?.object === 'whistle' || feel(s, 'boy', 'curiosity') > 0.6,
        text: () => 'He stays. He stays much longer than a boy should stay looking at nothing. When he goes it is slowly, and he looks back twice.',
        effects: () => [
          { kind: 'emotion', person: 'boy', emotion: 'curiosity', delta: 0.35 },
          { kind: 'belief', belief: 'mystery', delta: 0.2 },
          { kind: 'well', field: 'attention', delta: 0.15 },
          { kind: 'flag', flag: 'boy-is-curious', value: true },
        ],
      },
      {
        id: 'bored',
        when: () => true,
        text: () => 'They get bored of it, the way the living get bored of anything that will not answer. The light comes back.',
        effects: () => [{ kind: 'well', field: 'attention', delta: 0.05 }],
      },
    ],
  },
  {
    // The witness scene. The only lever here is noise, and noise gets explained.
    id: 'the-asking',
    title: 'Anselm, at the rim',
    cast: ['anselm', 'anna'],
    weight: (s) => (s.history.length <= 2 ? 3 : 1),
    beats: [
      { text: () => 'Two of them at the rim in the middle of the day. Neither of them has brought a bucket.' },
      { text: () => 'The woman is asking about something and keeps starting the same sentence over.' },
      { text: () => 'The old man answers before she gets to the end of it, every time.' },
    ],
    outcomes: [
      {
        id: 'heard',
        when: (_s, ctx) => ctx.pressure >= NOTICED,
        text: () =>
          'The water knocks against the stone and both of them stop. The old man leans over, looks, and tells her it is frost getting into the wall.',
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'curiosity', delta: 0.15 },
          { kind: 'belief', belief: 'mystery', delta: 0.1 },
          { kind: 'well', field: 'attention', delta: 0.05 },
        ],
      },
      {
        id: 'settled',
        when: () => true,
        text: () =>
          'He finishes her sentence for her, twice, and then they go back down the track. He does most of the talking on the way.',
        effects: () => [],
      },
    ],
  },

  {
    id: 'tomas-alone',
    title: 'Tomas, after dark',
    cast: ['tomas'],
    requires: (s) => s.history.length >= 2,
    weight: (s) => 1 + feel(s, 'tomas', 'guilt') * 3,
    beats: [
      { text: () => 'No light at all up there now, and still someone is standing at the rim. He has been standing there a while.' },
      { text: () => 'He says a word. Not loudly, and not a prayer. It might be a name. It might be yours.' },
      { text: () => 'He leans over. The rope creaks against nothing; there is no wind.' },
    ],
    outcomes: [
      {
        id: 'confession',
        when: (s, ctx) => ctx.resonance?.object === 'knife' && feel(s, 'tomas', 'guilt') >= 0.3,
        text: () => 'Whatever he came to say, he says all of it, and it takes a long time, and nobody hears it but you and the stone. He is different when he walks away. Lighter, and much worse off.',
        effects: () => [
          { kind: 'emotion', person: 'tomas', emotion: 'guilt', delta: 0.3 },
          { kind: 'belief', belief: 'tragedy', delta: 0.3 },
          { kind: 'flag', flag: 'tomas-confessed', value: true },
        ],
      },
      {
        id: 'terror',
        when: (_s, ctx) => ctx.pressure >= NOTICED,
        text: () => 'He recoils so hard he goes down on the stones. He does not get up straight away. When he does, he is walking backwards, and he keeps walking backwards until the dark takes him.',
        effects: () => [
          { kind: 'emotion', person: 'tomas', emotion: 'fear', delta: 0.4 },
          { kind: 'emotion', person: 'tomas', emotion: 'guilt', delta: 0.15 },
          { kind: 'belief', belief: 'haunted', delta: 0.2 },
          { kind: 'belief', belief: 'danger', delta: 0.15 },
        ],
      },
      {
        id: 'nothing',
        when: () => true,
        text: () => 'He waits for something. It does not come. Being forgiven by silence is not the same as being forgiven, and he knows it, and he goes.',
        effects: () => [{ kind: 'emotion', person: 'tomas', emotion: 'guilt', delta: 0.1 }],
      },
    ],
  },

  {
    id: 'the-hearing',
    title: 'Anselm brings the village',
    cast: ['anselm', 'anna'],
    requires: (s) => notoriety(s) > 0.4 && s.history.length >= 3,
    beats: [
      { text: () => 'Many feet. More people than have ever stood around this hole at once.' },
      { text: () => 'An old man is talking about the well in the third person, the way you talk about a debt.' },
      { text: () => 'Somebody has brought a lamp and is lowering it. The light comes down and finds the water, and then it finds what is under the water.' },
    ],
    outcomes: [
      {
        id: 'under-the-coat',
        when: (_s, ctx) => ctx.resonance?.object === 'coat',
        text: NOTHING_CONCLUSIVE.text,
        effects: NOTHING_CONCLUSIVE.effects,
      },
      {
        id: 'seal-it',
        when: (s, ctx) => s.beliefs.haunted > 0.5 || ctx.pressure >= UNDENIABLE,
        text: () => 'The lamp goes up fast. The argument that follows is short. Before dark there is a board over the sky, and stones on the board.',
        effects: () => [
          { kind: 'belief', belief: 'danger', delta: 0.35 },
          { kind: 'well', field: 'dread', delta: 0.2 },
          { kind: 'flag', flag: 'well-covered', value: true },
        ],
      },
      {
        id: 'a-body',
        when: (s) => s.objects.coat?.discovered === true && s.objects.ring?.discovered === true,
        text: () => 'The lamp holds steady a long moment. Then the woman says a name out loud, and the sound the village makes is not fear. It is arithmetic. They are counting backwards to a night they all remember.',
        effects: () => [
          { kind: 'belief', belief: 'tragedy', delta: 0.35 },
          { kind: 'belief', belief: 'mystery', delta: 0.2 },
          { kind: 'emotion', person: 'anna', emotion: 'grief', delta: 0.4 },
          { kind: 'emotion', person: 'anselm', emotion: 'fear', delta: 0.2 },
          { kind: 'flag', flag: 'body-found', value: true },
        ],
      },
      {
        id: 'inconclusive',
        when: () => true,
        text: NOTHING_CONCLUSIVE.text,
        effects: NOTHING_CONCLUSIVE.effects,
      },
    ],
  },

  {
    id: 'the-throwing',
    title: 'The throwing',
    terminal: true,
    cast: ['tomas'],
    requires: (s) =>
      s.history.length >= 4 &&
      notoriety(s) > 0.6 &&
      (!s.flags['well-covered'] || coin(s.seed)),
    weight: () => 6,
    beats: [
      { text: () => 'Four sets of feet, and one of them is not walking on purpose.' },
      { text: () => 'Boards coming off. Voices low and fast and practical, the voices of men doing a job they have talked themselves into.' },
      { text: () => 'The sky opens. Something is held over it that is still arguing.' },
    ],
    outcomes: [
      {
        id: 'stopped',
        when: (s, ctx) => (ctx.pressure >= UNDENIABLE && s.beliefs.haunted > 0.6),
        text: () => 'As the boards come off, you come up the wall with everything you have. They drop something - not the stranger. The lamp light disappears and the stranger stays at the rim. You know that from the sound he makes, a sound you have not heard since you had lungs.',
        effects: () => [
          { kind: 'belief', belief: 'haunted', delta: 0.4 },
          { kind: 'emotion', person: 'tomas', emotion: 'fear', delta: 0.5 },
          { kind: 'flag', flag: 'throwing-prevented', value: true },
        ],
      },
      {
        id: 'thrown-afraid',
        when: (s) => feel(s, 'tomas', 'fear') > 0.4,
        text: () => 'He lets go early, badly, the way you drop a thing that has become hot. The water takes it. He does not look down after. The boards go back on in a hurry, and one of them is not straight, and it never will be.',
        effects: () => [
          { kind: 'person', person: 'stranger', field: 'present', value: true },
          { kind: 'emotion', person: 'stranger', emotion: 'fear', delta: 0.8 },
          { kind: 'belief', belief: 'danger', delta: 0.3 },
          { kind: 'well', field: 'dread', delta: 0.25 },
          { kind: 'flag', flag: 'stranger-in-the-well', value: true },
        ],
      },
      {
        id: 'thrown-cold',
        when: () => true,
        text: () => 'It is done carefully. That is the part you will keep. The water closes, and above you a board is set down flush, and a man says something to another man about the weather.',
        effects: () => [
          { kind: 'person', person: 'stranger', field: 'present', value: true },
          { kind: 'emotion', person: 'stranger', emotion: 'fear', delta: 0.6 },
          { kind: 'emotion', person: 'stranger', emotion: 'anger', delta: 0.3 },
          { kind: 'belief', belief: 'danger', delta: 0.35 },
          { kind: 'well', field: 'dread', delta: 0.3 },
          { kind: 'flag', flag: 'stranger-in-the-well', value: true },
        ],
      },
    ],
  },
];
