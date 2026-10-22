import { spawn } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const name of ['pack:mac', 'pack:win', 'verify:packages', 'retain:packages']) {
  const code = await new Promise((resolve, reject) => { const child = spawn(npm, ['run', name], { stdio: 'inherit' }); child.on('error', reject); child.on('exit', resolve); });
  if (code !== 0) process.exit(code ?? 1);
}

await copyFile('使用说明.md', 'dist/使用说明.md');
