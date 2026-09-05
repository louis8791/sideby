import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

const sourceFiles = ['app/page.tsx', 'app/globals.css', 'app/layout.tsx', 'src/venues/maps.ts'];
const requiredFiles = [
  ...sourceFiles, 'scripts/seed-demo.ts', 'tests/phase7-ui.test.ts', 'docs/PHASE7_ACCEPTANCE.md',
];
const evidenceDir = resolve('.local/phase7');
const gates: Array<{ gate: string; status: 'PASS' | 'BLOCKED'; evidence: string }> = [];

async function sourceFingerprint() {
  const hash = createHash('sha256');
  for (const file of sourceFiles) hash.update(file).update('\0').update(await readFile(resolve(file)));
  return hash.digest('hex');
}

async function filesGate() {
  try {
    await Promise.all(requiredFiles.map(file => stat(resolve(file))));
    gates.push({ gate: '7_mobile_ui_and_honest_states', status: 'PASS', evidence: requiredFiles.join(', ') });
  } catch {
    gates.push({ gate: '7_mobile_ui_and_honest_states', status: 'BLOCKED', evidence: 'required Phase 7 source, test or acceptance file is missing' });
  }
}

async function evidenceGate(name: string, file: string, schema: z.ZodType, fingerprint?: string) {
  const path = resolve(evidenceDir, file);
  try {
    const value = schema.parse(JSON.parse(await readFile(path, 'utf8'))) as { sourceFingerprint?: string };
    if (fingerprint && value.sourceFingerprint !== fingerprint) throw new Error('source fingerprint mismatch');
    gates.push({ gate: name, status: 'PASS', evidence: path });
  } catch (error) {
    gates.push({ gate: name, status: 'BLOCKED', evidence: `${path}: ${error instanceof Error ? error.message : 'invalid evidence'}` });
  }
}

async function main() {
  await filesGate();
  const fingerprint = await sourceFingerprint();
  await evidenceGate('7_browser_390_1280_runtime', 'browser-runtime.json', z.strictObject({
    sourceFingerprint: z.string().length(64), syntheticDemo: z.literal(true),
    viewports: z.array(z.number().int()).length(2).refine(value => value.includes(390) && value.includes(1280)),
    horizontalOverflowFailures: z.literal(0), consoleErrors: z.literal(0),
    mainFlowThroughFeedback: z.literal(true), privateLeakFindings: z.literal(0),
    mapsWithPlaceId: z.literal(true), mapsWithoutPlaceId: z.literal(true), mapsApiKeys: z.literal(0),
    externalFailurePreservedResults: z.literal(true), externalUnavailableShown: z.literal(true),
    checkedAt: z.iso.datetime({ offset: true }), notes: z.string().max(1000),
  }), fingerprint);
  await evidenceGate('7_owner_two_real_phones', 'owner-mobile.json', z.strictObject({
    sourceFingerprint: z.string().length(64), phones: z.literal(2), accepted: z.literal(true),
    reviewer: z.string().trim().min(1), reviewedAt: z.iso.datetime({ offset: true }), notes: z.string().max(1000),
  }), fingerprint);

  const status = gates.every(gate => gate.status === 'PASS') ? 'READY_FOR_OWNER_REVIEW' : 'NOT_READY';
  console.log(JSON.stringify({ status, sourceFingerprint: fingerprint, evidenceDir, gates }, null, 2));
  if (status !== 'READY_FOR_OWNER_REVIEW') process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Phase 7 readiness check failed');
  process.exitCode = 1;
});
