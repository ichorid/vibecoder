/**
 * Release content check (`npm run check:release-content`): structural validity is not enough
 * for a release — every one of the 28 milestones needs its own real illustration, its world
 * addition, a growing framing envelope and placements that use real atlas tags inside it.
 * Visual distinctness still needs a human review; this only rejects what can be proven wrong.
 */
import { createHash } from 'node:crypto';
import type { AssetManifest } from '../src/content/assets';
import type { AtlasData } from '../src/content/atlas';
import type { WorldAddition } from '../src/content/world';
import type { Catalog } from '../src/game/catalog';
import type { AssetFiles } from './validateAssets';
import { validateAssets } from './validateAssets';

export interface ReleaseInput {
  readonly catalog: Catalog;
  readonly assets: AssetManifest;
  readonly worldAdditions: readonly WorldAddition[];
  readonly files: AssetFiles & { readBytes(file: string): Uint8Array | null };
  readonly requiredTechnologies: number;
  /** Concatenated text of the ending route scenarios (each ending must be exercised). */
  readonly scenarioText: string;
  readonly requiredEndings: number;
}

function contains(outer: WorldAddition['envelope'], inner: WorldAddition['envelope']): boolean {
  return (
    outer.x <= inner.x &&
    outer.y <= inner.y &&
    outer.x + outer.w >= inner.x + inner.w &&
    outer.y + outer.h >= inner.y + inner.h
  );
}

export function validateRelease(input: ReleaseInput): string[] {
  const { catalog, assets, worldAdditions, files } = input;
  const problems = validateAssets(assets, files);

  if (catalog.technologies.length < input.requiredTechnologies) {
    problems.push(
      `catalog has ${catalog.technologies.length} technologies, release needs ${input.requiredTechnologies}`,
    );
  }

  // Real, unique art for every technology and both memorial photos.
  const hashes = new Map<string, string>();
  for (const technology of catalog.technologies) {
    const asset = assets.illustrations.find((a) => a.id === technology.illustrationId);
    if (!asset) {
      problems.push(`${technology.id}: no illustration entry`);
      continue;
    }
    if (asset.placeholder)
      problems.push(`${technology.id}: illustration is a declared placeholder`);
    const bytes = files.readBytes(asset.file);
    if (!bytes) continue;
    const hash = createHash('sha256').update(bytes).digest('hex');
    const twin = hashes.get(hash);
    if (twin) problems.push(`${technology.id}: illustration identical to ${twin} (duplicate PNG)`);
    hashes.set(hash, technology.id);
  }
  if (assets.memorial.length !== 2)
    problems.push(`memorial needs exactly two photos, has ${assets.memorial.length}`);

  // Scene: one addition per technology, growing envelopes, real tags, placements inside.
  const atlasText = files.readText(assets.atlases.light);
  const atlas = atlasText ? (JSON.parse(atlasText) as AtlasData) : null;
  let previous: WorldAddition['envelope'] | null = null;
  for (const technology of catalog.technologies) {
    const addition = worldAdditions.find((a) => a.id === technology.worldAdditionId);
    if (!addition || addition.technologyId !== technology.id) {
      problems.push(`${technology.id}: missing scene addition "${technology.worldAdditionId}"`);
      continue;
    }
    const env = addition.envelope;
    if (previous && !(contains(env, previous) && env.w * env.h > previous.w * previous.h)) {
      problems.push(`${technology.id}: framing envelope does not strictly expand`);
    }
    previous = env;
    for (const placement of addition.placements) {
      const animation = atlas?.animations[placement.sprite];
      const frame = animation ? atlas?.frames[animation.frames[0] ?? ''] : undefined;
      if (!frame) {
        problems.push(`${addition.id}: unknown atlas tag "${placement.sprite}"`);
        continue;
      }
      const scale = placement.scale ?? 1;
      const rect = { x: placement.x, y: placement.y, w: frame.w * scale, h: frame.h * scale };
      if (!contains(env, rect))
        problems.push(`${addition.id}: placement ${placement.sprite} lies outside its envelope`);
    }
    if (!atlas?.animations[addition.lodSprite])
      problems.push(`${addition.id}: unknown LOD tag "${addition.lodSprite}"`);
  }
  // Endings: enough reachable ones (legacy endings only stay for old profiles), each reached by
  // a choice, a rule, the release jackpot or the landlord, each with a route scenario and every
  // cat fate.
  const reachableEndings = catalog.endings.filter((e) => !e.legacy);
  if (reachableEndings.length < input.requiredEndings) {
    problems.push(
      `catalog has ${reachableEndings.length} endings, release needs ${input.requiredEndings}`,
    );
  }
  for (const ending of catalog.endings) {
    if (ending.text.alive.length === 0 || ending.text.dead.length === 0) {
      problems.push(`ending ${ending.id}: needs text for both fates of the cat`);
    }
    if (ending.text.stray.length === 0) problems.push(`ending ${ending.id}: needs stray text`);
    if (ending.illustrationId) {
      for (const id of [
        `ending-${ending.illustrationId}`,
        `ending-${ending.illustrationId}-nocat`,
      ]) {
        const asset = assets.illustrations.find((a) => a.id === id);
        if (!asset || !files.readBytes(asset.file)) {
          problems.push(`ending ${ending.id}: missing picture "${id}"`);
        }
      }
    }
    if (ending.legacy) continue;
    const reachable =
      ending.automatic !== undefined ||
      catalog.choices.some((c) => c.ends === ending.id) ||
      (ending.jackpot === true && catalog.releases.jackpotEnding === ending.id) ||
      catalog.money.evictionEnding === ending.id;
    if (!reachable) problems.push(`ending ${ending.id}: no choice or rule leads to it`);
    if (!input.scenarioText.includes(`'${ending.id}'`)) {
      problems.push(`ending ${ending.id}: no route scenario references it`);
    }
  }
  const last = worldAdditions.find((a) => a.final);
  if (!last) problems.push('no final framing addition');
  return problems;
}
