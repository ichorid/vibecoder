/** Read a source song by its extension: Standard MIDI (.mid), FastTracker 2 (.xm), ProTracker (.mod). */
import { parseMidi, type MidiFile } from './midiFile';
import { parseMod, parseXm, trackerToMidi } from './trackerFile';

export const SONG_EXTENSIONS = ['.mid', '.xm', '.mod'] as const;

export function readSong(file: string, bytes: Uint8Array): MidiFile {
  const lower = file.toLowerCase();
  if (lower.endsWith('.mid')) return parseMidi(bytes);
  if (lower.endsWith('.xm')) return trackerToMidi(parseXm(bytes)).midi;
  if (lower.endsWith('.mod')) return trackerToMidi(parseMod(bytes)).midi;
  throw new Error(`${file}: unsupported song format (${SONG_EXTENSIONS.join(', ')})`);
}
