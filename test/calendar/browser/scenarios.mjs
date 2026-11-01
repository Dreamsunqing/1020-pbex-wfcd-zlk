import { createWorldStateCalendarSource } from '../../../src/features/calendar-1999/index.mjs';

// Scenario catalog of the 1999 calendar test pages (CAL-09). The standalone page (standalone.html), the harness of the
// browser check (harness.html for scripts/check-calendar-ui.mjs) and test/calendar/standalone.test.mjs all load these
// scenarios, so maintainers and the checks look at the same data. Test data only: never a current schedule.
//
// Rules, also listed in 文档/深入/49-1999日历独立执行页面与测试资料.md:
// - Every scenario reads one fixed file in test/calendar/fixtures/scenarios/. A file holds either a CalendarDocument
//   (`document`) or a host world-state projection (`projection`, converted by the feature's adapter as the App does),
//   next to a `fixture` block that marks it as test data. A file without that mark is refused.
// - A scenario may restate the snapshot status of its file (`data`: kind and stale), never its seasons or entries. The
//   contextId stays the same, so such variants are new snapshots of one season (ADR-005).
// - Fixtures are written for the DE server. Choosing WG changes data.server and the server part of the contextId only,
//   so each server keeps its own selection; the schedule itself stays the same test data.
// - Capability presets and clocks are read by the standalone page only; the harness sets its own.

export const FIXTURE_PURPOSE = 'test';
export const FIXTURE_DIR = 'test/calendar/fixtures/scenarios/';
export const DEFAULT_CLOCK = '2026-10-28T06:00:00.000Z';

const freeze = value => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) Object.values(Object.freeze(value)).forEach(freeze);
  return value;
};

export const SERVERS = freeze([
  { id: 'de', label: '国际服 DE' },
  { id: 'wg', label: '国服 WG' }
]);

export const SCENARIO_GROUPS = freeze({
  normal: '正常排程',
  events: '同日多事件',
  edge: '边界与空资料',
  snapshot: '快照状态',
  capabilities: '外部操作'
});

export const SCENARIOS = freeze([
  { id: 'winter', group: 'normal', title: '正常冬季', file: 'winter.json', clock: '2026-10-22T19:32:27.000Z',
    summary: '宿主投影经世界状态转接器转换：1—3 月三个月份，打开时选中第一个事件日 1 月 3 日（挑战）；19 日两项候选奖励，20 日煞调变三选一。' },
  { id: 'spring', group: 'normal', title: '正常春季', file: 'spring.json',
    summary: '契约范例：4—6 月三个月份；4 月 6 日挑战、11 日候选奖励（可跳转资料库）、14 日煞调变三选一；4 月 1 日只列出、没有事件。' },
  { id: 'seasons', group: 'normal', title: '两个季度', file: 'seasons.json',
    summary: '季度选单可在春季（轮回 24）与夏季（轮回 25）间切换；切换季度回到该季第一个月，不预设日期。' },
  { id: 'multi', group: 'events', title: '同日多笔独立条目', file: 'multi.json',
    summary: '4 月 11 日格内显示 ×3；详情逐笔列出候选奖励、挑战与煞调变，各自保留类型，煞调变条目保留三选一说明。' },
  { id: 'mixedEntry', group: 'events', title: '单笔综合条目', file: 'mixed-entry.json',
    summary: '1 月 19 日是一笔综合事件：两项候选奖励与三项条款，条款编号为「内容 NN」，只显示条件式说明，不当成三选一。' },
  { id: 'unknown', group: 'edge', title: '未知季节', file: 'unknown-season.json',
    summary: '没有日期格；保留标题、季度选单与倒数，提示 CST_UNKNOWN 还没有日期对应规则，并按原始顺序列出两笔事件。' },
  { id: 'unmapped', group: 'edge', title: '日期无法对应本季', file: 'unmapped.json',
    summary: '春季照常显示；详情底部可展开「2 笔事件的日期无法对应本季，已原样保留」，列出原始日序 366 与 200。' },
  { id: 'quiet', group: 'edge', title: '季度没有事件', file: 'quiet.json',
    summary: '日期格没有事件图示，只列出的日子有小方块；打开时不选日期，选到列出的日子时说明上游没有提供事件内容。' },
  { id: 'empty', group: 'edge', title: '空资料', file: 'empty.json',
    summary: '快照没有任何季度：只保留标题列与状态列，显示「这份快照没有可用的 1999 日历。」' },
  { id: 'long', group: 'edge', title: '缺图与长文字', file: 'long.json', capabilities: { art: 'missing' },
    summary: '图片预设为缺图，奖励卡显示代码占位图；资料库未收录的奖励不显示跳转；超长名称与说明换行，不溢出也不截断。' },
  { id: 'stale', group: 'snapshot', title: '过期快照', file: 'spring.json', data: { kind: 'network', stale: true },
    summary: '春季资料标为过期的网络快照：标题列下方提示「快照已过期」，状态列为缓存快照；与春季共用选取。' },
  { id: 'imported', group: 'snapshot', title: '导入快照', file: 'spring.json', data: { kind: 'import', stale: true },
    summary: '春季资料标为导入快照：提示排程以快照时间为准；与春季共用选取。' },
  { id: 'live', group: 'snapshot', title: '实时快照', file: 'spring.json', data: { kind: 'network', stale: false },
    summary: '春季资料标为实时快照：日历内不显示快照提示，只有本页的测试横幅与框线表明这是测试资料；与春季共用选取。' },
  { id: 'failure', group: 'capabilities', title: '外部操作失败', file: 'spring.json', capabilities: { art: 'error', openItem: 'error', close: 'error' },
    summary: '图片请求失败，奖励卡显示占位图；点奖励时跳转抛错，日历显示「资料库暂时无法打开」；点 × 时关闭抛错，日历留在原位。错误都记入操作纪录。' }
]);

export const findScenario = id => SCENARIOS.find(scenario => scenario.id === id) ?? null;
export const findServer = id => SERVERS.find(server => server.id === id) ?? null;

/**
 * Checks that a fixture file is marked as test data and holds exactly one input, then returns a deep copy.
 * @param {unknown} content  The parsed file.
 * @param {string} [file]    For error messages.
 * @returns {{fixture: {purpose: 'test', notice: string, description: string}, document?: object, projection?: object}}
 * @throws {TypeError} When the file is not marked as test data or holds no input or both.
 */
export function testFixture(content, file = 'fixture') {
  if (content?.fixture?.purpose !== FIXTURE_PURPOSE) throw new TypeError(`${file} is not marked as test data: fixture.purpose must be "${FIXTURE_PURPOSE}"`);
  const inputs = ['document', 'projection'].filter(key => content[key] !== undefined);
  if (inputs.length !== 1) throw new TypeError(`${file} needs exactly one of document or projection`);
  return structuredClone(content);
}

// JSON modules load the same way in a browser page and in Node, so the pages and the unit tests share this loader.
async function readFixture(file) {
  const { default: content } = await import(new URL(`../fixtures/scenarios/${file}`, import.meta.url).href, { with: { type: 'json' } });
  return testFixture(content, FIXTURE_DIR + file);
}

function forServer(document, server, data) {
  const { contextId } = document;
  if (typeof contextId !== 'string' || !contextId.startsWith(`${document.data?.server}:`)) {
    throw new TypeError('A scenario document needs a contextId that starts with its server, such as "de:"');
  }
  return { ...document, contextId: `${server}:${contextId.slice(contextId.indexOf(':') + 1)}`, data: { ...document.data, ...data, server } };
}

/**
 * Loads one scenario for one server. The source is what a host hands to createCalendarSession: a projection goes through
 * the feature's world-state adapter, a document is returned as it is, each read a new copy.
 * @param {string} id
 * @param {{server?: 'de'|'wg'}} [options]
 * @returns {Promise<{scenario: object, fixture: object, input: 'document'|'projection',
 *   source: import('../../../src/features/calendar-1999/application/ports.mjs').CalendarSource}>}
 * @throws {RangeError} For an unknown scenario or server. {TypeError} When the file is not a test fixture.
 */
export async function loadScenario(id, { server = 'de' } = {}) {
  const scenario = findScenario(id);
  if (!scenario) throw new RangeError(`Unknown calendar scenario: ${id}`);
  if (!findServer(server)) throw new RangeError(`Unknown calendar server: ${server}`);
  const content = await readFixture(scenario.file);
  if (content.document) {
    const document = forServer(content.document, server, scenario.data);
    return { scenario, fixture: content.fixture, input: 'document', source: Object.freeze({ read: () => structuredClone(document) }) };
  }
  const source = createWorldStateCalendarSource({ ...content.projection, ...scenario.data, server });
  return { scenario, fixture: content.fixture, input: 'projection', source };
}
