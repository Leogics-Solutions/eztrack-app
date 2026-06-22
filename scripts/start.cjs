const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

const child = spawn(process.execPath, [nextBin, 'start', ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
  windowsHide: false,
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err.message);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});
