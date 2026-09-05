import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidenceDir = resolve('.local/phase6');
const gates: Array<{ gate: string; status: 'PASS' | 'BLOCKED'; evidence: string }> = [];

async function filesGate() {
  const files = [
    'db/005_replan_finalize.sql', 'db/006_preference_learning.sql', 'db/007_preference_event_retention.sql', 'src/recommendations/engine.ts',
    'src/model/preference-learning.ts', 'src/server/itineraries.ts', 'app/page.tsx',
    'tests/recommendations.test.ts', 'tests/backend.test.ts', 'docs/PHASE6_ACCEPTANCE.md',
  ];
  try {
    await Promise.all(files.map(file => stat(resolve(file))));
    gates.push({ gate: '6_reaction_replan_finalize_api', status: 'PASS', evidence: files.join(', ') });
  } catch {
    gates.push({ gate: '6_reaction_replan_finalize_api', status: 'BLOCKED', evidence: 'required Phase 6 source, test or acceptance file is missing' });
  }
}

async function evidenceGate(name: string, file: string, schema: z.ZodType) {
  const path = resolve(evidenceDir, file);
  try {
    const value = schema.parse(JSON.parse(await readFile(path, 'utf8')));
    if ((value as { commit: string }).commit !== commit) throw new Error('commit mismatch');
    gates.push({ gate: name, status: 'PASS', evidence: path });
  } catch (error) {
    gates.push({ gate: name, status: 'BLOCKED', evidence: `${path}: ${error instanceof Error ? error.message : 'invalid evidence'}` });
  }
}

async function main() {
  await filesGate();
  await evidenceGate('6_two_browser_runtime', 'two-browser-replan.json', z.strictObject({
    commit: z.string().length(40), browsers: z.literal(2), cases: z.number().int().min(3),
    lockedStopChanges: z.literal(0), hardConstraintViolations: z.literal(0), privacyLeaks: z.literal(0),
    nonmemberAccessLeaks: z.literal(0), staleVersionAccepted: z.literal(0), externalModelApiCalls: z.literal(0),
  }));
  await evidenceGate('6_owner_acceptance', 'owner-acceptance.json', z.strictObject({
    commit: z.string().length(40), accepted: z.literal(true), reviewer: z.string().trim().min(1),
    reviewedAt: z.iso.datetime({ offset: true }), notes: z.string().max(1000),
  }));

  const status = gates.every(gate => gate.status === 'PASS') ? 'READY_FOR_OWNER_REVIEW' : 'NOT_READY';
  console.log(JSON.stringify({ status, commit, evidenceDir, gates }, null, 2));
  if (status !== 'READY_FOR_OWNER_REVIEW') process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Phase 6 readiness check failed');
  process.exitCode = 1;
});
