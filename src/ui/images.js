export async function decorateImages(api, entries, detail = false) {
  if (!entries.length) return;
  // Keep each response below the byte budget; a dense page must not starve its last images.
  if (entries.length > 16) { for (let i = 0; i < entries.length; i += 16) await decorateImages(api, entries.slice(i, i + 16), detail); return; }
  try {
    const images = await api.images(entries.map(({ id, imageName, blueprint, resultId, resultImageName, icon, abilityIcon }) => ({ id, imageName, blueprint, resultId, resultImageName, icon, abilityIcon })));
    images.forEach((image, index) => {
      const { card, label } = entries[index];
      if (!image || !card.isConnected || card.querySelector(':scope > .local-item-image')) return;
      const composite = Array.isArray(image.layers);
      const picture = document.createElement(composite ? 'span' : 'img');
      picture.className = `local-item-image${detail ? ' detail-image' : ''}${composite ? ' blueprint-image' : ''}${image.kind === 'tau-shard' ? ' tau-shard-image' : ''}${image.abilityIcon ? ' wfcd-ability-image' : ''}`;
      const layers = composite ? image.layers : [image];
      picture.title = layers.map(layer => `本地 ${layer.provider === 'official' ? 'DE 官方' : 'WFCD'} 图片 · ${layer.original ?? layer.file}\n匹配方式：${layer.method}`).join('\n');
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
    });
  } catch { /* Optional imagery must never prevent browsing data. */ }
}
