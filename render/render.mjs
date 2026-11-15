// Render scene three.js -> frame PNG -> WebP animasi + PNG statis.
// Pakai: node render.mjs <scene.html> <data.json> <out-prefix> [--w 900 --h 400 --fps 15 --sec 8 --q 55 --economy]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [scene, dataFile, outPrefix, ...rest] = process.argv.slice(2);
if (!scene || !dataFile || !outPrefix) { console.error('usage: render.mjs <scene.html> <data.json> <out-prefix> [opts]'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : d; };
const economy = rest.includes('--economy');
const W = +opt('w', 900), H = +opt('h', 400), FPS = +opt('fps', 15), SEC = +opt('sec', 8), Q = +opt('q', 55);
const N = FPS * SEC, root = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
let ok = false;
try {
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', e => { throw new Error('scene error: ' + e.message); });
  await page.addInitScript(d => { window.__DATA__ = d; }, data);
  await page.goto(`http://localhost:${port}/${scene}`);
  await page.waitForFunction('window.ready===true', null, { timeout: 60000 });
  for (let i = 0; i < N; i++) {
    await page.evaluate(t => window.renderFrame(t), i * SEC / N);
    await page.locator('canvas').first().screenshot({ path: path.join(tmp, `f${String(i).padStart(3, '0')}.png`) });
  }
  await browser.close();
  const scale = economy ? ['-vf', 'scale=720:-1'] : [];
  const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%03d.png'), ...scale,
    '-c:v', 'libwebp_anim', '-lossless', '0', '-quality', String(Q), '-loop', '0', `${outPrefix}.webp`], { stdio: 'inherit' });
  if (enc.status !== 0) throw new Error('ffmpeg gagal');
  fs.copyFileSync(path.join(tmp, 'f000.png'), `${outPrefix}-static.png`);
  console.log('ok', `${outPrefix}.webp`, fs.statSync(`${outPrefix}.webp`).size, 'bytes');
  ok = true;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  server.close();
  if (!ok) process.exitCode = 1;
}
