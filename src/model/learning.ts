import { z } from 'zod';
import { requirementSampleSchema } from './requirements';

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);

export const requirementCandidateInput = z.strictObject({
  userId: z.uuid(),
  sourceFeedbackId: z.uuid(),
  correctedText: z.string().trim().min(1).max(500)
    .refine(value => !/[\u0000-\u001f\u007f]/u.test(value)),
  annotations: requirementSampleSchema.shape.annotations,
  expectedConstraints: requirementSampleSchema.shape.expectedConstraints,
  needsClarification: z.boolean(),
  clarificationReason: z.string().trim().min(1).max(240).nullable(),
  deidentifiedBy: id,
  taxonomyVersion: id,
}).superRefine((value, context) => {
  if (value.needsClarification !== Boolean(value.clarificationReason)) {
    context.addIssue({ code: 'custom', message: 'Clarification flag and reason must agree', path: ['clarificationReason'] });
  }
  value.annotations.forEach((annotation, index) => {
    if (annotation.direction === 'not_mentioned' && annotation.evidenceText !== null) {
      context.addIssue({ code: 'custom', message: 'not_mentioned must not cite text', path: ['annotations', index, 'evidenceText'] });
    }
    if (annotation.direction !== 'not_mentioned'
      && (!annotation.evidenceText || !value.correctedText.includes(annotation.evidenceText))) {
      context.addIssue({ code: 'custom', message: 'Evidence must be an exact substring', path: ['annotations', index, 'evidenceText'] });
    }
  });
});

export const learningReviewInput = z.strictObject({
  candidateId: z.uuid(),
  reviewer: id,
  decision: z.enum(['approved', 'rejected', 'disputed']),
  split: z.enum(['unassigned', 'train', 'validation', 'test']),
}).superRefine((value, context) => {
  if (value.decision !== 'approved' && value.split !== 'unassigned') {
    context.addIssue({ code: 'custom', message: 'Only approved candidates may enter a split', path: ['split'] });
  }
});

export const learningVersion = id;
export type RequirementCandidateInput = z.infer<typeof requirementCandidateInput>;
export type LearningReviewInput = z.infer<typeof learningReviewInput>;
