// ─────────────────────────────────────────────────────────────
// motion.js — the shared animation kit (GSAP + ScrollTrigger + Lenis).
// Pages opt in with data-attributes so markup stays readable:
//   data-split        headline lines rise out of a mask
//   data-fill         words fill with colour as you scroll (scrubbed)
//   data-fade         fade + lift on enter         (data-delay="0.2")
//   data-stagger      children fade-lift in sequence
//   data-clip         image wipes open with clip-path
//   data-parallax=".2" element drifts while scrolling
//   data-count="1998" number ticks up              (data-suffix="+")
//   data-marquee      infinite ticker, reacts to scroll velocity
//   data-magnetic     element leans toward the cursor
//   data-cursor="View" custom cursor label on hover
// ─────────────────────────────────────────────────────────────
const gsap = window.gsap;
const ST = window.ScrollTrigger;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = matchMedia('(hover: none)').matches;

if (gsap && ST) gsap.registerPlugin(ST);

/* ── Smooth scroll ─────────────────────────────────────────── */
export function initLenis() {
  if (reduced || !window.Lenis || !gsap) return null;
  const lenis = new window.Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, touchMultiplier: 1.4 });
  lenis.on('scroll', ST.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis;
  // in-page anchors go through Lenis
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: -80 });
  });
  return lenis;
}

export function scrollToEl(el, offset = -90) {
  if (!el) return;
  if (window.__lenis) window.__lenis.scrollTo(el, { offset });
  else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY + offset, behavior: 'smooth' });
}

/* ── Text splitting (no paid plugin needed) ────────────────── */
export function splitWords(el) {
  if (el.dataset.splitDone) return [...el.querySelectorAll('.w')];
  const walk = (node) => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p));
          else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; frag.appendChild(s); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
    });
  };
  walk(el);
  el.dataset.splitDone = '1';
  return [...el.querySelectorAll('.w')];
}

export function splitLines(el) {
  const words = splitWords(el);
  const lines = [];
  let top = null, line = null;
  words.forEach(w => {
    const t = w.offsetTop;
    if (top === null || Math.abs(t - top) > 4) { top = t; line = []; lines.push(line); }
    line.push(w);
  });
  // wrap each word in a mask so it can rise from below its own baseline
  words.forEach(w => {
    if (w.parentNode.classList?.contains('wm')) return;
    const m = document.createElement('span'); m.className = 'wm';
    w.parentNode.insertBefore(m, w); m.appendChild(w);
  });
  return lines;
}

export function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map(c => c === ' ' ? '<span class="ch sp">&nbsp;</span>' : `<span class="ch" aria-hidden="true">${c}</span>`).join('');
  return [...el.querySelectorAll('.ch')];
}

/* ── Scroll reveals ────────────────────────────────────────── */
export function initReveals(root = document) {
  if (!gsap || reduced) { document.documentElement.classList.remove('anim'); root.querySelectorAll('[data-count]').forEach(el => counter(el)); return; }

  root.querySelectorAll('[data-split]:not([data-split-done-anim])').forEach(el => {
    el.setAttribute('data-split-done-anim', '');
    const lines = splitLines(el);
    el.style.visibility = 'visible';
    const delay = Number(el.dataset.delay || 0) + (el.dataset.split === 'now' ? 0.55 : 0);
    lines.forEach((ln, i) => {
      gsap.fromTo(ln, { yPercent: 110, rotate: 3 }, {
        yPercent: 0, rotate: 0, duration: 1.15, ease: 'expo.out', delay: delay + i * 0.09,
        scrollTrigger: el.dataset.split === 'now' ? undefined : { trigger: el, start: 'top 88%' },
      });
    });
  });

  root.querySelectorAll('[data-fill]').forEach(el => {
    const words = splitWords(el);
    gsap.fromTo(words, { opacity: 0.14 }, {
      opacity: 1, stagger: 0.08, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
    });
  });

  root.querySelectorAll('[data-fade]').forEach(el => {
    gsap.fromTo(el, { autoAlpha: 0, y: 40 }, {
      autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', delay: Number(el.dataset.delay || 0),
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  root.querySelectorAll('[data-stagger]').forEach(el => {
    gsap.fromTo(el.children, { autoAlpha: 0, y: 46 }, {
      autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09,
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });

  root.querySelectorAll('[data-clip]').forEach(el => {
    const img = el.querySelector('img,video');
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%' } });
    tl.fromTo(el, { clipPath: 'inset(18% 12% 18% 12% round 28px)' }, { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.5, ease: 'expo.inOut' });
    if (img) tl.fromTo(img, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: 'expo.out' }, 0);
  });

  root.querySelectorAll('[data-parallax]').forEach(el => {
    const amt = Number(el.dataset.parallax) || 0.2;
    gsap.fromTo(el, { yPercent: -amt * 50 }, {
      yPercent: amt * 50, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  root.querySelectorAll('[data-count]').forEach(el => counter(el));
}

export function counter(el, onScroll = true) {
  const end = Number(el.dataset.count) || 0;
  const suffix = el.dataset.suffix || '';
  const fmt = v => (end >= 10000 ? Math.round(v).toLocaleString() : Math.round(v)) + suffix;
  if (reduced || !gsap) { el.textContent = fmt(end); return; }
  const o = { v: 0 };
  el.textContent = fmt(0);
  gsap.to(o, {
    v: end, duration: 2.2, ease: 'power3.out',
    onUpdate: () => { el.textContent = fmt(o.v); },
    scrollTrigger: onScroll ? { trigger: el, start: 'top 92%' } : undefined,
  });
}

/* ── Marquee that speeds up / skews with scroll velocity ──── */
export function initMarquees(root = document) {
  root.querySelectorAll('[data-marquee]').forEach(m => {
    const track = m.querySelector('.mq-track');
    if (!track || track.dataset.ready) return;
    track.dataset.ready = '1';
    track.innerHTML += track.innerHTML; // seamless loop
    if (reduced || !gsap) return;
    const dir = m.dataset.marquee === 'right' ? 1 : -1;
    let x = 0, boost = 0, w = track.scrollWidth / 2;
    const base = Number(m.dataset.speed || 0.6);
    gsap.ticker.add(() => {
      x += dir * (base + boost);
      if (x <= -w) x += w;
      if (x >= 0 && dir > 0) x -= w;
      gsap.set(track, { x, skewX: -boost * dir * 0.6 });
      boost *= 0.92;
    });
    ST.create({ trigger: m, start: 'top bottom', end: 'bottom top', onUpdate: s => { boost = Math.min(14, Math.abs(s.getVelocity()) / 260); } });
    addEventListener('resize', () => { w = track.scrollWidth / 2; });
  });
}

/* ── Magnetic buttons + custom cursor ──────────────────────── */
export function initMagnetic(root = document) {
  if (isTouch || reduced || !gsap) return;
  root.querySelectorAll('[data-magnetic]').forEach(el => {
    if (el.dataset.magReady) return; el.dataset.magReady = '1';
    const s = Number(el.dataset.magnetic) || 0.35;
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * s, y: (e.clientY - r.top - r.height / 2) * s, duration: 0.5, ease: 'power3.out' });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.35)' }));
  });
}

export function initCursor() {
  if (isTouch || reduced || !gsap || document.querySelector('.cur')) return;
  const c = document.createElement('div');
  c.className = 'cur'; c.innerHTML = '<span class="cur-dot"></span><span class="cur-label"></span>';
  document.body.appendChild(c);
  const label = c.querySelector('.cur-label');
  const xTo = gsap.quickTo(c, 'x', { duration: 0.45, ease: 'power3' });
  const yTo = gsap.quickTo(c, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('mousemove', e => { xTo(e.clientX); yTo(e.clientY); c.classList.add('on'); });
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-cursor],a,button,input,select,textarea,label');
    c.classList.toggle('hover', !!t);
    const txt = t?.closest('[data-cursor]')?.dataset.cursor || '';
    label.textContent = txt;
    c.classList.toggle('has-label', !!txt);
  });
  document.addEventListener('mouseleave', () => c.classList.remove('on'));
}

/* ── Page transitions (curtain) ────────────────────────────── */
export function initTransitions() {
  const cur = document.querySelector('.curtain');
  if (!cur || !gsap) return;
  gsap.to(cur, { yPercent: -100, duration: 1, ease: 'expo.inOut', delay: 0.05, onComplete: () => cur.classList.add('done') });
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || /^https?:/.test(href) || a.hasAttribute('download')) return;
    e.preventDefault();
    cur.classList.remove('done');
    gsap.fromTo(cur, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: 'expo.inOut', onComplete: () => { location.href = href; } });
  });
  // bfcache: make sure curtain is lifted when navigating back
  addEventListener('pageshow', ev => { if (ev.persisted) gsap.set(cur, { yPercent: -100 }); });
}

/* ── Header behaviour ──────────────────────────────────────── */
export function initHeader() {
  const hd = document.querySelector('.hd');
  if (!hd) return;
  let last = 0;
  const onScroll = () => {
    const y = scrollY;
    hd.classList.toggle('solid', y > 40);
    hd.classList.toggle('hide', y > last && y > 420 && !document.body.classList.contains('menu-open'));
    last = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const btn = document.querySelector('.menu-btn');
  const menu = document.querySelector('.menu');
  if (!btn || !menu) return;
  const links = menu.querySelectorAll('.menu-links a, .menu-foot > *');
  btn.addEventListener('click', () => {
    const open = !document.body.classList.contains('menu-open');
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      window.__lenis?.stop();
      if (gsap) {
        gsap.fromTo(menu, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: 0.9, ease: 'expo.inOut' });
        gsap.fromTo(links, { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.9, ease: 'expo.out', stagger: 0.05, delay: 0.25 });
      }
    } else {
      window.__lenis?.start();
      if (gsap) gsap.to(menu, { clipPath: 'circle(0% at 100% 0%)', duration: 0.7, ease: 'expo.inOut' });
    }
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    if (a.getAttribute('href')?.startsWith('#')) btn.click();
  }));
}

/* ── Inner-page hero image: settle in, then drift ─────────── */
export function initHeroImage() {
  const im = document.querySelector('[data-hero-img]');
  if (!im || !gsap || reduced) return;
  gsap.fromTo(im, { scale: 1.3 }, { scale: 1.08, duration: 2.2, ease: 'expo.out', delay: 0.15 });
  gsap.to(im, { yPercent: 14, ease: 'none', scrollTrigger: { trigger: im.closest('section'), start: 'top top', end: 'bottom top', scrub: true } });
  const inner = im.closest('section')?.querySelector('.phero-in');
  if (inner) gsap.to(inner, { yPercent: -18, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: inner.closest('section'), start: 'top top', end: 'bottom top', scrub: true } });
}

/* ── Footer wordmark rise ──────────────────────────────────── */
export function initFooterMark() {
  const mark = document.querySelector('.ft-mark');
  if (!mark || !gsap || reduced) return;
  const chars = splitChars(mark);
  gsap.fromTo(chars, { yPercent: 100 }, {
    yPercent: 0, ease: 'expo.out', duration: 1.4, stagger: 0.06,
    scrollTrigger: { trigger: mark, start: 'top 98%' },
  });
}

export function refresh() { ST?.refresh(); }

/** Boot every shared behaviour. Pages call this once their own markup exists. */
export function boot() {
  initLenis();
  initHeader();
  initTransitions();
  initHeroImage();
  initReveals();
  initMarquees();
  initMagnetic();
  initFooterMark();
  addEventListener('load', () => ST?.refresh());
}

/** Home video hero: gentle parallax as the page scrolls away. */
export function initVideoHero() {
  const sec = document.querySelector('.vhero');
  if (!sec || !gsap || reduced) return;
  gsap.fromTo(sec.querySelector('video'), { scale: 1.08 }, { scale: 1, duration: 2, ease: 'expo.out' });
  gsap.to(sec.querySelector('video'), { yPercent: 14, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom top', scrub: true } });
}
