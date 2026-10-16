import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { productionPackages, renderNotices } from './noticesLib';

describe('third-party notices', () => {
  const packages = productionPackages(readFileSync('package-lock.json', 'utf8'));

  it('lists the shipped runtime dependencies with exact versions and licenses', () => {
    const names = packages.map((p) => p.name);
    for (const name of ['tone', 'pixi.js', 'svelte', 'tonal', 'ajv']) expect(names).toContain(name);
    expect(packages.every((p) => p.license !== 'UNKNOWN')).toBe(true);
  });

  it('excludes development-only tools', () => {
    const names = packages.map((p) => p.name);
    for (const name of ['vitest', 'eslint', '@playwright/test', 'typescript']) {
      expect(names).not.toContain(name);
    }
  });

  it('the committed notices file matches the lockfile', () => {
    expect(readFileSync('THIRD_PARTY_NOTICES.md', 'utf8')).toBe(renderNotices(packages));
  });
});
