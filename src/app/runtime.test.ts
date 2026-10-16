import { describe, expect, it } from 'vitest';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { createRuntime } from './runtime';

function setup() {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  let steps = 0;
  const runtime = createRuntime({
    clock,
    scheduler,
    onSteps: (count) => {
      steps += count;
    },
  });
  return { clock, scheduler, runtime, steps: () => steps };
}

describe('runtime clock', () => {
  it('turns allowed elapsed time into 100 ms steps and carries the remainder', () => {
    const t = setup();
    t.runtime.start();
    t.clock.advance(500);
    t.runtime.settle();
    t.clock.advance(550);
    t.runtime.settle();
    expect(t.steps()).toBe(10);
    expect(t.runtime.remainderMs()).toBe(50);
    t.clock.advance(50);
    t.runtime.settle();
    expect(t.steps()).toBe(11);
    expect(t.runtime.remainderMs()).toBe(0);
  });

  it('does not count the same monotonic timestamp twice', () => {
    const t = setup();
    t.runtime.start();
    t.clock.advance(300);
    t.runtime.settle();
    t.runtime.settle();
    expect(t.steps()).toBe(3);
  });

  it.each(['hidden', 'blurred', 'frozen'] as const)(
    'blocks elapsed time while %s and never catches up on resume',
    (reason) => {
      const t = setup();
      t.runtime.start();
      t.clock.advance(200);
      t.runtime.pause(reason);
      expect(t.steps()).toBe(2);
      t.clock.advance(5 * 60 * 1000);
      t.runtime.settle();
      t.runtime.resume(reason);
      t.runtime.settle();
      expect(t.steps()).toBe(2);
      t.clock.advance(100);
      t.runtime.settle();
      expect(t.steps()).toBe(3);
    },
  );

  it('discards a scheduling gap above 1000 ms but allows exactly 1000 ms', () => {
    const t = setup();
    t.runtime.start();
    t.clock.advance(1000);
    t.runtime.settle();
    expect(t.steps()).toBe(10);
    t.clock.advance(1001);
    t.runtime.settle();
    expect(t.steps()).toBe(10);
    t.clock.advance(100);
    t.runtime.settle();
    expect(t.steps()).toBe(11);
  });

  it('keeps pause reasons independent', () => {
    const t = setup();
    t.runtime.start();
    t.runtime.pause('hidden');
    t.runtime.pause('loading');
    t.runtime.resume('hidden');
    expect(t.runtime.isActive()).toBe(false);
    t.clock.advance(500);
    t.runtime.settle();
    expect(t.steps()).toBe(0);
    t.runtime.resume('loading');
    expect(t.runtime.isActive()).toBe(true);
    t.clock.advance(100);
    t.runtime.settle();
    expect(t.steps()).toBe(1);
  });

  it('never rewinds on a negative or invalid delta', () => {
    const t = setup();
    t.runtime.start();
    t.clock.advance(300);
    t.runtime.settle();
    t.clock.advance(-250);
    t.runtime.settle();
    expect(t.steps()).toBe(3);
    t.clock.set(Number.NaN);
    t.runtime.settle();
    expect(t.steps()).toBe(3);
    t.clock.set(5000);
    t.runtime.settle();
    t.clock.advance(100);
    t.runtime.settle();
    expect(t.steps()).toBe(4);
  });

  it('fires settle from exactly one owned interval and removes it on dispose', () => {
    const t = setup();
    t.runtime.start();
    t.runtime.start();
    expect(t.scheduler.activeCount()).toBe(1);
    t.clock.advance(200);
    t.scheduler.fire();
    expect(t.steps()).toBe(2);
    t.runtime.dispose();
    t.runtime.dispose();
    expect(t.scheduler.activeCount()).toBe(0);
    t.clock.advance(200);
    t.runtime.settle();
    expect(t.steps()).toBe(2);
  });

  it('does not run before start', () => {
    const t = setup();
    t.clock.advance(300);
    t.runtime.settle();
    expect(t.steps()).toBe(0);
  });
});
