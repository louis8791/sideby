import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { migrate } from './migrate';

export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Port allocation failed');
  const port = address.port;
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  return port;
}

export async function localPostgres(directory: string) {
  const root = resolve(directory);
  await mkdir(root, { recursive: true });
  const passwordFile = resolve(root, 'password');
  let password: string;
  try { password = await readFile(passwordFile, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    password = randomBytes(32).toString('hex');
    await writeFile(passwordFile, password, { flag: 'wx', mode: 0o600 });
  }
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const packageName = `@embedded-postgres/${platform}-${process.arch}`;
  const binaries = await import(packageName) as { postgres: string; initdb: string };
  const pgCtl = resolve(dirname(binaries.postgres), process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
  const run = (file: string, args: string[]) => new Promise<void>((done, reject) => {
    // pg_ctl's server inherits pipes on Windows; ignore stdio so startup waits
    // for pg_ctl itself, not for the lifetime of the database server.
    const child = spawn(file, args, { windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('PostgreSQL command timed out')); }, 30000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (code === 0) done(); else reject(new Error(`PostgreSQL command failed (${code}); inspect local server.log`));
    });
  });
  const port = await freePort(), databaseDir = resolve(root, 'data');
  try { await access(resolve(databaseDir, 'PG_VERSION')); }
  catch {
    await run(binaries.initdb, ['-D', databaseDir, '--username=sideby', '--auth=scram-sha-256',
      `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C']);
  }
  // Native pg_ctl gives hidden Windows processes and a clean checkpoint on shutdown.
  // All passwords, logs and database files stay inside the project.
  await run(pgCtl, ['start', '-D', databaseDir, '-l', resolve(root, 'server.log'),
    '-o', `-p ${port} -h 127.0.0.1`, '-w', '-t', '20']);
  const postgres = { stop: () => run(pgCtl, ['stop', '-D', databaseDir, '-m', 'fast', '-w', '-t', '20']) };
  const url = `postgresql://sideby:${password}@127.0.0.1:${port}/postgres`;
  try { await migrate(url); }
  catch (error) { await postgres.stop(); throw error; }
  return { postgres, url };
}
