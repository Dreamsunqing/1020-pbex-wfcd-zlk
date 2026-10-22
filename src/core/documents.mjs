import fs from 'node:fs/promises';
import path from 'node:path';

const inside = (root, file) => { const relative = path.relative(root, file); return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const category = id => id.startsWith('文档/归档/') ? '归档' : id.startsWith('文档/入门/') ? '新人入门' : id.startsWith('文档/深入/') ? '深入理解' : id.startsWith('文档/AI/') ? 'AI 协作' : id.startsWith('工具/') ? '工具' : '总览';

export class DocumentLibrary {
  constructor(root) { this.root = path.resolve(root); }
  async catalog() {
    const rows = [];
    const walk = async relative => {
      const directory = path.join(this.root, relative);
      for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
        const id = relative + '/' + entry.name;
        if (entry.isDirectory()) await walk(id);
        else if (entry.isFile() && entry.name.endsWith('.md')) rows.push(id);
      }
    };
    await walk('文档'); await walk('工具');
    for (const name of ['README.md', '使用说明.md']) if (await fs.stat(path.join(this.root, name)).then(s => s.isFile(), () => false)) rows.push(name);
    return rows.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
  }
  async read(id, known = null) {
    if (typeof id !== 'string' || id.length > 500 || !(known ?? await this.catalog()).includes(id)) throw new Error('文档不在本项目阅读目录中');
    const file = await fs.realpath(path.join(this.root, id));
    if (!inside(await fs.realpath(this.root), file)) throw new Error('文档路径超出项目目录');
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('文档超过 1 MiB，请在编辑器中阅读');
    const text = await fs.readFile(file, 'utf8');
    return { id, title: text.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(id, '.md'), group: category(id), bytes: stat.size, modifiedAt: stat.mtime.toISOString(), text };
  }
  async list({ query = '', group = '全部' } = {}) {
    if (typeof query !== 'string' || query.length > 300 || !['全部', '总览', '新人入门', '深入理解', 'AI 协作', '工具', '归档'].includes(group)) throw new Error('文档筛选无效');
    const tokens = query.normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean), rows = [];
    const known = await this.catalog();
    for (const id of known) {
      if (group !== '全部' && category(id) !== group) continue;
      const row = await this.read(id, known);
      const search = `${row.id} ${row.title} ${row.text}`.normalize('NFKC').toLocaleLowerCase();
      if (tokens.every(token => search.includes(token))) { const { text, ...entry } = row; rows.push(entry); }
    }
    return { rows, total: rows.length };
  }
}
