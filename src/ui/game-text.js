import { inlineText, plainGameText } from '../core/inline-tokens.mjs';
export { plainGameText };
export function renderGameText(target, value, mode = 'description') {
  target.replaceChildren();
  if (mode === 'name' || ['OPTION', 'BUTTON', 'SUMMARY'].includes(target.tagName)) {
    target.textContent = plainGameText(value, mode); return target;
  }
  for (const part of inlineText.parse(value)) {
    if (part.kind === 'format') continue;
    if (part.kind === 'break') { target.append(document.createElement('br')); continue; }
    if (part.kind === 'icon') {
      const badge = document.createElement('span'); badge.className = 'game-inline-icon';
      badge.dataset.token = part.token; badge.title = part.raw + ' · ' + part.label;
      if (part.image && /^[a-f0-9]{64}\.png$/.test(part.image)) {
        const img = document.createElement('img'); img.src = new URL('./assets/text-icons/' + part.image, import.meta.url).href;
        img.alt = part.label; img.className = 'game-text-image';
        // A missing runtime asset must not erase the meaning of the source token.
        img.addEventListener('error', () => { badge.textContent = part.label; }, { once: true });
        badge.append(img); badge.classList.add('has-game-text-image');
      } else badge.textContent = part.label;
      target.append(badge);
    } else if (part.kind === 'unknown') {
      const unknown = document.createElement('span'); unknown.className = 'game-inline-unknown'; unknown.title = '未登记文本标记，保留原值'; unknown.textContent = part.text; target.append(unknown);
    } else target.append(document.createTextNode(part.text));
  }
  return target;
}
