import { clamp01 } from './types.js';
import type { Belief, Emotion, ObjectId, PersonId, WorldState } from './types.js';

/**
 * The only way content is allowed to change the world. Keeping this a data
 * union (rather than callbacks) means a scene's consequences can be inspected,
 * diffed and tested without running it.
 */
export type Effect =
  | { kind: 'emotion'; person: PersonId; emotion: Emotion; delta: number }
  | { kind: 'belief'; belief: Belief; delta: number }
  | { kind: 'well'; field: 'attention' | 'dread'; delta: number }
  | { kind: 'presence'; field: 'charge' | 'lucidity'; delta: number }
  | { kind: 'object'; object: ObjectId; field: 'found' | 'discovered'; value: boolean }
  | { kind: 'objectCharge'; object: ObjectId; delta: number }
  | { kind: 'person'; person: PersonId; field: 'present'; value: boolean }
  | { kind: 'flag'; flag: string; value: boolean };

export function applyEffect(state: WorldState, effect: Effect): WorldState {
  switch (effect.kind) {
    case 'emotion': {
      const person = state.people[effect.person];
      if (!person) return state;
      return {
        ...state,
        people: {
          ...state.people,
          [person.id]: {
            ...person,
            emotions: {
              ...person.emotions,
              [effect.emotion]: clamp01(person.emotions[effect.emotion] + effect.delta),
            },
          },
        },
      };
    }
    case 'belief':
      return {
        ...state,
        beliefs: { ...state.beliefs, [effect.belief]: clamp01(state.beliefs[effect.belief] + effect.delta) },
      };
    case 'well':
      return { ...state, well: { ...state.well, [effect.field]: clamp01(state.well[effect.field] + effect.delta) } };
    case 'presence':
      return {
        ...state,
        presence: { ...state.presence, [effect.field]: clamp01(state.presence[effect.field] + effect.delta) },
      };
    case 'object': {
      const object = state.objects[effect.object];
      if (!object) return state;
      return { ...state, objects: { ...state.objects, [object.id]: { ...object, [effect.field]: effect.value } } };
    }
    case 'objectCharge': {
      const object = state.objects[effect.object];
      if (!object) return state;
      return {
        ...state,
        objects: { ...state.objects, [object.id]: { ...object, charge: clamp01(object.charge + effect.delta) } },
      };
    }
    case 'person': {
      const person = state.people[effect.person];
      if (!person) return state;
      return { ...state, people: { ...state.people, [person.id]: { ...person, present: effect.value } } };
    }
    case 'flag':
      return { ...state, flags: { ...state.flags, [effect.flag]: effect.value } };
  }
}

export const applyEffects = (state: WorldState, effects: readonly Effect[]): WorldState =>
  effects.reduce(applyEffect, state);
