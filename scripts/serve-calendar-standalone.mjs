import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Local server of the 1999 calendar standalone page (CAL-09). Maintainers work on the calendar view without the App:
// no Electron, no upstream data package, no gzip data or image library, no live API and no game account. It needs
// Node only (no npm install), and serves nothing but the calendar feature and its test pages.
//
//   npm run calendar:standalone                         http://127.0.0.1:1999/
//   node scripts/serve-calendar-standalone.mjs --port 0 any free port
//
// Rules, also listed in 文档/深入/49-1999日历独立执行页面与测试资料.md:
// - Listens on 127.0.0.1 only, and answers only requests whose Host is that address or localhost at its port.
// - GET and HEAD only. "/" redirects to the standalone page; there are no directory listings.
// - A path is served only when it is plain ASCII (letters, digits, ".", "_", "-", "/"), has no empty, "." or ".."
//   segment and no dotfile, ends in .html, .mjs, .js, .css or .json, and lies under one of PAGE_FILE_PREFIXES. Its real
//   path, after symbolic links, must still lie there. Everything else is 404, so the page cannot reach other files.
// - scripts/check-calendar-ui.mjs serves its harness through pageFileOf as well, so both pages see the same files.

export const STANDALONE_PAGE = '/test/calendar/browser/standalone.html';
export const PAGE_FILE_PREFIXES = Object.freeze(['src/features/calendar-1999/', 'test/calendar/browser/', 'test/calendar/fixtures/scenarios/']);
export const PAGE_FILE_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
});
export const DEFAULT_PORT = 1999;
const HOST = '127.0.0.1';
const SAFE_PATH = /^\/[A-Za-z0-9._\-/]+$/;
// Same policy as the pages' own meta tag; frame-ancestors only works as a header.
const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow'
});
const defaultRoot = fileURLToPath(new URL('../', import.meta.url));

/**
 * Decides whether a URL path names a file the calendar pages may load. Pure: it looks at the path only.
 * @param {string} pathname  The path of a request URL, as the URL parser gives it (still percent-encoded).
 * @returns {{relative: string, type: string}|null}  The path relative to the repository root and its content type.
 */
export function pageFileOf(pathname) {
  if (typeof pathname !== 'string' || !SAFE_PATH.test(pathname)) return null;
  const relative = pathname.slice(1);
  // Blocks "..", ".", dotfiles, "//" and a trailing "/"; percent-encoding never reaches here, so nothing decodes into them.
  if (relative.split('/').some(segment => segment === '' || segment.startsWith('.'))) return null;
  const type = PAGE_FILE_TYPES[path.posix.extname(relative)];
  if (!type || !PAGE_FILE_PREFIXES.some(prefix => relative.startsWith(prefix))) return null;
  return { relative, type };
}

// The real path of an allowed file, or null when it is missing, not a file, or leads outside the allowed folders.
async function realFileOf(realRoot, relative) {
  try {
    const real = await fs.realpath(path.join(realRoot, relative));
    const inside = path.relative(realRoot, real).split(path.sep).join('/');
    if (inside === '..' || inside.startsWith('../') || path.isAbsolute(inside) ||!PAGE_FILE_PREFIXES.some(prefix => inside.startsWith(prefix))) return null;
    return (await fs.stat(real)).isFile() ? real : null;
  } catch {
    return null;
  }
}

/**
 * Starts the standalone server and resolves once it listens.
 * @param {{root?: string, port?: number, log?: (line: string) => void}} [options]  root defaults to this repository;
 *        port 0 picks a free port; log receives one line per refused request.
 * @returns {Promise<http.Server>}  server.address().port is the port in use.
 */
export async function createCalendarStandaloneServer({ root = defaultRoot, port = DEFAULT_PORT, log = () => {} } = {}) {
  const realRoot = await fs.realpath(root);
  const server = http.createServer(async (request, response) => {
    const send = (status, headers = {}, body = '') => {
      response.writeHead(status, { ...SECURITY_HEADERS, ...headers });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    const refuse = (status, reason, headers) => {
      log(`拒绝 ${status} ${request.method} ${request.url}（${reason}）`);
      send(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers }, status === 404 ? 'Not found' : reason);
    };
    const { port: own } = server.address();
    // Guards against DNS rebinding: a page on another site cannot reach this server under its own host name.
    if (request.headers.host !== `${HOST}:${own}` && request.headers.host !== `localhost:${own}`) return refuse(403, 'Host 不是本机地址');
    if (request.method !== 'GET' && request.method !== 'HEAD') return refuse(405, '只接受 GET 与 HEAD', { Allow: 'GET, HEAD' });
    let pathname;
    try { pathname = new URL(request.url, `http://${HOST}:${own}`).pathname; } catch { return refuse(400, '无法解析的路径'); }
    if (pathname === '/') return send(302, { Location: STANDALONE_PAGE });
    const file = pageFileOf(pathname);
    const real = file && await realFileOf(realRoot, file.relative);
    if (!real) return refuse(404, file ? '文件不存在或位于允许范围之外' : '不在允许范围');
    let body;
    try { body = await fs.readFile(real); } catch { return refuse(404, '文件无法读取'); }
    send(200, { 'Content-Type': file.type, 'Content-Length': body.length }, body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, () => { server.off('error', reject); resolve(); });
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--port');
  const port = index === -1 ? DEFAULT_PORT : Number(process.argv[index + 1]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('用法：node scripts/serve-calendar-standalone.mjs [--port 端口]（0 到 65535，0 为任意可用端口）');
    process.exit(2);
  }
  let server;
  try {
    server = await createCalendarStandaloneServer({ port, log: line => console.log(line) });
  } catch (error) {
    console.error(`无法在 ${HOST}:${port} 启动（${error.code ?? error.message}）。请改用 --port 指定其他端口，或 --port 0 自动选择。`);
    process.exit(1);
  }
  console.log(`1999 日历独立测试页（测试资料，非正式排程）：http://${HOST}:${server.address().port}/`);
  console.log(`只提供 ${PAGE_FILE_PREFIXES.join('、')} 内的 html、mjs、js、css 与 json；按 Ctrl+C 结束。`);
  const stop = () => { server.close(() => process.exit(0)); server.closeAllConnections(); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
