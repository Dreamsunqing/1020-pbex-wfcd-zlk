import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { RULE_HELP, RULE_HELP_TITLES, RULE_GUIDE_ID } from '../src/core/merge/rule-help.mjs';
const root = new URL('../', import.meta.url);
const contract = JSON.parse(await fs.readFile(new URL('src/data/merge-full-contract.json', root), 'utf8'));
const cell = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
const count = values => Object.entries(values).map(([key, value]) => `${key} ${value}`).join('；');
export function optionReference() {
  const sections = Object.entries(RULE_HELP).map(([section, fields]) => `### ${RULE_HELP_TITLES[section]}\n\n| 选项 | 名称 | 影响步骤 | 功能与填写规则 |\n| --- | --- | --- | --- |\n` + Object.entries(fields).map(([key, [label, stage, text]]) => `| \`${key}\` | ${label} | ${stage} | ${cell(text)} |`).join('\n'));
  const counts = Object.fromEntries(['official', 'plus', 'wfcd', 'oracle'].map(source => [source, contract.catalogs.filter(row => row.source === source).length]));
  return `当前内置合同：schemaVersion **${contract.schemaVersion}**；mappingVersion **${contract.mappingVersion}**；builderVersion **${contract.builderVersion}**；语言 **${contract.locales.join('、')}**；实体上限 **${contract.scope.maxEntities}**。\n\n分类 ${contract.catalogs.length} 条（${count(counts)}）；字段 ${contract.fields.length} 条；嵌套 ${contract.nested.length} 条；别名 ${contract.aliases.length} 条。Oracle 无直接实体分类，不代表其字典和奖励引用未参与。\n\n` + sections.join('\n\n');
}
export function defaultsReference() {
  const fieldRows = contract.fields.map(field => {
    const bounds = [field.min === undefined ? '' : `≥ ${field.min}`, field.max === undefined ? '' : `≤ ${field.max}`, field.precision === undefined ? '' : `小数 ${field.precision} 位`].filter(Boolean).join('，') || '无范围／精度限制';
    return `| ${field.label} | \`${field.key}\` → \`${field.path}\` | ${field.kinds.join('、')} | ${field.type}；${cell(field.unit)} | ${bounds}${field.description ? '。' + cell(field.description) : ''} |`;
  });
  const nestedRows = contract.nested.map(row => `| \`${row.key}\` | \`${row.path}\` | \`${row.relation}\`；${row.reverse ? '目标 → 当前实体' : '当前实体 → 目标'} | ${row.entityKind ? `有数据的子对象可提取为 ${row.entityKind}` : '仅建关系'} |`);
  return `### 默认 ${contract.fields.length} 条字段映射\n\n全部作用于步骤④。未设置单字段优先级，继承全局；默认都未标记 required。比例字段没有设置 max=1，允许超过 100%。以下是**当前规则值**，并不保证游戏实时平衡参数不变。\n\n| 功能 | 来源 → 结果 | 适用类别 | 类型；单位 | 限制与语义 |\n| --- | --- | --- | --- | --- |\n${fieldRows.join('\n')}\n\n### 默认 ${contract.nested.length} 条嵌套映射\n\n当前全部启用；开关同时影响子实体索引和集合关系，见上方 nested 选项。\n\n| 来源字段 | 输出集合 | 关系与方向 | 子实体处理 |\n| --- | --- | --- | --- |\n${nestedRows.join('\n')}\n\n### 默认别名\n\n${contract.aliases.map(row => `- \`${row.mode}\`：\`${row.from}\` → \`${row.to}\`。`).join('\n')}\n\n作用于引用解析；奖励表自身的表路径保持不变。`;
}
export async function syncGuide({ check = false } = {}) {
  const file = new URL(RULE_GUIDE_ID, root), text = await fs.readFile(file, 'utf8');
  let next = text;
  for (const [name, content] of [['rule-options', optionReference()], ['rule-defaults', defaultsReference()]]) {
    const start = `<!-- ${name}:start -->`, end = `<!-- ${name}:end -->`;
    if (!next.includes(start) || !next.includes(end)) throw new Error('文档缺少生成区标记：' + name);
    const before = next.indexOf(start) + start.length, after = next.indexOf(end, before);
    next = next.slice(0, before) + '\n\n' + content + '\n\n' + next.slice(after);
  }
  if (next !== text) { if (check) throw new Error('合并合同文档待同步：node scripts/sync-merge-rule-help.mjs --write'); await fs.writeFile(file, next); }
  return fileURLToPath(file);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = !process.argv.includes('--write');
  console.log(`${check ? '已校验' : '已同步'}：${await syncGuide({ check })}`);
}
