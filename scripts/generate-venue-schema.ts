import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { venueRecordSchema } from '../src/venues/schema';

const output = resolve('schemas/venue-record.schema.json');
const schema = z.toJSONSchema(venueRecordSchema, { target: 'draft-7' });

async function main() {
  await writeFile(output, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  console.log(output);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
