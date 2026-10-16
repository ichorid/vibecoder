/**
 * If there is no cat (dead or a stray), there is no cat: texts that mention it have a version
 * for its absence, chosen by whether the cat is around.
 */
import type { CatAwareText } from './catalog';

export function catAware(text: CatAwareText, catAlive: boolean): string {
  return typeof text === 'string' ? text : catAlive ? text.alive : text.absent;
}
