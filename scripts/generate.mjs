// Generator profil: ambil data (live via GraphQL atau sampel), render scene 3D bila data berubah, tulis SVG dan README.
// Live:    GH_TOKEN=... node scripts/generate.mjs
// Sampel:  node scripts/generate.mjs --sample sparse|dense|empty [--no-render] [--out dist-sample]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as S from './lib/svg.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const flag = k => process.argv.includes('--' + k);
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'profile.config.json'), 'utf8'));
const OUT = path.resolve(ROOT, arg('out', 'dist'));
const sampleName = arg('sample', null);
const NAME_RE = /^[A-Za-z0-9._-]+$/;
for (const n of [cfg.login, cfg.repo, cfg.featureRepo, ...cfg.portfolioRepos]) if (!NAME_RE.test(n)) throw new Error('nama tidak valid di config: ' + n);

/* ---------- 1. data ---------- */
async function gql(query) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_TOKEN/GITHUB_TOKEN tidak ada');
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'profile-generator' }, body: JSON.stringify({ query }) });
  if (!r.ok) throw new Error(`GraphQL HTTP ${r.status}`);
  const j = await r.json(); if (j.errors) throw new Error('GraphQL: ' + JSON.stringify(j.errors).slice(0, 400));
  return j.data;
}
const REPO_FIELDS = 'name description url stargazerCount pushedAt isTemplate primaryLanguage{name} defaultBranchRef{target{... on Commit{history(first:8){nodes{committedDate}}}}}';
const toRepo = r => r && ({ name: r.name, description: r.description || '', url: r.url, stars: r.stargazerCount, pushedAt: r.pushedAt, isTemplate: !!r.isTemplate, language: r.primaryLanguage?.name || '', commits: (r.defaultBranchRef?.target?.history?.nodes || []).map(n => n.committedDate.slice(0, 10)) });

async function fetchLive() {
  const names = [cfg.featureRepo, ...cfg.portfolioRepos];
  const aliases = names.map((n, i) => `r${i}: repository(owner:"${cfg.login}", name:"${n}"){${REPO_FIELDS}}`).join('\n');
  const q = `query{ user(login:"${cfg.login}"){ login name bio location followers{totalCount} following{totalCount}
    contributionsCollection{ totalCommitContributions totalPullRequestContributions totalIssueContributions totalPullRequestReviewContributions
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } } } } ${aliases} }`;
  const d = await gql(q); const u = d.user; if (!u) throw new Error('user tidak ditemukan');
  const flat = u.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays).slice(-365);
  const cc = u.contributionsCollection;
  const repos = {}; names.forEach((n, i) => { const r = toRepo(d['r' + i]); if (!r) throw new Error('repo tidak ditemukan: ' + n); repos[n] = r; });
  return {
    sample: false, updated: new Date().toISOString(),
    profile: { login: u.login, name: u.name, bio: u.bio, location: u.location, followers: u.followers.totalCount, following: u.following.totalCount },
    start: flat[0].date, days: flat.map(x => x.contributionCount), total: flat.reduce((a, x) => a + x.contributionCount, 0),
    activity: { commit: cc.totalCommitContributions, pr: cc.totalPullRequestContributions, issue: cc.totalIssueContributions, review: cc.totalPullRequestReviewContributions },
    repos,
  };
}
function fetchSample(name) {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/samples', name + '.json'), 'utf8'));
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/fixture.profile.json'), 'utf8'));
  const repos = { [cfg.featureRepo]: s.repo };
  for (const n of cfg.portfolioRepos) repos[n] = fx.repos[n];
  return { sample: true, updated: s.updated, profile: fx.profile, start: s.start, days: s.days, total: s.total, activity: s.activity, repos };
}

const data = sampleName ? fetchSample(sampleName) : await fetchLive();
const day = data.updated.slice(0, 10);
const P = { ...data.profile, ...cfg.profile };
const scenes = {
  header: { sample: data.sample, login: P.login, name: P.name, start: data.start, days: data.days, total: data.total },
  contribution: { sample: data.sample, start: data.start, days: data.days, total: data.total },
  activity: { sample: data.sample, activity: data.activity },
  feature: { sample: data.sample, updated: day + 'T00:00:00Z', repo: data.repos[cfg.featureRepo] },
};

/* ---------- 2. render scene 3D (lewati bila tidak berubah) ---------- */
fs.mkdirSync(OUT, { recursive: true });
const hashFile = path.join(OUT, 'hashes.json');
const prev = fs.existsSync(hashFile) ? JSON.parse(fs.readFileSync(hashFile, 'utf8')) : {};
const next = {};
const sha = s => crypto.createHash('sha1').update(s).digest('hex');
const libHash = sha(fs.readFileSync(path.join(ROOT, 'render/lib/common.js')) + fs.readFileSync(path.join(ROOT, 'render/render.mjs')) + JSON.stringify(cfg.render));
fs.cpSync(path.join(ROOT, 'assets/custom'), path.join(ROOT, 'render/custom'), { recursive: true });
fs.mkdirSync(path.join(ROOT, '.build'), { recursive: true });
const rc = cfg.render;
for (const [name, d] of Object.entries(scenes)) {
  const html = fs.readFileSync(path.join(ROOT, `render/scenes/${name}.html`), 'utf8');
  const h = sha(JSON.stringify(d) + html + libHash);
  next[name] = h;
  const have = fs.existsSync(path.join(OUT, `${name}.webp`)) && fs.existsSync(path.join(OUT, `${name}-static.png`));
  if (prev[name] === h && have) { console.log(`skip ${name} (data tidak berubah)`); continue; }
  if (flag('no-render')) { console.log(`lewati render ${name} (--no-render)`); continue; }
  const df = path.join(ROOT, `.build/${name}.json`); fs.writeFileSync(df, JSON.stringify(d));
  const args = ['render.mjs', `scenes/${name}.html`, `../.build/${name}.json`, path.join(OUT, name), '--fps', rc.fps, '--sec', rc.seconds, '--q', rc.quality, '--w', rc.width, '--h', rc.height, ...(rc.economy ? ['--economy'] : [])].map(String);
  console.log('render', name);
  const r = spawnSync('node', args, { cwd: path.join(ROOT, 'render'), stdio: 'inherit' });
  if (r.status !== 0) { console.error(`render ${name} gagal`); process.exit(1); }
}

/* ---------- 3. SVG ---------- */
const w = (f, s) => fs.writeFileSync(path.join(OUT, f), s);
const avatar = fs.readFileSync(path.join(ROOT, 'assets/custom/avatar-240-q.png')).toString('base64');
const now = Date.parse(data.updated);
w('profile-card.svg', S.profileCard(P, avatar));
w('what-is.svg', S.whatIs(cfg.whatIsThis));
w('skillset.svg', S.skillSet(cfg.skills, path.join(ROOT, 'assets/icons/devicon')));
const pf = cfg.portfolioRepos.map(n => data.repos[n]);
pf.forEach((r, i) => w(`repo-${i}.svg`, S.repoCard(r, i, now)));
const pw = cfg.socials.map(s => S.pillWidth(s.label)); const sumP = pw.reduce((a, b) => a + b, 0);
const fillW = Math.floor((900 - sumP) / 2); const fillR = 900 - sumP - fillW;
cfg.socials.forEach((s, i) => w(`pill-${s.icon}.svg`, S.pill(s.label, s.icon, path.join(ROOT, 'assets/icons'), pw[i])));
w('fill-l.svg', S.filler(fillW, 'l', 'CONNECT')); w('fill-r.svg', S.filler(fillR, 'r'));
w('footer.svg', S.footer(data.updated.slice(0, 16).replace('T', ' ') + ' UTC'));

/* ---------- 4. README ---------- */
const base = `https://raw.githubusercontent.com/${cfg.login}/${cfg.repo}/${cfg.assetsBranch}/`;
const anim = (n, alt) => `<picture><source media="(prefers-reduced-motion: reduce)" srcset="${base}${n}-static.png"><img align="top" width="100%" src="${base}${n}.webp" alt="${alt}"></picture>`;
const svg = (n, alt, wd = '100%') => `<img align="top" width="${wd}" src="${base}${n}.svg" alt="${alt}">`;
const link = (u, inner) => `<a href="${u}">${inner}</a>`;
const pct = x => (Math.floor(x / 9 * 100) / 100).toFixed(2) + '%';
const row = [svg('fill-l', '', pct(fillW))].concat(cfg.socials.map((s, i) => link(s.url, svg('pill-' + s.icon, s.label, pct(pw[i]))))).concat(svg('fill-r', '', pct(fillR))).join('');
const feat = data.repos[cfg.featureRepo];
const readme = `<div align="center">

${anim('header', `${P.login} - cybersecurity learner`)}
${svg('profile-card', `Profile of ${P.login}`)}
${svg('what-is', 'What this profile is')}
${svg('skillset', 'Skill set: systems, languages, tools')}
${link(feat.url, anim('feature', `Featured project ${feat.name}`))}
${anim('contribution', 'Contribution scope for the last 365 days')}
${anim('activity', 'Activity overview by contribution type')}
${pf.map((r, i) => link(r.url, svg(`repo-${i}`, r.name, '49.95%'))).join('')}
${row}
${svg('footer', 'Last update stamp')}

</div>
`;
fs.writeFileSync(path.join(ROOT, 'README.md'), readme);
fs.writeFileSync(hashFile, JSON.stringify(next, null, 1));
console.log('selesai ->', OUT);
