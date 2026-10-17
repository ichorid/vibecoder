import type { ProjectKey, ProjectProgress } from './types';

/** The project map without `key` (its code was consumed). */
export function withoutProject(
  projects: Readonly<Partial<Record<ProjectKey, ProjectProgress>>>,
  key: ProjectKey,
): Partial<Record<ProjectKey, ProjectProgress>> {
  const next = { ...projects };
  delete next[key];
  return next;
}
