import { demoRng } from './rng';
import type { Genome } from './genome';

export const pick = (g: Genome) => demoRng(g.palette).f();
