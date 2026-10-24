import {composeCardArt} from './card-art.js';
const setIcons=new WeakMap();
async function setIcon(api,meta){
  if(!meta?.set?.icon)return null;
  if(!setIcons.has(api))setIcons.set(api,new Map());
  const cache=setIcons.get(api),key=JSON.stringify(meta.set.icon);
  if(!cache.has(key))cache.set(key,api.images([{...meta.set.icon,hasCardArt:true}]).then(images=>images[0]?.dataUrl??null).catch(()=>{cache.delete(key);return null;}));
  return cache.get(key);
}
export async function decorateImages(api, entries, detail = false) {
  if (!entries.length) return;
  // Keep each response below the byte budget; a dense page must not starve its last images.
  if (entries.length > 16) { for (let i = 0; i < entries.length; i += 16) await decorateImages(api, entries.slice(i, i + 16), detail); return; }
  try {
    const images = await api.images(entries.map(({ id, imageName, blueprint, resultId, resultImageName, icon, abilityIcon, cardArt }) => ({ id, imageName, blueprint, resultId, resultImageName, icon, abilityIcon, hasCardArt: cardArt !== undefined })));
    await Promise.all(images.map(async (image, index) => {
      const { card, label } = entries[index];
      if (!image || !card.isConnected || card.querySelector(':scope > .local-item-image')) return;
      const meta=entries[index].cardArt??image.cardArt;
      const art=await composeCardArt(image,{...entries[index],cardArt:meta,setIconDataUrl:await setIcon(api,meta)});
      if(!card.isConnected)return;
      const original=image;
      if(art)image={...image,dataUrl:art.dataUrl};
      const composite = Array.isArray(image.layers);
      const picture = document.createElement(composite ? 'span' : 'img');
      picture.className = `local-item-image${detail ? ' detail-image' : ''}${composite ? ' blueprint-image' : ''}${image.kind === 'tau-shard' ? ' tau-shard-image' : ''}${image.abilityIcon ? ' wfcd-ability-image' : ''}${art ? ' composed-card-art '+art.kind+'-card-art'+(art.full?' full-mod-card':'') : ''}`;
      const layers = composite ? image.layers : [image];
      picture.title = layers.map(layer => `本地 ${layer.provider === 'official' ? 'DE 官方' : layer.provider === 'wiki' ? 'Warframe Wiki' : 'WFCD'} 图片 · ${layer.original ?? layer.file}\n匹配方式：${layer.method}${layer.note?'\n'+layer.note:''}`).join('\n');
      if(art){picture.dataset.composed=art.kind;if(meta?.set)picture.dataset.modSet=meta.set.id;picture.title='本地拼接 · '+art.kind+' · '+(original.original??original.file)+'\n'+picture.title;if(meta?.set)picture.title+='\n'+meta.set.title+' · 1/'+meta.set.size+' 件套装效果预览';}
      if (composite) { picture.setAttribute('role', 'img'); picture.setAttribute('aria-label', label ?? '蓝图'); }
      layers.forEach(layer => {
        const img = composite ? document.createElement('img') : picture;
        img.alt = composite ? '' : label ?? '';
        if (composite) img.className = `blueprint-layer blueprint-${layer.role}`;
        img.loading = 'lazy'; img.decoding = 'async';
        img.onerror = () => { img.remove(); if (composite && !picture.childElementCount) picture.remove(); };
        img.src = layer.dataUrl;
        if (composite) picture.append(img);
      });
      card.prepend(picture);
    }));
  } catch { /* Optional imagery must never prevent browsing data. */ }
}
