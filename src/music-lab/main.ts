import { mount } from 'svelte';
import '../ui/styles.css';
import { createAudioPreferences } from '../music/preferences';
import App from './App.svelte';
import { createCandidateStore } from './candidates';
import { createLabController, type LabState } from './labController';
import { createReviewStore } from './reviewStore';
import { loadLabSources } from './sources';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function boot(target: HTMLElement): Promise<void> {
  const sources = await loadLabSources();
  let publish: (state: LabState) => void = () => {};
  const lab = createLabController({
    sources,
    seed: (Date.now() >>> 0) % 2_147_483_647,
    preferences: createAudioPreferences(storage()),
    reviews: createReviewStore(storage()),
    candidates: createCandidateStore(storage()),
    // Tone (and its AudioContext) load only on the first PLAY gesture.
    load: async () => (await import('../music/backend/loader')).loadToneBackend(),
    onState: (state) => publish(state),
  });
  mount(App, {
    target,
    props: {
      lab,
      subscribe: (listener: (state: LabState) => void) => {
        publish = listener;
        listener(lab.state());
      },
    },
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') lab.suspend();
    else lab.wake();
  });
  // A page kept in the back/forward cache only pauses; a real unload releases the audio graph.
  window.addEventListener('pagehide', (event) => (event.persisted ? lab.suspend() : lab.dispose()));
}

const target = document.getElementById('lab');
if (!target) throw new Error('Missing #lab mount point');
boot(target).catch((error: unknown) => {
  target.textContent = `The Music Lab could not start: ${String(error)}`;
});
