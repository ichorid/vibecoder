import { mount, unmount } from 'svelte';
import './ui/styles.css';
import App from './app/App.svelte';
import { bootGame, illustrationUrl } from './app/bootstrap';
import { browserFrames } from './app/frameLoop';
import { claimSaveOwnership, watchForeignWrites, type LockManagerLike } from './app/saveOwnership';
import { SAVE_KEY } from './persistence/save';
import RecoveryPanel from './ui/RecoveryPanel.svelte';
import TabPanel from './ui/TabPanel.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Missing #app mount point');
}
const root = target;
const reload = () => window.location.reload();

/** Boot from the save as it is *now* (called once this tab owns the save). */
function start(bestEffort: boolean): void {
  const boot = bootGame();
  if (boot.kind !== 'ready') {
    mount(RecoveryPanel, {
      target: root,
      props: {
        reason: boot.load.reason,
        unsupported: boot.load.status === 'unsupported',
        keepsEndings: boot.keepsEndings,
        onRetry: reload,
        onStartNew: () => {
          boot.startNew();
          reload();
        },
      },
    });
    return;
  }
  const game = boot.game;
  const app = mount(App, {
    target: root,
    props: {
      api: game.api,
      audio: boot.music.controls,
      illustrationUrl,
      clock: { activeNow: () => game.activeNow(), frames: browserFrames },
    },
  });
  if (!bestEffort) return;
  // No Web Locks: if another tab saved newer progress, stop here without writing again.
  const stopWatching = watchForeignWrites(
    window,
    SAVE_KEY,
    () => game.revision(),
    () => {
      stopWatching();
      boot.detach();
      game.dispose();
      void unmount(app);
      mount(TabPanel, { target: root, props: { mode: 'elsewhere', onReload: reload } });
    },
  );
}

let waiting: ReturnType<typeof mount> | null = null;
const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
// The claim lives as long as the page: the lock is released when the tab closes.
claimSaveOwnership(locks, {
  onWaiting: () => {
    waiting = mount(TabPanel, { target: root, props: { mode: 'waiting', onReload: reload } });
  },
  onOwner: () => {
    if (waiting) void unmount(waiting);
    waiting = null;
    start(locks === undefined);
  },
});
