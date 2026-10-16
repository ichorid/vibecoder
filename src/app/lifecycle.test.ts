import { describe, expect, it } from 'vitest';
import { createFakeClock, createFakeScheduler } from '../../tests/helpers/fakeClock';
import { attachBrowserLifecycle, type LifecycleDocument } from './lifecycle';
import { createRuntime } from './runtime';

function fakeDocument(): LifecycleDocument & EventTarget & { setHidden(h: boolean): void } {
  const target = new EventTarget() as EventTarget & {
    visibilityState: DocumentVisibilityState;
    hasFocus(): boolean;
    setHidden(h: boolean): void;
  };
  target.visibilityState = 'visible';
  target.hasFocus = () => true;
  target.setHidden = (hidden) => {
    target.visibilityState = hidden ? 'hidden' : 'visible';
    target.dispatchEvent(new Event('visibilitychange'));
  };
  return target;
}

function setup() {
  const clock = createFakeClock();
  const scheduler = createFakeScheduler();
  let steps = 0;
  const runtime = createRuntime({
    clock,
    scheduler,
    onSteps: (n) => {
      steps += n;
    },
  });
  const doc = fakeDocument();
  const win = new EventTarget();
  let suspensions = 0;
  const detach = attachBrowserLifecycle(runtime, doc, win, () => {
    suspensions += 1;
  });
  runtime.start();
  return { clock, runtime, doc, win, detach, steps: () => steps, suspensions: () => suspensions };
}

describe('browser lifecycle adapter', () => {
  it('pauses on hidden, settles first, and resumes without catch-up', () => {
    const t = setup();
    t.clock.advance(300);
    t.doc.setHidden(true);
    expect(t.steps()).toBe(3);
    expect(t.suspensions()).toBe(1);
    t.clock.advance(60_000);
    t.doc.setHidden(false);
    t.clock.advance(100);
    t.runtime.settle();
    expect(t.steps()).toBe(4);
  });

  it('treats blur and pagehide as independent pauses', () => {
    const t = setup();
    t.win.dispatchEvent(new Event('blur'));
    t.win.dispatchEvent(new Event('pagehide'));
    t.win.dispatchEvent(new Event('focus'));
    expect(t.runtime.isActive()).toBe(false);
    t.win.dispatchEvent(new Event('pageshow'));
    expect(t.runtime.isActive()).toBe(true);
  });

  it('is idempotent for repeated hidden events', () => {
    const t = setup();
    t.doc.setHidden(true);
    t.doc.setHidden(true);
    t.doc.setHidden(false);
    expect(t.runtime.isActive()).toBe(true);
  });

  it('removes listeners on detach', () => {
    const t = setup();
    t.detach();
    t.doc.setHidden(true);
    expect(t.runtime.isActive()).toBe(true);
  });
});
