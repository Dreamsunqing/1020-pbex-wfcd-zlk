import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createCalendarView } from '../../src/features/calendar-1999/index.mjs';

// Presentation boundary tests (CAL-08). They read the presentation sources and need no DOM; the drawn view, its keyboard
// and focus behaviour, the states and the narrow layout are checked in a real browser by scripts/check-calendar-ui.mjs.
const presentationDir = new URL('../../src/features/calendar-1999/presentation/', import.meta.url);
const read = name => readFileSync(new URL(name, presentationDir), 'utf8');
const code = name => read(name).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const specifiers = name => [...code(name).matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]);
const scripts = readdirSync(presentationDir).filter(name => /\.(mjs|js)$/.test(name));

test('presentation depends only on the view model and its own modules', () => {
  assert.deepEqual(scripts.sort(), ['calendar-view.js', 'icons.js']);
  assert.deepEqual(specifiers('calendar-view.js').sort(), ['../application/view-model.mjs', './icons.js']);
  assert.deepEqual(specifiers('icons.js'), []);
});

test('presentation reaches no global, creates no timer and reads no clock', () => {
  const forbidden = /\b(document|window|globalThis|self|navigator|localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|setTimeout|setInterval|requestAnimationFrame|requestIdleCallback|queueMicrotask|Date|performance|process|require|electron|workbench)\b/;
  for (const name of scripts) assert.doesNotMatch(code(name), forbidden, name);
  // Elements come from the container's own document, so the view works in any document, attached or not.
  assert.match(code('calendar-view.js'), /const doc = container\?\.ownerDocument;/);
});

test('presentation keeps no calendar rule: the state goes only to the model builder, and actions go only to the session', () => {
  const view = code('calendar-view.js');
  // Every session use is one of the CalendarOperations; nothing else of the session or its state is read.
  assert.deepEqual([...new Set(view.match(/session\.\w+/g))].sort(), ['session.move', 'session.read', 'session.selectDay', 'session.selectMonth', 'session.selectSeason']);
  assert.doesNotMatch(view, /\bstate\.\w/, 'CalendarState fields are never read; the model is');
  // A state goes straight to the model builder, whether it comes from an operation or from session.read().
  const builds = view.match(/buildCalendarViewModel\(/g).length;
  assert.equal(view.match(/buildCalendarViewModel\((?:state|session\.read\(\))\)/g).length, builds);
  // No date arithmetic or grid layout of its own: no weekday maths, no month lengths, no 42-slot grid.
  assert.doesNotMatch(view, /%\s*7|\b42\b|\b365\b|getUTC|ordinalToDate|buildSeasonMonths|seasonMonths|monthDates|classifyDay|selectionStore/);
  // Clicks and keys reach the same session operations; the key itself is judged by session.move.
  assert.doesNotMatch(view, /ArrowLeft|ArrowRight|ArrowUp|ArrowDown|'Home'|'End'/);
});

test('update() only reads the session, and only user actions scroll', () => {
  const view = code('calendar-view.js');
  const update = view.match(/\n {4}update\(\) \{([\s\S]*?)\n {4}\},/)?.[1];
  assert.ok(update, 'update() was found');
  // No operation, so no selection change and no store write; no source access and no timer either.
  assert.deepEqual(update.match(/session\.\w+/g), ['session.read']);
  assert.doesNotMatch(update, /select\w*\(|move\(|source|setTimeout|setInterval|requestAnimationFrame/);
  assert.match(update, /draw\(next, refocus\(\), \{ reveal: false \}\)/, 'a repaint from update() never scrolls');
  // Only draw() scrolls, only when asked to reveal, and only as far as needed.
  assert.equal(view.match(/scrollIntoView\(/g)?.length, 1);
  assert.match(view, /if \(reveal\) target\.scrollIntoView\(\{ block: 'nearest', inline: 'nearest', behavior: 'instant' \}\);/);
  assert.match(view, /target\.focus\(\{ preventScroll: true \}\);/);
  assert.match(view, /const paint = \(state, focus\) => draw\(buildCalendarViewModel\(state\), focus, \{ reveal: true \}\);/);
});

test('entry kinds come from the model only: no type is inferred from names, text or evidence', () => {
  const view = code('calendar-view.js');
  assert.doesNotMatch(view, /CET_|\.events\b|eventType|evidence\.\w|evidence\[/);
  // Evidence is only ever printed as written.
  assert.equal(view.match(/\.evidence\b/g).length, 1);
  assert.match(view, /JSON\.stringify\(entry\.evidence, null, 2\)/);
  assert.doesNotMatch(view, /\.(name|title|description)\.(includes|match|search|startsWith|endsWith|test)\b|\.test\((term|entry|reward)/);
  // The only notes after terms are keyed by the entry's own kind: a pure upgrade, or a mixed entry that may hold one.
  assert.match(view, /if \(Object\.hasOwn\(ENTRY_NOTES, entry\.kind\)\) article\.append\(el\('p', 'cal99-detail-note', ENTRY_NOTES\[entry\.kind\]\)\);/);
});

test('presentation uses only the capabilities it is handed, and the guarded failure rules are respected', () => {
  const view = code('calendar-view.js');
  assert.deepEqual([...new Set(view.match(/capabilities\.\w+/g))].sort(), ['capabilities.close', 'capabilities.formatDeadline', 'capabilities.loadArt',
    'capabilities.now', 'capabilities.openItem', 'capabilities.renderText']);
  // The countdown is always asked with the host clock (ADR-009).
  assert.match(view, /capabilities\.formatDeadline\(season\.startsAt, season\.endsAt, capabilities\.now\(\)\)/);
  // openItem answering false is shown to the user instead of failing silently.
  assert.match(view, /if \(!capabilities\.openItem\(ref\)\) showStatus\(/);
  // Pictures and jumps are apart (CAL-10): every reward asks for its picture with its full ID, and only the library
  // target decides whether a reward is a jump control. A picture never turns a card into a button.
  assert.equal(view.match(/capabilities\.loadArt\(/g).length, 1);
  assert.match(view, /capabilities\.loadArt\(\{ id: reward\.id, libraryId: linked\(reward\) \? reward\.libraryId : null \}\)/);
  assert.doesNotMatch(view.slice(view.indexOf('function artSlot('), view.indexOf('function rewardView(')), /if \(!linked\(reward\)\)/);
  assert.match(view, /const card = linked\(reward\)\s*\? button\('cal99-reward is-linked'/);
});

test('the view needs a DOM container and its deps before it draws anything', () => {
  const session = { read() { throw new Error('read before validation'); } };
  assert.throws(() => createCalendarView({}, { session, capabilities: {} }), TypeError);
  assert.throws(() => createCalendarView(null, { session, capabilities: {} }), TypeError);
  const container = { ownerDocument: {}, append() {} };
  assert.throws(() => createCalendarView(container, { capabilities: {} }), /session/);
  assert.throws(() => createCalendarView(container, { session, capabilities: null }), /capabilities/);
});

test('wording never suggests personal progress, a claim or a choice made', () => {
  const view = code('calendar-view.js');
  assert.doesNotMatch(view, /待办|已完成|未完成|已领取|可领取|领取奖励|已解锁|已选择|已选中|下一项|今日|今天/);
  // Rewards stay candidates, and the page says it records no choice and no progress.
  for (const text of ['候选奖励', '排程预览 · 不含个人完成进度', '本页不记录任何选择',
    '此处仅预览公开事件。若包含煞调变，候选效果以游戏内三选一为准；本页不记录个人选择或完成进度。']) assert.ok(view.includes(text), text);
  // The App writes Simplified Chinese; the calendar follows it inside the App (41 · 未决问题第 1 项).
  assert.doesNotMatch(view, /日曆|獎勵|選項|資料庫|國際服|國服|離線樣本|來源/);
});

// --- stylesheet ----------------------------------------------------------------------------------------------------

// Splits a stylesheet into the selector lists of its style rules, at any nesting depth of at-rules.
function selectorLists(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const lists = [];
  const stack = [];
  let buffer = '';
  for (const char of source) {
    if (char === '{') {
      const prelude = buffer.trim();
      buffer = '';
      stack.push(prelude);
      if (!prelude.startsWith('@')) lists.push(prelude);
    } else if (char === '}') {
      stack.pop();
      buffer = '';
    } else if (char === ';' && buffer.trim().startsWith('@')) {
      lists.push(buffer.trim());
      buffer = '';
    } else buffer += char;
  }
  return lists;
}

test('every stylesheet rule is scoped to the calendar root', () => {
  const css = read('calendar.css');
  const lists = selectorLists(css);
  assert.ok(lists.length > 50, 'the stylesheet was parsed');
  for (const list of lists) {
    assert.doesNotMatch(list, /^@/, `no top-level statement such as @import: ${list}`);
    for (const selector of list.split(',').map(value => value.trim())) {
      assert.match(selector, /^\.cal99(?![\w-])/, `selector outside the calendar root: ${selector}`);
      assert.doesNotMatch(selector, /#|:root|\bhtml\b|\bbody\b|\.ws-/, `selector reaches the App: ${selector}`);
    }
  }
  // Only media-free container queries: the layout follows the calendar's own width, never the viewport.
  const atRules = [...css.matchAll(/@([\w-]+)/g)].map(match => match[1]);
  assert.deepEqual([...new Set(atRules)], ['container']);
  // !important is reserved for keeping [hidden] hidden.
  assert.equal(css.match(/!important/g)?.length, 1);
  assert.match(css, /^\.cal99 \[hidden\] \{ display: none !important; \}$/m);
});

test('descendant rules outweigh App element rules, so App styles do not reshape the calendar', () => {
  for (const list of selectorLists(read('calendar.css'))) {
    for (const selector of list.split(',').map(value => value.trim())) {
      if (selector === '.cal99') continue;
      // ".cal99 .x" (two classes) beats App rules such as ".ws-page svg" (one class and one element) or "button".
      assert.match(selector, /^\.cal99[\s>]+\S/, `descendant rule without the root prefix: ${selector}`);
    }
  }
});

test('the view draws only classes its own stylesheet defines', () => {
  const css = read('calendar.css');
  const defined = new Set([...css.matchAll(/\.(cal99[\w-]*)/g)].map(match => match[1]));
  const used = new Set([...code('calendar-view.js').matchAll(/['" ](cal99-[\w-]+)/g)].map(match => match[1]));
  for (const name of [...code('icons.js').matchAll(/['" ](cal99-[\w-]+)/g)].map(match => match[1])) used.add(name);
  // State classes that only ever appear combined with a defined class.
  for (const name of used) assert.ok(defined.has(name), `${name} has no rule in calendar.css`);
  assert.doesNotMatch(code('calendar-view.js'), /\bws-[\w-]+/, 'the view uses no App class');
});
