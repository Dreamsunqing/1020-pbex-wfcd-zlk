import { validLocale } from '../text-localization.mjs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicJson, exists, readJson, safeRelative, withLock } from '../io.mjs';
import { digest, stable, valid } from './contract.mjs';
import { nestedRules } from './nested.mjs';
export const FULL_CONTRACT = JSON.parse(await fs.readFile(new URL('../../data/merge-full-contract.json', import.meta.url), 'utf8'));
export const KINDS = { weapon: '武器', warframe: '战甲／Archwing', companion: '同伴／守护', resource: '资源／部件', blueprint: '蓝图', mod: 'Mod', arcane: '赋能', cosmetic: '外观／浮印', gear: '消耗品／装备', relic: '遗物', enemy: '敌人', animal: '动物／鱼类', ability: '技能', quest: '任务／钥匙', 'quest-item': '任务物品', bounty: '赏金', bundle: '礼包', booster: '增益', achievement: '成就', challenge: '挑战／午夜电波', codex: '资料库', dojo: '氏族研究', faction: '派系', focus: '专精', intrinsic: '内源', 'mission-type': '任务类型', 'mod-set': 'Mod套装', region: '星图节点', syndicate: '集团', system: '星球', tileset: '地图场景', vendor: '商人', extractor: '采集者', misc: '其他', reference: '待补引用' };
const sources = ['official', 'plus', 'wfcd', 'oracle'];
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const safeKey = text => typeof text === 'string' && text.length > 0 && text.length < 160 && !text.split('.').some(part => !part || forbidden.has(part)) && !/[\x00-\x1f]/.test(text);
export function validateRules({ contract, overrides }) {
  if (!contract || contract.schemaVersion !== 2 || contract.scope?.mode !== 'full' || !Number.isInteger(contract.scope.maxEntities) || contract.scope.maxEntities < 1 || contract.scope.maxEntities > 300000) throw new Error('规则规范版本或全量范围上限无效');
  if (!Array.isArray(contract.locales) || !contract.locales.length || new Set(contract.locales).size !== contract.locales.length || contract.locales.some(locale => !validLocale(locale))) throw new Error('规范语言须为唯一、有效的语言代码，例如 zh-CN、en、fr');
  for (const key of ['mappingVersion', 'builderVersion']) if (typeof contract[key] !== 'string' || !/^[a-zA-Z0-9._-]{1,80}$/.test(contract[key])) throw new Error('规则版本标记无效');
  if (!Array.isArray(contract.priority) || new Set(contract.priority).size !== sources.length || contract.priority.length !== sources.length || contract.priority.some(s => !sources.includes(s))) throw new Error('来源优先级须包含四个来源且不可重复');
  if (!Array.isArray(contract.catalogs) || !contract.catalogs.length || contract.catalogs.length > 600 || !Array.isArray(contract.fields) || contract.fields.length > 300 || !Array.isArray(contract.aliases) || contract.aliases.length > 100) throw new Error('分类、字段或别名规则数量无效');
  const ids = new Set();
  for (const rule of contract.catalogs) {
    if (!sources.includes(rule.source) || !Object.hasOwn(KINDS, rule.kind) || !['map', 'array', 'nested', 'group'].includes(rule.shape) || typeof rule.enabled !== 'boolean' || typeof rule.file !== 'string') throw new Error('分类规则的来源、类别、结构或开关无效');
    if (rule.classificationPriority !== undefined && (!Number.isInteger(rule.classificationPriority) || rule.classificationPriority < 0 || rule.classificationPriority > 20)) throw new Error('分类优先级须为 0～20 整数，数字越小越优先');
    safeRelative(rule.file);
    if (!rule.file.endsWith('.json') || rule.file.length > 250 || (rule.shape === 'group' && !safeKey(rule.group)) || (rule.idKey && !safeKey(rule.idKey)) || (rule.locale && !validLocale(rule.locale))) throw new Error('分类规则文件、分组或语言无效');
    const id = `${rule.source}/${rule.file}/${rule.group ?? ''}`; if (ids.has(id)) throw new Error('分类规则重复：' + id); ids.add(id);
  }
  const paths = new Set();
  for (const field of contract.fields) {
    if (!safeKey(field.path) || !safeKey(field.key) || !/^(stats\.[A-Za-z0-9_]+|bundle\.[A-Za-z0-9_]+|masteryRank|tradable|rarity|imageName|icon|custom\.[A-Za-z0-9_]+)$/.test(field.path) || !['number', 'integer', 'string', 'boolean'].includes(field.type) || typeof field.label !== 'string' || !field.label.trim() || !Array.isArray(field.kinds) || !field.kinds.length || field.kinds.some(k => k !== '*' && !Object.hasOwn(KINDS, k))) throw new Error('字段规则的路径、类型、中文名或类别无效');
    if (paths.has(field.path)) throw new Error('字段规则路径重复：' + field.path); paths.add(field.path);
    if (field.required !== undefined && typeof field.required !== 'boolean') throw new Error('必需字段开关须为布尔值');
    if (['min', 'max', 'precision'].some(key => field[key] !== undefined) && !['number', 'integer'].includes(field.type)) throw new Error('仅数值字段支持范围与精度');
    for (const key of ['min', 'max']) if (field[key] !== undefined && (typeof field[key] !== 'number' || !Number.isFinite(field[key]))) throw new Error('字段边界无效');
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) throw new Error('字段最小值大于最大值');
    if (field.precision !== undefined && (!Number.isInteger(field.precision) || field.precision < 0 || field.precision > 10)) throw new Error('字段精度须为 0～10 整数');
    if (field.priority && (!Array.isArray(field.priority) || field.priority.length !== sources.length || new Set(field.priority).size !== sources.length || field.priority.some(s => !sources.includes(s)))) throw new Error('字段优先级须包含四个来源');
  }
  const nested = nestedRules(contract), nestedKeys = new Set();
  if (!Array.isArray(nested) || nested.length > 40) throw new Error('嵌套关联规则数量无效');
  for (const rule of nested) {
    if (!safeKey(rule.key) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(rule.key) || nestedKeys.has(rule.key) || !/^(abilities|components|additionalItems|exaltedItems|custom[A-Z][A-Za-z0-9_]*)$/.test(rule.path) || typeof rule.label !== 'string' || !rule.label.trim() || !/^[a-z][a-z-]{1,60}$/.test(rule.relation) || typeof rule.enabled !== 'boolean' || (rule.reverse !== undefined && typeof rule.reverse !== 'boolean') || (rule.entityKind !== undefined && !Object.hasOwn(KINDS, rule.entityKind))) throw new Error('嵌套关联的字段、路径、关系、类别或开关无效');
    nestedKeys.add(rule.key);
  }
  const aliases = new Set();
  for (const alias of contract.aliases) {
    if (!['prefix', 'exact'].includes(alias.mode) || typeof alias.from !== 'string' || typeof alias.to !== 'string' || !alias.from.startsWith('/') || !alias.to.startsWith('/') || alias.from === '/' || alias.from === alias.to || aliases.has(alias.from)) throw new Error('路径别名必须为不重复的完整路径或明确前缀');
    aliases.add(alias.from);
  }
  if (!overrides || overrides.version !== 1 || !Array.isArray(overrides.entries) || overrides.entries.length > 20000) throw new Error('人工修订格式无效');
  const patches = new Set();
  for (const patch of overrides.entries) {
    const field = contract.fields.find(f => f.path === patch.field) ?? (/^(name|description)\.([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/.test(patch.field) ? { type: 'string' } : /^recipe\.(credits|seconds|quantity)$/.test(patch.field) ? { type: 'number', min: 0 } : null);
    if (!field || typeof patch.entityId !== 'string' || !patch.entityId || typeof patch.reason !== 'string' || !patch.reason.trim() || !/^[a-f0-9]{64}$/.test(patch.expectedSourceHash) || !valid(patch.value, field)) throw new Error('人工修订需有效实体、已建模字段、类型正确的值、预期源哈希与原因');
    const key = patch.entityId + '\0' + patch.field; if (patches.has(key)) throw new Error('人工修订字段重复'); patches.add(key);
  }
  return { valid: true, catalogs: contract.catalogs.filter(r => r.enabled).length, fields: contract.fields.length, overrideCount: overrides.entries.length, revision: digest({ contract, overrides }) };
}
export class RuleStore {
  constructor(root) { this.root = root; }
  async get() {
    const file = path.join(this.root, 'current.json');
    const value = await exists(file) ? await readJson(file) : { contract: structuredClone(FULL_CONTRACT), overrides: { version: 1, entries: [] }, note: '应用内置全量规则', updatedAt: null };
    return { ...value, ...validateRules(value), nestedDefaults: structuredClone(FULL_CONTRACT.nested), hasPrevious: await exists(path.join(this.root, 'previous.json')), kinds: KINDS };
  }
  async save({ contract, overrides, expectedRevision, note }) {
    validateRules({ contract, overrides });
    if (typeof note !== 'string' || !note.trim() || note.length > 1000) throw new Error('请填写本次规则修改说明');
    return withLock(this.root, async () => {
      const current = await this.get(); if (current.revision !== expectedRevision) throw new Error('规则已由其他窗口修改，请重新载入后编辑');
      await atomicJson(path.join(this.root, 'previous.json'), { contract: current.contract, overrides: current.overrides, note: current.note, updatedAt: current.updatedAt });
      await atomicJson(path.join(this.root, 'current.json'), { contract, overrides, note: note.trim(), updatedAt: new Date().toISOString() });
      return this.get();
    });
  }
  async previous() { const old = await readJson(path.join(this.root, 'previous.json')); validateRules(old); return old; }
}
