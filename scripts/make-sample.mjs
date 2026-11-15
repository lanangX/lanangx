// Membuat dataset SAMPEL (bukan data akun) untuk uji scene: sparse, dense, empty.
// Pakai: node scripts/make-sample.mjs
import fs from 'node:fs';

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const N = 365, start = '2025-11-16';
const repo = {
  name: 'redirecthunter', owner: 'lanangX', url: 'https://github.com/lanangX/redirecthunter',
  description: 'Python tool that checks where candidate URLs redirect and which redirect type they use. A validation tool, not an exploitation tool.',
  language: 'Python', stars: 0, pushedAt: '2026-11-12T03:00:00Z',
  commits: ['2026-11-12', '2026-11-09', '2026-11-08', '2026-11-03', '2026-10-28', '2026-10-21', '2026-10-20', '2026-09-30'],
};
function make(name, fn, activity) {
  const days = Array.from({ length: N }, (_, i) => fn(i));
  const total = days.reduce((a, b) => a + b, 0);
  const a = activity || { commit: total, pr: 0, issue: 0, review: 0 };
  const sum = a.commit + a.pr + a.issue + a.review;
  const shares = sum ? [a.commit, a.pr, a.issue, a.review].map(v => Math.round(v / sum * 100)) : [0, 0, 0, 0];
  const out = { sample: true, updated: '2026-11-15T06:00:00Z', login: 'lanangX', name: 'Lanang X', start, days, total, activity: a, shares, repo, palette: { bg: '#05070f' } };
  fs.mkdirSync('data/samples', { recursive: true });
  fs.writeFileSync(`data/samples/${name}.json`, JSON.stringify(out));
  console.log(name, 'total', total, 'aktif', days.filter(Boolean).length);
}
const r1 = rng(7), r2 = rng(99);
make('sparse', i => (i > 300 && r1() < .28) ? Math.floor(r1() * 5) + 1 : (r1() < .02 ? 1 : 0), { commit: 38, pr: 3, issue: 1, review: 0 });
make('dense', i => { const w = (i % 7 === 5 || i % 7 === 6) ? .35 : .85; return r2() < w ? Math.floor(Math.pow(r2(), 2.2) * 22) + 1 : 0; }, { commit: 1210, pr: 180, issue: 64, review: 97 });
make('empty', () => 0);
