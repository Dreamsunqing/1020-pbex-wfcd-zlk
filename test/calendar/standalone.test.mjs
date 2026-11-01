import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCalendarMount, createCalendarSession, createMemorySelectionStore, validateCalendarCapabilities, validateCalendarDocument } from '../../src/features/calendar-1999/index.mjs';
import { ART_MODES, CLOSE_MODES, DEFAULT_SETTINGS, OPEN_MODES, createFakeCapabilities } from './browser/fake-capabilities.mjs';
import { DEFAULT_CLOCK, FIXTURE_DIR, SCENARIOS, SCENARIO_GROUPS, SERVERS, loadScenario, testFixture } from './browser/scenarios.mjs';
import { PAGE_FILE_PREFIXES, STANDALONE_PAGE, createCalendarStandaloneServer, pageFileOf } from '../../scripts/serve-calendar-standalone.mjs';

// Standalone page and test data (CAL-09). The page itself is driven in Chromium by scripts/check-calendar-standalone-ui.mjs;
// these tests need no browser: they load every scenario through the public entry, check that the fixture files are
// marked and small, keep the fake capabilities honest, and probe the local server's file restriction over real HTTP.
const root = new URL('../../', import.meta.url);
const browserDir = new URL('./browser/', import.meta.url);
const fixtureDir = new URL('./fixtures/scenarios/', import.meta.url);
const read = (file, base = root) => readFileSync(new URL(file, base), 'utf8');
const code = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const specifiers = source => [...code(source).matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]);
const flush = async (rounds = 5) => { for (let round = 0; round < rounds; round++) await new Promise(resolve => setImmediate(resolve)); };
const sessionOf = async (id, server = 'de') => createCalendarSession({ source: (await loadScenario(id, { server })).source, selectionStore: createMemorySelectionStore() });

test('every scenario mounts through the public entry on both servers, and each server keeps its own context', async () => {
  for (const scenario of SCENARIOS) {
    const contexts = new Set();
    for (const { id: server } of SERVERS) {
      const { source, fixture, input } = await loadScenario(scenario.id, { server });
      const document = source.read();
      assert.deepEqual(validateCalendarDocument(document).issues, [], `${scenario.id} on ${server}`);
      assert.equal(document.data.server, server);
      assert.equal(fixture.purpose, 'test');
      assert.ok(['document', 'projection'].includes(input));
      contexts.add(document.contextId);
      assert.ok(createCalendarSession({ source, selectionStore: createMemorySelectionStore() }).read().data);
    }
    // ADR-005: another server is another context, so the SelectionStore keeps the two apart.
    assert.equal(contexts.size, SERVERS.length, `${scenario.id} gives each server its own contextId`);
  }
});

test('the catalog names known groups, existing files, valid presets and clocks, and restates nothing but snapshot status', () => {
  const files = readdirSync(fixtureDir).filter(file => file.endsWith('.json')).sort();
  assert.equal(new Set(SCENARIOS.map(scenario => scenario.id)).size, SCENARIOS.length);
  // Every fixture file is used, and every scenario reads one of them.
  assert.deepEqual([...new Set(SCENARIOS.map(scenario => scenario.file))].sort(), files);
  for (const scenario of SCENARIOS) {
    assert.ok(Object.hasOwn(SCENARIO_GROUPS, scenario.group), scenario.id);
    assert.ok(scenario.title && scenario.summary, scenario.id);
    assert.ok(Object.isFrozen(scenario));
    for (const key of Object.keys(scenario.data ?? {})) assert.ok(['kind', 'stale'].includes(key), `${scenario.id} restates ${key}`);
    const modes = { art: ART_MODES, openItem: OPEN_MODES, close: CLOSE_MODES };
    for (const [key, mode] of Object.entries(scenario.capabilities ?? {})) assert.ok(Object.hasOwn(modes[key] ?? {}, mode), `${scenario.id} ${key}=${mode}`);
    assert.match(scenario.clock ?? DEFAULT_CLOCK, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  }
  for (const key of Object.keys(DEFAULT_SETTINGS)) assert.ok(Object.hasOwn({ art: ART_MODES, openItem: OPEN_MODES, close: CLOSE_MODES }[key], DEFAULT_SETTINGS[key]));
});

test('fixture files are marked as test data, hold one input written for DE, stay small and point nowhere', () => {
  let total = 0;
  for (const file of readdirSync(fixtureDir).filter(name => name.endsWith('.json'))) {
    const text = read(file, fixtureDir);
    const content = JSON.parse(text);
    total += statSync(new URL(file, fixtureDir)).size;
    assert.equal(content.fixture?.purpose, 'test', file);
    assert.match(content.fixture.notice, /测试资料.*不是任何服务器的正式排程/, file);
    assert.ok(content.fixture.description.length > 10, file);
    assert.deepEqual(Object.keys(content).filter(key => key !== 'fixture').length, 1, `${file} holds one input`);
    const input = content.document ?? content.projection;
    assert.ok(input, file);
    // Every file is an offline sample, so the calendar itself says it is no current schedule; only a scenario that
    // restates the snapshot status on purpose (live, stale, imported) looks otherwise.
    const status = content.document?.data ?? content.projection;
    assert.equal(status.server, 'de', file);
    assert.equal(status.kind, 'sample', file);
    if (content.document) assert.ok(content.document.contextId.startsWith('de:'), `${file} contextId starts with its server`);
    assert.ok(statSync(new URL(file, fixtureDir)).size < 16 * 1024, `${file} stays small`);
    // No live API: the only address in the data is the reserved example.invalid, used as long text.
    for (const [, host] of text.matchAll(/https?:\/\/([^/\s"]+)/g)) assert.equal(host, 'example.invalid', file);
  }
  assert.ok(total < 64 * 1024, `all scenario fixtures together stay under 64 KiB (${total} bytes)`);
});

test('the scenarios cover every situation CAL-09 lists', async () => {
  const winter = (await sessionOf('winter')).read();
  assert.equal(winter.season.code, 'CST_WINTER');
  assert.deepEqual(winter.months.map(month => month.month), [1, 2, 3]);
  assert.ok(winter.selected.entries.length > 0, 'normal winter opens on a day with events');

  const spring = (await sessionOf('spring')).read();
  assert.equal(spring.season.code, 'CST_SPRING');
  assert.deepEqual(spring.months.map(month => month.month), [4, 5, 6]);

  // Several events on one day: independent entries, and one projected day made of different events.
  const multi = (await sessionOf('multi')).read();
  const day101 = multi.months[0].days.find(day => day.ordinal === 101);
  assert.deepEqual(day101.entries.map(entry => entry.kind), ['reward', 'challenge', 'upgrade']);
  assert.equal(day101.kind, 'mixed');
  const mixed = (await sessionOf('mixedEntry')).read();
  assert.deepEqual(mixed.months[0].days.find(day => day.ordinal === 19).entries.map(entry => entry.kind), ['mixed']);

  const unknown = (await sessionOf('unknown')).read();
  assert.deepEqual(unknown.months, []);
  assert.equal(unknown.unmapped.length, 2);

  // Empty data: no season at all, and a season without events.
  assert.deepEqual((await sessionOf('empty')).read().seasons, []);
  const quiet = (await sessionOf('quiet')).read();
  assert.deepEqual(quiet.season.entries, []);
  assert.ok(quiet.season.listedDays.length > 0);
  assert.equal(quiet.selected, null);

  // Missing pictures and long text.
  const long = (await loadScenario('long')).source.read();
  const rewards = long.seasons[0].entries.flatMap(entry => entry.rewards);
  assert.ok(rewards.some(reward => reward.libraryId === null));
  assert.ok(rewards.some(reward => reward.name.length > 100));
  assert.ok(long.seasons[0].label.length > 20);
  assert.equal(SCENARIOS.find(scenario => scenario.id === 'long').capabilities.art, 'missing');

  // A stale snapshot of the spring season: same context, so the selection carries over.
  const stale = (await loadScenario('stale')).source.read();
  assert.deepEqual(stale.data, { ...spring.data, kind: 'network', stale: true });
  assert.equal(stale.contextId, (await loadScenario('spring')).source.read().contextId);

  // Failing external operations.
  assert.deepEqual(SCENARIOS.find(scenario => scenario.id === 'failure').capabilities, { art: 'error', openItem: 'error', close: 'error' });
});

test('a file that is not marked as test data is refused, and every load is a fresh copy', async () => {
  const document = (await loadScenario('spring')).source.read();
  assert.throws(() => testFixture({ document }), /not marked as test data/);
  assert.throws(() => testFixture({ fixture: { purpose: 'production' }, document }), /not marked as test data/);
  assert.throws(() => testFixture({ fixture: { purpose: 'test' } }), /exactly one of document or projection/);
  assert.throws(() => testFixture({ fixture: { purpose: 'test' }, document, projection: {} }), /exactly one of document or projection/);
  await assert.rejects(loadScenario('missing'), RangeError);
  await assert.rejects(loadScenario('spring', { server: 'cn' }), RangeError);

  const first = await loadScenario('spring');
  first.fixture.purpose = 'changed';
  const read = first.source.read();
  read.seasons[0].entries.length = 0;
  assert.equal((await loadScenario('spring')).fixture.purpose, 'test');
  assert.equal(first.source.read().seasons[0].entries.length, 3);
});

test('fake capabilities pass the capability check, and the mount turns every failing mode into the contract answer', async () => {
  const settings = { ...DEFAULT_SETTINGS };
  const calls = [], errors = [];
  let closed = 0;
  const capabilities = createFakeCapabilities({ settings, now: () => 42, record: call => calls.push(call), onClose: () => { closed++; } });
  assert.deepEqual(validateCalendarCapabilities(capabilities).issues, []);
  // The pages use them through the mount's guarded copy, so the failing modes are checked there.
  let guarded = null;
  const mount = createCalendarMount({
    view: (container, deps) => { guarded = deps.capabilities; return { update() {}, destroy() {} }; },
    capabilities,
    onError: (error, where) => errors.push(where)
  });
  mount.mount({}, await sessionOf('spring'));
  const ref = { id: '/Test/Reward', name: '测试奖励', libraryId: '/Test/Reward' };

  const art = async mode => { settings.art = mode; return guarded.loadArt(ref); };
  assert.equal((await art('found')).status, 'found');
  assert.deepEqual(await art('missing'), { status: 'missing' });
  assert.deepEqual(await art('broken'), { status: 'found', src: 'data:image/png;base64,broken' });
  assert.deepEqual(await art('error'), { status: 'missing' });
  let settled = false;
  art('pending').then(() => { settled = true; });
  await flush();
  assert.equal(settled, false, 'pending never settles');

  settings.openItem = 'accept';
  assert.equal(guarded.openItem(ref), true);
  settings.openItem = 'unavailable';
  assert.equal(guarded.openItem(ref), false);
  settings.openItem = 'error';
  assert.equal(guarded.openItem(ref), false);

  settings.close = 'accept';
  guarded.close();
  settings.close = 'error';
  guarded.close();
  assert.equal(closed, 1, 'a failing close never reaches the host reaction');
  assert.deepEqual(errors, ['loadArt', 'openItem', 'close']);
  assert.deepEqual(calls.find(call => call[0] === 'openItem'), ['openItem', '/Test/Reward', '/Test/Reward', null]);

  const target = { textContent: '' };
  guarded.renderText(target, '<DT_FIRE>火焰', 'name');
  assert.equal(target.textContent, '<DT_FIRE>火焰', 'unknown tokens stay as written');
  assert.equal(guarded.now(), 42);
  const at = Date.parse('2026-10-28T06:00:00.000Z');
  assert.deepEqual(guarded.formatDeadline('2026-10-26T00:00:00.000Z', '2026-11-02T00:00:00.000Z', at), { text: '114时 0分后结束', ended: false });
  assert.deepEqual(guarded.formatDeadline('2026-10-29T00:00:00.000Z', '2026-11-02T00:00:00.000Z', at), { text: '还有 18时 0分开始', ended: false });
  assert.deepEqual(guarded.formatDeadline('2026-10-19T00:00:00.000Z', '2026-10-26T00:00:00.000Z', at), { text: '已结束', ended: true });
  assert.deepEqual(guarded.formatDeadline('bad', 'bad', at), { text: '', ended: false });
  mount.unmount();
});

test('pageFileOf allows only plain paths to page files inside the calendar folders', () => {
  assert.deepEqual(pageFileOf(STANDALONE_PAGE), { relative: STANDALONE_PAGE.slice(1), type: 'text/html; charset=utf-8' });
  assert.equal(pageFileOf('/src/features/calendar-1999/index.mjs').type, 'text/javascript; charset=utf-8');
  assert.equal(pageFileOf('/src/features/calendar-1999/presentation/calendar.css').type, 'text/css; charset=utf-8');
  assert.equal(pageFileOf('/test/calendar/fixtures/scenarios/spring.json').type, 'application/json; charset=utf-8');
  for (const refused of [
    '/', '/package.json', '/src/ui/index.html', '/src/ui/calendar-1999.js', '/src/core/live-state/view.mjs',
    '/src/data/void-storm-history.json.gz', '/test/calendar/fixtures/contracts/valid-document.json', '/test/calendar/domain.test.mjs',
    '/scripts/serve-calendar-standalone.mjs', '/src/features/calendar-1999/', '/src/features/calendar-1999',
    '/src/features//calendar-1999/index.mjs', '/test/calendar/browser/../../../package.json', '/test/calendar/browser/./standalone.html',
    '/test/calendar/fixtures/scenarios/..%2F..%2F..%2F..%2Fpackage.json', '/test/calendar/fixtures/scenarios/%2e%2e/spring.json',
    '/test/calendar/browser/standalone.html%00', '/test/calendar/browser\\..\\..\\..\\package.json', '/test/calendar/browser/.hidden.json',
    '/src/features/calendar-1999/README.md', '/test/calendar/browser/standalone.html.', 'test/calendar/browser/standalone.html', null
  ]) assert.equal(pageFileOf(refused), null, String(refused));
});

function request(port, target, { method = 'GET', host = `127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    // http.request sends the path as written, so ".." and percent-encoding reach the server unchanged.
    const call = http.request({ host: '127.0.0.1', port, path: target, method, headers: { host } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    call.on('error', reject);
    call.end();
  });
}

async function withServer(options, run) {
  const refused = [];
  const server = await createCalendarStandaloneServer({ port: 0, log: line => refused.push(line), ...options });
  try {
    await run(server.address(), refused);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('the local server listens on loopback and serves only the calendar page files, for GET and HEAD', async () => {
  await withServer({}, async ({ address, port }, refused) => {
    assert.equal(address, '127.0.0.1');
    const home = await request(port, '/');
    assert.equal(home.status, 302);
    assert.equal(home.headers.location, STANDALONE_PAGE);

    const page = await request(port, STANDALONE_PAGE);
    assert.equal(page.status, 200);
    assert.equal(page.headers['content-type'], 'text/html; charset=utf-8');
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.match(page.body, /测试资料，非正式排程/);
    assert.equal((await request(port, STANDALONE_PAGE, { method: 'HEAD' })).body, '');
    assert.equal((await request(port, STANDALONE_PAGE, { host: `localhost:${port}` })).status, 200);
    assert.equal((await request(port, '/src/features/calendar-1999/index.mjs')).headers['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(JSON.parse((await request(port, '/test/calendar/fixtures/scenarios/spring.json')).body).fixture.purpose, 'test');

    // Each of these files exists in the repository, and none of them may leave the server.
    for (const target of [
      '/package.json', '/src/ui/index.html', '/src/ui/calendar-1999.js', '/src/data/void-storm-history.json.gz',
      '/test/calendar/fixtures/contracts/valid-document.json', '/scripts/serve-calendar-standalone.mjs',
      '/test/calendar/browser/../../../package.json', '/test/calendar/fixtures/scenarios/..%2F..%2F..%2F..%2Fpackage.json',
      '/test/calendar/fixtures/scenarios/%2e%2e/%2e%2e/%2e%2e/%2e%2e/package.json', '/src/features/calendar-1999/'
    ]) {
      const response = await request(port, target);
      assert.equal(response.status, 404, target);
      assert.equal(response.body, 'Not found', target);
    }
    assert.equal((await request(port, '/test/calendar/fixtures/scenarios/nothing.json')).status, 404);
    const post = await request(port, STANDALONE_PAGE, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
    // Another host name pointing at 127.0.0.1 (DNS rebinding) gets nothing.
    assert.equal((await request(port, STANDALONE_PAGE, { host: `calendar.example:${port}` })).status, 403);
    assert.ok(refused.some(line => line.includes('/package.json')), 'refusals are logged for the maintainer');
  });
});

test('the server follows no link out of the allowed folders', async () => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'calendar-standalone-'));
  try {
    const browser = path.join(temp, 'test/calendar/browser');
    mkdirSync(browser, { recursive: true });
    mkdirSync(path.join(temp, 'secret'));
    writeFileSync(path.join(temp, 'secret/data.json'), '{"secret":true}');
    writeFileSync(path.join(browser, 'inside.json'), '{"inside":true}');
    // A junction needs no extra privilege on Windows; elsewhere the type is ignored and a directory link is made.
    symlinkSync(path.join(temp, 'secret'), path.join(browser, 'linked'), 'junction');
    await withServer({ root: temp }, async ({ port }) => {
      assert.equal((await request(port, '/test/calendar/browser/inside.json')).status, 200);
      assert.equal((await request(port, '/test/calendar/browser/linked/data.json')).status, 404);
    });
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('the pages load the calendar only through its public entry, and every file they reach is one the server allows', () => {
  assert.deepEqual(specifiers(read('standalone.mjs', browserDir)).sort(), ['../../../src/features/calendar-1999/index.mjs', './fake-capabilities.mjs', './scenarios.mjs']);
  assert.deepEqual(specifiers(read('harness.mjs', browserDir)).sort(), ['./fake-capabilities.mjs', './scenarios.mjs', '/src/features/calendar-1999/index.mjs']);
  assert.deepEqual(specifiers(read('scenarios.mjs', browserDir)), ['../../../src/features/calendar-1999/index.mjs']);
  assert.deepEqual(specifiers(read('fake-capabilities.mjs', browserDir)), []);
  for (const name of ['standalone.mjs', 'scenarios.mjs', 'fake-capabilities.mjs', 'harness.mjs']) {
    assert.doesNotMatch(code(read(name, browserDir)), /workbench|electron|src\/ui\/|src\/core\/|localStorage|indexedDB|fetch\(/, name);
  }

  // Walk the static import graph from both pages; every module must be a file the server would serve.
  const seen = new Set();
  const visit = relative => {
    if (seen.has(relative)) return;
    assert.ok(pageFileOf('/' + relative), `${relative} is served`);
    seen.add(relative);
    for (const specifier of specifiers(read(relative))) {
      visit(specifier.startsWith('/') ? specifier.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier)));
    }
  };
  visit('test/calendar/browser/standalone.mjs');
  visit('test/calendar/browser/harness.mjs');
  assert.ok(seen.has('src/features/calendar-1999/presentation/calendar-view.js'));
  for (const page of ['standalone.html', 'harness.html']) {
    for (const [, link] of read(page, browserDir).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (link.startsWith('data:')) continue;
      const target = link.startsWith('/') ? link.slice(1) : path.posix.normalize(path.posix.join('test/calendar/browser', link));
      assert.ok(pageFileOf('/' + target), `${page} links ${target}`);
    }
  }
  // Fixtures are imported by URL at run time, so the folder they come from must be an allowed one too.
  assert.ok(PAGE_FILE_PREFIXES.includes(FIXTURE_DIR));
});

test('the page says it is test data, and host styles never reach into the calendar', () => {
  const html = read('standalone.html', browserDir);
  assert.match(html, /<html lang="zh-CN" data-purpose="test"/);
  assert.match(html, /<title>[^<]*测试资料，非正式排程[^<]*<\/title>/);
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /class="sa-banner" role="note"/);
  assert.match(html, /不是任何服务器的正式排程/);
  assert.match(html, /href="\.\.\/\.\.\/\.\.\/src\/features\/calendar-1999\/presentation\/calendar\.css"/);
  assert.match(read('standalone.mjs', browserDir), /测试资料 · \$\{scenario\.title\} · \$\{server\.label\} · 不是正式排程/);
  for (const sheet of ['standalone.css', 'harness.css']) assert.doesNotMatch(read(sheet, browserDir), /\.cal99/, sheet);
});

test('switching scenario or server unmounts the old calendar and shows a loading note before any data loads', () => {
  // Driven in Chromium by check-calendar-standalone-ui.mjs with held fixture responses; this keeps the rule in npm test.
  const open = code(read('standalone.mjs', browserDir)).match(/async function open\(reason = '挂载'\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(open, 'open() was found');
  const beforeLoad = open.slice(0, open.indexOf('await loadScenario('));
  assert.match(beforeLoad, /mount\.unmount\(\);/);
  assert.match(beforeLoad, /placeholder\('loading', /);
  // Only the latest choice mounts: a load is dropped once a newer open, an unmount or a close took the ticket.
  assert.match(open, /if \(mine !== ticket\) return;[\s\S]*mount\.mount\(slot, session\);/);
});

test('one start command runs the server with Node alone', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['calendar:standalone'], 'node scripts/serve-calendar-standalone.mjs');
  // Node built-ins only, so a clean checkout can start it without npm install.
  assert.ok(specifiers(read('scripts/serve-calendar-standalone.mjs')).every(specifier => specifier.startsWith('node:')));
});
