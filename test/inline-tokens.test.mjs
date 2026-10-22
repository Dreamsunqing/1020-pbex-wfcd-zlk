import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createInlineTokenMiddleware, inlineText, plainGameText } from '../src/core/inline-tokens.mjs';
import { prepareInlineTokens } from '../scripts/prepare-inline-tokens.mjs';
test('文本中间件保留未知值、不执行 HTML、去控制码，并为名字和操作保留可读说明', () => {
  assert.equal(plainGameText('<SHARD_RED_SIMPLE>深红执刑官源力石', 'name'), '深红执刑官源力石');
  assert.equal(plainGameText('<DT_FIRE_COLOR>火焰<br>伤害 <UNKNOWN>'), '火焰\n伤害 <UNKNOWN>');
  assert.equal(plainGameText('<JUMP>'), '跳跃');
  assert.equal(inlineText.parse('<img src=x onerror=alert(1)>')[0].kind, 'unknown');
  assert.equal(inlineText.parse('<__proto__>')[0].kind, 'unknown');
  assert.match(inlineText.parse('<DT_FIRE>')[0].image, /^[a-f0-9]{64}\.png$/);
  assert.equal(inlineText.parse('<DT_HEAT>')[0].image, inlineText.parse('<DT_FIRE>')[0].image);
  const custom = {entries:{TEST:{kind:'icon',label:'测试'}}};const isolated=createInlineTokenMiddleware(custom);custom.entries.TEST.label='改动';assert.equal(isolated.plain('<TEST>'),'测试');
});
test('生成的 JS 登记表与人工 JSON 和图标索引一致；小图标文件具有有效 PNG 和可追溯哈希', async () => {
  await prepareInlineTokens({ check: true });
  const manifest = JSON.parse(await fs.readFile(new URL('../src/data/text-icon-assets.json', import.meta.url)));
  assert.equal(manifest.failures.length, 0);assert.ok(Object.keys(manifest.tokens).length > 600);
  for (const asset of manifest.assets) {
    const bytes = await fs.readFile(new URL('../src/ui/assets/text-icons/' + asset.file, import.meta.url));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  }
});
