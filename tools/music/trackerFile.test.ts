import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMod, parseXm, trackerToMidi } from './trackerFile';

const SOURCE = 'music/sources/cyber';
const read = (file: string) => readFileSync(`${SOURCE}/${file}`);

/** A one-pattern, two-channel ("02CH") MOD with one looping sample; cells as [period, effect, param]. */
function mod(cells: Record<number, Record<number, readonly [number, number, number]>>): Uint8Array {
  const bytes = new Uint8Array(1084 + 64 * 2 * 4 + 64);
  const view = new DataView(bytes.buffer);
  bytes.set(
    [...'test'].map((c) => c.charCodeAt(0)),
    0,
  );
  view.setUint16(20 + 22, 32); // sample 1: 64 bytes
  bytes[20 + 25] = 64; // volume
  view.setUint16(20 + 28, 32); // loops (melodic)
  bytes[950] = 1; // one order
  bytes.set(
    [...'02CH'].map((c) => c.charCodeAt(0)),
    1080,
  );
  for (const [row, channels] of Object.entries(cells)) {
    for (const [channel, [period, effect, param]] of Object.entries(channels)) {
      const at = 1084 + (Number(row) * 2 + Number(channel)) * 4;
      bytes[at] = (period >> 8) & 0x0f;
      bytes[at + 1] = period & 0xff;
      bytes[at + 2] = (period ? 1 << 4 : 0) | effect;
      bytes[at + 3] = param;
    }
  }
  for (let i = 0; i < 64; i += 1) bytes[1084 + 512 + i] = i % 2 ? 100 : 156; // a square-ish wave
  return bytes;
}

const C4 = 428; // ProTracker C-2 → MIDI 60 here

describe('tracker modules → notes', () => {
  it('plays MOD rows in order: a note lasts until the next note, a C00 cut or the song end', () => {
    const midi = trackerToMidi(
      parseMod(mod({ 0: { 0: [C4, 0, 0] }, 4: { 0: [214, 0, 0] }, 6: { 0: [0, 0xc, 0] } })),
    ).midi;
    const rowTicks = midi.ppq / 4;
    expect(midi.notes.map((n) => [n.pitch, n.start / rowTicks, n.end / rowTicks])).toEqual([
      [60, 0, 4],
      [72, 4, 6],
    ]);
    expect(midi.tempos[0]?.bpm).toBe(125);
  });

  it('turns the 0xy arpeggio into sixteenth-note runs over root, +x, +y', () => {
    const rows = Object.fromEntries(
      Array.from({ length: 6 }, (_, r) => [r, { 0: [r === 0 ? C4 : 0, 0x0, 0x47] as const }]),
    );
    const midi = trackerToMidi(parseMod(mod({ ...rows, 6: { 0: [0, 0xc, 0] } }))).midi;
    expect(midi.notes.map((n) => n.pitch)).toEqual([60, 64, 67, 60, 64, 67]);
  });

  it('stops where a position jump loops back (no endless song)', () => {
    const midi = trackerToMidi(parseMod(mod({ 0: { 0: [C4, 0, 0] }, 8: { 1: [0, 0xb, 0] } }))).midi;
    expect(Math.max(...midi.notes.map((n) => n.end))).toBe((9 * midi.ppq) / 4);
  });

  it('reads XM and MOD headers: channels, tempo and rows per beat', () => {
    const keygen = trackerToMidi(parseXm(read('drozerix-keygen-9000.xm')));
    expect(keygen.rowsPerBeat).toBe(8); // speed 3 at 120: eight rows to a beat
    expect(keygen.midi.tempos[0]?.bpm).toBeCloseTo(120, 5);
    const neon = parseMod(read('drozerix-neon-techno.mod'));
    expect(neon.channels).toBe(4);
    expect(trackerToMidi(neon).midi.tempos[0]?.bpm).toBeCloseTo(125, 5);
  });

  it('finds drums from the samples themselves (checked against named instruments)', () => {
    const kinds = (file: string) => {
      const playback = trackerToMidi(parseXm(read(file)));
      const byName = new Map<string, string>();
      for (const [sample, kind] of playback.drums) byName.set(sample.name, kind);
      return byName;
    };
    // Subterrain: Bass Drum, Snare Drum, Ride Cymbal (the muted power-chord stab is not a drum).
    const subterrain = kinds('congusbongus-subterrain.xm');
    expect([...subterrain.values()].sort()).toEqual(['hat', 'kick', 'snare']);
    // Midnight Drive: Bass Drum, Snare Drum, High Hat Closed, Crash and Ride Cymbal.
    const midnight = kinds('congusbongus-midnight-drive.xm');
    expect([...midnight.values()].sort()).toEqual(['hat', 'hat', 'hat', 'kick', 'snare']);
  });
});
