import type { PersonDef } from '../core/content.js';

/**
 * Nobody here knows what the presence is. Starting emotions are what the
 * village already carries before the player touches anything.
 */
export const people: PersonDef[] = [
  {
    id: 'mira',
    name: 'Mira',
    // She has been drawing water from this well for a year without knowing why she hates it.
    emotions: { grief: 0.15, curiosity: 0.1 },
  },
  {
    id: 'tomas',
    name: 'Tomas',
    // Whatever happened, he was there for the end of it.
    emotions: { guilt: 0.35, fear: 0.1 },
  },
  {
    id: 'anselm',
    name: 'Anselm',
    // The old man who decides what the village is allowed to say out loud.
    emotions: { fear: 0.05 },
  },
  {
    id: 'boy',
    name: 'the Ferrin boy',
    emotions: { curiosity: 0.5 },
  },
  {
    id: 'stranger',
    name: 'the stranger',
    // Not in play until the throwing.
    present: false,
  },
];
