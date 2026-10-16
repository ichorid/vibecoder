/** Read music documents from a directory tree (Node only; CLI and tests). */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { MusicSources } from '../../src/music/core/catalog';

export interface FileDocument {
  readonly file: string;
  readonly value: unknown;
  readonly parseError?: string;
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return jsonFiles(full);
      return name.endsWith('.json') ? [full] : [];
    });
}

export function readDocuments(dir: string): FileDocument[] {
  return jsonFiles(dir).map((file) => {
    try {
      return { file, value: JSON.parse(readFileSync(file, 'utf8')) as unknown };
    } catch (error) {
      return { file, value: null, parseError: String(error) };
    }
  });
}

export interface RepositorySources extends MusicSources {
  readonly files: { readonly patterns: readonly FileDocument[] };
  readonly parseErrors: readonly FileDocument[];
}

export function readRepository(root: string): RepositorySources {
  const read = (sub: string) => readDocuments(path.join(root, sub));
  const groups = {
    eras: read('eras'),
    presets: read('presets'),
    arrangements: read('arrangements'),
    motifs: read('motif'),
    patterns: read('patterns'),
  };
  const all = Object.values(groups).flat();
  return {
    eras: groups.eras.map((d) => d.value),
    presets: groups.presets.map((d) => d.value),
    arrangements: groups.arrangements.map((d) => d.value),
    motifs: groups.motifs.map((d) => d.value),
    patterns: groups.patterns.filter((d) => !d.parseError).map((d) => d.value),
    files: { patterns: groups.patterns },
    parseErrors: all.filter((d) => d.parseError),
  };
}
