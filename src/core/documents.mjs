import fs from 'node:fs/promises';
import path from 'node:path';

const inside = (root, file) => { const relative = path.relative(root, file); return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const category = id => id.startsWith('文档/WM/') || id.startsWith('文档/参考资料/WarframeMarket/') ? 'WM' : id.startsWith('文档/归档/') ? '归档' : id.startsWith('文档/入门/') ? '新人入门' : id.startsWith('文档/深入/') ? '深入理解' : id.startsWith('文档/AI/') ? 'AI 协作' : id.startsWith('工具/') ? '工具' : '总览';

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
    if (typeof query !== 'string' || query.length > 300 || !['全部', 'WM', '总览', '新人入门', '深入理解', 'AI 协作', '工具', '归档'].includes(group)) throw new Error('文档筛选无效');
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
  async image({ documentId, href }) {
    await this.read(documentId);
    if (typeof href !== 'string' || href.length > 500 || /[\\\0]/.test(href)) throw new Error('图示链接无效');
    const url = new URL(href, 'https://workbench-docs.invalid/' + documentId);
    if (url.origin !== 'https://workbench-docs.invalid' || url.search || url.hash) throw new Error('仅支持项目本地图示');
    const id = decodeURIComponent(url.pathname.slice(1));
    if (!id.startsWith('文档/图示/') || !/\.(png|jpe?g|webp)$/i.test(id)) throw new Error('图片不在项目图示目录中');
    const root = await fs.realpath(path.join(this.root, '文档/图示'));
    const file = await fs.realpath(path.join(this.root, id));
    if (!inside(root, file)) throw new Error('图示路径超出目录');
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error('图示超过 8 MiB');
    const bytes = await fs.readFile(file);
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
    if (!mime) throw new Error('图示格式无效');
    return { id, dataUrl: `data:${mime};base64,${bytes.toString('base64')}` };
  }
}
