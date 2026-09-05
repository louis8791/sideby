import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { parseRequirementJsonl, validateRequirementDataset } from '../src/model/requirements';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidenceDir = resolve(process.env.PHASE1_EVIDENCE_DIR ?? '.local/phase1');
const requirementsPath = resolve(process.env.PHASE1_REQUIREMENTS_PATH ?? `${evidenceDir}/requirements.jsonl`);
const commitId = z.literal(commit);

const modelManifest = z.strictObject({
  commit: commitId,
  modelName: z.string().min(1), version: z.string().min(1), purpose: z.string().min(1),
  runtime: z.string().min(1), quantization: z.string().min(1), license: z.string().min(1),
  localPath: z.string().min(1), targetHardware: z.string().min(1),
  ranOnTargetHardware: z.literal(true), externalModelApiCalls: z.literal(0),
});
const modelEvaluation = z.strictObject({
  commit: commitId, datasetVersion: z.string().min(1), taxonomyVersion: z.string().min(1),
  baselineName: z.string().min(1), modelName: z.string().min(1), macroF1: z.number().min(0).max(1),
  beatsBaseline: z.literal(true), hardConstraintRegressionCount: z.literal(0),
  testSetFrozenBeforeRun: z.literal(true), perAttribute: z.array(z.strictObject({
    attribute: z.string().min(1), precision: z.number().min(0).max(1),
    recall: z.number().min(0).max(1), f1: z.number().min(0).max(1), support: z.number().int().min(1),
  })).min(4),
});
const retrievalEvaluation = z.strictObject({
  commit: commitId, datasetVersion: z.string().min(1), indexVersion: z.string().min(1),
  embeddingModel: z.string().min(1), productionVenueCount: z.number().int().min(12),
  queryCount: z.number().int().min(1), k: z.number().int().min(1), recallAtK: z.number().min(0).max(1),
  meetsPredeclaredTarget: z.literal(true), sourceViolations: z.literal(0),
  googleDerivedRecords: z.literal(0), externalApiCalls: z.literal(0),
});
const twoBrowserRuntime = z.strictObject({
  commit: commitId, testedAt: z.iso.datetime({ offset: true }), recordedBy: z.string().min(1),
  browsers: z.array(z.string().min(1)).min(2), sameRoomJoined: z.literal(true),
  sharedStateSynchronized: z.literal(true), privateDataLeakCount: z.literal(0),
  evidenceRefs: z.array(z.string().min(1)).min(1),
});

type Gate = { gate: string; status: 'PASS' | 'BLOCKED'; evidence: string };
const gates: Gate[] = [];

async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}

async function jsonGate(gate: string, file: string, schema: z.ZodType) {
  const path = resolve(evidenceDir, file);
  if (!(await exists(path))) {
    gates.push({ gate, status: 'BLOCKED', evidence: `missing ${path}` });
    return;
  }
  try {
    schema.parse(JSON.parse(await readFile(path, 'utf8')));
    gates.push({ gate, status: 'PASS', evidence: path });
  } catch (error) {
    gates.push({ gate, status: 'BLOCKED', evidence: `${path}: ${error instanceof Error ? error.message : 'invalid JSON'}` });
  }
}

async function main() {
  const required = [
    'AGENTS.md', 'PRD.md', 'TDD.md', 'ROADMAP.md',
    'schemas/preference-query.schema.json', 'schemas/itinerary.schema.json', 'schemas/venue-record.schema.json',
  ];
  const missing = [];
  for (const file of required) if (!(await exists(resolve(file)))) missing.push(file);
  gates.push({
    gate: '1.0_contracts', status: missing.length ? 'BLOCKED' : 'PASS',
    evidence: missing.length ? `missing ${missing.join(', ')}` : required.join(', '),
  });

  if (!(await exists(requirementsPath))) {
    gates.push({ gate: '1A_requirements', status: 'BLOCKED', evidence: `missing ${requirementsPath}` });
  } else {
    const parsed = parseRequirementJsonl(await readFile(requirementsPath, 'utf8'));
    const dataset = validateRequirementDataset(parsed.samples);
    const errors = [...parsed.errors, ...dataset.errors];
    gates.push({
      gate: '1A_requirements', status: errors.length ? 'BLOCKED' : 'PASS',
      evidence: errors.length ? errors.join('; ') : `${requirementsPath}; ${dataset.samples} samples; ${dataset.groups} groups`,
    });
  }

  await jsonGate('1A_model_runtime', 'model-manifest.json', modelManifest);
  await jsonGate('1A_model_evaluation', 'model-evaluation.json', modelEvaluation);
  await jsonGate('1A_rag_retrieval', 'retrieval-evaluation.json', retrievalEvaluation);
  await jsonGate('1B_two_browser_runtime', 'two-browser-runtime.json', twoBrowserRuntime);

  const status = gates.every(gate => gate.status === 'PASS') ? 'READY_FOR_CC_REVIEW' : 'NOT_READY';
  console.log(JSON.stringify({ status, commit, evidenceDir, gates }, null, 2));
  if (status !== 'READY_FOR_CC_REVIEW') process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Phase 1 readiness check failed');
  process.exitCode = 1;
});
