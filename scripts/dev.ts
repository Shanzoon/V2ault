import { spawn, spawnSync } from 'child_process';
import { platform } from 'os';
import open from 'open';
import chalk from 'chalk';
import treeKill from 'tree-kill';

const CONFIG = {
  url: process.env.APP_URL || 'http://localhost:3000',
  dbInitScript: 'scripts/init-db.ts',
  readySignal: ['Ready in', 'started server on', 'Local:', 'http://localhost:'],
  timeout: 5000,
};

const getNpmCmd = () => (platform() === 'win32' ? 'npm.cmd' : 'npm');
const getNpxCmd = () => (platform() === 'win32' ? 'npx.cmd' : 'npx');

const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ [Dev] ') + msg),
  success: (msg: string) => console.log(chalk.green('✔ [Dev] ') + msg),
  error: (msg: string) => console.error(chalk.red('✖ [Dev] ') + msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠ [Dev] ') + msg),
};

async function main() {
  log.info('Checking database schema...');
  const initDb = spawnSync(getNpxCmd(), ['tsx', CONFIG.dbInitScript], {
    stdio: 'inherit',
    shell: true,
  });
  if (initDb.status !== 0) {
    log.error('Database initialization failed. Aborting.');
    process.exit(1);
  }
  log.success('Database check passed.');

  log.info('Starting Next.js server...');
  const server = spawn(getNpmCmd(), ['run', 'dev:core'], {
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, FORCE_COLOR: 'true' },
  });

  let browserOpened = false;
  const tryOpenBrowser = async () => {
    if (browserOpened) return;
    browserOpened = true;
    log.success(`Server is ready! Opening browser at ${chalk.underline(CONFIG.url)}...`);
    try {
      await open(CONFIG.url);
    } catch (err) {
      log.warn(`Failed to open browser: ${err}`);
    }
  };

  server.stdout?.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    if (CONFIG.readySignal.some((signal) => output.includes(signal))) {
      tryOpenBrowser();
    }
  });

  server.stderr?.on('data', (data) => process.stderr.write(data));

  setTimeout(() => {
    if (!browserOpened) {
      log.warn('Server ready signal not detected, forcing browser open...');
      tryOpenBrowser();
    }
  }, CONFIG.timeout);

const cleanup = () => {
  log.info('Stopping server...');
  if (server.pid) {
    treeKill(server.pid, 'SIGTERM', (err) => {
      if (err) log.error('Failed to kill server process');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  server.on('close', (code) => {
    if (code !== 0 && code !== null) {
      log.error(`Server exited abnormally with code ${code}`);
      process.exit(code);
    }
  });
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});