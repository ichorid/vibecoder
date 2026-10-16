import type { CatText } from '../game/catalog';

export const catText = {
  conditions: {
    dead: 'The cat is gone.',
    critical: 'Very weak. It barely lifts its head when you come near.',
    sick: 'Lethargic and unhappy. That was a lot of food.',
    hungry: 'Staring meaningfully at the empty bowl.',
    attentionSeeking: 'Meowing loudly. Sitting on whatever you were about to use.',
    lonely: 'Keeps glancing at you from the corner of the desk.',
    normal: 'Content. Watching the cursor blink.',
  },
  overfed: 'Suspiciously round.',
  care: {
    nom: '*nom nom nom*',
    notHungry: 'Not hungry, but okay...',
    tooMuch: 'That was probably too much.',
    spherical: 'The cat is becoming suspiciously spherical.',
    purr: 'Purrrr.',
    playWin: 'The cat looks extremely pleased with itself.',
    playLose: 'The mouse got away. The cat pretends it meant to do that.',
  },
  history: {
    'cat-died': 'The cat is gone.',
    'cat-left': 'The cat left. Nobody noticed when.',
  },
  careMessageMs: 8000,
} as const satisfies CatText;
