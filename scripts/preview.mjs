// Pratinjau lokal: menumpuk aset seperti README (tanpa GitHub). Pakai: node scripts/preview.mjs <dir> <out.png> [width]
import { chromium } from '../render/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';
const [dir, out, width = '880'] = process.argv.slice(2);
const d = path.resolve(dir); const base = 'file://' + d + '/';
let md = fs.readFileSync(path.resolve(path.dirname(d), 'README.md'), 'utf8');
md = md.replace(/https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//g, base);
const html = `<!doctype html><meta charset=utf-8><body style="margin:0;background:#0d1117"><div style="width:${width}px;margin:0 auto">${md}</div>`;
const f = path.join(d, '_preview.html'); fs.writeFileSync(f, html);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +width + 40, height: 800 } });
await p.goto('file://' + f); await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true }); await b.close(); fs.rmSync(f);
const sz = await 0; console.log('ok', out);
