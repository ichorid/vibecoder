/** Floating "+x" numbers and short labels (presentation only). */
import type { PrimaryGainViewModel } from '../game/selectors';

export interface FloatingGain {
  readonly id: number;
  readonly text: string;
  /** Horizontal start position inside the host, 0–1. */
  readonly x: number;
  /** Vertical start position inside the host, 0–1 (top when omitted). */
  readonly y?: number;
  /** Where it flies to, in px from its start: into the build the press fills (none: it rises). */
  readonly to?: { readonly x: number; readonly y: number };
  /**
   * `spend`: money paid out (e.g. the cat's food), red.
   * `earn`: money earned (a gig paid), gold; it pops under the balance and flies up into it.
   * None of them flies to a build.
   */
  readonly tone?: 'spend' | 'earn';
}

/** The element a press fills (the first slot's build row), as a CSS selector in Game. */
export function buildSelector(target: string | null): string | null {
  return target === null ? null : '[data-build-slot="0"]';
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
