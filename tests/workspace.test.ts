import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { localOptions } from '../scripts/workspace';

const run = promisify(execFile);
const launcher = resolve('scripts/local.ts');
const tsx = resolve('node_modules/tsx/dist/cli.mjs');

test('local launch rejects a different working directory before creating a database', async () => {
  await assert.rejects(run(process.execPath, [tsx, launcher], { cwd: resolve('scripts'), windowsHide: true }),
    (error: unknown) => /WRONG_WORKSPACE/u.test((error as { stderr: string }).stderr));
});

test('local launch refuses an occupied port instead of opening a different app URL', async t => {
  const listener = createServer();
  await new Promise<void>(done => listener.listen(0, '127.0.0.1', done));
  t.after(() => new Promise<void>((done, reject) => listener.close(error => error ? reject(error) : done())));
  const port = (listener.address() as { port: number }).port;
  await assert.rejects(run(process.execPath, [tsx, launcher, '--demo', '--port', String(port)], { windowsHide: true }),
    (error: unknown) => /LOCAL_PORT_UNAVAILABLE/u.test((error as { stderr: string }).stderr));
});

test('local options preserve demo mode and reject malformed ports', () => {
  assert.deepEqual(localOptions(['--demo', '--port', '3100']), { demo: true, port: 3100 });
  for (const args of [['--port'], ['--port', '0'], ['--port', '3000.5'], ['--port', '65536'], ['--unknown']]) {
    assert.throws(() => localOptions(args));
  }
});
