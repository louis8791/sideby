import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseRequirementJsonl, validateRequirementDataset } from '../src/model/requirements';

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run requirements:validate -- <requirements.jsonl>');

async function main() {
  const parsed = parseRequirementJsonl(await readFile(resolve(input), 'utf8'));
  const result = validateRequirementDataset(parsed.samples);
  const errors = [...parsed.errors, ...result.errors];
  console.log(JSON.stringify({
    status: errors.length ? 'INVALID' : 'VALID',
    file: input,
    samples: result.samples,
    groups: result.groups,
    splits: result.splitCounts,
    errors,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Requirement validation failed');
  process.exitCode = 1;
});
