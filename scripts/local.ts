import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { localPostgres } from './postgres';
import { seedSyntheticDemo } from './seed-demo';
import { assertWorkspaceRoot, localOptions, assertPortAvailable } from './workspace';

async function main() {
  await assertWorkspaceRoot();
  const { demo, port } = localOptions(process.argv.slice(2));
  await assertPortAvailable(port);
  const { postgres, url } = await localPostgres(demo ? '.local/demo-postgres' : '.local/dev-postgres');
  try { if (demo) await seedSyntheticDemo(url); }
  catch (error) { await postgres.stop(); throw error; }
  console.log(`Sideby: http://127.0.0.1:${port} (${demo ? 'synthetic demo; not real recommendations' : 'local development'})`);
  const app = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, DATABASE_URL: url, NEXT_TELEMETRY_DISABLED: '1',
      SIDEBY_DATA_MODE: demo ? 'synthetic_demo' : 'standard' },
    stdio: 'inherit', windowsHide: true,
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    try {
      if (app.exitCode === null && app.pid) {
        if (process.platform === 'win32') {
          // next dev owns a child worker; stop only this launcher's known process tree.
          await promisify(execFile)('taskkill', ['/PID', String(app.pid), '/T', '/F'], { windowsHide: true })
            .catch(error => { if (error.code !== 128) throw error; }); // Ctrl+C may already have closed it.
        } else app.kill('SIGTERM');
      }
    } finally { await postgres.stop(); }
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
  app.once('error', () => { process.exitCode = 1; void close(); });
  app.once('exit', code => { process.exitCode = code ?? 0; void close(); });
}
main().catch(error => {
  const message = error instanceof Error ? error.message : '';
  console.error(/^(WRONG_WORKSPACE|INVALID_LOCAL_|LOCAL_PORT_UNAVAILABLE)/u.test(message)
    ? message : 'Local Sideby failed to start. Check .local database and installed dependencies.');
  process.exitCode = 1;
});
