#!/usr/bin/env node
/**
 * Entry point for P00 acceptance tests (no npm install required).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const patterns = [
  path.join(__dirname, 'meta', '*.test.mjs'),
  path.join(__dirname, 'bootstrap', '*.test.mjs'),
  path.join(__dirname, 'behavior', '*.test.mjs'),
];

const result = spawnSync(
  process.execPath,
  ['--test', ...patterns],
  { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') },
);

process.exit(result.status ?? 1);
