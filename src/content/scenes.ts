import type { Effect } from '../core/effects.js';
import type { Outcome, Scene } from '../core/scene.js';
import { notoriety } from '../core/types.js';
import type { Emotion, PersonId, WorldState } from '../core/types.js';
import { sceneProse, sceneTitles } from './prose/scenes.js';

type SceneKey = keyof typeof sceneProse;
type OutcomeKey<K extends SceneKey> = keyof (typeof sceneProse)[K]['outcomes'] & string;

type OutcomeSpec<K extends SceneKey> = Omit<Outcome, 'id' | 'text'> & { id: OutcomeKey<K> };
type SceneSpec<K extends SceneKey> = Omit<Scene, 'id' | 'title' | 'beats' | 'outcomes'> & {
  outcomes: OutcomeSpec<K>[];
};

/** Joins a scene's mechanics to its prose. Every id here is checked by `tsc`. */
const scene = <K extends SceneKey>(id: K, spec: SceneSpec<K>): Scene => {
  const prose: { beats: readonly string[]; outcomes: Record<string, string> } = sceneProse[id];
  return {
    ...spec,
    id,
    title: sceneTitles[id],
    beats: prose.beats.map((line) => ({ text: () => line })),
    outcomes: spec.outcomes.map((outcome) => ({ ...outcome, text: () => prose.outcomes[outcome.id]! })),
  };
};

const feel = (state: WorldState, person: PersonId, emotion: Emotion): number =>
  state.people[person]?.emotions[emotion] ?? 0;

/** Pressure bands. Below `NOTICED` the living explain it away. */
const NOTICED = 0.25;
const UNDENIABLE = 0.6;

/** Fixed for a run: `requires` is pure and is evaluated against probe worlds. */
const coin = (seed: number): boolean => ((Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 16) & 1) === 1;

const nothingConclusive = (): Effect[] => [{ kind: 'belief', belief: 'mystery', delta: 0.1 }];

export const scenes: Scene[] = [
  scene('first-water', {
    cast: ['anna'],
    weight: (s) => (s.history.length === 0 ? 4 : 1),
    outcomes: [
      {
        id: 'the-word',
        when: (_s, ctx) => ctx.resonance?.object === 'ring',
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'grief', delta: 0.45 },
          { kind: 'belief', belief: 'tragedy', delta: 0.3 },
          { kind: 'well', field: 'attention', delta: 0.2 },
        ],
      },
      {
        id: 'terrified',
        when: (_s, ctx) => ctx.pressure >= UNDENIABLE,
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
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'fear', delta: 0.15 },
          { kind: 'belief', belief: 'mystery', delta: 0.15 },
          { kind: 'well', field: 'attention', delta: 0.1 },
        ],
      },
      {
        id: 'quiet',
        when: () => true,
        effects: (_s, ctx) => (ctx.resonance ? [{ kind: 'belief', belief: 'tragedy', delta: 0.05 }] : []),
      },
    ],
  }),

  scene('boys-at-the-rim', {
    cast: ['boy'],
    outcomes: [
      {
        id: 'fled',
        when: (_s, ctx) => ctx.pressure >= UNDENIABLE,
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
        effects: () => [
          { kind: 'emotion', person: 'boy', emotion: 'curiosity', delta: 0.35 },
          { kind: 'belief', belief: 'mystery', delta: 0.2 },
          { kind: 'well', field: 'attention', delta: 0.15 },
          { kind: 'flag', flag: 'boy-is-curious', value: true },
        ],
      },
      { id: 'bored', when: () => true, effects: () => [{ kind: 'well', field: 'attention', delta: 0.05 }] },
    ],
  }),

  /** The only lever is noise, and noise gets explained. */
  scene('the-asking', {
    cast: ['anselm', 'anna'],
    weight: (s) => (s.history.length <= 2 ? 3 : 1),
    outcomes: [
      {
        id: 'heard',
        when: (_s, ctx) => ctx.pressure >= NOTICED,
        effects: () => [
          { kind: 'emotion', person: 'anna', emotion: 'curiosity', delta: 0.15 },
          { kind: 'belief', belief: 'mystery', delta: 0.1 },
          { kind: 'well', field: 'attention', delta: 0.05 },
        ],
      },
      { id: 'settled', when: () => true, effects: () => [] },
    ],
  }),

  scene('tomas-alone', {
    cast: ['tomas'],
    requires: (s) => s.history.length >= 2,
    weight: (s) => 1 + feel(s, 'tomas', 'guilt') * 3,
    outcomes: [
      {
        id: 'confession',
        when: (s, ctx) => ctx.resonance?.object === 'knife' && feel(s, 'tomas', 'guilt') >= 0.3,
        effects: () => [
          { kind: 'emotion', person: 'tomas', emotion: 'guilt', delta: 0.3 },
          { kind: 'belief', belief: 'tragedy', delta: 0.3 },
          { kind: 'flag', flag: 'tomas-confessed', value: true },
        ],
      },
      {
        id: 'terror',
        when: (_s, ctx) => ctx.pressure >= NOTICED,
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
        effects: () => [{ kind: 'emotion', person: 'tomas', emotion: 'guilt', delta: 0.1 }],
      },
    ],
  }),

  scene('the-hearing', {
    cast: ['anselm', 'anna'],
    unhidable: true,
    requires: (s) => notoriety(s) > 0.4 && s.history.length >= 3,
    outcomes: [
      { id: 'under-the-coat', when: (_s, ctx) => ctx.resonance?.object === 'coat', effects: nothingConclusive },
      {
        id: 'seal-it',
        when: (s, ctx) => s.beliefs.haunted > 0.5 || ctx.pressure >= UNDENIABLE,
        effects: () => [
          { kind: 'belief', belief: 'danger', delta: 0.35 },
          { kind: 'well', field: 'dread', delta: 0.2 },
          { kind: 'flag', flag: 'well-covered', value: true },
        ],
      },
      {
        id: 'a-body',
        when: (s) => s.objects.coat?.discovered === true && s.objects.ring?.discovered === true,
        effects: () => [
          { kind: 'belief', belief: 'tragedy', delta: 0.35 },
          { kind: 'belief', belief: 'mystery', delta: 0.2 },
          { kind: 'emotion', person: 'anna', emotion: 'grief', delta: 0.4 },
          { kind: 'emotion', person: 'anselm', emotion: 'fear', delta: 0.2 },
          { kind: 'flag', flag: 'body-found', value: true },
        ],
      },
      { id: 'inconclusive', when: () => true, effects: nothingConclusive },
    ],
  }),

  scene('the-throwing', {
    cast: ['tomas'],
    terminal: true,
    requires: (s) => s.history.length >= 4 && notoriety(s) > 0.6 && (!s.flags['well-covered'] || coin(s.seed)),
    weight: () => 6,
    outcomes: [
      {
        id: 'stopped',
        when: (s, ctx) => ctx.pressure >= UNDENIABLE && s.beliefs.haunted > 0.4,
        effects: () => [
          { kind: 'belief', belief: 'haunted', delta: 0.4 },
          { kind: 'emotion', person: 'tomas', emotion: 'fear', delta: 0.5 },
          { kind: 'flag', flag: 'throwing-prevented', value: true },
        ],
      },
      {
        id: 'thrown-afraid',
        when: (s) => feel(s, 'tomas', 'fear') > 0.4,
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
  }),
];
