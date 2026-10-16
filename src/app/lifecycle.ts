import type { GameRuntime } from './runtime';

export interface LifecycleDocument extends EventTarget {
  readonly visibilityState: DocumentVisibilityState;
  hasFocus(): boolean;
}

/**
 * Map browser lifecycle events to runtime pause reasons. Each event is idempotent; the runtime
 * settles eligible time before pausing. `onSuspend` lets app composition save.
 */
export function attachBrowserLifecycle(
  runtime: GameRuntime,
  doc: LifecycleDocument,
  win: EventTarget,
  onSuspend: () => void,
): () => void {
  const suspend = (reason: 'hidden' | 'blurred' | 'frozen') => {
    const wasActive = runtime.isActive();
    runtime.pause(reason);
    if (wasActive) onSuspend();
  };

  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') suspend('hidden');
    else runtime.resume('hidden');
  };
  const onBlur = () => suspend('blurred');
  const onFocus = () => runtime.resume('blurred');
  const onFreeze = () => suspend('frozen');
  const onThaw = () => runtime.resume('frozen');

  const listeners: [EventTarget, string, () => void][] = [
    [doc, 'visibilitychange', onVisibility],
    [doc, 'freeze', onFreeze],
    [doc, 'resume', onThaw],
    [win, 'blur', onBlur],
    [win, 'focus', onFocus],
    [win, 'pagehide', onFreeze],
    [win, 'pageshow', onThaw],
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener);

  if (doc.visibilityState === 'hidden') runtime.pause('hidden');
  if (!doc.hasFocus()) runtime.pause('blurred');

  return () => {
    for (const [target, type, listener] of listeners) target.removeEventListener(type, listener);
  };
}
