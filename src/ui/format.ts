/** Presentation helpers shared by views. */

/** Active time as m:ss (or h:mm:ss). */
export function formatActiveTime(activeMs: number): string {
  const totalSeconds = Math.floor(activeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Q'];

/** Compact number formatting: 999, 1.2K, 45.6M. */
export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  let abs = Math.abs(value);
  if (abs < 1000) return sign + String(Math.floor(abs));
  let index = 0;
  while (abs >= 1000 && index < SUFFIXES.length - 1) {
    abs /= 1000;
    index += 1;
  }
  const digits = abs >= 100 ? 0 : 1;
  return `${sign}${abs.toFixed(digits).replace(/\.0$/, '')}${SUFFIXES[index] ?? ''}`;
}

/** Words for a 0–100 bar, used in accessible names instead of numbers. */
export function describeLevel(value: number): string {
  if (value <= 0) return 'empty';
  if (value < 20) return 'very low';
  if (value < 40) return 'low';
  if (value < 70) return 'fair';
  return 'good';
}
