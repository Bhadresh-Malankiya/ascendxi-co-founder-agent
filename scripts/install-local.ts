import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  chmodSync,
  cpSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
if (process.platform !== 'darwin')
  throw Error(
    'This installer manages a macOS user LaunchAgent. Use the documented service runner on other hosts.',
  );
const root = resolve(import.meta.dirname, '..'),
  label = 'com.ascendxi.company-os',
  domain = 'gui/' + process.getuid!(),
  plist = join(homedir(), 'Library', 'LaunchAgents', label + '.plist');
const run = (args: string[]) =>
  spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
if (process.argv.includes('--status')) {
  const r = run(['print', domain + '/' + label]);
  console.log(
    r.status === 0
      ? r.stdout
          .split('\n')
          .filter((l) => /state =|pid =|last exit code =|program =/.test(l))
          .join('\n')
      : 'Local service is not loaded',
  );
  process.exit(r.status ?? 1);
}
if (process.argv.includes('--stop')) {
  const r = run(['bootout', domain + '/' + label]);
  console.log(
    r.status === 0
      ? 'Local company service stopped'
      : 'Local company service was not loaded',
  );
  process.exit(0);
}
const envPath = join(root, '.env.company-local');
if (!existsSync(envPath) || !existsSync(join(root, '.mastra/output/index.mjs')))
  throw Error('Create private .env.company-local and run npm run build first');
const env = parseEnv(readFileSync(envPath, 'utf8'));
if (
  env.ASCENDXI_LOCAL_MODE !== 'true' ||
  env.ASCENDXI_LOCAL_WORKER !== 'true' ||
  !env.ASCENDXI_API_TOKEN ||
  !env.DATABASE_URL ||
  !['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname)
)
  throw Error(
    'Installer requires explicit local mode, worker, private API token and localhost database',
  );
chmodSync(envPath, 0o600);
const dataRoot = join(
  homedir(),
  'Library',
  'Application Support',
  'AscendXI Company OS',
);
mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
chmodSync(dataRoot, 0o700);
const logDir = join(dataRoot, 'logs');
mkdirSync(logDir, { recursive: true, mode: 0o700 });
for (const file of ['service.log', 'service-error.log']) {
  if (!existsSync(join(logDir, file)))
    writeFileSync(join(logDir, file), '', { mode: 0o600 });
  chmodSync(join(logDir, file), 0o600);
}
const xml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
// Stage outside macOS-protected Documents so login services can start without extra file-access grants.
const runtime = join(dataRoot, 'runtime'),
  staging = join(dataRoot, 'runtime.next'),
  previous = join(dataRoot, 'runtime.previous');
if (existsSync(staging)) rmSync(staging, { recursive: true, force: true });
cpSync(join(root, '.mastra/output'), staging, { recursive: true });
const oldJob = run(['bootout', domain + '/' + label]);
// launchd can report bootout before the old process has finished exiting.
if (oldJob.status === 0) {
  for (let wait = 0; wait < 30; wait++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (run(['print', domain + '/' + label]).status !== 0) break;
    if (wait === 29)
      throw Error(
        'Previous service did not unload; inspect local:status before updating.',
      );
  }
}
if (existsSync(previous)) rmSync(previous, { recursive: true, force: true });
if (existsSync(runtime)) renameSync(runtime, previous);
renameSync(staging, runtime);
const serviceEnv = join(dataRoot, 'service.env');
writeFileSync(serviceEnv, readFileSync(envPath), { mode: 0o600 });
chmodSync(serviceEnv, 0o600);
const args = [
  '/usr/bin/caffeinate',
  '-is',
  process.execPath,
  '--env-file=' + serviceEnv,
  join(runtime, 'index.mjs'),
];
const body = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map((a) => '<string>' + xml(a) + '</string>').join('')}</array><key>WorkingDirectory</key><string>${xml(dataRoot)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${xml(join(logDir, 'service.log'))}</string><key>StandardErrorPath</key><string>${xml(join(logDir, 'service-error.log'))}</string><key>ProcessType</key><string>Standard</string></dict></plist>`;
mkdirSync(resolve(plist, '..'), { recursive: true });
writeFileSync(plist, body, { mode: 0o600 });
chmodSync(plist, 0o600);
let r = run(['bootstrap', domain, plist]);
for (let retry = 0; r.status !== 0 && retry < 8; retry++) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  r = run(['bootstrap', domain, plist]);
}
if (r.status !== 0)
  throw Error('LaunchAgent could not start: ' + r.stderr.trim());
let healthy = false;
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    const response = await fetch(
      'http://127.0.0.1:' + (env.PORT || 4111) + '/company/state',
      { signal: AbortSignal.timeout(1500) },
    );
    const state = (await response.json()) as {
      worker?: { alive?: boolean; pid?: number };
    };
    const currentJob = run(['print', domain + '/' + label]);
    const currentPid = Number(currentJob.stdout.match(/\bpid = (\d+)/)?.[1]);
    if (response.ok && state.worker?.alive && state.worker.pid === currentPid) {
      healthy = true;
      break;
    }
  } catch {
    /* A newly staged Node runtime can take time to load its dependency graph. */
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
if (!healthy)
  throw Error(
    'The service is loaded but its company API/worker did not become healthy. Inspect private logs and local:status.',
  );
console.log(
  'Local company service installed. It starts at login and restarts after failure. Runtime and logs are in ~/Library/Application Support/AscendXI Company OS; idle system sleep is prevented while the service runs. Shutdown, logout and lid/manual sleep still stop local work.',
);
