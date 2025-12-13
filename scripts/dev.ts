import { spawn } from 'child_process';
import { platform } from 'os';

const URL = 'http://localhost:3000';
const DELAY = 2500; 

console.log('[Dev] Starting Next.js server...');

const server = spawn(/^win/.test(platform()) ? 'npm.cmd' : 'npm', ['run', 'dev:core'], {
  stdio: 'inherit',
  shell: true,
});

setTimeout(() => {
  console.log('[Dev] Opening browser at ' + URL + '...');
  
  let command = '';
  let args = [];

  if (process.env.WSL_DISTRO_NAME) {
    command = 'explorer.exe';
    args = [URL];
  } else if (platform() === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', URL];
  } else if (platform() === 'darwin') {
    command = 'open';
    args = [URL];
  } else {
    command = 'xdg-open';
    args = [URL];
  }

  if (command) {
    const opener = spawn(command, args, { stdio: 'ignore' });
    opener.on('error', (err) => {
      console.error('[Dev] Failed to open browser: ' + err.message);
    });
  }
}, DELAY);

server.on('close', (code) => {
  process.exit(code ?? 0);
});
