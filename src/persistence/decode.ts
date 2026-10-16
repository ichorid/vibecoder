/**
 * Small structural decoding helpers for untrusted saved JSON. Each helper narrows `unknown`
 * and checks ranges; the first violation throws a DecodeError that `decodeSave` converts into
 * a typed LoadResult. No type assertion stands in for validation.
 */
export class DecodeError extends Error {}

export type Path = string;

export function fail(path: Path, problem: string): never {
  throw new DecodeError(`${path}: ${problem}`);
}

export function record(value: unknown, path: Path): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

export interface NumberRule {
  min?: number;
  max?: number;
  integer?: boolean;
}

export function num(value: unknown, path: Path, rule: NumberRule = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return fail(path, 'expected a finite number');
  if (rule.integer && !Number.isInteger(value)) return fail(path, 'expected an integer');
  if (rule.min !== undefined && value < rule.min) return fail(path, `below ${rule.min}`);
  if (rule.max !== undefined && value > rule.max) return fail(path, `above ${rule.max}`);
  return value;
}

export function nullableNum(value: unknown, path: Path, rule: NumberRule = {}): number | null {
  return value === null ? null : num(value, path, rule);
}

export function bool(value: unknown, path: Path): boolean {
  if (typeof value !== 'boolean') return fail(path, 'expected a boolean');
  return value;
}

export function str(value: unknown, path: Path, maxLength = 200): string {
  if (typeof value !== 'string') return fail(path, 'expected a string');
  if (value.length > maxLength) return fail(path, 'string too long');
  return value;
}

export function oneOf<T extends string>(value: unknown, path: Path, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    return fail(path, `expected one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function list<T>(
  value: unknown,
  path: Path,
  item: (entry: unknown, path: Path) => T,
  maxLength = 10_000,
): T[] {
  if (!Array.isArray(value)) return fail(path, 'expected an array');
  if (value.length > maxLength) return fail(path, 'array too long');
  return value.map((entry, index) => item(entry, `${path}[${index}]`));
}

export function uniqueList<T extends string>(
  value: unknown,
  path: Path,
  allowed: readonly T[],
): T[] {
  const items = list(value, path, (entry, p) => oneOf(entry, p, allowed));
  if (new Set(items).size !== items.length) return fail(path, 'duplicate entries');
  return items;
}
