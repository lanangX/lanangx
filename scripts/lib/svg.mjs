// Pembuat bagian SVG bertema Radar. Semua teks pengguna di-escape; tanpa script, tanpa URL eksternal.
import fs from 'node:fs';
import path from 'node:path';

export const W = 900;
export const C = { bg: '#05070f', deep: '#0a1a3a', grid: '#12356e', phos: '#2f8cff', cyan: '#29d3ff', ice: '#dbe8ff', amber: '#ffb020', dim: '#5d7fb8' };
export const FONT = "ui-monospace,SFMono-Regular,Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono',monospace";

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* Pembungkus teks konservatif: lebar karakter monospace ~0.62 em. */
export function wrap(s, maxChars, maxLines = 99) {
  const words = String(s ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean); const lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (n.length > maxChars && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] = k[maxLines - 1].replace(/\s*\S{0,3}$/, '') + '…'; return k; }
  return lines;
}
export const trunc = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* Bingkai keluarga visual: scanline, vignette ringan, braket sudut. Latar identik di semua bagian agar menyatu. */
export function frame(h, id, { brackets = true } = {}) {
  const m = 10, L = 22;
  const br = brackets ? `<g stroke="${C.phos}" stroke-width="2" fill="none" opacity=".7">
    <path d="M${m} ${m + L}V${m}H${m + L}"/><path d="M${W - m} ${m + L}V${m}H${W - m - L}"/>
    <path d="M${m} ${h - m - L}V${h - m}H${m + L}"/><path d="M${W - m} ${h - m - L}V${h - m}H${W - m - L}"/></g>` : '';
  return {
    defs: `<pattern id="${id}sl" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".16"/></pattern>
      <radialGradient id="${id}vg" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".4"/></radialGradient>`,
    bg: `<rect width="${W}" height="${h}" fill="${C.bg}"/>`,
    fg: `<rect width="${W}" height="${h}" fill="url(#${id}sl)"/><rect width="${W}" height="${h}" fill="url(#${id}vg)"/>${br}`,
  };
}

export function doc(h, id, title, desc, body, { defs = '', style = '' } = {}) {
  const f = frame(h, id);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title><desc>${esc(desc)}</desc>
<defs>${f.defs}${defs}</defs>
<style>text{font-family:${FONT}}${style}@media (prefers-reduced-motion:reduce){.an{animation:none!important}}</style>
${f.bg}${body}${f.fg}
</svg>`;
}

/* Sanitasi SVG pihak ketiga: buang script, handler on*, foreignObject, style, href eksternal; awali id agar tidak bentrok. */
export function inlineIcon(file, x, y, size, pfx, { color = null } = {}) {
  let s = fs.readFileSync(file, 'utf8');
  s = s.replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|foreignObject|style)[\s\S]*?<\/\1>/gi, '').replace(/\son\w+="[^"]*"/gi, '').replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/gi, '');
  s = s.replace(/(xlink:href|href)="(?!#)[^"]*"/gi, '');
  const vb = (s.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 128 128';
  let inner = s.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  inner = inner.replace(/\bid="([^"]+)"/g, `id="${pfx}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pfx}$1)`).replace(/(xlink:href|href)="#([^"]+)"/g, `$1="#${pfx}$2"`);
  if (color) inner = inner.replace(/fill="(?!none)[^"]*"/g, `fill="${color}"`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}">${inner}</svg>`;
}
export const simpleIcon = (file, x, y, size, color) => { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${j.viewBox}"><path d="${j.path}" fill="${color}"/></svg>`; };

/* Sapuan kecil berputar (SMIL). Posisi akhir statis tetap terbaca bila animasi mati. */
export const sweepArc = (cx, cy, r, dur = 8) => `<g><path d="M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 0 1 ${cx + r * Math.sin(.8)} ${cy - r * Math.cos(.8)}Z" fill="${C.phos}" opacity=".22"/><line x1="${cx}" y1="${cy}" x2="${cx + r * Math.sin(.8)}" y2="${cy - r * Math.cos(.8)}" stroke="${C.cyan}" stroke-width="1.5"/>
<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/></g>`;

const kv = (x, y, k, v, vcol = C.ice) => `<text x="${x}" y="${y}" font-size="11" fill="${C.dim}">${esc(k)}</text><text x="${x + 96}" y="${y}" font-size="13" fill="${vcol}">${esc(v)}</text>`;

/* 2. Kartu profil: avatar sebagai target + data block ala kontrol lalu lintas udara */
export function profileCard(p, avatarB64) {
  const H = 300, cx = 150, cy = 150, r = 78;
  const bio = wrap(p.bio || '', 52, 3);
  const rows = [];
  let y = 140; bio.forEach((l, i) => { rows.push(`<text x="${i ? 416 : 416}" y="${y + i * 18}" font-size="13" fill="${C.ice}">${esc(l)}</text>`); });
  const b0 = y - 12;
  const body = `
<g opacity=".9"><circle cx="${cx}" cy="${cy}" r="${r + 22}" fill="none" stroke="${C.grid}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="none" stroke="${C.phos}" stroke-width="2" stroke-dasharray="3 7" opacity=".7"/></g>
${sweepArc(cx, cy, r + 22, 8)}
<clipPath id="pfClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
<image x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" clip-path="url(#pfClip)" style="image-rendering:pixelated" href="data:image/png;base64,${avatarB64}" xlink:href="data:image/png;base64,${avatarB64}"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.cyan}" stroke-width="2"/>
<g stroke="${C.amber}" stroke-width="2.5" fill="none"><path d="M${cx - r - 14} ${cy - r + 4}v-18h18"/><path d="M${cx + r + 14} ${cy - r + 4}v-18h-18"/><path d="M${cx - r - 14} ${cy + r - 4}v18h18"/><path d="M${cx + r + 14} ${cy + r - 4}v18h-18"/></g>
<path d="M${cx + r + 24} ${cy}H372V52" fill="none" stroke="${C.amber}" stroke-width="1.5" opacity=".9"/>
<rect x="372" y="34" width="${W - 40 - 372}" height="${H - 68}" fill="#040c1e" fill-opacity=".8" stroke="${C.phos}" stroke-width="1.5"/><rect x="372" y="34" width="4" height="${H - 68}" fill="${C.amber}"/>
<text x="392" y="58" font-size="11" fill="${C.cyan}" font-weight="bold">OPERATOR  /  PROFILE</text>
<text x="392" y="92" font-size="28" font-weight="bold" fill="${C.ice}">${esc(String(p.name || p.login).toUpperCase())}</text>
<text x="${392 + Math.min(String(p.name || p.login).length, 20) * 17.4 + 14}" y="92" font-size="13" fill="${C.dim}">@${esc(p.login)}</text>
<text x="392" y="${b0 + 12}" font-size="11" fill="${C.dim}">BIO</text>
${bio.map((l, i) => `<text x="440" y="${b0 + 12 + i * 18}" font-size="13" fill="${C.ice}">${esc(l)}</text>`).join('')}
<g transform="translate(392,${b0 + 12 + Math.max(bio.length, 1) * 18 + 10})">
${kv(0, 0, 'LOCATION', p.location || '-')}${kv(300, 0, 'FOLLOWERS', String(p.followers ?? 0))}
${kv(0, 22, 'FOCUS', trunc(p.focus || '-', 24))}${kv(300, 22, 'FOLLOWING', String(p.following ?? 0))}
${p.achievements?.length ? kv(0, 44, 'ACHIEVEMENT', p.achievements.join(', ')) : ''}
</g>`;
  return doc(H, 'pf', `Profile: ${p.name || p.login}`, `Profile card of ${p.login}`, body);
}

/* 3. What is this */
export function whatIs(w) {
  const H = 214;
  const en = wrap(w.en, 84, 3), id = wrap(w.id, 94, 2);
  let y = 78;
  const lines = en.map((l, i) => `<text x="46" y="${y + i * 22}" font-size="15.5" fill="${C.ice}">${esc(l)}</text>`).join(''); y += en.length * 22 + 6;
  const idl = id.map((l, i) => `<text x="46" y="${y + i * 19}" font-size="13" fill="${C.dim}">${esc(l)}</text>`).join(''); y += id.length * 19 + 10;
  const body = `
<text x="46" y="42" font-size="14" fill="${C.cyan}">lanang@kali:~$ <tspan fill="${C.ice}">whoami</tspan></text>
<text x="${46 + 15 * 8.7 + 8 * 8.7 + 6}" y="42" font-size="14" fill="${C.cyan}">_<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;.49;.5;.99;1" dur="1s" repeatCount="indefinite"/></text>
<line x1="46" y1="54" x2="${W - 46}" y2="54" stroke="${C.grid}" stroke-width="1.5"/>
${lines}${idl}
<text x="46" y="${y + 6}" font-size="11.5" fill="${C.cyan}">▸ ${esc(w.find)}</text>`;
  return doc(H, 'wi', 'What this profile is', w.en, body);
}

/* 4. Skill set: sektor setengah lingkaran, tiga cincin (OS, bahasa, alat) */
export function skillSet(sk, iconDir) {
  const H = 360, cx = 450, cy = 330;
  const ring = [
    { name: 'SYSTEMS', r: 80, items: sk.systems },
    { name: 'LANGUAGES', r: 165, items: sk.languages },
    { name: 'TOOLS', r: 250, items: sk.tools },
  ];
  let defs = '', body = '';
  body += `<g fill="none" stroke="${C.phos}" stroke-opacity=".55" stroke-width="1.5">${ring.map(g => `<path d="M${cx - g.r} ${cy}A${g.r} ${g.r} 0 0 1 ${cx + g.r} ${cy}"/>`).join('')}<path d="M${cx} ${cy}V${cy - 262}"/></g>`;
  body += `<clipPath id="skClip"><rect x="0" y="0" width="${W}" height="${cy}"/></clipPath><g clip-path="url(#skClip)"><g class="an"><path d="M${cx} ${cy}L${cx - 262 * Math.sin(.5)} ${cy - 262 * Math.cos(.5)}A262 262 0 0 1 ${cx - 262 * Math.sin(.05)} ${cy - 262 * Math.cos(.05)}Z" fill="${C.phos}" opacity=".16"/>
<animateTransform attributeName="transform" type="rotate" values="-84 ${cx} ${cy};84 ${cx} ${cy};-84 ${cx} ${cy}" dur="8s" repeatCount="indefinite"/></g></g>`;
  ring.forEach((g, gi) => {
    const n = g.items.length, span = gi === 0 ? 90 : gi === 1 ? 120 : 150, a0 = -span / 2;
    body += `<text x="${cx - g.r}" y="${cy + 18}" font-size="10" fill="${C.cyan}" text-anchor="middle">${g.name}</text><text x="${cx + g.r}" y="${cy + 18}" font-size="10" fill="${C.dim}" text-anchor="middle">${g.name}</text>`;
    g.items.forEach((it, k) => {
      const a = (n === 1 ? 0 : a0 + span * k / (n - 1)) * Math.PI / 180, x = cx + g.r * Math.sin(a), y = cy - g.r * Math.cos(a);
      body += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="23" fill="${it.light ? '#c9d8f0' : '#061634'}" stroke="${C.phos}" stroke-width="1.5"/>`;
      const f = it.icon && path.join(iconDir, it.icon + '.svg');
      if (f && fs.existsSync(f)) body += inlineIcon(f, (x - 14).toFixed(1), (y - 14).toFixed(1), 28, `i${gi}${k}`);
      else body += `<path d="M${(x - 12).toFixed(1)} ${(y - 7).toFixed(1)}l12 -8 12 8v14l-12 8 -12 -8z" fill="none" stroke="${C.cyan}" stroke-width="1.5"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="10" font-weight="bold" text-anchor="middle" fill="${C.ice}">${esc(String(it.badge || it.name).slice(0, 2).toUpperCase())}</text>`;
      body += `<text x="${x.toFixed(1)}" y="${(y + 38).toFixed(1)}" font-size="10" text-anchor="middle" fill="${C.ice}">${esc(it.name)}</text>`;
    });
  });
  body += `<text x="40" y="38" font-size="13" fill="${C.cyan}" font-weight="bold">SKILL SET  /  SECTOR SCAN</text><text x="40" y="56" font-size="10" fill="${C.dim}">RINGS GROUP SKILLS BY KIND; THEY DO NOT RANK PROFICIENCY</text>`;
  return doc(H, 'sk', 'Skill set', 'Languages, systems and tools', body, { defs });
}

/* 8. Portfolio: satu kartu repo (450 x 210); dua kartu ditaruh berdampingan di README */
export function repoCard(r, idx, now) {
  const w = 450, H = 232, days = r.pushedAt ? Math.max(0, Math.round((now - Date.parse(r.pushedAt)) / 864e5)) : null;
  const ago = days === null ? '' : days === 0 ? 'PUSHED TODAY' : days < 60 ? `PUSHED ${days}D AGO` : days < 700 ? `PUSHED ${Math.round(days / 30)}MO AGO` : `PUSHED ${Math.round(days / 365)}Y AGO`;
  const meta = [r.language ? r.language.toUpperCase() : null, `★ ${r.stars ?? 0}`, r.isTemplate ? 'TEMPLATE' : null, ago].filter(Boolean).join('  ·  ');
  const d = wrap(r.description || 'No description.', 44, 3);
  const f = frame(H, 'rc' + idx, { brackets: false });
  const body = `<rect x="22" y="22" width="${w - 44}" height="${H - 44}" fill="#040c1e" fill-opacity=".8" stroke="${C.phos}" stroke-width="1.5"/><rect x="22" y="22" width="4" height="${H - 44}" fill="${C.amber}"/>
<text x="42" y="46" font-size="10.5" fill="${C.cyan}" font-weight="bold">TRK ${String(idx + 2).padStart(2, '0')}  /  ${esc(trunc(String(r.name).toUpperCase(), 32))}</text>
<text x="42" y="78" font-size="22" font-weight="bold" fill="${C.ice}">${esc(trunc(String(r.name).toUpperCase(), 24))}</text>
<text x="42" y="98" font-size="11" fill="${C.cyan}">${esc(meta)}</text>
${d.map((l, i) => `<text x="42" y="${126 + i * 18}" font-size="12.5" fill="${C.ice}">${esc(l)}</text>`).join('')}
<text x="42" y="${H - 32}" font-size="11" fill="${C.dim}">${esc(String(r.url || '').replace(/^https?:\/\//, ''))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="${esc(r.name)}"><title>${esc(r.name)}</title><desc>${esc(r.description || '')}</desc>
<defs><pattern id="rc${idx}sl" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".16"/></pattern></defs><style>text{font-family:${FONT}}</style>
<rect width="${w}" height="${H}" fill="${C.bg}"/>${body}<rect width="${w}" height="${H}" fill="url(#rc${idx}sl)"/></svg>`;
}

/* 11. Socials: pill + tile pengisi kiri/kanan agar baris lebar 900 dan rata dengan bagian lain */
const PH = 64;
export function pill(label, iconKey, iconDir, wPx) {
  const f = frame(PH, 'sp' + iconKey, { brackets: false });
  const body = `<rect x="6" y="10" width="${wPx - 12}" height="${PH - 20}" rx="10" fill="#061634" stroke="${C.phos}" stroke-width="1.5"/>
${simpleIcon(path.join(iconDir, 'simple', iconKey + '.json'), 24, 20, 24, C.ice)}
<text x="62" y="37" font-size="14" font-weight="bold" fill="${C.ice}">${esc(label)}</text>
<g stroke="${C.amber}" stroke-width="2" fill="none"><path d="M6 18v-8h8"/><path d="M${wPx - 6} 18v-8h-8"/><path d="M6 ${PH - 18}v8h8"/><path d="M${wPx - 6} ${PH - 18}v8h-8"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wPx} ${PH}" width="${wPx}" height="${PH}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>
<defs>${f.defs}</defs><style>text{font-family:${FONT}}</style><rect width="${wPx}" height="${PH}" fill="${C.bg}"/>${body}<rect width="${wPx}" height="${PH}" fill="url(#sp${iconKey}sl)"/></svg>`;
}
export function pillWidth(label) { return Math.round(62 + label.length * 8.6 + 26); }
export function filler(wPx, side, text) {
  const f = frame(PH, 'sf' + side, { brackets: false });
  const body = side === 'l'
    ? `<line x1="${wPx - 70}" y1="32" x2="${wPx}" y2="32" stroke="${C.grid}" stroke-width="1.5"/><text x="${wPx - 80}" y="36" font-size="11" fill="${C.cyan}" text-anchor="end">${esc(text)}</text>`
    : `<line x1="0" y1="32" x2="70" y2="32" stroke="${C.grid}" stroke-width="1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wPx} ${PH}" width="${wPx}" height="${PH}" role="img" aria-hidden="true"><title></title><defs>${f.defs}</defs><style>text{font-family:${FONT}}</style><rect width="${wPx}" height="${PH}" fill="${C.bg}"/>${body}<rect width="${wPx}" height="${PH}" fill="url(#sf${side}sl)"/></svg>`;
}

/* 12. Footer */
export function footer(stamp) {
  const H = 64;
  const body = `<text x="46" y="38" font-size="11.5" fill="${C.dim}">LAST SWEEP  <tspan fill="${C.cyan}">${esc(stamp)}</tspan>   ·   AUTO-UPDATED BY GITHUB ACTIONS</text>
<g transform="translate(${W - 60},32)"><circle r="14" fill="none" stroke="${C.grid}" stroke-width="1.5"/><circle r="7" fill="none" stroke="${C.grid}" stroke-width="1"/>${sweepArc(0, 0, 14, 8)}</g>`;
  return doc(H, 'ft', 'Footer', `Last update ${stamp}`, body);
}
