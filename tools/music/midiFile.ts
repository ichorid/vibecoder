/**
 * A minimal Standard MIDI File reader (formats 0/1, PPQ division) for importing third-party
 * CC material: notes with absolute ticks, tempo and time-signature meta events, programs.
 * Node and browser safe (bytes in, plain data out); no dependency.
 */

export interface MidiNote {
  readonly channel: number;
  readonly pitch: number;
  readonly start: number;
  readonly end: number;
  readonly velocity: number;
}

export interface MidiFile {
  /** Ticks per quarter note. */
  readonly ppq: number;
  /** Sorted by start tick, then channel and pitch. */
  readonly notes: readonly MidiNote[];
  readonly tempos: readonly { readonly tick: number; readonly bpm: number }[];
  readonly timeSignatures: readonly {
    readonly tick: number;
    readonly numerator: number;
    readonly denominator: number;
  }[];
  /** Last program change per channel. */
  readonly programs: ReadonlyMap<number, number>;
}

const ascii = (bytes: Uint8Array, at: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(at, at + 4)));

export function parseMidi(bytes: Uint8Array): MidiFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14 || ascii(bytes, 0) !== 'MThd') {
    throw new Error('not a Standard MIDI File (missing MThd header)');
  }
  const trackCount = view.getUint16(10);
  const division = view.getUint16(12);
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  let at = 8 + view.getUint32(4);

  const notes: MidiNote[] = [];
  const tempos: { tick: number; bpm: number }[] = [];
  const timeSignatures: { tick: number; numerator: number; denominator: number }[] = [];
  const programs = new Map<number, number>();

  for (let t = 0; t < trackCount; t += 1) {
    if (ascii(bytes, at) !== 'MTrk') throw new Error(`track ${t}: missing MTrk chunk`);
    const end = at + 8 + view.getUint32(at + 4);
    let i = at + 8;
    at = end;
    const vlq = () => {
      let value = 0;
      for (;;) {
        const byte = bytes[i++] ?? 0;
        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80) || i >= end) return value;
      }
    };
    let tick = 0;
    let status = 0;
    const open = new Map<number, { start: number; velocity: number }>();
    const close = (channel: number, pitch: number) => {
      const key = channel * 128 + pitch;
      const on = open.get(key);
      if (!on) return;
      open.delete(key);
      if (tick > on.start)
        notes.push({ channel, pitch, start: on.start, end: tick, velocity: on.velocity });
    };
    while (i < end) {
      tick += vlq();
      const lead = bytes[i] ?? 0;
      if (lead === 0xff) {
        const type = bytes[i + 1] ?? 0;
        i += 2;
        const length = vlq();
        const data = bytes.subarray(i, i + length);
        i += length;
        if (type === 0x51 && length === 3) {
          const micros = ((data[0] ?? 0) << 16) | ((data[1] ?? 0) << 8) | (data[2] ?? 0);
          if (micros > 0) tempos.push({ tick, bpm: 60_000_000 / micros });
        } else if (type === 0x58 && length >= 2) {
          timeSignatures.push({ tick, numerator: data[0] ?? 4, denominator: 2 ** (data[1] ?? 2) });
        }
        continue;
      }
      if (lead === 0xf0 || lead === 0xf7) {
        i += 1;
        i += vlq();
        continue;
      }
      if (lead & 0x80) {
        status = lead;
        i += 1;
      }
      const kind = status & 0xf0;
      const channel = status & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) {
        if (kind === 0xc0) programs.set(channel, bytes[i] ?? 0);
        i += 1;
        continue;
      }
      const a = bytes[i] ?? 0;
      const b = bytes[i + 1] ?? 0;
      i += 2;
      if (kind === 0x90 && b > 0) {
        close(channel, a);
        open.set(channel * 128 + a, { start: tick, velocity: b });
      } else if (kind === 0x80 || kind === 0x90) {
        close(channel, a);
      }
    }
  }
  notes.sort((x, y) => x.start - y.start || x.channel - y.channel || x.pitch - y.pitch);
  tempos.sort((x, y) => x.tick - y.tick);
  timeSignatures.sort((x, y) => x.tick - y.tick);
  return { ppq: division, notes, tempos, timeSignatures, programs };
}
