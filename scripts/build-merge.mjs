import path from 'node:path';
import { parseArgs } from 'node:util';
import { promises as fs } from 'node:fs';
import { scanLibrary, readLibraryFile, snapshotFiles, snapshotEntry } from '../src/core/library.mjs';
import { loadConfig } from '../src/core/config.mjs';
import { Store } from '../src/core/store.mjs';
import { MergeRepository, exportMerged } from '../src/core/merge/repository.mjs';
import { FULL_CONTRACT } from '../src/core/merge/rules.mjs';
import { digest } from '../src/core/merge/contract.mjs';
const { values } = parseArgs({ options: { root: { type: 'string', default: '.' }, store: { type: 'string', default: '.workbench' }, out: { type: 'string' }, release: { type: 'string' }, overrides: { type: 'string' }, rules: { type: 'string' }, profile: { type: 'string', default: 'full' } } });
try {
  const store = new Store(path.resolve(values.store)), config = await loadConfig();
  const release = values.release ? await store.release(values.release) : null;
  const library = release ? null : await scanLibrary(values.root, config);
  const files = release ? await snapshotFiles(store, release) : library.files;
  const read = release ? async id => { const entry = snapshotEntry(release, id); return { bytes: await store.bytes(entry), hash: entry.hash }; } : id => readLibraryFile(library.root, id);
  const context = release ? { mode: 'snapshot', releaseId: release.id } : { mode: 'local', root: library.root };
  const repository = new MergeRepository(path.join(store.root, 'merged', digest(context)));
  const overrides = values.overrides ? JSON.parse(await fs.readFile(values.overrides, 'utf8')) : undefined;
  if (!['full', 'pilot'].includes(values.profile)) throw new Error('profile 须为 full 或 pilot');
  const saved = values.rules ? JSON.parse(await fs.readFile(values.rules, 'utf8')) : null;
  const contract = values.profile === 'pilot' ? undefined : saved?.contract ?? FULL_CONTRACT;
  const result = await repository.build({ files, read, context, contract, overrides: overrides ?? saved?.overrides, onProgress: p => console.error(p.message) });
  const exported = values.out ? await exportMerged(result, values.out) : null;
  console.log(JSON.stringify({ datasetVersion: result.manifest.datasetVersion, quality: result.manifest.quality, summary: result.manifest.summary, repository: repository.root, exported, changeCount: (await repository.changes(result)).changes.length }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
