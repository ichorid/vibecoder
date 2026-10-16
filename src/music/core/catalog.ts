/**
 * Build an immutable music catalog from untrusted documents: structural validation first,
 * then cross-references (era ↔ arrangement ↔ preset, pattern ↔ era/motif/role) and licences.
 * Invalid documents are excluded and reported; nothing invalid reaches a player.
 */
import arrangementSchema from '../../../music/schemas/arrangement.schema.json';
import eraSchema from '../../../music/schemas/era.schema.json';
import motifSchema from '../../../music/schemas/motif.schema.json';
import presetSchema from '../../../music/schemas/preset.schema.json';
import type {
  ArrangementDocument,
  EraDocument,
  MotifDocument,
  PatternDocument,
  PresetDocument,
} from '../data/patterns.generated';
import { compileSchema, toErrors, validatePatternStructure } from './schema';

export interface Diagnostic {
  readonly level: 'error' | 'warning';
  /** Document kind and identity, e.g. `pattern discovery-a@1`. */
  readonly source: string;
  readonly path: string;
  readonly message: string;
}

export interface MusicSources {
  readonly eras: readonly unknown[];
  readonly presets: readonly unknown[];
  readonly arrangements: readonly unknown[];
  readonly motifs: readonly unknown[];
  readonly patterns: readonly unknown[];
}

export interface MusicCatalog {
  readonly eras: ReadonlyMap<string, EraDocument>;
  readonly presets: ReadonlyMap<string, PresetDocument>;
  readonly arrangements: ReadonlyMap<string, ArrangementDocument>;
  readonly motifs: ReadonlyMap<string, MotifDocument>;
  /** Structurally valid, reference-checked pattern versions (several revisions may coexist). */
  readonly patterns: readonly PatternDocument[];
}

const checkEra = compileSchema<EraDocument>(eraSchema);
const checkPreset = compileSchema<PresetDocument>(presetSchema);
const checkArrangement = compileSchema<ArrangementDocument>(arrangementSchema);
const checkMotif = compileSchema<MotifDocument>(motifSchema);

function identity(kind: string, value: unknown, index: number): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string'
  ) {
    const revision = 'revision' in value ? `@${String(value.revision)}` : '';
    return `${kind} ${value.id}${revision}`;
  }
  return `${kind} #${index}`;
}

function structural<T extends { id: string }>(
  kind: string,
  values: readonly unknown[],
  check: ((value: unknown) => value is T) & { errors?: unknown },
  diagnostics: Diagnostic[],
): Map<string, T> {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    const source = identity(kind, value, index);
    if (check(value)) {
      if (result.has(value.id)) {
        diagnostics.push({
          level: 'error',
          source,
          path: '/id',
          message: `${source}: duplicate ${kind} id`,
        });
      }
      result.set(value.id, value);
      return;
    }
    for (const error of toErrors(check.errors as Parameters<typeof toErrors>[0])) {
      diagnostics.push({
        level: 'error',
        source,
        path: error.path,
        message: `${source}: ${error.path} ${error.message}`,
      });
    }
  });
  return result;
}

export function buildCatalog(sources: MusicSources): {
  catalog: MusicCatalog;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const error = (source: string, path: string, message: string) =>
    diagnostics.push({ level: 'error', source, path, message: `${source}: ${message}` });

  const presets = structural('preset', sources.presets, checkPreset, diagnostics);
  const arrangements = structural(
    'arrangement',
    sources.arrangements,
    checkArrangement,
    diagnostics,
  );
  const eras = structural('era', sources.eras, checkEra, diagnostics);
  const motifs = structural('motif', sources.motifs, checkMotif, diagnostics);

  for (const arrangement of arrangements.values()) {
    for (const [role, assignment] of Object.entries(arrangement.roles)) {
      if (assignment && !presets.has(assignment.preset)) {
        error(
          `arrangement ${arrangement.id}`,
          `/roles/${role}/preset`,
          `unknown preset "${assignment.preset}"`,
        );
      }
    }
  }
  for (const era of eras.values()) {
    if (!arrangements.has(era.defaultArrangement)) {
      error(
        `era ${era.id}`,
        '/defaultArrangement',
        `unknown arrangement "${era.defaultArrangement}"`,
      );
    }
    if (era.demoFallbackEra !== undefined && !eras.has(era.demoFallbackEra)) {
      error(`era ${era.id}`, '/demoFallbackEra', `unknown era "${era.demoFallbackEra}"`);
    }
  }
  for (const motif of motifs.values()) {
    if (motif.license === 'CC-BY-4.0' && !motif.attribution) {
      error(`motif ${motif.id}`, '/attribution', 'CC BY material needs attribution');
    }
  }

  const roles = new Set<string>();
  for (const arrangement of arrangements.values())
    for (const role of Object.keys(arrangement.roles)) roles.add(role);

  const patterns: PatternDocument[] = [];
  const seen = new Set<string>();
  sources.patterns.forEach((value, index) => {
    const source = identity('pattern', value, index);
    const result = validatePatternStructure(value);
    if (!result.value) {
      for (const e of result.errors) error(source, e.path, `${e.path} ${e.message}`);
      return;
    }
    const pattern = result.value;
    const before = diagnostics.length;
    const key = `${pattern.id}@${pattern.revision}`;
    if (seen.has(key)) error(source, '/revision', 'duplicate id and revision');
    seen.add(key);
    if (!eras.has(pattern.eraId)) error(source, '/eraId', `unknown era "${pattern.eraId}"`);
    const motif = motifs.get(pattern.motifRef.id);
    if (!motif || motif.revision !== pattern.motifRef.revision) {
      error(
        source,
        '/motifRef',
        `unknown motif ${pattern.motifRef.id}@${pattern.motifRef.revision}`,
      );
    }
    for (const role of Object.keys(pattern.tracks)) {
      if (!roles.has(role))
        error(source, `/tracks/${role}`, `role "${role}" is not used by any arrangement`);
    }
    if (pattern.license === 'CC-BY-4.0' && !pattern.attribution) {
      error(source, '/attribution', 'CC BY material needs attribution');
    }
    if (diagnostics.length === before) patterns.push(pattern);
  });

  return { catalog: { eras, presets, arrangements, motifs, patterns }, diagnostics };
}
