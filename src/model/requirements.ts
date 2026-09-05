import { z } from 'zod';

export const requirementAttributes = [
  'bright', 'quiet', 'cute', 'childish', 'interactive', 'walking',
] as const;

const id = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const shortText = z.string().trim().min(1).max(500)
  .refine(value => !/[\u0000-\u001f\u007f]/u.test(value));

const annotation = z.strictObject({
  attribute: z.enum(requirementAttributes),
  direction: z.enum(['prefer', 'avoid', 'indifferent', 'not_mentioned']),
  degree: z.enum(['low', 'medium', 'high', 'unspecified']),
  evidenceText: z.string().trim().min(1).max(120).nullable(),
});

export const requirementSampleSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  sampleId: id,
  text: shortText,
  groupId: id,
  sourceType: z.enum(['owner_authored', 'consented_interview', 'synthetic_candidate']),
  sourceRef: id,
  annotations: z.array(annotation).min(1).max(requirementAttributes.length)
    .refine(items => new Set(items.map(item => item.attribute)).size === items.length),
  expectedConstraints: z.array(z.strictObject({
    kind: z.enum(['budget', 'time', 'transport', 'walking', 'dietary', 'accessibility', 'hard_no']),
    value: z.string().trim().min(1).max(120),
  })).max(12),
  needsClarification: z.boolean(),
  clarificationReason: z.string().trim().min(1).max(240).nullable(),
  reviewer: id.nullable(),
  reviewStatus: z.enum(['pending', 'approved', 'disputed']),
  split: z.enum(['unassigned', 'train', 'validation', 'test']),
  taxonomyVersion: id,
  datasetVersion: id,
}).superRefine((sample, context) => {
  if (sample.reviewStatus !== 'approved' && sample.split !== 'unassigned') {
    context.addIssue({ code: 'custom', message: 'Only approved samples may enter a split', path: ['split'] });
  }
  if (sample.reviewStatus === 'approved' && !sample.reviewer) {
    context.addIssue({ code: 'custom', message: 'Approved samples require a reviewer', path: ['reviewer'] });
  }
  if (sample.needsClarification !== Boolean(sample.clarificationReason)) {
    context.addIssue({ code: 'custom', message: 'Clarification flag and reason must agree', path: ['clarificationReason'] });
  }
  sample.annotations.forEach((item, index) => {
    if (item.direction === 'not_mentioned' && item.evidenceText !== null) {
      context.addIssue({ code: 'custom', message: 'not_mentioned must not cite text', path: ['annotations', index, 'evidenceText'] });
    }
    if (item.direction !== 'not_mentioned' && (!item.evidenceText || !sample.text.includes(item.evidenceText))) {
      context.addIssue({ code: 'custom', message: 'Evidence must be an exact substring', path: ['annotations', index, 'evidenceText'] });
    }
  });
});

export type RequirementSample = z.infer<typeof requirementSampleSchema>;

export function validateRequirementDataset(samples: RequirementSample[]) {
  const errors: string[] = [];
  const sampleIds = new Set<string>();
  const groupSplits = new Map<string, string>();
  const datasetVersions = new Set(samples.map(sample => sample.datasetVersion));
  const taxonomyVersions = new Set(samples.map(sample => sample.taxonomyVersion));
  const splitCounts = { train: 0, validation: 0, test: 0 };

  for (const sample of samples) {
    if (sampleIds.has(sample.sampleId)) errors.push(`duplicate sampleId: ${sample.sampleId}`);
    sampleIds.add(sample.sampleId);
    if (sample.reviewStatus !== 'approved' || sample.split === 'unassigned') continue;
    splitCounts[sample.split] += 1;
    const previous = groupSplits.get(sample.groupId);
    if (previous && previous !== sample.split) errors.push(`group split leakage: ${sample.groupId}`);
    groupSplits.set(sample.groupId, sample.split);
  }
  if (datasetVersions.size !== 1) errors.push('dataset must use exactly one datasetVersion');
  if (taxonomyVersions.size !== 1) errors.push('dataset must use exactly one taxonomyVersion');
  for (const [split, count] of Object.entries(splitCounts)) {
    if (count === 0) errors.push(`approved ${split} split is empty`);
  }
  return { errors, splitCounts, samples: samples.length, groups: groupSplits.size };
}

export function parseRequirementJsonl(source: string) {
  const samples: RequirementSample[] = [];
  const errors: string[] = [];
  source.split(/\r?\n/u).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      samples.push(requirementSampleSchema.parse(JSON.parse(line)));
    } catch (error) {
      errors.push(`line ${index + 1}: ${error instanceof Error ? error.message : 'invalid sample'}`);
    }
  });
  if (!samples.length) errors.push('dataset has no valid samples');
  return { samples, errors };
}
