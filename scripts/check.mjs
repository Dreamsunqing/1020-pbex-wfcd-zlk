import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
async function walk(root) { const files = []; for (const entry of await fs.readdir(root, { withFileTypes: true })) { const file = path.join(root, entry.name); if (entry.isDirectory()) files.push(...await walk(file)); else if (/\.(mjs|cjs|js)$/.test(file)) files.push(file); } return files; }
const files = (await Promise.all(['src', 'scripts', 'test'].map(walk))).flat();
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status !== 0) { console.error(result.stderr); process.exit(1); } }
console.log(`语法检查通过：${files.length} 个文件`);

// 1999 calendar picture mappings: reward art (CAL-10) and character portraits (CAL-11). Duplicates, invalid paths and
// missing pictures fail the check; characters without a portrait are only listed.
const rewardArt = await import('./check-calendar-reward-art.mjs');
const art = await rewardArt.checkCalendarRewardArt();
for (const line of rewardArt.describeRewardArtCheck(art)) (art.ok ? console.log : console.error)(line);
if (!art.ok) process.exit(1);
const portraits = await rewardArt.checkCalendarPortraitArt();
for (const line of rewardArt.describePortraitArtCheck(portraits)) (portraits.ok ? console.log : console.error)(line);
if (!portraits.ok) process.exit(1);

await (await import('./prepare-inline-tokens.mjs')).prepareInlineTokens({ check: true });
