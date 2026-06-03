import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runNpm(script, prefix) {
  const cwd = path.join(root, prefix);
  return spawn('npm', ['run', script], {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
}

const children = [
  runNpm('start:dev', 'backend'),
  runNpm('start', 'frontend'),
];

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown();
      process.exit(code);
    }
  });
}
