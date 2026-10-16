/** Review documents: a human decision about one exact pattern version. Never stored in a pattern. */
import reviewSchema from '../../../music/schemas/review.schema.json';
import type { ReviewDocument } from '../data/patterns.generated';
import { compileSchema, toErrors, type StructuralResult } from './schema';

const checkReview = compileSchema<ReviewDocument>(reviewSchema);

export function validateReview(value: unknown): StructuralResult<ReviewDocument> {
  if (checkReview(value)) return { value, errors: [] };
  return { value: null, errors: toErrors(checkReview.errors) };
}
