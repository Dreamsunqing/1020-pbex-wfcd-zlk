// Blueprint product uses 84%; Tau glow uses 100%. Self-contained: also executed in an isolated Chromium page by the export tool.
export async function composeBlueprintLayers(layers, size = 512) {
  if (!Array.isArray(layers) || layers.length !== 2 || !Number.isInteger(size) || size < 64 || size > 2048) throw new Error('图片合成参数无效');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  for (const layer of layers) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(layer.dataUrl)) throw new Error('只允许本地图片数据');
    const image = new Image(); image.src = layer.dataUrl; await image.decode();
    const box = layer.role === 'item' ? size * .84 : size;
    const ratio = Math.min(box / image.naturalWidth, box / image.naturalHeight);
    const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
    context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  }
  return canvas.toDataURL('image/png');
}
