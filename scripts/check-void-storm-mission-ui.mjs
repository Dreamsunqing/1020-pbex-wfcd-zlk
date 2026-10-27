import { _electron as electron, expect as baseExpect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const expect = baseExpect.configure({ timeout: 30000 });
const root = process.cwd(), output = path.resolve('artifacts/void-storm-mission');
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-storm-mission-'));
await fs.mkdir(output, { recursive: true });
const env = { ...process.env, WORKBENCH_ROOT: root, WORKBENCH_USER_DATA: profile, WORKBENCH_UI_OFFLINE: '1' };
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  const executablePath = process.env.WORKBENCH_TEST_EXECUTABLE;
  app = await electron.launch({ ...(executablePath ? { executablePath, args: [] } : { args: [root] }), env, timeout: 60000 });
  const page = await app.firstWindow(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => window.smokeReady, null, { timeout: 60000 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-panel=world]').click();
  await page.locator('[data-stat=fissures-storm]').click({ timeout: 60000 });
  const expected = await page.evaluate(async () => {
    const { liveUI } = await import('./app.js');
    return liveUI.state.data.modules.find(m => m.id === 'fissures').entries.filter(r => r.kind === 'storm').map(r => r.missionType);
  });
  expect(expected.length).toBeGreaterThan(0);
  expect(expected.every(Boolean)).toBe(true);
  await expect(page.locator('.ws-kind-storm .ws-mission-badge')).toHaveCount(expected.length);
  await expect(page.locator('.ws-kind-storm .ws-mission-badge')).toHaveText(expected);
  await expect(page.getByLabel('任务类型')).toContainText('爆发');
  await page.getByLabel('任务类型').selectOption('爆发');
  await expect(page.locator('.ws-kind-storm')).toHaveCount(expected.filter(t => t === '爆发').length);
  await expect(page.locator('.ws-kind-storm .ws-mission-badge')).toHaveText(expected.filter(t => t === '爆发'));
  await page.getByLabel('任务类型').selectOption('');
  await page.screenshot({ path: path.join(output, 'mission-types.png') });
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ ok: true, rows: expected.length, types: [...new Set(expected)], output }));
} finally {
  await app?.close();
  await fs.rm(profile, { recursive: true, force: true });
}
