// zoom.js — "fly through the letters" hero.
// A cream canvas covers the photo with AMJA punched out of it. Scrolling
// scales the canvas around the thickest point inside a letter, so the
// letter's interior swallows the screen and you land inside the photo.
// The interior point is found from the canvas pixels themselves, so it
// is exact for any font, size or screen.
import { reduced } from './motion.js';

export async function initZoom({ onReveal } = {}) {
  const sec = document.getElementById('zoom');
  const cv = document.getElementById('zoomMask');
  const gsap = window.gsap, ST = window.ScrollTrigger;
  const copy = sec?.querySelector('.zoom-copy');
  const title = document.getElementById('heroTitle');
  if (!sec || !cv) return;

  const goStatic = () => {
    sec.classList.add('static');
    document.body.classList.remove('page-light');
    onReveal?.(true);
  };
  if (reduced || !gsap || !cv.getContext) { goStatic(); return; }

  const since = sec.querySelector('[data-site="since"]')?.textContent || '1998';
  const WORD = 'AMJA', SUB = `TOURS  ·  SRI LANKA  ·  SINCE ${since}`;
  try { await Promise.race([document.fonts.load('400 200px "Abril Fatface"'), new Promise(r => setTimeout(r, 2500))]); } catch { /* use fallback face */ }

  const ctx = cv.getContext('2d');
  const cream = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#F3ECDF';
  let W, H, dpr, fs, origin = [0, 0], radius = 40, maxScale = 60, baseY, subY;

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = sec.clientWidth; H = sec.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    fs = Math.min(Math.max(104, W * 0.26), 440);
    if (W / H < 0.75) fs = W * 0.29;
    baseY = H * 0.5 + fs * 0.33;
    subY = baseY + Math.max(34, fs * 0.2);
    findInterior();
  }

  function setFont(c, size, weight = 400) {
    c.font = weight === 400 ? `400 ${size}px "Abril Fatface", Georgia, serif` : `${weight} ${size}px Raleway, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    if ('letterSpacing' in c) c.letterSpacing = weight === 400 ? `${0.01 * size}px` : '0px';
  }

  // distance-transform the rendered word to find the deepest interior point
  function findInterior() {
    const sc = 0.25;                              // work at 1/4 res for speed
    const w = Math.ceil(W * sc), h = Math.ceil(H * sc);
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const c = off.getContext('2d');
    c.scale(sc, sc); setFont(c, fs); c.fillStyle = '#000'; c.fillText(WORD, W / 2, baseY);
    const data = c.getImageData(0, 0, w, h).data;
    const INF = 1e9, d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = data[i * 4 + 3] > 128 ? INF : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {      // forward pass
      const i = y * w + x; if (!d[i]) continue;
      const up = y ? d[i - w] + 1 : 0, lf = x ? d[i - 1] + 1 : 0;
      const ul = x && y ? d[i - w - 1] + 1.414 : 0, ur = y && x < w - 1 ? d[i - w + 1] + 1.414 : 0;
      d[i] = Math.min(d[i], up, lf, ul, ur);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { // backward pass
      const i = y * w + x; if (!d[i]) continue;
      const dn = y < h - 1 ? d[i + w] + 1 : 0, rt = x < w - 1 ? d[i + 1] + 1 : 0;
      const dr = x < w - 1 && y < h - 1 ? d[i + w + 1] + 1.414 : 0, dl = x && y < h - 1 ? d[i + w - 1] + 1.414 : 0;
      d[i] = Math.min(d[i], dn, rt, dr, dl);
    }
    let best = -1, bx = w / 2, by = h / 2;
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = d[y * w + x]; if (!v) continue;
      const score = v - 0.012 * Math.hypot(x - cx, y - cy);  // prefer deep AND central
      if (score > best) { best = score; bx = x; by = y; }
    }
    origin = [bx / sc, by / sc];
    radius = Math.max(4, d[Math.round(by) * w + Math.round(bx)] / sc);
    const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - origin[0], y - origin[1])));
    maxScale = (far / radius) * 1.08;
  }

  function draw(s, subAlpha = 1) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cream; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.translate(origin[0], origin[1]); ctx.scale(s, s); ctx.translate(-origin[0], -origin[1]);
    setFont(ctx, fs); ctx.fillStyle = '#000'; ctx.fillText(WORD, W / 2, baseY);
    if (subAlpha > 0.01) {
      ctx.globalAlpha = subAlpha;
      setFont(ctx, Math.max(11, fs * 0.07), 600);
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(4, fs * 0.04)}px`;
      ctx.fillText(SUB, W / 2, subY);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  layout();
  const state = { p: 0, intro: 0 };
  const render = () => {
    const p = state.p;
    const zoomP = Math.min(1, p / 0.62);
    const s = 1 + (maxScale - 1) * Math.pow(zoomP, 2.8);
    draw(s * (0.92 + 0.08 * state.intro), Math.max(0, 1 - p * 5) * state.intro);
    cv.style.opacity = p < 0.6 ? 1 : Math.max(0, 1 - (p - 0.6) / 0.08);
    document.body.classList.toggle('page-light', p < 0.58);
  };
  sec.classList.add('ready');

  // intro: word settles in, copy hidden until we fly through
  gsap.set(copy.children, { autoAlpha: 0, y: 40 });
  gsap.set(sec.querySelector('.zoom-media img'), { scale: 1.25 });
  gsap.to(state, { intro: 1, duration: 1.4, ease: 'expo.out', delay: 0.35, onUpdate: render });
  render();

  const shade = sec.querySelector('.zoom-shade');
  let revealed = false;
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: sec, start: 'top top', end: '+=185%', pin: true, scrub: 0.6, anticipatePin: 1,
      onUpdate: self => {
        state.p = self.progress; render();
        if (self.progress > 0.62 && !revealed) { revealed = true; onReveal?.(); }
      },
    },
  });
  tl.to(sec.querySelector('.zoom-media img'), { scale: 1, ease: 'none', duration: 1 }, 0)
    .to(sec.querySelector('.zoom-meta'), { autoAlpha: 0, duration: 0.12 }, 0.02)
    .to(shade, { opacity: 1, duration: 0.2 }, 0.55)
    .to(copy.children, { autoAlpha: 1, y: 0, stagger: 0.06, duration: 0.25, ease: 'power3.out' }, 0.66);

  let rT;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { layout(); render(); ST.refresh(); }, 180); });
  setTimeout(() => { if (!sec.classList.contains('ready')) goStatic(); }, 4000);
  void title;
}
