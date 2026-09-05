import { createServer } from 'node:net';
import { realpath, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');

export async function assertWorkspaceRoot() {
  const [expected, actual] = await Promise.all([realpath(root), realpath(process.cwd())]);
  const normalize = (path: string) => process.platform === 'win32' ? path.toLowerCase() : path;
  if (normalize(expected) !== normalize(actual)) {
    throw new Error(`WRONG_WORKSPACE: run this command from ${expected}`);
  }
  return expected;
}

export function localOptions(args: string[]) {
  let port = Number(process.env.SIDEBY_PORT ?? 3000);
  let demo = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--demo') demo = true;
    else if (args[i] === '--port') port = Number(args[++i]);
    else throw new Error('INVALID_LOCAL_OPTION: use --demo and/or --port <1024..65535>');
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('INVALID_LOCAL_PORT: choose an integer from 1024 to 65535');
  }
  return { demo, port };
}

export async function assertPortAvailable(port: number) {
  const server = createServer();
  await new Promise<void>((done, reject) => {
    server.once('error', () => reject(new Error(`LOCAL_PORT_UNAVAILABLE: 127.0.0.1:${port}; close your existing Sideby instance or choose --port <number>`)));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close(error => error ? reject(error) : done());
    });
  });
}

if (process.argv[1]?.endsWith('workspace.ts')) {
  (async () => {
    const directory = await assertWorkspaceRoot();
    const config = JSON.parse(await readFile(resolve(directory, 'tsconfig.json'), 'utf8'));
    if (!config.exclude?.includes('.local') || config.include?.some((path: string) => path.startsWith('**/'))) {
      throw new Error('WORKSPACE_SCOPE_INVALID: keep external frontends and worktrees outside the main compiler scope');
    }
    console.log(JSON.stringify({ status: 'WORKSPACE_BOUNDARIES_OK', root: directory,
      externalFrontends: '.local/frontends', worktrees: '.local/worktrees',
      note: 'Checks directory/configuration only; this is not product acceptance.' }, null, 2));
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
