import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMidi } from './midiFile';

/** A variable-length quantity as in the Standard MIDI File format. */
function vlq(value: number): number[] {
  const bytes = [value & 0x7f];
  for (let v = value >> 7; v > 0; v >>= 7) bytes.unshift((v & 0x7f) | 0x80);
  return bytes;
}

function smf(ppq: number, tracks: number[][]): Uint8Array {
  const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 1, 0, tracks.length, ppq >> 8, ppq & 255];
  const body = tracks.flatMap((t) => [0x4d, 0x54, 0x72, 0x6b, ...u32(t.length), ...t]);
  return new Uint8Array([...header, ...body]);
}

describe('Standard MIDI File parsing', () => {
  it('reads notes, tempo, time signature and programs (running status, note-on 0 = off)', () => {
    // prettier-ignore
    const conductor = [
      ...vlq(0), 0xff, 0x51, 3, 0x07, 0xa1, 0x20, // 500 000 µs per beat = 120 bpm
      ...vlq(0), 0xff, 0x58, 4, 3, 2, 24, 8, // 3/4
      ...vlq(0), 0xff, 0x2f, 0,
    ];
    // prettier-ignore
    const melody = [
      ...vlq(0), 0xc1, 80, // program 80 on channel 1
      ...vlq(0), 0x91, 60, 100, // C4 on
      ...vlq(96), 64, 90, // running status: E4 on at 96
      ...vlq(0), 60, 0, // running status: C4 off (velocity 0) at 96
      ...vlq(96), 0x81, 64, 0, // E4 off at 192
      ...vlq(0), 0xf0, ...vlq(2), 0x01, 0xf7, // a SysEx event is skipped
      ...vlq(0), 0xff, 0x2f, 0,
    ];
    const midi = parseMidi(smf(96, [conductor, melody]));
    expect(midi.ppq).toBe(96);
    expect(midi.tempos).toEqual([{ tick: 0, bpm: 120 }]);
    expect(midi.timeSignatures).toEqual([{ tick: 0, numerator: 3, denominator: 4 }]);
    expect(midi.programs.get(1)).toBe(80);
    expect(midi.notes).toEqual([
      { channel: 1, pitch: 60, start: 0, end: 96, velocity: 100 },
      { channel: 1, pitch: 64, start: 96, end: 192, velocity: 90 },
    ]);
  });

  it('rejects files that are not MIDI, and SMPTE time division', () => {
    expect(() => parseMidi(new Uint8Array([1, 2, 3, 4]))).toThrow(/not a Standard MIDI File/);
    const smpte = smf(96, []);
    smpte[12] = 0xe7;
    expect(() => parseMidi(smpte)).toThrow(/SMPTE/);
  });

  it('parses the bundled CC0 sources', () => {
    const midi = parseMidi(readFileSync('music/sources/rpgchip/rpgchip03_town.mid'));
    expect(midi.ppq).toBeGreaterThan(0);
    expect(midi.tempos[0]?.bpm).toBeCloseTo(108, 3);
    expect(midi.notes.length).toBeGreaterThan(500);
    expect(midi.notes.every((n) => n.end > n.start)).toBe(true);
  });
});
