// stays.js — hotel cards whose photos cycle (Instagram-story style bars).
// Hover on desktop / in-view on touch. Used on Home and Hotels.
import { esc, img, imagesOf } from './store.js';
import { isTouch } from './motion.js';

export const starStr = n => '★'.repeat(Math.max(0, Math.min(5, Number(n) || 0)));

export function stayCard(h, { href = 'hotels.html', i = 0 } = {}) {
  const ims = imagesOf(h).slice(0, 6);
  return `
  <a class="stay" href="${href}" data-hotel="${esc(h.id)}" data-cursor="View">
    <div class="stay-media">
      ${ims.length > 1 ? `<div class="stay-bars">${ims.map(() => '<i><b></b></i>').join('')}</div>` : ''}
      ${ims.map((s, k) => `<img src="${esc(img(s))}" alt="${esc(h.name)} — photo ${k + 1}" loading="lazy" class="${k === 0 ? 'on' : ''}" onerror="this.classList.add('broken')">`).join('')}
      ${h.category ? `<span class="stay-flag">${esc(h.category)}</span>` : ''}
    </div>
    <div class="stay-txt">
      <div><h3>${esc(h.name)}</h3><small>${esc(h.location || h.city || '')}</small></div>
      <span class="stars">${starStr(h.stars)}</span>
    </div>
  </a>`;
}

/** Wire the photo cycling on every .stay inside root. */
export function wireStays(root) {
  const gsap = window.gsap;
  root.querySelectorAll('.stay').forEach(card => {
    const imgs = [...card.querySelectorAll('.stay-media img')];
    const bars = [...card.querySelectorAll('.stay-bars b')];
    if (imgs.length < 2) return;
    let i = 0, tween = null, running = false;
    const show = k => {
      imgs.forEach((im, n) => im.classList.toggle('on', n === k));
      bars.forEach((b, n) => { if (gsap) gsap.set(b, { width: n < k ? '100%' : '0%' }); });
    };
    const step = () => {
      if (!running) return;
      const b = bars[i];
      tween = gsap ? gsap.fromTo(b, { width: '0%' }, { width: '100%', duration: 2.2, ease: 'none', onComplete: () => { i = (i + 1) % imgs.length; show(i); step(); } }) : null;
    };
    const start = () => { if (running) return; running = true; step(); };
    const stop = () => { running = false; tween?.kill(); i = 0; show(0); };
    if (isTouch) {
      const io = new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()), { threshold: 0.6 });
      io.observe(card);
    } else {
      card.addEventListener('mouseenter', start);
      card.addEventListener('mouseleave', stop);
    }
  });
}
