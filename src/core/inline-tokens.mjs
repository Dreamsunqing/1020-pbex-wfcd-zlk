import registry from '../data/inline-tokens.generated.mjs';

// Pure and instance scoped. Unknown angle tokens are preserved, never parsed as HTML.
export function createInlineTokenMiddleware(index = registry) {
  const entries = structuredClone(index.entries ?? {});
  function parse(value) {
    const text = String(value ?? ''), parts = []; let last = 0;
    for (const match of text.matchAll(/<([^<>\n]{1,100})>/g)) {
      if (match.index > last) parts.push({ kind: 'text', text: text.slice(last, match.index) });
      const token = match[1], entry = Object.hasOwn(entries, token) ? entries[token] : null;
      parts.push(entry ? { ...entry, token, raw: match[0] } : { kind: 'unknown', token, text: match[0] });
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
    return parts;
  }
  function plain(value, mode = 'description') {
    const parts = parse(value);
    const result = parts.map(part => part.kind === 'format' ? '' : part.kind === 'break' ? '\n' : part.kind === 'icon' ? part.omitInPlain || mode === 'name' && part.omitInName ? '' : part.label : part.text).join('');
    // A name made only of an icon still needs an accessible name.
    return result.trim() || parts.filter(p => p.kind === 'icon').map(p => p.label).join('');
  }
  return Object.freeze({ version: index.version, parse, plain });
}
export const inlineText = createInlineTokenMiddleware();
export const plainGameText = (value, mode = 'description') => inlineText.plain(value, mode);

export function scanInlineTokens(sources) {
  const tokens = new Map();
  for (const { ref, text } of sources) for (const part of inlineText.parse(text)) if (part.token) {
    if (!tokens.has(part.token)) tokens.set(part.token, { token: part.token, kind: part.kind, occurrences: 0, sources: [] });
    const row = tokens.get(part.token); row.occurrences++;
    if (row.sources.length < 5 && !row.sources.includes(ref)) row.sources.push(ref);
  }
  return [...tokens.values()].sort((a, b) => a.token < b.token ? -1 : a.token > b.token ? 1 : 0);
}
