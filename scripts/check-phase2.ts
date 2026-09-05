import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidenceDir = resolve(process.env.PHASE2_EVIDENCE_DIR ?? '.local/phase2');
const commitId = z.literal(commit);
const twoBrowserPrivacy = z.strictObject({
  commit: commitId,
  recordedBy: z.string().min(1),
  testedAt: z.iso.datetime({ offset: true }),
  browsers: z.array(z.string().min(1)).min(2),
  partnerCannotReadRawInput: z.literal(true),
  sharedStateLeakCount: z.literal(0),
  realtimeLeakCount: z.literal(0),
  serverLogLeakCount: z.literal(0),
  rememberedConsentWithdrawalVerified: z.literal(true),
  evidenceRefs: z.array(z.string().min(1)).min(1),
});

type Gate = { gate: string; status: 'PASS' | 'BLOCKED' | 'DEFERRED'; evidence: string };
const gates: Gate[] = [];
async function exists(path: string) {
  try { await access(path); return true; } catch { return false; }
}
async function jsonGate(gate: string, file: string, schema: z.ZodType) {
  const path = resolve(evidenceDir, file);
  if (!(await exists(path))) return gates.push({ gate, status: 'BLOCKED', evidence: `missing ${path}` });
  try {
    schema.parse(JSON.parse(await readFile(path, 'utf8')));
    gates.push({ gate, status: 'PASS', evidence: path });
  } catch (error) {
    gates.push({ gate, status: 'BLOCKED', evidence: `${path}: ${error instanceof Error ? error.message : 'invalid JSON'}` });
  }
}

async function main() {
  const required = [
    'db/003_private_inputs.sql', 'src/server/private-inputs.ts', 'src/model/preference-query.ts',
    'src/server/privacy.ts', 'tests/privacy-parser.test.ts', 'docs/PHASE2_ACCEPTANCE.md',
  ];
  const missing = [];
  for (const file of required) if (!(await exists(resolve(file)))) missing.push(file);
  gates.push({
    gate: '2_private_storage_parser_guard', status: missing.length ? 'BLOCKED' : 'PASS',
    evidence: missing.length ? `missing ${missing.join(', ')}` : required.join(', '),
  });
  gates.push({
    gate: '2_rag_integration', status: 'DEFERRED',
    evidence: 'Venue RAG is outside the current hackathon Phase 1/2 acceptance cut and is not claimed as implemented.',
  });
  await jsonGate('2_two_browser_privacy', 'two-browser-privacy.json', twoBrowserPrivacy);
  const status = gates.every(gate => gate.status !== 'BLOCKED') ? 'READY_FOR_CC_REVIEW' : 'NOT_READY';
  console.log(JSON.stringify({ status, commit, evidenceDir, gates }, null, 2));
  if (status !== 'READY_FOR_CC_REVIEW') process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Phase 2 readiness check failed');
  process.exitCode = 1;
});
