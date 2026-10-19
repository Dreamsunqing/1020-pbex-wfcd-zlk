import { atomicJson, readJson } from './io.mjs';
import { anchorFromWorldState, validAnchor, WORLD_STATE_URL } from './browse.mjs';
import { requestBytes } from './updater.mjs';

export async function cachedAnchor(file) {
  const anchor = await readJson(file).catch(() => null);
  return validAnchor(anchor) ? anchor : null;
}
export async function refreshAnchor(file, { proxyUrl = null, request = requestBytes, now = Date.now } = {}) {
  const bytes = await request(WORLD_STATE_URL, { maxBytes: 16 * 1024 * 1024, proxyUrl });
  const anchor = anchorFromWorldState(bytes.toString('utf8'), { fetchedAt: now() });
  // A failed request or validation never overwrites the previous valid anchor.
  await atomicJson(file, anchor);
  return anchor;
}
