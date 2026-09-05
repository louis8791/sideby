import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const env = {};
for (const name of ['.env', '.env.local']) {
  const path = fileURLToPath(new URL(`../frontend/${name}`, import.meta.url));
  if (existsSync(path)) Object.assign(env, parseEnv(readFileSync(path, 'utf8')));
}
Object.assign(env, process.env);
const browser = env.VITE_GOOGLE_MAPS_API_KEY?.trim();
const server = env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
const ready = Boolean(browser && server && browser !== server);
console.log(JSON.stringify({
  status: ready ? 'CONFIG_PRESENT_NOT_LIVE_VERIFIED' : 'INPUT_REQUIRED',
  browserKeyPresent: Boolean(browser), serverKeyPresent: Boolean(server),
  separateKeys: Boolean(browser && server && browser !== server),
  liveVerified: false, externalCalls: 0,
  next: 'Fill frontend/.env.local privately; restart frontend and open /maps-check. Never paste keys into chat.',
}, null, 2));
process.exitCode = ready ? 0 : 1;
