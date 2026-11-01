// Small code-native pixel icons (CAL-08), so the calendar stays readable without the App image library.
// Every icon is decorative: the text next to it carries the meaning, so it is hidden from assistive technology.

const SVG = 'http://www.w3.org/2000/svg';

/**
 * @param {Document} doc  The document of the calendar container; the view never reaches for a global document.
 * @param {'challenge'|'reward'|'upgrade'|'mixed'|'flower'} kind  Any other value draws the mixed icon.
 * @returns {SVGSVGElement}
 */
export function calendarIcon(doc, kind) {
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'cal99-icon');
  const rect = (x, y, width, height, fill) => {
    const element = doc.createElementNS(SVG, 'rect');
    for (const [key, value] of Object.entries({ x, y, width, height, fill })) element.setAttribute(key, String(value));
    svg.append(element);
  };
  if (kind === 'reward') {
    rect(3, 9, 18, 13, '#26384d'); rect(4, 10, 16, 11, '#3888b2');
    rect(2, 7, 20, 5, '#26384d'); rect(3, 8, 18, 3, '#60b1cc');
    rect(10, 8, 4, 13, '#f4c36a'); rect(5, 3, 6, 5, '#26384d');
    rect(13, 3, 6, 5, '#26384d'); rect(6, 4, 4, 2, '#f4c36a');
    rect(14, 4, 4, 2, '#f4c36a'); rect(10, 6, 4, 3, '#e19a44');
  } else if (kind === 'challenge') {
    rect(4, 3, 16, 20, '#384740'); rect(5, 4, 14, 18, '#d2b787');
    rect(7, 6, 11, 15, '#f8f4e6'); rect(9, 1, 6, 5, '#556c70');
    rect(10, 2, 4, 2, '#d2ded6');
    for (const y of [9, 13, 17]) { rect(8, y, 2, 2, '#599374'); rect(12, y, 4, 1, '#7b8981'); }
  } else if (kind === 'upgrade') {
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('d', 'M5 2 9 6 6 9 2 5 2 10 6 13 10 12 19 22 22 19 12 10 13 6 10 2Z');
    path.setAttribute('fill', '#a4c0c1'); path.setAttribute('stroke', '#334e56');
    path.setAttribute('stroke-width', '1.2'); svg.append(path);
    rect(17, 2, 2, 6, '#d5a647'); rect(15, 4, 6, 2, '#edc568');
    rect(4, 18, 2, 2, '#c387a0');
  } else if (kind === 'flower') {
    rect(9, 2, 6, 20, '#a45d76'); rect(2, 9, 20, 6, '#a45d76');
    rect(7, 5, 10, 14, '#e9a2ae'); rect(5, 7, 14, 10, '#e9a2ae');
    rect(9, 9, 6, 6, '#e8bc66'); rect(11, 10, 2, 4, '#fff4ca');
  } else {
    rect(3, 3, 18, 18, '#557a72'); rect(5, 5, 14, 14, '#e8ebe0');
    for (const x of [7, 11, 15]) for (const y of [8, 12, 16]) rect(x, y, 2, 2, '#b7798a');
  }
  return svg;
}
