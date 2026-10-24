import { pointer, compareText } from './contract.mjs';

// Membership is an exact upstream identity. Display names are derived only
// after joining members; neither a translated prefix nor a folder is a join key.
export function buildModSetLinks({ index, items, itemMap, relations, provenance, issue, locales }) {
  const report = { sets: 0, members: 0, named: 0, bonusRows: 0, unmatched: [] };
  const evidence = (row, key) => ({ ...row.source, pointer: row.source.pointer + '/' + pointer(key) });
  const fail = (id, message, sources = []) => { report.unmatched.push({ id, message }); issue('mod-set-unmatched', id, 'modSet', message, sources); };
  const members = new Map();
  for (const item of items.filter(i => i.kind === 'mod')) {
    const candidates = (index.get(item.id) ?? []).filter(r => typeof r.value.modSet === 'string');
    if (!candidates.length) continue;
    const ids = new Set(candidates.map(r => r.value.modSet));
    if (ids.size !== 1) { fail(item.id, '来源套装 ID 冲突，未猜测所属套装', candidates.map(r => evidence(r, 'modSet'))); continue; }
    const id = candidates[0].value.modSet;
    if (itemMap.get(id)?.kind !== 'mod-set') { fail(item.id, '完整套装 ID 没有对应套装实体', candidates.map(r => evidence(r, 'modSet'))); continue; }
    item.modSetId = id;
    if (!members.has(id)) members.set(id, []);
    members.get(id).push(item);
    const sources = candidates.map(r => evidence(r, 'modSet'));
    relations.push({ from: item.id, to: id, kind: 'member-of-mod-set', source: sources[0], sources });
    provenance.push({ entityId: item.id, field: 'modSetId', value: id, status: 'resolved', selected: 0, rule: 'modSet 完整内部 ID 精确关联', candidates: candidates.map(r => ({ value: id, rawValue: r.value.modSet, transform: 'exact-mod-set-id', source: evidence(r, 'modSet') })) });
    report.members++;
  }
  for (const set of items.filter(i => i.kind === 'mod-set')) {
    report.sets++;
    const rows = index.get(set.id) ?? [], group = (members.get(set.id) ?? []).sort((a, b) => compareText(a.id, b.id));
    const countRow = rows.find(r => Number.isInteger(r.value.numUpgradesInSet) && r.value.numUpgradesInSet > 0);
    const size = countRow?.value.numUpgradesInSet;
    if (!size) { fail(set.id, '套装缺少有效件数，未按成员数量推测'); continue; }
    if (group.length !== size) fail(set.id, `声明 ${size} 件，已关联 ${group.length} 件，保留差异`);
    const bonuses = {}, sources = [evidence(countRow, 'numUpgradesInSet')];
    for (const locale of locales) {
      const names = group.map(m => m.name?.[locale]);
      // Spaced family labels, or Chinese possessive families (…之苦/之恨).
      // Never infer another language from Chinese or replace a real set name.
      if (names.length > 1 && names.every(n => typeof n === 'string')) {
        let families = names.map(n => n.trim().split(/\s+/)[0].replace(/['’]s$/, ''));
        if (locale.startsWith('zh') && !names.every(n => /\s/.test(n))) families = names.map(n => n.includes('之') ? n.slice(0, n.lastIndexOf('之')) : null);
        const family = families[0];
        if (family && families.every(n => n === family) && (!set.name[locale] || /setmod$/i.test(set.name[locale]))) {
          const value = family + (locale.startsWith('zh') ? ' 套装' : locale === 'en' ? ' Set' : '');
          set.name[locale] = value;
          const candidates = group.map(m => {
            const p = provenance.find(p => p.entityId === m.id && p.field === 'name.' + locale);
            const selected = p?.candidates[p.selected ?? 0];
            return { value, rawValue: selected?.rawValue ?? m.name[locale], transform: 'member-family-display-name', source: selected?.source ?? evidence(rows[0], 'name'), ...(selected?.dictionary ? { dictionary: selected.dictionary } : {}) };
          });
          const field = provenance.find(p => p.entityId === set.id && p.field === 'name.' + locale);
          if (field) Object.assign(field, { value, status: 'derived', selected: field.candidates.length, rule: '完整 ID 关联成员后，同语言成员共享家族名称；显示名派生，不冒充官方独立标题', candidates: [...field.candidates, ...candidates] });
          report.named++;
        }
      }
      const template = set.description?.[locale];
      const params = rows.find(r => r.source.source === 'plus' && Array.isArray(r.value.levelStats)) ?? rows.find(r => Array.isArray(r.value.levelStats));
      const literal = rows.find(r => r.locale === locale && Array.isArray(r.value.stats) && r.value.stats.every(s => typeof s === 'string'));
      bonuses[locale] = Array.from({ length: size }, (_, at) => {
        let value = template;
        if (typeof value === 'string') value = value.replace(/\|([^|]+)\|/g, (token, key) => params?.value.levelStats[at]?.[key] ?? token);
        if (!value || /\|[^|]+\|/.test(value)) value = literal?.value.stats[at] ?? null;
        if (value) report.bonusRows++;
        return value;
      });
      if (params) sources.push(evidence(params, 'levelStats'));
      if (literal) sources.push(evidence(literal, 'stats'));
      const p = provenance.find(p => p.entityId === set.id && p.field === 'description.' + locale);
      const selected = p?.candidates[p.selected ?? 0];
      if (selected?.source) sources.push(selected.source);
      if (selected?.dictionary) sources.push(selected.dictionary);
    }
    set.modSetInfo = { size, buffSet: rows.some(r => r.value.buffSet === true), memberIds: group.map(m => m.id), bonuses };
    provenance.push({ entityId: set.id, field: 'modSetInfo', value: set.modSetInfo, status: 'derived', selected: 0, rule: 'numUpgradesInSet 为装备件数；同语言 description 模板 × levelStats 参数，缺少模板才使用 WFCD 同语言 stats；不按 Mod 强化等级线性推算', candidates: sources.map(source => ({ value: set.modSetInfo, transform: 'mod-set-piece-bonuses', source })) });
  }
  return report;
}
