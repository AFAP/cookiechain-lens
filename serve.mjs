// 本地静态伺服 dist/，用于在浏览器里验证真实渲染与 API 跨域。
// 不 spawn 子进程（沙箱禁管道 stdio），纯 Node http。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('dist');
const BASE = '/cookiechain-lens';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  // 模拟 GitHub Pages 的项目站点前缀
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  if (p === '' || p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found: ' + p);
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const port = Number(process.env.PORT ?? 8899);
server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${ROOT} at http://127.0.0.1:${port}${BASE}/`);
});
