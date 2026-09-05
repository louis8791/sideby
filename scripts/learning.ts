import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAndActivateVenueRecommendationIndex, collectRankingPreferenceCandidates,
  exportRankingPreferenceDataset, exportRequirementDataset, reviewLearningCandidate,
  revokeLearningCandidatesForUser, submitRequirementCandidate, withLearningTransaction,
} from '../src/server/learning';

const [command, ...args] = process.argv.slice(2);
const option = (name: string) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const required = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const privateOutputRoot = resolve(repositoryRoot, '.local');

function privateOutput(raw: string) {
  const output = resolve(repositoryRoot, raw);
  const fromPrivateRoot = relative(privateOutputRoot, output);
  if (!fromPrivateRoot || fromPrivateRoot.startsWith('..') || isAbsolute(fromPrivateRoot)) {
    throw new Error('Export output must be a file under E:\\sideby\\.local');
  }
  return output;
}

async function main() {
  if (command === 'collect-ranking') {
    console.log(JSON.stringify(await withLearningTransaction(collectRankingPreferenceCandidates)));
    return;
  }
  if (command === 'submit-requirement') {
    const input = JSON.parse(await readFile(resolve(required('input')), 'utf8'));
    console.log(JSON.stringify(await withLearningTransaction(client => submitRequirementCandidate(client, input))));
    return;
  }
  if (command === 'review') {
    await withLearningTransaction(client => reviewLearningCandidate(client, {
      candidateId: required('candidate'), reviewer: required('reviewer'),
      decision: required('decision') as 'approved' | 'rejected' | 'disputed',
      split: (option('split') ?? 'unassigned') as 'unassigned' | 'train' | 'validation' | 'test',
    }));
    console.log(JSON.stringify({ status: 'reviewed' }));
    return;
  }
  if (command === 'export-requirements') {
    const output = privateOutput(required('output'));
    const result = await withLearningTransaction(client => exportRequirementDataset(
      client, required('version'), required('taxonomy'),
    ));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, result.jsonl, { flag: 'wx' });
    console.log(JSON.stringify({ status: 'exported', version: result.version, count: result.count, sha256: result.sha256, output }));
    return;
  }
  if (command === 'export-ranking') {
    const output = privateOutput(required('output'));
    const result = await withLearningTransaction(client => exportRankingPreferenceDataset(client, required('version')));
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, result.json, { flag: 'wx' });
    console.log(JSON.stringify({ status: 'exported', corpusKind: 'ranking_preference_events_not_text_classification',
      version: result.version, count: result.count, sha256: result.sha256, output }));
    return;
  }
  if (command === 'revoke-user') {
    console.log(JSON.stringify(await withLearningTransaction(client => revokeLearningCandidatesForUser(client, required('user')))));
    return;
  }
  if (command === 'build-venue-index') {
    console.log(JSON.stringify(await buildAndActivateVenueRecommendationIndex(required('version'))));
    return;
  }
  throw new Error('Usage: learning.ts collect-ranking | submit-requirement | review | export-requirements | export-ranking | revoke-user | build-venue-index');
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
void main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Learning command failed');
  process.exitCode = 1;
});
