// Pustaka bersama scene radar: palet, fade fosfor, layer 2D, penyaring CRT.
// Semua fungsi deterministik: hasil hanya bergantung pada t (detik) dan window.__DATA__.
import * as THREE from '/node_modules/three/build/three.module.js';
export { THREE };

export const W = 900, H = 400, T = 8, TAU = Math.PI * 2;
export const PAL = {
  bg: 0x05070f, bgHex: '#05070f',
  deep: '#0a1a3a', grid: '#12356e', phos: '#2f8cff', cyan: '#29d3ff',
  ice: '#dbe8ff', amber: '#ffb020', dim: '#5d7fb8', red: '#ff5a4d',
};
export const MONO = '"DejaVu Sans Mono","Liberation Mono","Courier New",monospace';

/* Fade fosfor: ~8% kecerahan tersisa setelah satu putaran penuh (turunan dari paten US7020434;
   nilai k adalah pilihan desain). d = sudut (rad) sejak sapuan lewat, 0..TAU. */
export const K = Math.log(12.5);
export const fade = d => Math.exp(-K * d / TAU);
export const mod = (a, b) => ((a % b) + b) % b;

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function loadImg(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('gagal memuat ' + url)); i.src = url; });
}

export function getData() {
  const D = window.__DATA__;
  if (!D) throw new Error('window.__DATA__ kosong');
  return D;
}

/* Lapisan 2D (canvas) yang digambar ulang tiap frame dan ditempel sebagai quad layar penuh. */
export function layer2d(draw, { opaque = false } = {}) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: !opaque, depthTest: false, depthWrite: false }));
  scene.add(quad);
  return { scene, update(t) { ctx.clearRect(0, 0, W, H); draw(ctx, t); tex.needsUpdate = true; } };
}

export function createStage() {
  const canvas = document.getElementById('c');
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  R.setSize(W, H, false); R.setPixelRatio(1); R.autoClear = false; R.setClearColor(PAL.bg, 1);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { R, ortho };
}

/* Tekstur lingkaran skala radar: cincin jarak, tick bearing tiap 10 derajat, N/E/S/W. */
export function scopeFace({ size = 1024, labels = true, ringCount = 4 } = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const x = cv.getContext('2d');
  const c = size / 2, r = size / 2 - 6;
  const g = x.createRadialGradient(c, c, 0, c, c, r);
  g.addColorStop(0, '#07204a'); g.addColorStop(.7, '#061634'); g.addColorStop(1, '#040b1c');
  x.fillStyle = g; x.beginPath(); x.arc(c, c, r, 0, TAU); x.fill();
  x.strokeStyle = PAL.grid; x.lineWidth = 2;
  for (let i = 1; i <= ringCount; i++) { x.globalAlpha = i === ringCount ? .95 : .55; x.beginPath(); x.arc(c, c, r * i / ringCount * .92, 0, TAU); x.stroke(); }
  x.globalAlpha = .4; x.beginPath(); x.moveTo(c, c - r * .92); x.lineTo(c, c + r * .92); x.moveTo(c - r * .92, c); x.lineTo(c + r * .92, c); x.stroke();
  x.globalAlpha = .9; x.strokeStyle = PAL.phos;
  for (let d = 0; d < 360; d += 10) {
    const a = d / 360 * TAU, long = d % 30 === 0, r0 = r * (long ? .93 : .96), r1 = r;
    x.lineWidth = long ? 3 : 1.5;
    x.beginPath(); x.moveTo(c + r0 * Math.sin(a), c - r0 * Math.cos(a)); x.lineTo(c + r1 * Math.sin(a), c - r1 * Math.cos(a)); x.stroke();
  }
  if (labels) {
    x.globalAlpha = 1; x.fillStyle = PAL.ice; x.font = `bold ${size * .05}px ${MONO}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(([s, d]) => { const a = d / 360 * TAU, rr = r * .84 + 0; x.fillText(s, c + rr * Math.sin(a) * 1.0, c - rr * Math.cos(a) * 1.0 + (d === 0 ? 0 : 0)); });
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/* Penyaring CRT: scanline, vignette, braket sudut. Digambar di lapisan HUD. */
export function crtFinish(ctx, t = 0) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(47,140,255,.7)'; ctx.lineWidth = 2;
  const m = 10, L = 22;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([px, py, sx, sy]) => {
    ctx.beginPath(); ctx.moveTo(px, py + sy * L); ctx.lineTo(px, py); ctx.lineTo(px + sx * L, py); ctx.stroke();
  });
  ctx.restore();
}

export function text(ctx, s, x, y, { size = 14, color = PAL.ice, align = 'left', bold = false, alpha = 1, glow = 0 } = {}) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${MONO}`;
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
  ctx.fillText(s, x, y); ctx.restore();
}

export function wrap(ctx, s, maxW, font) {
  ctx.save(); ctx.font = font; const words = String(s).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const n = cur ? cur + ' ' + w : w; if (ctx.measureText(n).width > maxW && cur) { lines.push(cur); cur = w; } else cur = n; }
  if (cur) lines.push(cur); ctx.restore(); return lines;
}

export function sampleBadge(ctx, D) {
  if (!D.sample) return;
  ctx.save(); ctx.fillStyle = 'rgba(255,176,32,.95)'; ctx.font = `bold 11px ${MONO}`; ctx.textAlign = 'right';
  ctx.fillText('SAMPLE DATA - BUKAN DATA AKUN', W - 22, H - 18); ctx.restore();
}

/* Sprite titik bercahaya (blip). Atribut: position, aSize (satuan dunia), aAlpha, aColor. */
export function blipPoints(count) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uPx: { value: H / (2 * Math.tan(THREE.MathUtils.degToRad(30 / 2))) } },
    vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uPx; varying float vA; varying vec3 vC;
      void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=max(2.0,aSize*uPx/(-mv.z)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5)*2.0; if(d>1.0) discard;
      float core=smoothstep(1.0,.25,d); float glow=exp(-d*d*3.2); gl_FragColor=vec4(vC*(core*.95+glow*.7)*vA,1.0); }`,
  });
  return new THREE.Points(geo, mat);
}

export function hex(c) { return new THREE.Color(c); }
export function toScreen(v, cam) { const p = v.clone().project(cam); return { x: (p.x * .5 + .5) * W, y: (1 - (p.y * .5 + .5)) * H }; }
export function fmtDate(iso) { return iso ? iso.slice(0, 10) : '-'; }
export function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
