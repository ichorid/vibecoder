/**
 * Audio preferences: a separate versioned key shared by Game and Music Lab. The browser's audio
 * unlock is never stored. A corrupt value falls back to defaults and never touches game saves.
 */
export const AUDIO_PREFS_KEY = 'vibecoder.audio.v1';
export const DEFAULT_VOLUME = 0.35;

export interface AudioPreferences {
  readonly schemaVersion: 1;
  readonly soundOn: boolean;
  readonly volume: number;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  schemaVersion: 1,
  soundOn: false,
  volume: DEFAULT_VOLUME,
};

function decode(text: string | null): AudioPreferences {
  if (text === null) return DEFAULT_AUDIO_PREFERENCES;
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) return DEFAULT_AUDIO_PREFERENCES;
    const raw = value as Record<string, unknown>;
    const volume = raw.volume;
    if (raw.schemaVersion !== 1 || typeof raw.soundOn !== 'boolean')
      return DEFAULT_AUDIO_PREFERENCES;
    if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0 || volume > 1) {
      return DEFAULT_AUDIO_PREFERENCES;
    }
    return { schemaVersion: 1, soundOn: raw.soundOn, volume };
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

export function createAudioPreferences(storage: PreferenceStorage | null) {
  return {
    load(): AudioPreferences {
      try {
        return decode(storage?.getItem(AUDIO_PREFS_KEY) ?? null);
      } catch {
        return DEFAULT_AUDIO_PREFERENCES;
      }
    },
    save(preferences: AudioPreferences): boolean {
      try {
        storage?.setItem(AUDIO_PREFS_KEY, JSON.stringify(preferences));
        return storage !== null;
      } catch {
        return false;
      }
    },
  };
}

export type AudioPreferenceStore = ReturnType<typeof createAudioPreferences>;
