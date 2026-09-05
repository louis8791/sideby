import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';
import { parseRequirementJsonl, validateRequirementDataset } from '../src/model/requirements';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidenceDir = resolve(process.env.PHASE1_EVIDENCE_DIR ?? '.local/phase1');
const requirementsPath = resolve(process.env.PHASE1_REQUIREMENTS_PATH ?? 'data/training/requirements.hackathon.jsonl');
const commitId = z.literal(commit);

const twoBrowserRuntime = z.strictObject({
  commit: commitId, testedAt: z.iso.datetime({ offset: true }), recordedBy: z.string().min(1),
  browsers: z.array(z.string().min(1)).min(2), sameRoomJoined: z.literal(true),
  sharedStateSynchronized: z.literal(true), privateDataLeakCount: z.literal(0),
  evidenceRefs: z.array(z.string().min(1)).min(1),
});

type Gate = { gate: string; status: 'PASS' | 'BLOCKED' | 'DEFERRED'; evidence: string };
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

  gates.push({
    gate: '1A_model_runtime_evaluation', status: 'DEFERRED',
    evidence: 'Hackathon demo uses rule_baseline_v1; trained/self-hosted model evaluation is outside the current Phase 1/2 acceptance cut.',
  });
  gates.push({
    gate: '1A_rag_retrieval', status: 'DEFERRED',
    evidence: 'Venue RAG remains a later Roadmap work item and is not claimed as implemented.',
  });
  await jsonGate('1B_two_browser_runtime', 'two-browser-runtime.json', twoBrowserRuntime);

  const status = gates.every(gate => gate.status !== 'BLOCKED') ? 'READY_FOR_CC_REVIEW' : 'NOT_READY';
  console.log(JSON.stringify({ status, commit, evidenceDir, gates }, null, 2));
  if (status !== 'READY_FOR_CC_REVIEW') process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Phase 1 readiness check failed');
  process.exitCode = 1;
});
