import { _electron as electron, expect as baseExpect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RULE_HELP, RULE_GUIDE_ID } from '../src/core/merge/rule-help.mjs';
const expect = baseExpect.configure({ timeout: 20000 }), root = process.cwd();
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-rule-help-')), out = path.resolve('artifacts/merge-rule-help-ui');
const preview = process.argv.includes('--preview'), errors = [], checks = []; let app;
await fs.mkdir(out, { recursive: true });
try {
  const env = { ...process.env, WORKBENCH_ROOT: root, WORKBENCH_USER_DATA: profile }; delete env.ELECTRON_RUN_AS_NODE; delete env.WORKBENCH_SMOKE;
  app = await electron.launch({ args: env.WORKBENCH_TEST_EXECUTABLE ? [] : [root], ...(env.WORKBENCH_TEST_EXECUTABLE ? { executablePath: env.WORKBENCH_TEST_EXECUTABLE } : {}), env, timeout: 60000 }); const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.smokeReady, null, { timeout: 60000 });
  await page.setViewportSize({ width: 1500, height: 1050 }); await page.locator('[data-panel=rules]').click();
  await expect(page.locator('#rules-content .rules-option-help')).toHaveCount(2);
  const setInput = async (label, value) => { const control = page.getByRole('textbox', { name: label, exact: true }); await control.fill(value); await control.blur(); };
  await setInput('输出语言', 'zh-CN,en,fr');
  await page.getByRole('spinbutton', { name: '实体数量上限', exact: true }).fill('210000');
  await page.getByRole('spinbutton', { name: '实体数量上限', exact: true }).blur();
  for (const section of ['catalogs', 'fields', 'nested', 'aliases', 'overrides', 'json']) {
    await page.locator(`[data-rules-tab=${section}]`).click();
    const help = page.locator(`.rules-option-help[data-section=${section}]`); await help.locator('summary').click();
    await expect(help.locator('dt')).toHaveCount(Object.keys(RULE_HELP[section]).length);
    if (section === 'catalogs') await expect(page.getByRole('combobox', { name: '语言 1', exact: true }).locator('option[value=fr]')).toHaveCount(1);
    if (section === 'json') { const value = JSON.parse(await page.locator('#rules-json').inputValue()); expect(value.contract.locales).toEqual(['zh-CN', 'en', 'fr']); expect(value.contract.scope.maxEntities).toBe(210000); }
  }
  checks.push('所有编辑标签逐项说明完整，语言和数量表单保留到 JSON，自定义语言进入分类选项');
  await page.locator('[data-rules-tab=fields]').click(); await page.getByRole('button', { name: '＋ 添加一条', exact: true }).click();
  await setInput('统一字段路径 25', 'custom.accuracy'); await setInput('来源字段 25', 'accuracy'); await setInput('中文标题 25', '精准度'); await setInput('适用类别／* 25', 'weapon');
  await page.getByRole('combobox', { name: '类型 25', exact: true }).selectOption('number');
  const min = page.getByRole('spinbutton', { name: '最小值 25', exact: true }); await min.fill('0.25'); await min.blur();
  const precision = page.getByRole('spinbutton', { name: '精度 25', exact: true }); await precision.fill('2'); await precision.blur();
  await page.getByRole('checkbox', { name: '必需字段 25', exact: true }).check();
  await page.locator('#rules-validate').click(); await expect(page.locator('#notice')).toContainText('结构校验通过');
  await page.locator('#rules-note').fill('隔离 UI 测试：新增精准度'); await page.locator('#rules-save').click(); await expect(page.locator('#notice')).toContainText('规则已保存');
  const saved = JSON.parse(await fs.readFile(path.join(profile, 'merge-rules/current.json'), 'utf8'));
  expect(saved.contract.fields.at(-1)).toMatchObject({ path: 'custom.accuracy', key: 'accuracy', min: .25, precision: 2, required: true });
  await page.locator('#rules-previous').click(); await expect(page.locator('#notice')).toContainText('上一版已载入为草稿');
  const persisted = JSON.parse(await fs.readFile(path.join(profile, 'merge-rules/current.json'), 'utf8')); expect(persisted.contract.fields.length).toBe(25);
  await page.locator('[data-rules-tab=json]').click(); expect(JSON.parse(await page.locator('#rules-json').inputValue()).contract.fields.length).toBe(24);
  checks.push('表单新增字段接受小数边界、保存落盘；上一版仅载入草稿、不覆盖当前规则');
  await page.locator('[data-rules-tab=general]').click(); await page.locator('.rules-option-help[data-section=general] summary').click();
  await page.screenshot({ path: path.join(out, 'rules-light.png') });
  await page.locator('#theme-select').selectOption('dark'); await page.setViewportSize({ width: 800, height: 900 });
  await page.locator('[data-rules-tab=fields]').click(); await page.locator('.rules-option-help summary').click();
  expect(await page.locator('#rules').evaluate(node => node.scrollWidth <= node.clientWidth + 2)).toBe(true);
  await page.screenshot({ path: path.join(out, 'rules-dark-narrow.png') });
  checks.push('明暗模式与窄窗说明不溢出，宽表格独立滚动');
  await page.getByRole('button', { name: '配置文档与添加示例 ↗', exact: true }).click();
  await expect(page.locator('#docs-title')).toHaveText('合并合同逐项配置与编辑');
  await expect(page.locator('#docs-path')).toHaveText(RULE_GUIDE_ID);
  await expect(page.locator('#docs-article')).toContainText('默认 24 条字段映射');
  expect(await page.locator('#docs-article').innerText()).not.toContain('<!-- rule-options:');
  await page.waitForFunction(() => [...document.querySelectorAll('.docs-figure img')].length === 1 && [...document.querySelectorAll('.docs-figure img')].every(img => img.complete && img.naturalWidth));
  expect(await page.locator('#docs-reading').evaluate(node => node.scrollWidth <= node.clientWidth + 2)).toBe(true);
  await page.screenshot({ path: path.join(out, 'guide-dark-narrow.png') });
  await page.locator('#theme-select').selectOption('light'); await page.setViewportSize({ width: 1500, height: 1050 });
  await page.locator('#docs-reading').evaluate(node => node.scrollTop = 0); await page.screenshot({ path: path.join(out, 'guide-preview.png') });
  checks.push('规则页直接打开内置文档，配置表和关系图完整渲染，生成标记隐藏');
  expect(errors).toEqual([]); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ ok: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, checks, preview }, null, 2));
  if (preview) { await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.show(); window.focus(); }); console.log('配置文档预览已打开，等待确认后另行打包。'); await new Promise(resolve => app.on('close', resolve)); app = null; }
} catch (error) { console.error(error); process.exitCode = 1; if (app) await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); }
finally { await app?.close(); await fs.rm(profile, { recursive: true, force: true }); }
