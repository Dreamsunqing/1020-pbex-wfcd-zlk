import { readJson } from './io.mjs';
import { safeRelative } from './io.mjs';
export async function loadConfig(file = new URL('../../config/default.json', import.meta.url)) {
  const config = await readJson(file);
  if (config.schemaVersion !== 1 || !Array.isArray(config.sources) || !config.sources.length) throw new Error('配置 schemaVersion/sources 无效');
  if (!Number.isFinite(config.intervalMinutes) || config.intervalMinutes < 1 || config.intervalMinutes > 10080) throw new Error('intervalMinutes 必须为 1–10080');
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1 || config.concurrency > 16) throw new Error('concurrency 必须为 1–16');
  if (config.network?.proxyUrl) {
    const url = new URL(config.network.proxyUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('代理仅支持无凭据的 HTTP/HTTPS 地址；敏感代理配置请使用环境变量');
  }
  const langs = 'de en es fr it ja ko pl pt ru tc th tr uk zh'.split(' ');
  if (!Array.isArray(config.languages) || !config.languages.length || config.languages.some(x => !langs.includes(x)) || new Set(config.languages).size !== config.languages.length) throw new Error('languages 含重复或未知语言');
  const ids = new Set();
  if (!config.sources.some(s => s.enabled === true)) throw new Error('至少启用一个来源');
  for (const source of config.sources) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(source.id) || ids.has(source.id)) throw new Error('来源 id 无效或重复');
    ids.add(source.id);
    safeRelative(source.localPath);
    if (typeof source.enabled !== 'boolean') throw new Error('来源 enabled 必须是布尔值');
    if (!['official', 'github', 'droptables'].includes(source.kind)) throw new Error('未知来源类型');
    if (source.kind === 'github' && (!/^[\w.-]+\/[\w.-]+$/.test(source.repository) || typeof source.branch !== 'string' || !source.branch)) throw new Error('GitHub 来源配置无效');
  }
  if (config.notifications?.email?.enabled) throw new Error('第一版尚未实现邮件通知，请保持 enabled=false');
  return config;
}
