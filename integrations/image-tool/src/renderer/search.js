(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const collators = { en: new Intl.Collator('en', { numeric: true }), zh: new Intl.Collator('zh-CN', { numeric: true }) };
  function prepare(items) {
    const lookup = new Map(items.map(item => [item.id, item]));
    return items.map(item => ({ ...item, _search: normalize([
      item.name, item.zh, item.label, item.englishLabel,
      ...(item.category === 'Components' ? item.parents.flatMap(id => {
        const parent = lookup.get(id); return parent ? [parent.name, parent.zh] : [];
      }) : [])
    ].join(' ')) }));
  }
  function filter(items, { query = '', category = '', imageFilter = 'available', selectedOnly = false, selected = new Set(), sort = 'name' }) {
    const tokens = normalize(query).split(' ').filter(Boolean);
    return items.filter(item => (!category || item.category === category || item.sources?.includes(category))
      && (imageFilter === 'all' || item.hasImage === (imageFilter === 'available'))
      && (!selectedOnly || selected.has(item.id))
      && tokens.every(token => item._search.includes(token))).sort((a, b) => {
        if (tokens.length) {
          const q = normalize(query);
          const score = item => [item.name, item.zh, item.label, item.englishLabel].some(value => normalize(value) === q) ? 0
            : [item.name, item.zh, item.label].some(value => normalize(value).startsWith(q)) ? 1 : 2;
          const diff = score(a) - score(b);
          if (diff) return diff;
        }
        const left = sort === 'english' ? a.englishLabel : a.label;
        const right = sort === 'english' ? b.englishLabel : b.label;
        return collators[sort === 'english' ? 'en' : 'zh'].compare(left, right) || a.id.localeCompare(b.id);
      });
  }
  const api = { normalize, prepare, filter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GuideSearch = api;
})(typeof window !== 'undefined' ? window : globalThis);
