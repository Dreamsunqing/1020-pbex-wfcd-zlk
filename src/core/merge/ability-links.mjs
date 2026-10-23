import { pointer, compareText } from './contract.mjs';

// Read the generated wiki snapshots as data only. Exact indentation bounds each
// record; nested display tables cannot masquerade as top-level metadata fields.
export function wikiRecords(text, { depth = 2, fields = ['InternalName','Name','Description','Subsumed','Type','IsAbilityAugment','IsWeaponAugment'] } = {}) {
  const clean = text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--\[(=*)\[[\s\S]*?\]\1\]|--[^\r\n]*/g, part => part.startsWith('--') ? part.replace(/[^\r\n]/g, ' ') : part);
  const result = [], starts = [0];
  for (let i = 0; i < clean.length; i++) if (clean[i] === '\n') starts.push(i + 1);
  const lineAt = at => { let lo = 0, hi = starts.length; while (lo < hi) { const mid = (lo + hi) >>> 1; if (starts[mid] <= at) lo = mid + 1; else hi = mid; } return lo; };
  const indent = '\t'.repeat(depth);
  const records = new RegExp('^' + indent + '[^\\r\\n]+ = \\{\\r?\\n([\\s\\S]*?)^' + indent + '\\}[,\\r]?$', 'gm');
  for (const match of clean.matchAll(records)) {
    const value = {}, lines = {};
    for (const field of match[1].matchAll(new RegExp('^' + indent + '\t([A-Za-z]+) = ("(?:\\\\.|[^"\\\\])*"|true|false)[,\\r]?$', 'gm'))) {
      if (!fields.includes(field[1])) continue;
      let parsed; try { parsed = field[2] === 'true' ? true : field[2] === 'false' ? false : JSON.parse(field[2]); } catch { continue; }
      value[field[1]] = parsed;
      lines[field[1]] = lineAt(match.index + match[0].indexOf(match[1]) + field.index);
    }
    if (value.InternalName?.startsWith('/')) result.push({ value, lines });
  }
  return result;
}

export function buildAbilityLinks({ documents, index, items, itemMap, relations, provenance, issue }) {
  const report = { skillAugments: 0, weaponAugments: 0, transferableAbilities: 0, donorFrames: 0, unmatched: [], limitations: ['强化 Mod 关联不代表集团商店当前可购买；非集团武器强化使用“强化卡”徽章', '可移植指同系技能；Prime／Umbra／竞技场变体不作为献出材料', '不从名称相似度或技能序号猜测关联；未唯一匹配者保留待复核'] };
  const source = (doc, row, key) => ({ source: doc.source, file: doc.file, hash: doc.hash, pointer: '', line: row.lines[key] });
  const plus = id => index.get(id)?.find(r => r.source.source === 'plus');
  const parents = id => {
    const chain = new Set([id]); let current = id;
    for (let i = 0; i < 30; i++) { const parent = plus(current)?.value.parentName; if (typeof parent !== 'string' || chain.has(parent)) break; chain.add(parent); current = parent; }
    return chain;
  };
  const frameAbilities = items.filter(item => item.kind === 'warframe' && item.abilities?.length);
  const weapons = items.filter(item => item.kind === 'weapon');
  const linked = new Set();
  const add = (target, mod, sources, rule, badge) => {
    const key = target.id + '\0' + mod.id; if (linked.has(key)) return; linked.add(key);
    target.augments ??= []; target.augments.push({ itemId: mod.id, badge });
    relations.push({ from: target.id, to: mod.id, kind: 'augmented-by', source: sources[0], sources, rule });
    provenance.push({ entityId: target.id, field: 'augments[' + JSON.stringify(mod.id) + ']', value: { itemId: mod.id, badge }, status: 'resolved', selected: 0, rule, candidates: sources.map(s => ({ value: mod.id, rawValue: null, transform: 'multi-source-derived-link', source: s })) });
    report[target.kind === 'ability' ? 'skillAugments' : 'weaponAugments']++;
  };
  const fail = (id, reason, sources) => { report.unmatched.push({ id, reason, sources }); issue('ability-link-unmatched', id, 'links', reason, sources, 'info'); };
  const metadataState = (name, doc) => { if (!doc) { report.unmatched.push({ id: null, reason: name + ' 元数据缺失，相关徽章状态未知', sources: [] }); issue('ability-metadata-missing', null, 'links', name + ' 元数据缺失，未猜测关联', [], 'info'); } };
  const modDoc = documents.find(doc => doc.source === 'plus-gen' && /\/extras\/wiki\/Mods\.lua$/.test(doc.file));
  metadataState('Mods.lua', modDoc);
  if (modDoc) for (const row of wikiRecords(modDoc.value)) {
    const wiki = row.value, mod = itemMap.get(wiki.InternalName), raw = plus(wiki.InternalName);
    if (!mod || mod.kind !== 'mod' || !raw || /\/(PvPMods|Pvp|Conclave)\//i.test(mod.id)) continue;
    const at = key => ({ ...raw.source, pointer: raw.source.pointer + '/' + pointer(key) });
    const metadata = key => source(modDoc, row, key);
    if (wiki.IsAbilityAugment) {
      const compatible = frameAbilities.filter(frame => parents(frame.id).has(raw.value.compat));
      const ids = new Set(compatible.flatMap(frame => frame.abilities.map(a => a.itemId)));
      const languageKey = typeof raw.value.name === 'string' ? raw.value.name.replace(/Augment\d*Name$/, 'Name') : null;
      let targets = [...ids].filter(id => languageKey !== raw.value.name && plus(id)?.value.name === languageKey);
      let rule = '完整 compat／parentName 确认战甲范围；本地化键 AugmentNName → Name 唯一对应技能';
      const explicit = /^(.+?) Augment\s*:/.exec(wiki.Description ?? '')?.[1];
      if (targets.length !== 1 && explicit) {
        targets = [...ids].filter(id => itemMap.get(id)?.name.en === explicit);
        rule = '完整 compat／parentName 确认战甲范围；Wiki 明确的“技能名 Augment:”在范围内唯一精确匹配';
      }
      if (targets.length !== 1) { fail(mod.id, '技能强化没有唯一明确目标，未生成徽章', [metadata('IsAbilityAugment'), at('compat')]); continue; }
      const evidence = [at('compat'), at('name'), metadata('IsAbilityAugment'), ...(explicit ? [metadata('Description')] : [])];
      add(itemMap.get(targets[0]), mod, evidence, rule, '集团卡');
    } else if (wiki.IsWeaponAugment) {
      const value = raw.value;
      const targets = weapons.filter(weapon => {
        const tags = plus(weapon.id)?.value.compatibilityTags ?? [];
        if ((value.incompatibilityTags ?? []).some(tag => tags.includes(tag))) return false;
        if ((value.compatibilityTags ?? []).length && !value.compatibilityTags.every(tag => tags.includes(tag))) return false;
        return Array.isArray(value.compatibleItems) ? value.compatibleItems.includes(weapon.id) : parents(weapon.id).has(value.compat);
      });
      if (!targets.length) { fail(mod.id, '武器强化缺少可确认的兼容实体，未生成徽章', [metadata('IsWeaponAugment'), at('compat')]); continue; }
      for (const target of targets) add(target, mod, [at(Array.isArray(value.compatibleItems) ? 'compatibleItems' : 'compat'), metadata('IsWeaponAugment'), ...(value.incompatibilityTags ? [at('incompatibilityTags')] : []), ...(value.compatibilityTags ? [at('compatibilityTags')] : []), ...(plus(target.id)?.value.parentName ? [{ ...plus(target.id).source, pointer: plus(target.id).source.pointer + '/parentName' }] : [])], 'Wiki 明确武器强化标记；完整兼容 ID／父类链匹配，检查正反兼容标签；compatibleItems 优先', /\/Mods\/Syndicate\//.test(mod.id) ? '集团卡' : '强化卡');
    }
  }
  const frameDoc = documents.find(doc => doc.source === 'plus-gen' && /\/extras\/wiki\/Warframes\.lua$/.test(doc.file));
  metadataState('Warframes.lua', frameDoc);
  if (frameDoc) for (const row of wikiRecords(frameDoc.value)) {
    const wiki = row.value, frame = itemMap.get(wiki.InternalName);
    if (!wiki.Subsumed || !frame?.abilities?.length) continue;
    const matches = frame.abilities.filter(link => itemMap.get(link.itemId)?.name.en === wiki.Subsumed);
    if (matches.length !== 1) { fail(frame.id, 'Subsumed 在战甲自身技能中没有唯一精确匹配', [source(frameDoc, row, 'Subsumed')]); continue; }
    const ability = itemMap.get(matches[0].itemId), evidence = source(frameDoc, row, 'Subsumed');
    ability.helminth ??= { transferable: true, listedFrames: [], donorFrames: [] };
    ability.helminth.listedFrames.push(frame.id);
    // Prime, Umbra and Conclave entries may document the shared skill but cannot be donated.
    const donor = !/Prime|Umbra|PvP|Conclave/i.test(frame.id) && !/\b(Prime|Umbra)\b/.test(frame.name.en ?? '');
    if (donor) ability.helminth.donorFrames.push(frame.id);
    relations.push({ from: frame.id, to: ability.id, kind: 'subsumed-ability', source: evidence, donor, rule: 'Wiki InternalName → 完整战甲 ID；Subsumed 在自身技能中按英文名称唯一精确匹配' });
    provenance.push({ entityId: ability.id, field: 'helminth.listedFrames[' + JSON.stringify(frame.id) + ']', value: { frameId: frame.id, donor }, status: 'resolved', selected: 0, rule: '同系可移植技能；献出材料须为普通战甲', candidates: [{ value: wiki.Subsumed, rawValue: wiki.Subsumed, transform: 'explicit-subsumed', source: evidence }] });
  }
  for (const item of items) {
    item.augments?.sort((a,b) => compareText(a.itemId,b.itemId));
    if (item.helminth) { item.helminth.listedFrames.sort(compareText); item.helminth.donorFrames.sort(compareText); report.transferableAbilities++; report.donorFrames += item.helminth.donorFrames.length; }
  }
  return report;
}
