import { test } from 'vitest';
import { RuleTester } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import audioBoundaries from './audio-boundaries.js';
import ownedScheduling from './owned-scheduling.js';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parser: tsParser },
});

test('audio boundaries', () => {
  tester.run('vibe/audio-boundaries', audioBoundaries, {
    valid: [
      { code: "import * as Tone from 'tone';", filename: '/repo/src/music/backend/toneBackend.ts' },
      {
        code: "import { createDirector } from '../music/public';",
        filename: '/repo/src/app/musicBinding.ts',
      },
      {
        code: "import type { PatternDocument } from '../data/patterns.generated';",
        filename: '/repo/src/music/core/timing.ts',
      },
      {
        code: "import { validatePattern } from '../music/core/schema';",
        filename: '/repo/src/music-lab/catalog.ts',
      },
    ],
    invalid: [
      {
        code: "import * as Tone from 'tone';",
        filename: '/repo/src/ui/AudioControls.ts',
        errors: [{ message: /Tone/ }],
      },
      {
        code: "import { Synth } from 'tone';",
        filename: '/repo/src/music-lab/components/Player.ts',
        errors: [{ message: /Tone/ }],
      },
      {
        code: "const x = await import('tone');",
        filename: '/repo/src/game/cat.ts',
        errors: [{ message: /Tone/ }],
      },
      {
        code: 'const s = localStorage.getItem("x");',
        filename: '/repo/src/music/core/shuffleBag.ts',
        errors: [{ message: /browser|storage/ }],
      },
      {
        code: 'document.title = "x";',
        filename: '/repo/src/music/core/timing.ts',
        errors: [{ message: /browser|DOM/ }],
      },
      {
        code: "import { createDirector } from '../music/director';",
        filename: '/repo/src/game/simulation.ts',
        errors: [{ message: /music/ }],
      },
      {
        code: "import { loadReviews } from '../music-lab/reviewStore';",
        filename: '/repo/src/ui/SettingsMenu.ts',
        errors: [{ message: /Lab|review/ }],
      },
      {
        code: "import App from '../music-lab/App.svelte';",
        filename: '/repo/src/app/bootstrap.ts',
        errors: [{ message: /Lab/ }],
      },
    ],
  });
});

test('music notes are never scheduled with browser timers', () => {
  tester.run('vibe/owned-scheduling', ownedScheduling, {
    valid: [
      {
        code: 'transport.scheduleOnce(() => {}, 0);',
        filename: '/repo/src/music/backend/toneBackend.ts',
      },
    ],
    invalid: [
      {
        code: 'window.setTimeout(() => synth.triggerAttack("C4"), 100);',
        filename: '/repo/src/music/director.ts',
        errors: 1,
      },
      {
        code: 'globalThis.setInterval(tick, 50);',
        filename: '/repo/src/music/backend/toneBackend.ts',
        errors: 1,
      },
    ],
  });
});
