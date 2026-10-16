import { describe, expect, it } from 'vitest';
import {
  baseline,
  choose,
  expectEnding,
  has,
  newRun,
  playUntil,
  playUntilOffered,
} from '../../helpers/endingRoute';

describe('The Forgotten Project', () => {
  it('archives the unshipped original project after the custom harness', () => {
    let run = playUntilOffered(newRun(), baseline, 'archive-original');
    expect(has(run, 'custom-harness')).toBe(true);
    run = choose(run, 'archive-original');
    expectEnding(run, 'the-forgotten-project');
  });
});

describe('The Perfect SaaS', () => {
  it('keeps a small profitable service with clean code', () => {
    let run = playUntilOffered(newRun(), baseline, 'small-saas');
    expect(has(run, 'product-management')).toBe(true);
    expect(run.stats.positiveMarginMs).toBeGreaterThanOrEqual(120_000);
    expect(run.economy.debt).toBeLessThanOrEqual(20);
    run = choose(run, 'small-saas');
    expectEnding(run, 'the-perfect-saas');
  });
});

describe('Acquired by Yourself', () => {
  it('accepts the self-acquisition offer once finance exists', () => {
    let run = playUntilOffered(newRun(), baseline, 'self-acquisition');
    expect(has(run, 'finance')).toBe(true);
    run = choose(run, 'self-acquisition');
    expectEnding(run, 'acquired-by-yourself');
  });
});

describe('Fully Automated Bankruptcy', () => {
  it('expands past its revenue, loses money for two minutes, then closes', () => {
    let run = playUntilOffered(newRun(), baseline, 'expand-anyway');
    expect(has(run, 'autonomous-company')).toBe(true);
    run = choose(run, 'expand-anyway');
    expect(run.status).toBe('playing');
    run = playUntilOffered(run, baseline, 'close-company');
    expect(run.stats.negativeMarginMs).toBeGreaterThanOrEqual(120_000);
    expect(run.economy.revenue).toBeGreaterThanOrEqual(0);
    run = choose(run, 'close-company');
    expectEnding(run, 'fully-automated-bankruptcy');
  });
});

describe('The Human Approval API', () => {
  it('keeps mandatory human approval at the final decision', () => {
    let run = playUntilOffered(newRun(), baseline, 'keep-approval');
    run = choose(run, 'keep-approval');
    expectEnding(run, 'the-human-approval-api');
  });
});

describe('You Have Been Optimized', () => {
  it('removes human oversight from the autonomous company (both cat fates)', () => {
    let alive = playUntilOffered(newRun(), baseline, 'remove-oversight');
    alive = choose(alive, 'remove-oversight');
    expectEnding(alive, 'you-have-been-optimized');
    expect(alive.ending?.catAlive).toBe(true);
    // A neglectful player: same economy policies without any care.
    const careless = baseline.filter((_, i) => i < 3);
    let dead = playUntil(newRun(404), careless, (r) => has(r, 'autonomous-company'));
    dead = choose(dead, 'remove-oversight');
    expectEnding(dead, 'you-have-been-optimized');
    expect(dead.ending?.catAlive).toBe(false);
  });
});
