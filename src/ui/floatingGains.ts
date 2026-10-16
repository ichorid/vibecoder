/** Floating "+x" numbers and short labels (presentation only). */
import type { PrimaryGainViewModel } from '../game/selectors';

export interface FloatingGain {
  readonly id: number;
  readonly text: string;
  /** Horizontal start position inside the host, 0–1. */
  readonly x: number;
  /** Vertical start position inside the host, 0–1 (top when omitted). */
  readonly y?: number;
}

/** Short text for one primary press: what it really added. */
export function gainText(gain: PrimaryGainViewModel, format: (n: number) => string): string {
  switch (gain.unit) {
    case 'code':
      return `+${format(gain.amount)}`;
    case 'managed':
      return `+${format(gain.amount)} managed`;
    case 'debt':
      return `−${format(gain.amount)} debt`;
    case 'efficiency':
      return `+${Math.round(gain.amount * 100)}% speed`;
  }
}

/** At most this many numbers float at once; the oldest makes room. */
export const MAX_FLOATING = 8;
