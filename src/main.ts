import { mount } from 'svelte';
import './ui/styles.css';
import App from './app/App.svelte';
import { bootGame, illustrationUrl } from './app/bootstrap';
import { browserFrames } from './app/frameLoop';
import RecoveryPanel from './ui/RecoveryPanel.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Missing #app mount point');
}

const boot = bootGame();
if (boot.kind === 'ready') {
  const game = boot.game;
  mount(App, {
    target,
    props: {
      api: game.api,
      illustrationUrl,
      clock: { activeNow: () => game.activeNow(), frames: browserFrames },
    },
  });
} else {
  mount(RecoveryPanel, {
    target,
    props: {
      reason: boot.load.reason,
      unsupported: boot.load.status === 'unsupported',
      onRetry: () => window.location.reload(),
      onStartNew: () => {
        boot.startNew();
        window.location.reload();
      },
    },
  });
}
