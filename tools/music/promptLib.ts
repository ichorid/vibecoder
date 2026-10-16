/** `music:prompt` logic: a template + the shared feedback formatter over repository data. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildCatalog } from '../../src/music/core/catalog';
import { contentHash } from '../../src/music/hash';
import { formatFeedbackPrompt } from '../../src/music-lab/feedback';
import type { Result } from '../../src/music-lab/reviews';
import { readReviews } from './packLib';
import { readRepository } from './sources';

export interface PromptOptions {
  readonly root: string;
  readonly era: string;
  readonly template?: 'era' | 'lead';
}

export async function generatePrompt(options: PromptOptions): Promise<Result<string>> {
  const { catalog } = buildCatalog(readRepository(options.root));
  if (!catalog.eras.has(options.era)) {
    return {
      ok: false,
      error: `unknown era "${options.era}" (known: ${[...catalog.eras.keys()].sort().join(', ')})`,
    };
  }
  const errors: string[] = [];
  const reviews = readReviews(options.root, errors);
  if (errors.length > 0) return { ok: false, error: errors.join('\n') };
  const approved = [];
  const requested = [];
  for (const pattern of catalog.patterns.filter((p) => p.eraId === options.era)) {
    const hash = await contentHash(pattern, catalog);
    const record = reviews.find(
      (r) =>
        r.patternId === pattern.id && r.revision === pattern.revision && r.contentHash === hash,
    );
    if (record?.status === 'approved') {
      approved.push({
        key: `${pattern.id}@${pattern.revision}`,
        hash,
        rating: record.rating ?? null,
      });
    } else if (record && (record.status === 'revise' || record.status === 'rejected')) {
      requested.push({
        pattern,
        hash,
        review: {
          status: record.status,
          rating: record.rating ?? null,
          ...(record.feedback ? { feedback: record.feedback } : {}),
        },
      });
    }
  }
  const template = options.template ?? 'era';
  const preamble = readFileSync(
    path.join(options.root, 'composer-prompts', `${template}-composer.md`),
    'utf8',
  ).replace(/^<!--.*?-->\s*/s, '');
  return formatFeedbackPrompt({
    eraId: options.era,
    catalog,
    schemaText: readFileSync(path.join(options.root, 'PATTERN_SCHEMA.json'), 'utf8'),
    approved,
    requested,
    preamble,
    scope: template,
  });
}
