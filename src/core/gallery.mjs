import { fileURLToPath } from 'node:url';
import textIconRegistry from '../data/inline-tokens.generated.mjs';
import { descriptionText, maxRankText } from './localized-text.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { imageOverrides, shardPairs, isAbilityIcon } from './image-presentation.mjs';
import { plainGameText } from './inline-tokens.mjs';

const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const safe = name => typeof name === 'string' && /^[^/\\\x00-\x1f]{1,240}\.(png|jpe?g|webp)$/i.test(name);
const inside = (root, file) => { const rel = path.relative(root, file); return rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
const runtimeIcons= fileURLToPath(new URL('../ui/assets/text-icons/',import.meta.url));
const categories = { TextIcons:'文本图标', Abilities: '技能', Unreferenced: '其他素材', Official: '官方其他' };
const publicRow = row => Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_')));

export class ImageGallery {
  constructor(root, dataRoot) { this.root = root; this.dataRoot = dataRoot; }
  async load() {
    if (this.loading) return this.loading;
    this.loading = this.initialize().catch(error => { this.loading = null; throw error; });
    return this.loading;
  }
  async initialize() {
    const root = this.root ? await fs.realpath(this.root).catch(error=>{if(error.code==='ENOENT')return null;throw error;}) : null;
    const selected = root && (path.basename(root) === 'img' ? path.dirname(root) : root);
    this.content = selected && (path.basename(selected) === 'wfcd' ? path.dirname(selected) : selected);
    const modern = this.content && await fs.stat(path.join(this.content, 'wfcd/catalog.json')).then(s => s.isFile(), () => false);
    const wfcdRoot = modern ? path.join(this.content, 'wfcd') : selected;
    const wfcdDirectory = modern ? 'wfcd/img' : 'img';
    const catalog = wfcdRoot ? await read(path.join(wfcdRoot, 'catalog.json')).catch(error=>{if(error.code==='ENOENT')return null;throw error;}) : null;
    this.libraryMissing=!catalog;
    const inventory = catalog ? await read(path.join(wfcdRoot, 'wfcd-image-index.json')).catch(() => ({ images: [], mappings: [] })) : {images:[],mappings:[]};
    const official = catalog ? await read(path.join(this.content, 'official/index.json')).catch(() => ({ entries: [], assets: [] })) : {entries:[],assets:[]};
    const activeCatalog=catalog ?? {items:[],meta:{categories:[]}};
    const titles = new Map(), kindById = new Map(), descriptions = new Map();
    for (const row of activeCatalog.items) { titles.set(row.id, { zh: row.zh, en: row.name }); kindById.set(row.id, row.category); }
    const walk = (value, english = false, file=null, at='', forcedId=null, priority=0) => {
      if (Array.isArray(value)) { value.forEach((child,i) => walk(child, english,file,at+'/'+i,null,priority)); return; }
      if (!value || typeof value !== 'object') return;
      const id = value.uniqueName ?? value.abilityUniqueName ?? forcedId;
      const label = value.name ?? value.abilityName;
      if (typeof id === 'string' && typeof label === 'string' && (english || /[\u3400-\u9fff]/.test(label))) {
        titles.set(id, { ...titles.get(id), [english ? 'en' : 'zh']: label });
      }
      const description=descriptionText({...value,description:Array.isArray(value.description)&&value.description.every(v=>typeof v==='string')?value.description.join('\n'):value.description});
      if(!english && id && description && priority<=(descriptions.get(id)?.priority ?? Infinity)) {const ranked=maxRankText(value);descriptions.set(id,{priority,value:description,locale:'zh-CN',source:{file,pointer:at+(value.description?'/description':ranked?.pointer??'')},derived:!value.description&&ranked?'max-rank-stats':null});}
      Object.entries(value).forEach(([key,child]) => walk(child, english,file,at+'/'+key.replaceAll('~','~0').replaceAll('/','~1'),key.startsWith('/')?key:null,priority));
    };
    if (this.dataRoot) {
      for (const name of ['Warframes.json', 'Archwing.json']) {
        const rows = await read(path.join(this.dataRoot, 'wfcd-items/data/json', name)).catch(() => null);
        if (rows) walk(rows, true);
      }
      const i18n=path.join(this.dataRoot,'wfcd-items/data/json/i18n/zh.json');
      const dictionary=await read(i18n).catch(()=>null);if(dictionary)walk(dictionary,false,i18n,'',null,2);
      const manifests = path.join(this.dataRoot, 'official-public-export/manifests/zh');
      for (const name of await fs.readdir(manifests).catch(() => [])) if (name.endsWith('.json') && name !== 'ExportManifest.json') {
        walk(await read(path.join(manifests, name)),false,path.join(manifests,name));
      }
    }
    this.rows = []; this.lookup = new Map();
    this.labels = new Map(activeCatalog.meta.categories.map(c => [c.id, c.label]));
    for (const [id, label] of Object.entries(categories)) this.labels.set(id, label);
    const add = row => {
      row.abilityIcon = row.category === 'Abilities' || isAbilityIcon(null, row.imageName);
      row.categoryLabel = this.labels.get(row.category) ?? row.category;
      const name = titles.get(row.id);
      row.label = name?.zh || row.label || row.name || row.imageName;
      const description=descriptions.get(row.id);
      if(description){row.description=description.value;row.descriptionLocale=description.locale;row.descriptionSource=description.source;row.descriptionTransform=description.derived;}
      else if(row.description){row.descriptionLocale='en';row.descriptionFallback=true;}
      row.label = plainGameText(row.label.replace(/\bBlueprint\b/g, '蓝图'), 'name');
      row.englishLabel ||= name?.en || row.name || row.imageName;
      row._search = normalize([row.label, row.englishLabel, row.imageName, row.id, row.token, row.textureLocation, row.categoryLabel,
        ...(row.parents ?? []).flatMap(id => [titles.get(id)?.zh, titles.get(id)?.en])].join(' '));
      if (this.lookup.has(row.key)) return;
      this.rows.push(row); this.lookup.set(row.key, row);
    };
    const textIcons=await read(new URL('../data/text-icon-assets.json',import.meta.url));
    const assetsByFile=new Map(textIcons.assets.map(asset=>[asset.file,asset]));
    for(const [token,entry] of Object.entries(textIconRegistry.entries)) {
      if(!entry.image || !safe(entry.image) || !assetsByFile.has(entry.image))continue;
      const asset=assetsByFile.get(entry.image),mapping=textIcons.tokens[token];
      add({key:'text-icon:'+token,id:'text-icon/'+token,token:'<'+token+'>',name:token,label:entry.label || token,englishLabel:token,provider:'text-icons',category:'TextIcons',imageName:token+'.png',hasImage:true,imageKind:'original',textureLocation:mapping?.texture ?? asset.texture,imageOrigin:asset.source,description:'游戏名称与描述中的内嵌文本图标。标记：<'+token+'>。按 Plus 映射选择图片，保留原始透明 PNG。',imageNote:mapping?'Plus ExportTextIcons 精确映射；复用程序内置文件':'明确标记别名；复用同一内置图片',parents:[],children:[],_asset:entry.image,_runtime:true});
    }
    const used = new Set();
    for (const row of activeCatalog.items) {
      if (row.hasImage) used.add(row.assetName);
      add({ ...row, key: 'wfcd:' + row.id, provider: 'wfcd', _asset: row.assetName, _directory: wfcdDirectory });
    }
    for (const row of inventory.mappings) if (!this.lookup.has('wfcd:' + row.id)) {
      used.add(row.assetName);
      add({ ...row, key: 'wfcd:' + row.id, provider: 'wfcd', category: 'Abilities',
        hasImage: true, imageKind: 'original', parents: [], children: [],
        _asset: row.assetName, _directory: wfcdDirectory });
    }
    for (const row of inventory.images) if (!used.has(row.assetName)) {
      add({ ...row, key: 'wfcd-file:' + row.assetName, id: row.imageName, name: row.imageName,
        provider: 'wfcd', category: 'Unreferenced', hasImage: true, imageKind: 'original',
        parents: [], children: [], _asset: row.assetName, _directory: wfcdDirectory });
    }
    for (const [id, override] of Object.entries(imageOverrides)) {
      const row = this.lookup.get('wfcd:' + id), replacement = inventory.images.find(image => image.imageName === override.imageName);
      if (row && replacement && safe(replacement.assetName)) Object.assign(row, { sourceImageName: row.imageName, imageName: override.imageName, resolvedImageName: override.imageName, _asset: replacement.assetName, imageNote: override.reason, imageMatch: 'reviewed-display-override', hasImage: true });
    }
    const textures = new Map(official.assets.map(row => [row.textureLocation, row]));
    for (const row of official.entries) {
      const asset = textures.get(row.textureLocation), existing = this.lookup.get('wfcd:' + row.uniqueName);
      const imageName = row.textureLocation.split('!')[0].split('/').at(-1);
      add({ key: 'official:' + row.uniqueName, id: row.uniqueName, provider: 'official',
        category: existing?.category ?? (row.textureLocation.includes('/Abilities/') ? 'Abilities' : 'Official'),
        imageName, name: existing?.name || imageName.replace(/\.[^.]+$/, ''),
        hasImage: Boolean(asset), imageKind: 'original', textureLocation: row.textureLocation,
        description: existing?.description ?? '', parents: existing?.parents ?? [], children: existing?.children ?? [],
        failure: asset ? '' : '官方地址暂不可用（清单记录为 HTTP 404）',
        _asset: asset?.file, _directory: 'official/img' });
    }
    // A generic blueprint image belongs below its exact product. Never infer a
    // product by removing a name suffix; ambiguous parents remain a single image.
    for (const row of this.rows) {
      const shardBase = shardPairs[row.id];
      if (shardBase && row.hasImage) {
        const base = [this.lookup.get(row.provider + ':' + shardBase), this.lookup.get('wfcd:' + shardBase)].find(candidate => candidate?.hasImage);
        if (base) { row.layers = [{ key: base.key, role: 'base' }, { key: row.key, role: 'overlay' }]; row.imageNote = '普通同色源力石叠底，Tau 辉光全尺寸叠顶；源图片保持不变。'; }
        continue;
      }
      const original = this.lookup.get('wfcd:' + row.id);
      if (!row.hasImage || !/^blueprint\.png$/i.test(original?.resolvedImageName ?? original?.imageName ?? '') || original.parents?.length !== 1) continue;
      const product = [this.lookup.get(row.provider + ':' + original.parents[0]), this.lookup.get('wfcd:' + original.parents[0])].find(candidate => candidate?.hasImage);
      if (!product?.hasImage || product.id === row.id || /^blueprint\.png$/i.test(product.resolvedImageName ?? product.imageName)) continue;
      row.layers = [{ key: row.key, role: 'base' }, { key: product.key, role: 'item' }];
      row.imageNote = '蓝图底纹 + 精确关联成品图；复制和保存时导出合成 PNG，源图片保持不变。';
    }
    this.rows.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN', { numeric: true }) || a.key.localeCompare(b.key));
    return this.status();
  }
  status() {
    return { root: this.content, libraryMissing:this.libraryMissing, total: this.rows.length,
      providers: Object.fromEntries(['wfcd', 'official','text-icons'].map(p => [p, this.rows.filter(r => r.provider === p).length])),
      categories: [...this.labels].map(([id, label]) => ({ id, label })) };
  }
  async list({ provider = 'wfcd', category = '', query = '', availability = 'available', offset = 0, limit = 72, selectedKeys = null } = {}) {
    await this.load();
    if (!['all', 'wfcd', 'official','text-icons'].includes(provider) || !['all', 'available', 'missing'].includes(availability)
      || typeof query !== 'string' || query.length > 500 || typeof category !== 'string'
      || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100
      || (selectedKeys !== null && (!Array.isArray(selectedKeys) || selectedKeys.length > 50000 || selectedKeys.some(k => typeof k !== 'string')))) throw new Error('图片筛选参数无效');
    const tokens = normalize(query).split(' ').filter(Boolean), selected = selectedKeys && new Set(selectedKeys);
    const filtered = this.rows.filter(r => (provider === 'all' || r.provider === provider) && (!category || r.category === category)
      && (availability === 'all' || r.hasImage === (availability === 'available')) && (!selected || selected.has(r.key))
      && tokens.every(t => r._search.includes(t)));
    if (tokens.length) {
      const queryText = normalize(query);
      const rank = row => [row.label, row.name, row.englishLabel].some(v => normalize(v) === queryText) ? 0
        : [row.label, row.name, row.englishLabel].some(v => normalize(v).startsWith(queryText)) ? 1 : 2;
      filtered.sort((a, b) => rank(a) - rank(b));
    }
    return { rows: filtered.slice(offset, offset + limit).map(publicRow), total: filtered.length, offset, limit, status: this.status() };
  }
  async detail(key) {
    await this.load(); const row = this.lookup.get(key);
    if (!row) throw new Error('没有找到这条图片记录');
    const relation = id => this.lookup.get('wfcd:' + id) ?? this.lookup.get('official:' + id);
    return { ...publicRow(row), relations: [...new Set([...(row.parents ?? []), ...(row.children ?? [])])].map(relation).filter(Boolean).map(publicRow) };
  }
  async asset(key) {
    await this.load(); const row = this.lookup.get(key);
    if (!row?.hasImage || !safe(row._asset)) throw new Error('这条记录暂无可用图片');
    const root = await fs.realpath(row._runtime ? runtimeIcons : path.join(this.content, row._directory));
    if (!row._runtime && !inside(this.content, root)) throw new Error('图片目录不属于当前资源库');
    const file = await fs.realpath(path.join(root, row._asset));
    if (!inside(root, file)) throw new Error('图片路径不属于当前资源库');
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error('图片文件无效或超过 8 MiB');
    const handle = await fs.open(file, 'r'); const header = Buffer.alloc(12);
    try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
    const mime = header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'image/png'
      : header[0] === 255 && header[1] === 216 && header[2] === 255 ? 'image/jpeg'
        : header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
    if (!mime) throw new Error('文件不是有效图片');
    return { file, bytes: stat.size, mime, item: publicRow(row) };
  }
}
