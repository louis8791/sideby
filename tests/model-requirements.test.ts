import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  parseRequirementJsonl, requirementSampleSchema, validateRequirementDataset,
} from '../src/model/requirements';

test('the synthetic requirements template is valid and group-safe', async () => {
  const parsed = parseRequirementJsonl(await readFile('data/training/requirements.example.jsonl', 'utf8'));
  assert.deepEqual(parsed.errors, []);
  const result = validateRequirementDataset(parsed.samples);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.splitCounts, { train: 2, validation: 2, test: 2 });
});

test('a rewritten group cannot leak across train and test', () => {
  const base = requirementSampleSchema.parse({
    schemaVersion: '1.0', sampleId: 'sample_1', text: '想要明亮。', groupId: 'same_group',
    sourceType: 'owner_authored', sourceRef: 'owner_batch_1',
    annotations: [{ attribute: 'bright', direction: 'prefer', degree: 'high', evidenceText: '明亮' }],
    expectedConstraints: [], needsClarification: false, clarificationReason: null,
    reviewer: 'reviewer_1', reviewStatus: 'approved', split: 'train',
    taxonomyVersion: 'adjective_v1', datasetVersion: 'dataset_v1',
  });
  const result = validateRequirementDataset([
    base,
    { ...base, sampleId: 'sample_2', text: '希望採光好。', split: 'test' },
    { ...base, sampleId: 'sample_3', groupId: 'validation_group', split: 'validation' },
  ]);
  assert.ok(result.errors.includes('group split leakage: same_group'));
});

test('unreviewed labels and invented evidence are rejected', () => {
  const input = {
    schemaVersion: '1.0', sampleId: 'sample_bad', text: '想去咖啡廳。', groupId: 'group_bad',
    sourceType: 'synthetic_candidate', sourceRef: 'candidate_bad',
    annotations: [{ attribute: 'quiet', direction: 'prefer', degree: 'high', evidenceText: '很安靜' }],
    expectedConstraints: [], needsClarification: false, clarificationReason: null,
    reviewer: null, reviewStatus: 'pending', split: 'train',
    taxonomyVersion: 'adjective_v1', datasetVersion: 'dataset_v1',
  };
  assert.equal(requirementSampleSchema.safeParse(input).success, false);
});
