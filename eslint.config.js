import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import layerImports from './tools/eslint-rules/layer-imports.js';
import noAmbientGameTime from './tools/eslint-rules/no-ambient-game-time.js';
import noRawContentInUi from './tools/eslint-rules/no-raw-content-in-ui.js';
import ownedScheduling from './tools/eslint-rules/owned-scheduling.js';
import audioBoundaries from './tools/eslint-rules/audio-boundaries.js';

const vibePluginRules = {
  'layer-imports': layerImports,
  'no-ambient-game-time': noAmbientGameTime,
  'no-raw-content-in-ui': noRawContentInUi,
  'owned-scheduling': ownedScheduling,
  'audio-boundaries': audioBoundaries,
};

const typedLintFiles = [
  'src/**/*.ts',
  'src/**/*.svelte',
  'tests/**/*.ts',
  'tools/*.ts',
  'tools/art/**/*.ts',
  'tools/music/**/*.ts',
  'art/**/*.ts',
  'playwright.config.ts',
  'vite.config.ts',
  'vitest.config.ts',
];

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'tools/acceptance/**/*.mjs',
      'tools/acceptance/bootstrap/**',
      'tools/acceptance/behavior/**',
      'tools/acceptance/meta/**',
      'tools/acceptance/lib/**',
      'tools/acceptance/fixtures/types/invalid-command-union.ts',
      'tools/acceptance/fixtures/types/game-uses-document.ts',
      'tools/acceptance/fixtures/eslint/**',
      'tools/eslint-rules/**/*.js',
    ],
  },
  js.configs.recommended,
  eslintConfigPrettier,
  {
    files: ['tools/acceptance/fixtures/types/lint-*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: './tools/type-fixtures/tsconfig.lint-eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
    },
  },
  {
    files: typedLintFiles,
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { vibe: { rules: vibePluginRules } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'vibe/layer-imports': 'error',
      'vibe/no-ambient-game-time': 'error',
      'vibe/no-raw-content-in-ui': 'error',
      'vibe/owned-scheduling': 'error',
      'vibe/audio-boundaries': 'error',
    },
  },
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['tools/eslint-rules/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
);
