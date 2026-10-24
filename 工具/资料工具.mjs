#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath, python = process.env.WORKBENCH_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const require = createRequire(import.meta.url);
const descriptions = [
  ['获取数据', '联网更新来源，写入 .workbench 快照，不覆盖离线原件'],
  ['处理数据', '离线解析 JSON 结构，输出字段清单'],
  ['合并数据', '按规则构建全量离线资料并导出'],
  ['获取WFCD图片', '按固定快照下载并整理完整 WFCD 图库（较大）'],
  ['获取官方图片', '按官方 Manifest 下载／续传官方图片（较大）'],
  ['处理图片', '完整校验并整理两套图片索引（耗时，不会自动运行）'],
  ['合成蓝图', '蓝图底纹叠加精确成品图，另存 PNG'],
  ['启动工作台', '启动 Electron 开发版'],
  ['打包程序', '仅构建 Mac x64 / Windows x64 包并执行版本保留，不运行测试'],
  ['文本标记清单', '显式扫描 JSON 文本标记并输出审阅清单，不覆盖人工登记表'],
  ['获取文本图标', '按 Plus 映射补齐真实文本图标，并更新离线运行时登记表'],
  ['校验语言映射', '核对已构建资料的字段、字典指针、嵌套中文和中间件保真，不扫描图库'],
  ['准备卡面素材', '从指定 App 目录整理小型 Mod / 赋能拼图素材'],
  ['预构建资料库', '从指定完整 P3 构建生成程序内置资料'],
  ['获取敌人图片', '按 Wiki 完整敌人 ID 与 Plus avatar 关系补充立绘，不以同名跨源猜图']
];
const help = () => console.log(`资料包工具箱\n\n${descriptions.map(([name, label], index) => `${index + 1}. ${name}：${label}`).join('\n')}\n\n用法：node 工具/资料工具.mjs <命令或编号> [参数]\n预览命令而不执行：加 --预览命令\n蓝图示例：node 工具/07-合成蓝图.mjs --id /Lotus/Types/Recipes/WarframeRecipes/RunnerBlueprint --result-id /Lotus/Powersuits/Runner/Runner\n帮助：工具/README.md。所有命令以项目根目录为工作目录；不会自动串联下载、构建或校验。`);

async function execute(binary, args, preview) {
  if (preview) { console.log(JSON.stringify({ cwd: root, executable: binary, args }, null, 2)); return; }
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: root, stdio: 'inherit', shell: false });
    child.on('error', error => reject(new Error(`无法启动 ${binary}：${error.message}。请按工具说明安装本地运行依赖。`)));
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(signal ? `任务被 ${signal} 停止` : `任务退出码 ${code}`)));
  });
}

export async function run(command, parameters = []) {
  const preview = parameters.includes('--预览命令'), args = parameters.filter(value => value !== '--预览命令');
  if (/^(?:[1-9]|1[0-5])$/.test(command ?? '')) command = descriptions[Number(command) - 1][0];
  if (!command || command === 'help' || command === '--help') { help(); return; }
  const at = value => path.join(root, value);
  const commands = {
    准备卡面素材: [node, [at('scripts/sync-card-assets.mjs'), ...args]],
    预构建资料库: [node, [at('scripts/prepare-player-library.mjs'), ...args]],
    获取敌人图片: [node, [at('scripts/fetch-enemy-images.mjs'), ...args]],
    获取数据: [node, [at('src/cli.mjs'), 'update', '--config', at('config/default.json'), '--store', at('.workbench'), ...args]],
    处理数据: [node, [at('scripts/inventory-structure.mjs'), args[0] || root, args[1] || at('输出/数据处理/字段结构清单.json')]],
    合并数据: [node, [at('scripts/build-merge.mjs'), '--root', root, '--store', at('.workbench'), '--out', at('输出/合并数据'), ...args]],
    获取WFCD图片: [python, [at('scripts/prepare-data.py'), ...args]],
    获取官方图片: [node, [at('scripts/fetch-image-libraries.mjs'), '--official-only', ...args]],
    处理图片: [python, [at('scripts/complete-image-libraries.py'), ...args]],
    校验语言映射: [node, [at('scripts/audit-localization.mjs'), '--root', root, '--store', at('.workbench'), ...args]],
    文本标记清单: [node, [at('scripts/inventory-inline-tokens.mjs'), args[0] || root, args[1] || at('输出/文本处理/文本标记清单.json')]]
  };
  if (commands[command]) { await execute(...commands[command], preview); return; }
  if (command === '获取文本图标') { await execute(python, [at('scripts/fetch-text-icons.py')], preview); await execute(node, [at('scripts/prepare-inline-tokens.mjs')], preview); return; }
  if (command === '合成蓝图' && (!args.length || args.includes('--help'))) { console.log('用法：node 工具/07-合成蓝图.mjs --id <蓝图完整ID> [--result-id <成品完整ID>] [--out <PNG路径>] [--size 512]'); return; }
  if (command === '合成蓝图' || command === '启动工作台') {
    if (command === '启动工作台') await execute(node, [at('scripts/prepare-inline-tokens.mjs')], preview);
    const cli = require.resolve('electron/cli.js');
    await execute(node, [cli, command === '合成蓝图' ? at('scripts/compose-blueprint.mjs') : root, ...args], preview); return;
  }
  if (command === '打包程序') {
    await execute(node, [at('scripts/prepare-inline-tokens.mjs')], preview);
    const builder = require.resolve('electron-builder/cli.js');
    for (const platform of ['--mac', '--win']) await execute(node, [builder, platform, 'zip', '--x64'], preview);
    if (!preview) await fs.copyFile(at('使用说明.md'), at('dist/使用说明.md'));
    await execute(node, [at('scripts/retain-packages.mjs')], preview); return;
  }
  throw new Error('未知任务；运行 node 工具/资料工具.mjs --help 查看命令。');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let command = process.argv[2];
    if (!command && process.stdin.isTTY) { help(); const prompt = createInterface({ input: process.stdin, output: process.stdout }); try { command = (await prompt.question('\n输入任务编号（直接回车退出）：')).trim(); } finally { prompt.close(); } if (!command) process.exit(0); }
    await run(command, process.argv.slice(3));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
