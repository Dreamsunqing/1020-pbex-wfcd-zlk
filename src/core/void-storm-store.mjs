import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { atomicJson } from './io.mjs';
import { stormObservation, forecastVoidStorms, backtestVoidStorms } from './void-storm-forecast.mjs';
import { forecastStormContent, backtestStormContent } from './void-storm-content.mjs';

export class VoidStormForecastStore {
  constructor(root) { this.root = root; this.pending = Promise.resolve(); }
  async history() {
    this.bundle ??= fs.readFile(new URL('../data/void-storm-history.json.gz', import.meta.url)).then(bytes => JSON.parse(gunzipSync(bytes, { maxOutputLength: 16 * 1024 * 1024 })));
    const bundled = await this.bundle;
    let saved = { samples: [] };
    try { saved = JSON.parse(await fs.readFile(path.join(this.root, 'observations.json'), 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    return { ...bundled, samples: [...bundled.samples, ...saved.samples] };
  }
  async record(observation) {
    // Serialize writes so concurrent DE/WG refreshes cannot discard each other's evidence.
    const task = this.pending.catch(() => {}).then(async () => {
      const file = path.join(this.root, 'observations.json');
      let data = { schemaVersion: 1, samples: [] };
      try { data = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      // Reopening a cache is not a new observation or a new forecast issuance.
      if (!data.samples.some(row => row.server === observation.server && row.hash === observation.hash)) {
        data.samples.push(observation); await atomicJson(file, data);
      }
    });
    this.pending = task;
    return task;
  }
  async view(snapshot, { at = Date.now(), hours = 24 } = {}) {
    const rawAt = typeof snapshot.raw.Time === 'number' ? new Date(snapshot.raw.Time * 1000).toISOString() : null;
    // A prediction cannot have been issued before the document actually arrived.
    const observedAt = snapshot.fetchedAt ?? rawAt;
    const observation = stormObservation(snapshot.raw, { server: snapshot.server, observedAt, source: snapshot.source, hash: snapshot.hash });
    // An old downloaded document remains stale even if it arrived just now.
    observation.generatedAt = rawAt;
    const forecast = forecastVoidStorms(observation, { at, hours });
    if (snapshot.kind === 'network') await this.record(observation);
    const history = await this.history();
    const evaluationAt = Date.parse(forecast.issuedAt);
    const samples = history.samples.filter(row => Date.parse(row.observedAt) <= evaluationAt);
    const backtest = backtestVoidStorms(samples, { server: snapshot.server, hours });
    const contentBacktest = backtestStormContent(samples, backtest, history.catalog);
    return { ...forecastStormContent(forecast, [...samples, observation], history.catalog), snapshotKind: snapshot.kind, refreshError: snapshot.refreshError ?? null, backtest, contentBacktest,
      evidence: { label: history.sourceLabel, calendarRange: history.calendarRange, missingFiles: history.missing.length, runtimeSamples: history.samples.filter(row => row.source.startsWith('https://')).length } };
  }
}
