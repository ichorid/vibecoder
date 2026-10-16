/** Floating "+x" numbers over the primary action (presentation only). */
export interface FloatingGain {
  readonly id: number;
  readonly text: string;
  /** Horizontal start position inside the host, 0–1. */
  readonly x: number;
}

/** At most this many numbers float at once; the oldest makes room. */
export const MAX_FLOATING = 8;
