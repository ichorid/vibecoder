/** Fixture: the real lazy controller on a page with no other audio code. */
import { createAudioController } from '../../../src/music/public';
import { createAudioPreferences } from '../../../src/music/preferences';

const status = document.getElementById('status');
const controller = createAudioController({
  loader: async () => {
    const { loadToneAudio } = await import('../../../src/music/backend/loader');
    return loadToneAudio((backend) => ({
      start: () => backend.start(),
      pause: () => backend.pause(),
      resume: () => backend.resume(),
      setVolume: (v) => backend.setVolume(v),
      setMuted: (m) => backend.setMuted(m),
      dispose: () => backend.dispose(),
    }));
  },
  preferences: createAudioPreferences(window.localStorage),
  userActivationActive: () => navigator.userActivation?.isActive ?? true,
  onState: (state) => {
    if (status) status.textContent = state.status;
  },
});
document.getElementById('sound')?.addEventListener('click', () => {
  void controller.setSound(controller.state().status !== 'playing');
});
(window as unknown as { contextState: () => Promise<string> }).contextState = async () =>
  (await import('../../../src/music/backend/loader')).contextState();
