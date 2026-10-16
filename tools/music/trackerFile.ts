/**
 * Minimal tracker module readers (FastTracker 2 XM, ProTracker/compatible MOD) and a "player"
 * that turns a module into the same note list as a MIDI file (`MidiFile`), so the MIDI import
 * pipeline (midiImportLib.ts) handles keys, roles, recolouring and phrase windows unchanged.
 *
 * Playback follows the order list with pattern breaks and position jumps (stopping where the
 * song loops), note-offs, note cuts and volume. The tracker arpeggio (`0xy`, a chord buzzing on
 * one channel) becomes real sixteenth-note runs. Drums are found from the samples themselves:
 * a sample that does not loop and is played at few pitches is a drum; how often its waveform
 * crosses zero tells kick (low), snare (middle) or hat/cymbal (high).
 */
import type { MidiFile, MidiNote } from './midiFile';

export interface TrackerSample {
  readonly name: string;
  readonly looped: boolean;
  readonly volume: number; // 0–64
  /** Semitones added to the played note (XM relative note). */
  readonly relativeNote: number;
  /** Zero crossings per frame over the first frames (0–1). */
  readonly zeroCrossings: number;
}

export interface TrackerCell {
  /** MIDI pitch before the sample's relative note; 0 = none; -1 = key off. */
  readonly note: number;
  /** 1-based instrument/sample number; 0 = none. */
  readonly instrument: number;
  /** Volume 0–64 from the volume column, or -1. */
  readonly volume: number;
  readonly effect: number;
  readonly param: number;
}

export interface TrackerModule {
  readonly format: 'xm' | 'mod';
  readonly title: string;
  readonly channels: number;
  readonly speed: number;
  readonly bpm: number;
  readonly orders: readonly number[];
  readonly patterns: readonly (readonly (readonly TrackerCell[])[])[];
  /** Per 1-based instrument number (index 0 unused): note (MIDI) → sample. */
  readonly sampleFor: (instrument: number, note: number) => TrackerSample | null;
  readonly instrumentNames: readonly string[];
}

const EFFECT = { arpeggio: 0x0, jump: 0xb, volume: 0xc, break: 0xd, extended: 0xe, speed: 0xf };

function zeroCrossings(values: ArrayLike<number>): number {
  const n = Math.min(values.length, 8000);
  let crossings = 0;
  for (let i = 1; i < n; i += 1) {
    if ((values[i - 1] ?? 0) < 0 !== (values[i] ?? 0) < 0) crossings += 1;
  }
  return n > 1 ? crossings / (n - 1) : 0;
}

/** Two's-complement wrap of a delta-decoded sample value into [-range/2, range/2). */
const wrap = (value: number, range: number) =>
  ((((value + range / 2) % range) + range) % range) - range / 2;

const text = (bytes: Uint8Array, from: number, length: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(from, from + length)))
    .replace(/\0.*$/s, '')
    .trim();

export function parseXm(bytes: Uint8Array): TrackerModule {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (text(bytes, 0, 17) !== 'Extended Module:') throw new Error('not an XM module');
  const u16 = (at: number) => view.getUint16(at, true);
  const u32 = (at: number) => view.getUint32(at, true);
  const headerSize = u32(60);
  const songLength = u16(64);
  const channels = u16(68);
  const patternCount = u16(70);
  const instrumentCount = u16(72);
  const orders = Array.from(bytes.subarray(80, 80 + songLength));
  let at = 60 + headerSize;

  const patterns: TrackerCell[][][] = [];
  for (let p = 0; p < patternCount; p += 1) {
    const length = u32(at);
    const rows = u16(at + 5);
    const packed = u16(at + 7);
    let i = at + length;
    const end = i + packed;
    at = end;
    const grid: TrackerCell[][] = [];
    for (let r = 0; r < rows; r += 1) {
      const row: TrackerCell[] = [];
      for (let c = 0; c < channels; c += 1) {
        if (packed === 0 || i >= end) {
          row.push({ note: 0, instrument: 0, volume: -1, effect: 0, param: 0 });
          continue;
        }
        const first = bytes[i] ?? 0;
        let note = 0;
        let instrument = 0;
        let volume = 0;
        let effect = 0;
        let param = 0;
        if (first & 0x80) {
          i += 1;
          if (first & 1) note = bytes[i++] ?? 0;
          if (first & 2) instrument = bytes[i++] ?? 0;
          if (first & 4) volume = bytes[i++] ?? 0;
          if (first & 8) effect = bytes[i++] ?? 0;
          if (first & 16) param = bytes[i++] ?? 0;
        } else {
          const [n = 0, ins = 0, vol = 0, eff = 0, par = 0] = Array.from(bytes.subarray(i, i + 5));
          [note, instrument, volume, effect, param] = [n, ins, vol, eff, par];
          i += 5;
        }
        row.push({
          note: note === 97 ? -1 : note > 0 && note < 97 ? note + 11 : 0,
          instrument,
          volume: volume >= 0x10 && volume <= 0x50 ? volume - 0x10 : -1,
          effect,
          param,
        });
      }
      grid.push(row);
    }
    patterns.push(grid);
  }

  const instruments: { name: string; map: number[]; samples: TrackerSample[] }[] = [];
  for (let k = 0; k < instrumentCount; k += 1) {
    const size = u32(at);
    const name = text(bytes, at + 4, 22);
    const sampleCount = u16(at + 27);
    if (sampleCount === 0) {
      instruments.push({ name, map: [], samples: [] });
      at += size;
      continue;
    }
    const sampleHeaderSize = u32(at + 29);
    const map = Array.from(bytes.subarray(at + 33, at + 33 + 96));
    let h = at + size;
    const heads = Array.from({ length: sampleCount }, () => {
      const head = {
        length: u32(h),
        loopLength: u32(h + 8),
        volume: bytes[h + 12] ?? 64,
        type: bytes[h + 14] ?? 0,
        relativeNote: view.getInt8(h + 16),
        name: text(bytes, h + 18, 22),
      };
      h += sampleHeaderSize;
      return head;
    });
    const samples = heads.map((head) => {
      const sixteen = (head.type & 16) !== 0;
      const frames = sixteen ? head.length / 2 : head.length;
      const available = Math.max(0, Math.floor((bytes.length - h) / (sixteen ? 2 : 1)));
      const values = new Float32Array(Math.min(frames, 8000, available));
      let acc = 0;
      for (let s = 0; s < values.length; s += 1) {
        if (sixteen) {
          acc = wrap(acc + view.getInt16(h + s * 2, true), 65536);
          values[s] = acc / 32768;
        } else {
          acc = wrap(acc + view.getInt8(h + s), 256);
          values[s] = acc / 128;
        }
      }
      h += head.length;
      return {
        name: head.name,
        looped: (head.type & 3) !== 0 && head.loopLength > 0,
        volume: Math.min(64, head.volume),
        relativeNote: head.relativeNote,
        zeroCrossings: zeroCrossings(values),
      };
    });
    instruments.push({ name, map, samples });
    at = h;
  }

  return {
    format: 'xm',
    title: text(bytes, 17, 20),
    channels,
    speed: u16(76) || 6,
    bpm: u16(78) || 125,
    orders,
    patterns,
    sampleFor: (instrument, note) => {
      const inst = instruments[instrument - 1];
      if (!inst || inst.samples.length === 0) return null;
      const index = inst.map[Math.max(0, Math.min(95, note - 12))] ?? 0;
      return inst.samples[index] ?? inst.samples[0] ?? null;
    },
    instrumentNames: instruments.map((i) => i.name),
  };
}

const MOD_TAGS: Record<string, number> = {
  'M.K.': 4,
  'M!K!': 4,
  FLT4: 4,
  '4CHN': 4,
  '6CHN': 6,
  '8CHN': 8,
};

export function parseMod(bytes: Uint8Array): TrackerModule {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = text(bytes, 1080, 4);
  const channels = MOD_TAGS[tag] ?? (/^\d\dCH$/.test(tag) ? Number(tag.slice(0, 2)) : 0);
  if (!channels) throw new Error(`not a 31-sample MOD (tag "${tag}")`);
  const heads = Array.from({ length: 31 }, (_, s) => {
    const at = 20 + s * 30;
    return {
      name: text(bytes, at, 22),
      length: view.getUint16(at + 22) * 2,
      volume: bytes[at + 25] ?? 64,
      loopLength: view.getUint16(at + 28) * 2,
    };
  });
  const songLength = bytes[950] ?? 0;
  const allOrders = Array.from(bytes.subarray(952, 952 + 128));
  const patternCount = Math.max(...allOrders) + 1;
  let at = 1084;
  const patterns: TrackerCell[][][] = [];
  for (let p = 0; p < patternCount; p += 1) {
    const grid: TrackerCell[][] = [];
    for (let r = 0; r < 64; r += 1) {
      const row: TrackerCell[] = [];
      for (let c = 0; c < channels; c += 1) {
        const [b0 = 0, b1 = 0, b2 = 0, b3 = 0] = Array.from(bytes.subarray(at, at + 4));
        at += 4;
        const period = ((b0 & 0x0f) << 8) | b1;
        row.push({
          // ProTracker period 428 = C-2 (MIDI 60 here); only relative pitch matters downstream.
          note: period > 0 ? Math.round(60 + 12 * Math.log2(428 / period)) : 0,
          instrument: (b0 & 0xf0) | (b2 >> 4),
          volume: -1,
          effect: b2 & 0x0f,
          param: b3,
        });
      }
      grid.push(row);
    }
    patterns.push(grid);
  }
  const samples: TrackerSample[] = heads.map((head) => {
    const values = new Float32Array(Math.max(0, Math.min(head.length, 8000, bytes.length - at)));
    for (let s = 0; s < values.length; s += 1) values[s] = view.getInt8(at + s) / 128;
    at += head.length;
    return {
      name: head.name,
      looped: head.loopLength > 2,
      volume: Math.min(64, head.volume),
      relativeNote: 0,
      zeroCrossings: zeroCrossings(values),
    };
  });
  return {
    format: 'mod',
    title: text(bytes, 0, 20),
    channels,
    speed: 6,
    bpm: 125,
    orders: allOrders.slice(0, songLength),
    patterns,
    sampleFor: (instrument) => samples[instrument - 1] ?? null,
    instrumentNames: heads.map((h) => h.name),
  };
}

export type DrumKind = 'kick' | 'snare' | 'hat';
const GM_DRUM: Record<DrumKind, number> = { kick: 36, snare: 38, hat: 42 };
/**
 * Zero crossings per frame: kicks are low and smooth, pitched one-shots (stabs, plucks) sit just
 * above them and are not drums, snares are noisier, hats and cymbals are mostly noise.
 */
export const DRUM_LIMITS = { kick: 0.017, tonal: 0.04, snare: 0.2 } as const;

export function drumKind(sample: TrackerSample): DrumKind | null {
  const z = sample.zeroCrossings;
  if (z < DRUM_LIMITS.kick) return 'kick';
  if (z < DRUM_LIMITS.tonal) return null;
  return z < DRUM_LIMITS.snare ? 'snare' : 'hat';
}

interface Played {
  readonly channel: number;
  readonly row: number;
  readonly pitch: number;
  readonly sample: TrackerSample;
  readonly velocity: number;
  readonly endRow: number;
  /** Arpeggio offsets per row index (relative to the start row), when used. */
  readonly arp: ReadonlyMap<number, readonly [number, number]>;
}

export interface TrackerPlayback {
  readonly midi: MidiFile;
  readonly rowsPerBeat: 4 | 8;
  /** Samples treated as drums, with their kind (for reports and tests). */
  readonly drums: ReadonlyMap<TrackerSample, DrumKind>;
}

const PPQ = 96;

/** Play the module through its order list and return MIDI-like notes. */
export function trackerToMidi(module: TrackerModule): TrackerPlayback {
  let speed = module.speed;
  let bpm = module.bpm;
  // Rows played at each speed/bpm: the song's tempo is the one heard longest.
  const tempoRows = new Map<string, number>();
  const played: Played[] = [];
  const active = new Map<
    number,
    {
      row: number;
      pitch: number;
      sample: TrackerSample;
      velocity: number;
      arp: Map<number, [number, number]>;
    }
  >();
  const lastInstrument = new Map<number, number>();
  const end = (channel: number, row: number) => {
    const a = active.get(channel);
    if (!a) return;
    active.delete(channel);
    if (row > a.row) played.push({ channel, ...a, endRow: row });
  };

  let rowIndex = 0;
  let order = 0;
  let startRow = 0;
  const seen = new Set<number>();
  while (order < module.orders.length && !seen.has(order)) {
    seen.add(order);
    const pattern = module.patterns[module.orders[order] ?? 0] ?? [];
    let next = order + 1;
    let nextStartRow = 0;
    let stop = false;
    for (let r = startRow; r < pattern.length; r += 1) {
      const row = pattern[r] ?? [];
      let broke = false;
      row.forEach((cell, channel) => {
        if (cell.effect === EFFECT.speed && cell.param > 0) {
          if (cell.param < 32) speed = cell.param;
          else bpm = cell.param;
        }
        if (cell.instrument) lastInstrument.set(channel, cell.instrument);
        if (cell.note === -1) end(channel, rowIndex);
        else if (
          cell.note > 0 &&
          !(module.format === 'xm' && cell.effect === 0x3 && active.has(channel))
        ) {
          end(channel, rowIndex);
          const sample = module.sampleFor(lastInstrument.get(channel) ?? 0, cell.note);
          if (sample) {
            const volume = cell.volume >= 0 ? cell.volume : sample.volume;
            active.set(channel, {
              row: rowIndex,
              pitch: cell.note + sample.relativeNote,
              sample,
              velocity: Math.max(1, Math.round((volume / 64) * 127)),
              arp: new Map(),
            });
          }
        } else if (cell.note > 0) {
          // Tone portamento to a new note: the slide target, held legato.
          const a = active.get(channel);
          if (a) {
            end(channel, rowIndex);
            active.set(channel, {
              ...a,
              row: rowIndex,
              pitch: cell.note + a.sample.relativeNote,
              arp: new Map(),
            });
          }
        }
        const a = active.get(channel);
        if (cell.effect === EFFECT.volume) {
          if (cell.param === 0) end(channel, rowIndex);
          else if (a && a.row === rowIndex)
            a.velocity = Math.max(1, Math.round((Math.min(64, cell.param) / 64) * 127));
        }
        if (cell.volume === 0 && cell.note <= 0) end(channel, rowIndex);
        if (cell.effect === EFFECT.extended && cell.param >> 4 === 0xc) end(channel, rowIndex + 1);
        if (cell.effect === EFFECT.arpeggio && cell.param && a) {
          a.arp.set(rowIndex - a.row, [cell.param >> 4, cell.param & 15]);
        }
        if (cell.effect === EFFECT.break) {
          broke = true;
          nextStartRow = Math.min(63, (cell.param >> 4) * 10 + (cell.param & 15));
        }
        if (cell.effect === EFFECT.jump) {
          broke = true;
          if (cell.param <= order) stop = true;
          next = cell.param;
        }
      });
      tempoRows.set(`${speed}/${bpm}`, (tempoRows.get(`${speed}/${bpm}`) ?? 0) + 1);
      rowIndex += 1;
      if (broke) break;
    }
    if (stop) break;
    order = next;
    startRow = nextStartRow;
  }
  for (const channel of [...active.keys()]) end(channel, rowIndex);

  // Rows per beat: 4 unless that makes the song faster than 180 bpm (fast speeds use 8).
  const [main = `${module.speed}/${module.bpm}`] = [...tempoRows.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);
  const [mainSpeed = 6, mainBpm = 125] = main.split('/').map(Number);
  const rowSeconds = (mainSpeed * 2.5) / mainBpm;
  const rowsPerBeat: 4 | 8 = 60 / (rowSeconds * 4) > 180 ? 8 : 4;
  const ticksPerRow = PPQ / rowsPerBeat;

  // Drums: non-looping samples played at no more than three pitches.
  const pitches = new Map<TrackerSample, Set<number>>();
  for (const p of played) pitches.set(p.sample, (pitches.get(p.sample) ?? new Set()).add(p.pitch));
  const drums = new Map<TrackerSample, DrumKind>();
  for (const [sample, set] of pitches) {
    const kind = sample.looped || set.size > 3 ? null : drumKind(sample);
    if (kind) drums.set(sample, kind);
  }

  const notes: MidiNote[] = [];
  const sixteenth = PPQ / 4;
  for (const p of played) {
    const start = p.row * ticksPerRow;
    const stop = p.endRow * ticksPerRow;
    const kind = drums.get(p.sample);
    if (kind) {
      notes.push({
        channel: 9,
        pitch: GM_DRUM[kind],
        start,
        end: Math.min(stop, start + sixteenth),
        velocity: p.velocity,
      });
      continue;
    }
    // Tracker channel 9 would collide with the MIDI drum channel.
    const channel = p.channel >= 9 ? p.channel + 1 : p.channel;
    if (p.arp.size === 0) {
      notes.push({ channel, pitch: p.pitch, start, end: stop, velocity: p.velocity });
      continue;
    }
    // Arpeggio rows → a run cycling root, +x, +y in sixteenths.
    let i = 0;
    for (let at = start; at < stop; at += sixteenth, i += 1) {
      const rowOffset = Math.floor((at - start) / ticksPerRow);
      const [x, y] = latestArp(p.arp, rowOffset);
      const offset = [0, x, y][i % 3] ?? 0;
      notes.push({
        channel,
        pitch: p.pitch + offset,
        start: at,
        end: Math.min(stop, at + sixteenth),
        velocity: p.velocity,
      });
    }
  }
  notes.sort((a, b) => a.start - b.start || a.channel - b.channel || a.pitch - b.pitch);
  return {
    midi: {
      ppq: PPQ,
      notes,
      tempos: [{ tick: 0, bpm: 60 / (rowSeconds * rowsPerBeat) }],
      timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
      programs: new Map(),
    },
    rowsPerBeat,
    drums,
  };
}

/** The arpeggio in effect at a row of the note (the last one set at or before it), else none. */
function latestArp(
  arp: ReadonlyMap<number, readonly [number, number]>,
  row: number,
): readonly [number, number] {
  let best: readonly [number, number] = [0, 0];
  let bestRow = -1;
  for (const [r, value] of arp) {
    if (r <= row && r > bestRow && r >= row - 1) {
      best = value;
      bestRow = r;
    }
  }
  return best;
}
