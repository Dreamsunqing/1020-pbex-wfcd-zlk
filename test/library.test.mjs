import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseDocument, pointerValue, preview, scanLibrary, readLibraryFile } from '../src/core/library.mjs';

test('JSONC 配置可读；坏 JSON 不当成空对象', () => {
  assert.equal(parseDocument('{"a":1,//hi\n}', 'config.json').format, 'jsonc');
  assert.throws(() => parseDocument('{bad', 'x.json'), /解析失败/);
  assert.equal(parseDocument('{bad', 'x.txt').format, 'text');
});
test('路径转义、原有顺序、搜索与分页', () => {
  const data = { '/Lotus/a~b': { name: '测试 Alpha', value: 123 }, z: null };
  const result = preview(data, { query: 'alpha', limit: 1 });
  assert.equal(result.rows[0].pointer, '/~1Lotus~1a~0b');
  assert.equal(pointerValue(data, result.rows[0].pointer).value, 123);
  assert.throws(() => pointerValue(data, '/__proto__'), /不存在/);
  assert.equal(preview([1, 2, 3], { offset: 1, limit: 1 }).hasMore, true);
  assert.equal(preview([1, 2, 3], { offset: 2, limit: 1 }).hasMore, false);
  assert.equal(preview(data).rows[0].key, '/Lotus/a~b');
});
test('实际资料包 404 份 JSON 全部可解析（含隐藏索引）', async () => {
  const library = await scanLibrary('.'); const files = library.files.filter(f => f.format === 'json');
  assert.equal(files.length, 404);
  assert.ok(files.some(x => x.id.endsWith('/data/cache/.images.json')));
  let jsonc = 0;
  for (const file of files) { const { bytes } = await readLibraryFile(library.root, file.id); if (parseDocument(bytes.toString('utf8'), file.id).format === 'jsonc') jsonc++; }
  assert.equal(jsonc, 2);
});
test('文件读取拒绝路径逃逸与指向目录外的符号链接', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-path-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(path.join(root, '..'), path.join(root, 'outside'));
  await assert.rejects(readLibraryFile(root, '../package.json'), /相对路径/);
  await assert.rejects(readLibraryFile(root, 'outside/package.json'));
});
