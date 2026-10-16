/**
 * Named disposable DOM animation helper (presentation only). It never advances gameplay; the
 * callback reads the shared active clock. One requestAnimationFrame chain per subscription.
 */
export type FrameSubscribe = (callback: () => void) => () => void;

export const browserFrames: FrameSubscribe = (callback) => {
  let handle = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    callback();
    handle = requestAnimationFrame(loop);
  };
  handle = requestAnimationFrame(loop);
  return () => {
    stopped = true;
    cancelAnimationFrame(handle);
  };
};
