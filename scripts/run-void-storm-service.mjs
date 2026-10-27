import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { atomicJson, readJson } from '../src/core/io.mjs';
import { VoidStormCollector } from '../src/core/void-storm-collector.mjs';
import { createStormCollectionCatalog } from '../src/core/void-storm-standalone-catalog.mjs';

const home = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(home, 'state');
const config = await readJson(path.join(home, 'service.json'));
const output = path.join(home, 'result/九重天七天采集.json');
const catalog = createStormCollectionCatalog(await readJson(path.join(root, 'catalog.json')));
const collector = new VoidStormCollector(root, output, catalog);
if (process.argv.includes('--status')) {
  console.log(JSON.stringify({ ...await collector.status(), worker: await readJson(path.join(root, 'worker.json')).catch(() => null) }, null, 2));
} else if (process.argv.includes('--stop')) {
  console.log(JSON.stringify(await collector.tick({ stop: true }), null, 2));
} else {
  while (true) {
    let status = await collector.status();
    const end = Date.parse(status.endsAt);
    if (status.status === 'active' && (Date.now() >= end || Date.now() >= Date.parse(status.nextFetchAt))) {
      status = await collector.tick();
      console.log(JSON.stringify({ at: new Date().toISOString(), ...status }));
    }
    await atomicJson(path.join(root, 'worker.json'), { pid: process.pid, checkedAt: new Date().toISOString(), status: status.status, nextFetchAt: status.nextFetchAt });
    if (status.status !== 'active') {
      await fs.rm(config.plist, { force: true });
      console.log(JSON.stringify({ at: new Date().toISOString(), event: 'service-exit', status: status.status, output }));
      break;
    }
    // Wake precisely for the next expiry (+60s), with a local heartbeat at
    // least once a minute to notice manual stop. Waiting never calls the API.
    await delay(Math.max(100, Math.min(60000, end - Date.now(), Date.parse(status.nextFetchAt) - Date.now())));
  }
}
