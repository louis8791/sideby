import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { governmentSourceRowSchema, importGovernmentRow } from '../src/venues/government-import';

async function main() {
  const [inputArg, outputArg] = process.argv.slice(2);
  if (!inputArg || !outputArg) {
    throw new Error('Usage: npm run venues:import-government -- <input.json> <output.json>');
  }
  const input = resolve(inputArg), output = resolve(outputArg);
  const rows = z.array(governmentSourceRowSchema).parse(JSON.parse(await readFile(input, 'utf8')));
  const records = rows.map(importGovernmentRow);
  await writeFile(output, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(`Imported ${records.length} draft venue record(s) to ${output}`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
