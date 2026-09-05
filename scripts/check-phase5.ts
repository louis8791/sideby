import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { z } from 'zod';

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const evidenceDir = resolve('.local/phase5');
const gates: Array<{ gate: string; status: 'PASS' | 'BLOCKED'; evidence: string }> = [];

async function filesGate() {
  const files = [
    'db/004_itineraries.sql', 'src/recommendations/engine.ts', 'src/server/itineraries.ts',
    'tests/recommendations.test.ts', 'docs/PHASE5_ACCEPTANCE.md',
  ];
  try {
    await Promise.all(files.map(file => stat(resolve(file))));
    gates.push({ gate: '5_engine_api', status: 'PASS', evidence: files.join(', ') });
  } catch {
    gates.push({ gate: '5_engine_api', status: 'BLOCKED', evidence: 'required Phase 5 source or acceptance file is missing' });
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
  await evidenceGate('5_real_venue_route_data', 'real-venue-route.json', z.strictObject({
    commit: z.string().length(40), synthetic: z.literal(false), approvedRealVenues: z.number().int().min(12),
    datasetVersion: z.string().min(1), routeMatrixVersion: z.string().min(1),
    sourceRightsViolations: z.literal(0), unknownRequiredFacts: z.literal(0), googleDerivedFields: z.literal(0),
  }));
  await evidenceGate('5_rag_candidate_retrieval', 'rag-retrieval.json', z.strictObject({
    commit: z.string().length(40), queries: z.number().int().min(4), recallAtK: z.number().min(0).max(1),
    requiredRecallAtK: z.number().min(0).max(1), passedThreshold: z.literal(true),
    privateIndexMatches: z.literal(0), promptInjectionFailures: z.literal(0), externalModelApiCalls: z.literal(0),
  }));
  await evidenceGate('5_three_itinerary_runtime', 'three-itinerary-runtime.json', z.strictObject({
    commit: z.string().length(40), cases: z.number().int().min(3), itinerariesPerCase: z.literal(3),
    hardConstraintViolations: z.literal(0), diversityFailures: z.literal(0), privacyLeaks: z.literal(0),
    sponsoredScoreChanges: z.literal(0), externalModelApiCalls: z.literal(0), p95Milliseconds: z.number().nonnegative(),
  }));

  const status = gates.every(gate => gate.status === 'PASS') ? 'READY_FOR_CC_REVIEW' : 'NOT_READY';
  console.log(JSON.stringify({ status, commit, evidenceDir, gates }, null, 2));
  if (status !== 'READY_FOR_CC_REVIEW') process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Phase 5 readiness check failed');
  process.exitCode = 1;
});
