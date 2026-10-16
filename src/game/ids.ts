/**
 * Stable content ID tuples. Domain types derive literal unions from these so game code never
 * imports content implementations. Extend a tuple when content with that ID is introduced.
 */
export const TECHNOLOGY_IDS = [] as const;
export type TechnologyId = (typeof TECHNOLOGY_IDS)[number];
