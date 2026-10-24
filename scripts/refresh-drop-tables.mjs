import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from '../src/core/store.mjs';
import {refreshDropTables} from '../src/core/drop-table-store.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const snapshot=await refreshDropTables(new Store(path.join(root,'.workbench')));
console.log(JSON.stringify({groups:snapshot.groups.length,rows:snapshot.rowCount,hash:snapshot.hash,fetchedAt:snapshot.fetchedAt},null,2));
