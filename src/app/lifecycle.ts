import type { PauseReason } from './runtime';

export interface LifecycleDocument extends EventTarget {
  readonly visibilityState: DocumentVisibilityState;
  hasFocus(): boolean;
}

/** What the lifecycle adapter drives: the composed game (or a bare runtime in tests). */
export interface LifecycleTarget {
  isActive(): boolean;
  /** Settle eligible time, pause for `reason`, and save. */
  suspend(reason: PauseReason): void;
  resume(reason: PauseReason): void;
}

/**
 * Map browser lifecycle events to pause reasons. Each event is idempotent; suspension settles
 * eligible time first (inside `suspend`).
 */
export function attachBrowserLifecycle(
  target: LifecycleTarget,
  doc: LifecycleDocument,
  win: EventTarget,
): () => void {
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') target.suspend('hidden');
    else target.resume('hidden');
  };
  const onBlur = () => target.suspend('blurred');
  const onFocus = () => target.resume('blurred');
  const onFreeze = () => target.suspend('frozen');
  const onThaw = () => target.resume('frozen');

  const listeners: [EventTarget, string, () => void][] = [
    [doc, 'visibilitychange', onVisibility],
    [doc, 'freeze', onFreeze],
    [doc, 'resume', onThaw],
    [win, 'blur', onBlur],
    [win, 'focus', onFocus],
    [win, 'pagehide', onFreeze],
    [win, 'pageshow', onThaw],
  ];
  for (const [eventTarget, type, listener] of listeners) {
    eventTarget.addEventListener(type, listener);
  }

  if (doc.visibilityState === 'hidden') target.suspend('hidden');
  if (!doc.hasFocus()) target.suspend('blurred');

  return () => {
    for (const [eventTarget, type, listener] of listeners) {
      eventTarget.removeEventListener(type, listener);
    }
  };
}
