'use strict';
/* Adapted from the merged guide image tool.
MIT License

Copyright (c) 2026 Warframe Guide Images contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

This license covers the tool code. Upstream data licensing and game artwork
are described separately in the bundled source notices.
*/
const path = require('node:path');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');

function safeFilename(value) {
  let name = String(value || '').normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/\s+/g, ' ').trim()
    .replace(/[. ]+$/g, '');
  name = [...name].slice(0, 90).join('').replace(/[. ]+$/g, '') || '未命名图片';
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return name;
}

function exportFilename(item, mode = 'both') {
  const zh = item.label || item.zh || item.name;
  const en = item.englishLabel || item.name;
  const label = mode === 'en' ? en : mode === 'zh' ? zh : zh === en ? zh : `${zh}_${en}`;
  return safeFilename(label) + (path.extname(item.imageName).toLowerCase() || '.png');
}

function resolveImage(contentDir, item) {
  const name = item?.assetName || item?.imageName;
  if (!item?.hasImage || typeof name !== 'string' || !name || name === '.' || name === '..'
      || /[/\\\x00]/.test(name) || path.basename(name) !== name) {
    throw new Error('这条记录暂无可用图片');
  }
  return path.join(contentDir, 'img', name);
}

async function copyWithoutOverwrite(source, directory, filename) {
  const extension = path.extname(filename);
  const stem = filename.slice(0, -extension.length || undefined);
  for (let n = 0; n < 100000; n++) {
    const destination = path.join(directory, n ? `${stem} (${n + 1})${extension}` : filename);
    try {
      await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
      return destination;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('目标文件夹中同名文件过多，请选择其他文件夹');
}

async function writeWithoutOverwrite(bytes, directory, filename) {
  const extension = path.extname(filename), stem = filename.slice(0, -extension.length || undefined);
  for (let n = 0; n < 100000; n++) {
    const destination = path.join(directory, n ? `${stem} (${n + 1})${extension}` : filename);
    try { await fs.writeFile(destination, bytes, { flag: 'wx' }); return destination; }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('目标文件夹中同名文件过多，请选择其他文件夹');
}

function validateIds(ids, lookup) {
  if (!Array.isArray(ids) || !ids.length || ids.length > lookup.size) throw new Error('请选择需要导出的图片');
  return [...new Set(ids)].map(id => {
    const item = lookup.get(id);
    if (!item?.hasImage) throw new Error('选择中有不可用的图片，请重新选择');
    return item;
  });
}

module.exports = { safeFilename, exportFilename, resolveImage, copyWithoutOverwrite, writeWithoutOverwrite, validateIds };
