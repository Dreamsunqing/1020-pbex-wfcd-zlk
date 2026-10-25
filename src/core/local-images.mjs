import { promises as fs } from 'node:fs';
import path from 'node:path';
import { imageOverrides, shardPairs, iconFilename, isAbilityIcon } from './image-presentation.mjs';

const safeName = name => typeof name === 'string' && name.length <= 240 && !/[\\/\x00-\x1f]/.test(name) && /\.(png|jpe?g|webp)$/i.test(name);
const inside = (root, file) => { const relative = path.relative(root, file); return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative); };
const mime = bytes => bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ? 'image/png' : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null;
export class LocalImages {
  async select(directory) {
    let selected = await fs.realpath(directory);
    if (await fs.stat(path.join(selected, 'wfcd/img')).then(s => s.isDirectory(), () => false)) selected = path.join(selected, 'wfcd');
    let root = selected, catalogFile = path.join(selected, 'catalog.json');
    if (path.basename(selected) === 'img') catalogFile = path.join(path.dirname(selected), 'catalog.json');
    else if (await fs.stat(path.join(selected, 'img')).then(s => s.isDirectory(), () => false)) root = await fs.realpath(path.join(selected, 'img'));
    const names = (await fs.readdir(root, { withFileTypes: true })).filter(e => e.isFile() && safeName(e.name)).map(e => e.name);
    if (!names.length) throw new Error('目录内没有 PNG、JPEG 或 WebP 图片');
    const exact = new Set(names), folded = new Map(), ids = new Map(), originals = new Map();
    let blueprintBase;
    for (const name of names) { const key = name.toLowerCase(); folded.set(key, folded.has(key) ? null : name); }
    if (await fs.stat(catalogFile).then(s => s.isFile() && s.size <= 40 * 1024 * 1024, () => false)) {
      const catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
      for (const item of catalog.items ?? []) {
        // The sibling tool also has enemy reference pictures. Only original assets qualify here.
        if (typeof item.id !== 'string' || !item.hasImage || item.imageKind !== 'original' || !safeName(item.assetName)) continue;
        const ref = { name: item.assetName, original: item.resolvedImageName ?? item.imageName, method: 'catalog-id' };
        for (const original of [item.imageName, item.resolvedImageName].filter(safeName)) {
          if (!originals.has(original)) originals.set(original, ref);
          else if (originals.get(original)?.name !== ref.name) originals.set(original, null);
        }
        if (/^blueprint\.png$/i.test(ref.original ?? '') || /^blueprint\.png$/i.test(item.imageName ?? '')) {
          ref.blueprint = true;
          ref.parents = [...new Set((Array.isArray(item.parents) ? item.parents : []).filter(id => typeof id === 'string' && id !== item.id))];
          if (blueprintBase === undefined) blueprintBase = ref;
          else if (blueprintBase?.name !== ref.name) blueprintBase = null;
        }
        if (ids.has(item.id)) {
          const previous = ids.get(item.id);
          if (previous?.name !== ref.name) ids.set(item.id, null);
          else if (previous?.blueprint) previous.parents = [...new Set([...previous.parents, ...(ref.parents ?? [])])];
        } else ids.set(item.id, ref);
      }
    }
    const indexFile = path.join(path.dirname(catalogFile), 'wfcd-image-index.json');
    if (await fs.stat(indexFile).then(s => s.isFile() && s.size <= 40 * 1024 * 1024, () => false)) {
      const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
      const abilityNames = new Set((index.mappings ?? []).filter(item => !ids.has(item.id)).map(item => item.imageName));
      for (const item of index.images ?? []) if (safeName(item.imageName) && safeName(item.assetName) && exact.has(item.assetName)) {
        const ref = { name: item.assetName, original: item.imageName, method: 'full-image-index', abilityIcon: abilityNames.has(item.imageName) };
        if (!originals.has(item.imageName)) originals.set(item.imageName, ref);
        else if (originals.get(item.imageName)?.name !== ref.name) originals.set(item.imageName, null);
      }
      const ambiguous = new Set(Object.keys(index.ambiguousIds ?? {}));
      for (const item of index.mappings ?? []) if (typeof item.id === 'string' && !ids.has(item.id) && !ambiguous.has(item.id)) {
        const ref = originals.get(item.imageName);
        if (ref && ref.name === item.assetName) ids.set(item.id, { ...ref, method: 'full-index-id' });
      }
    }
    const enemyFile=path.join(path.dirname(catalogFile),'enemy-image-index.json');
    const enemyIndex=await fs.stat(enemyFile).then(s=>s.isFile()&&s.size<5*1024*1024?fs.readFile(enemyFile,'utf8'):null,()=>null);
    if(enemyIndex){let parsed;try{parsed=JSON.parse(enemyIndex);}catch{/* An optional portrait index must not disable the existing library. */}for(const row of Array.isArray(parsed?.mappings)?parsed.mappings:[])if(typeof row.id==='string'&&row.id.startsWith('/Lotus/Types/Enemies/')&&safeName(row.assetName)&&exact.has(row.assetName)&&['wiki-internal-id','wiki-agent-avatar-id'].includes(row.basis))ids.set(row.id,{name:row.assetName,original:row.imageName,provider:row.provider??'wiki',method:row.basis,note:'敌人图片按完整 ID 关联；来源 '+row.source?.url});}
    const catalogRoot=path.dirname(catalogFile),contentRoot=path.basename(catalogRoot)==='wfcd'?path.dirname(catalogRoot):catalogRoot,wikiRoot=path.join(contentRoot,'wiki/img');
    const wiki=await fs.readFile(path.join(path.dirname(wikiRoot),'index.json'),'utf8').then(text=>{try{return JSON.parse(text);}catch{return {mappings:[]};}},()=>({mappings:[]}));
    const wikiRefs=new Map();
    for(const row of wiki.mappings??[])if(typeof row.id==='string'&&safeName(row.assetName)&&['wiki-internal-id','wiki-agent-avatar-id','wfcd-explicit-thumbnail','explicit-wiki-page-lead-image'].includes(row.basis))wikiRefs.set(row.id,{name:row.assetName,root:wikiRoot,original:row.imageName,provider:'wiki',imageRole:row.imageRole,method:row.basis,note:'Wiki 明确身份映射 · '+(row.source?.url??row.wikiPage)});
    this.wikiRefs=wikiRefs;this.contentRoot=contentRoot;
    this.root = root; this.exact = exact; this.folded = folded; this.ids = ids; this.originals = originals; this.blueprintBase = blueprintBase;
    return this.status();
  }
  status() { return { available: Boolean(this.root), root: this.root ?? '', files: this.exact?.size ?? 0, catalogIds: this.ids?.size ?? 0 }; }
  reference(id, imageName) {
    const override = imageOverrides[id];
    if (override) {
      const replacement = this.originals?.get(override.imageName);
      if (replacement && this.exact.has(replacement.name)) return { ...replacement, method: 'reviewed-display-override', note: override.reason };
    }
    if(id?.startsWith('/Lotus/Types/Enemies/')&&this.wikiRefs?.has(id))return this.wikiRefs.get(id);
    const ref = this.ids?.get(id);
    if (ref && this.exact.has(ref.name)) return ref;
    if(this.wikiRefs?.has(id))return this.wikiRefs.get(id);
    // Enemy names also name sigils and cosmetics. An unresolved enemy must not
    // fall back to a similarly named portrait across unrelated key spaces.
    if(id?.startsWith('/Lotus/Types/Enemies/'))return null;
    if (!this.root || !safeName(imageName)) return null;
    const catalog = this.originals?.get(imageName);
    if (catalog) return { ...catalog, method: 'catalog-image-name' };
    const name = this.exact.has(imageName) ? imageName : this.folded.get(imageName.toLowerCase());
    return name ? { name, original: imageName, method: name === imageName ? 'exact' : 'case-insensitive', blueprint: /^blueprint\.png$/i.test(imageName) } : null;
  }
  async batch(requests) {
    if (!Array.isArray(requests) || requests.length > 80 || requests.some(r => !r || typeof r !== 'object' || ['id', 'imageName', 'resultId', 'resultImageName', 'icon'].some(key => r[key] !== undefined && typeof r[key] !== 'string') || ['blueprint', 'abilityIcon'].some(key => r[key] !== undefined && typeof r[key] !== 'boolean'))) throw new Error('图片请求无效');
    let remaining = 16 * 1024 * 1024;
    const read = async ref => {
      if (!ref) return null;
      try {
        const assetRoot=ref.root?await fs.realpath(ref.root):this.root;
        if(ref.root&&!inside(this.contentRoot,assetRoot))return null;
        const file = await fs.realpath(path.join(assetRoot, ref.name));
        if (!inside(assetRoot, file)) return null;
        const stat = await fs.stat(file);
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024 || stat.size > remaining) return null;
        const bytes = await fs.readFile(file), type = mime(bytes);
        if (type && bytes.length <= 2 * 1024 * 1024 && bytes.length <= remaining) {
          remaining -= bytes.length;
          return { dataUrl: `data:${type};base64,${bytes.toString('base64')}`, file: ref.name, original: ref.original, method: ref.method, ...(ref.note ? { note: ref.note } : {}),...(ref.provider?{provider:ref.provider}:{}),...(ref.imageRole?{imageRole:ref.imageRole}:{}), ...(ref.abilityIcon || isAbilityIcon(null, ref.original) ? { abilityIcon: true } : {}) };
        }
      } catch { /* Missing or invalid local images leave a text card. */ }
      return null;
    };
    const result = [];
    for (const request of requests) {
      const ref = this.reference(request.id, request.imageName ?? iconFilename(request.icon));
      if (shardPairs[request.id]) {
        const base = await read(this.reference(shardPairs[request.id])), overlay = await read(ref);
        result.push(base && overlay ? { kind: 'tau-shard', layers: [{ ...base, role: 'base' }, { ...overlay, role: 'overlay' }] } : overlay ?? base); continue;
      }
      if (!request.blueprint && !request.resultId && !ref?.blueprint) {
        const image = await read(ref);
        result.push(image ? { ...image, abilityIcon: image.abilityIcon || request.abilityIcon || isAbilityIcon(request.icon, image.original) } : null); continue;
      }
      // Prefer the recipe's exact output. Catalog parents are usable only for a generic
      // blueprint with one unambiguous parent; names and ID suffixes are never guessed.
      const resultId = request.resultId || (ref?.blueprint && ref.parents?.length === 1 ? ref.parents[0] : undefined);
      const productRef = resultId && resultId !== request.id ? this.reference(resultId, request.resultImageName) : null;
      const base = await read(this.reference(undefined, 'blueprint.png') ?? this.blueprintBase ?? (ref?.blueprint ? ref : null));
      const product = productRef?.blueprint ? null : await read(productRef);
      if (base && product) result.push({ kind: 'blueprint', layers: [{ ...base, role: 'base' }, { ...product, role: 'item', itemId: resultId }] });
      else result.push(base ?? product ?? await read(ref));
    }
    return result;
  }
}
