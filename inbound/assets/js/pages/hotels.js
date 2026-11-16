// Hotels — the reel (scroll through hotels, drag through each hotel's photos),
// a Flip-filtered grid of every stay, and a gallery lightbox.
import { renderLayout } from '../layout.js';
import { list, esc, img, imagesOf } from '../store.js';
import { boot, reduced, isTouch, scrollToEl, refresh } from '../motion.js';
import { initEnquiries, prefill } from '../enquiry.js';
import { stayCard, wireStays, starStr } from '../stays.js';
import { DEFAULT_HOTELS } from '../defaults.js';

const gsap = window.gsap, ST = window.ScrollTrigger;
const desktop = () => matchMedia('(min-width: 901px)').matches;

await renderLayout('inbound', 'hotels.html');
const allHotels = (await list('hotels')).filter(h => imagesOf(h).length);
// the client's own hotel gets its own section (photos + videos) and leads the page
const own = allHotels.find(h => h.ownHotel) || allHotels.find(h => /our hotel/i.test(h.category || '')) || allHotels.find(h => /galaxy/i.test(h.name || ''))
  || { id: 'own-default', ...DEFAULT_HOTELS.find(h => h.ownHotel) };   // the client's hotel always shows
const hotels = allHotels.filter(h => h !== own);

(function ownHotel() {
  const sec = document.getElementById('ggh');
  if (!own) { sec.remove(); return; }
  const ims = imagesOf(own).slice(0, 5);
  const vids = (own.videos || []).filter(Boolean);
  const ICON = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>',
  };
  sec.innerHTML = `<div class="wrap">
    <div class="ggh-top">
      <span class="ggh-badge" data-fade>Our own hotel</span>
      <h2 data-split>${esc(own.name)}</h2>
      <div class="ggh-loc" data-fade>${esc(own.location || own.city || '')} ${own.stars ? '· ' + starStr(own.stars) : ''}</div>
      <p data-fade>${esc(own.description || '')}</p>
    </div>
    <div class="ggh-imgs" data-stagger>${ims.map((s, i) => `<div class="g" data-own="${i}" data-cursor="View"><img src="${esc(img(s))}" alt="${esc(own.name)} — photo ${i + 1}" loading="lazy"></div>`).join('')}</div>
    ${vids.length ? `<div class="ggh-vids" data-stagger>${vids.map(v => `<div class="vwrap"><video muted loop playsinline preload="metadata" poster="${esc(img(ims[0] || ''))}"><source src="${esc(img(v))}" type="video/mp4"></video><div class="vbtns"><button class="vplay" aria-label="Play or pause">${ICON.pause}</button><button class="vsound" aria-label="Sound on or off">${ICON.mute}</button></div></div>`).join('')}</div>` : ''}
    <div class="ggh-cta" data-fade><a href="#enquire" class="btn btn-accent" data-enquire="${esc(own.name)}">Book ${esc(own.name)} <span class="arr">→</span></a><button class="btn btn-ghost" data-own="0">See all photos</button></div>
  </div>`;
  sec.querySelectorAll('.vwrap').forEach(w => {
    const v = w.querySelector('video'), bp = w.querySelector('.vplay'), bs = w.querySelector('.vsound');
    const sync = () => { bp.innerHTML = v.paused ? ICON.play : ICON.pause; bs.innerHTML = v.muted ? ICON.mute : ICON.sound; };
    new IntersectionObserver(([en]) => { if (en.isIntersecting) v.play().catch(() => {}); else v.pause(); sync(); }, { threshold: 0.4 }).observe(w);
    bp.onclick = () => { v.paused ? v.play() : v.pause(); sync(); };
    bs.onclick = () => { v.muted = !v.muted; if (!v.muted) v.play().catch(() => {}); sync(); };
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
  });
  sec.addEventListener('click', e => { const g = e.target.closest('[data-own]'); if (g) openLB(own, Number(g.dataset.own)); });
})();

/* ═════════ the deck — a fanned, draggable stack of one hotel's photos ═════════ */
function Deck(root) {
  let cards = [], order = [], busy = false;
  const count = document.createElement('span'); count.className = 'deck-count';
  const hint = document.createElement('span'); hint.className = 'deck-hint'; hint.textContent = isTouch ? 'Swipe photos' : 'Drag or click';

  const place = (animate = true) => {
    order.forEach((ci, k) => {
      const c = cards[ci];
      const v = {
        x: k * (desktop() ? 22 : 12), y: k * -14, rotation: k === 0 ? 0 : (k % 2 ? 1 : -1) * (2 + k * 1.6),
        scale: 1 - k * 0.05, zIndex: 40 - k, opacity: k > 4 ? 0 : 1, filter: `brightness(${1 - k * 0.13})`,
      };
      animate && gsap ? gsap.to(c, { ...v, duration: 0.7, ease: 'expo.out' }) : gsap?.set(c, v);
    });
    count.textContent = `${String(order[0] + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
  };

  const fly = (dir = 1) => {
    if (busy || cards.length < 2) return;
    busy = true;
    const top = cards[order[0]];
    gsap.to(top, {
      x: dir * (root.clientWidth * 1.1), y: -40, rotation: dir * 24, opacity: 0, duration: 0.55, ease: 'power3.in',
      onComplete: () => {
        order.push(order.shift());
        gsap.set(top, { x: (cards.length - 1) * 22, y: 0, rotation: 0, opacity: 0, zIndex: 0 });
        place(true); busy = false; bindTop();
      },
    });
  };

  function bindTop() {
    cards.forEach(c => { c.onpointerdown = null; });
    const top = cards[order[0]];
    if (!top || !gsap) return;
    top.onpointerdown = e => {
      if (busy) return;
      const sx = e.clientX, sy = e.clientY; let dx = 0, dy = 0, t0 = performance.now(), moved = false;
      top.setPointerCapture(e.pointerId);
      const move = ev => {
        dx = ev.clientX - sx; dy = ev.clientY - sy;
        if (!moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8 && isTouch) { end(); return; }  // let the page scroll
        if (Math.abs(dx) > 4) moved = true;
        gsap.set(top, { x: dx, y: dy * 0.15, rotation: dx * 0.05 });
      };
      const end = () => {
        top.removeEventListener('pointermove', move);
        top.removeEventListener('pointerup', end);
        top.removeEventListener('pointercancel', end);
        const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
        if (!moved) fly(1);
        else if (Math.abs(dx) > 90 || v > 0.6) fly(Math.sign(dx) || 1);
        else gsap.to(top, { x: 0, y: 0, rotation: 0, duration: 0.8, ease: 'elastic.out(1,.5)' });
      };
      top.addEventListener('pointermove', move);
      top.addEventListener('pointerup', end);
      top.addEventListener('pointercancel', end);
    };
  }

  return {
    set(images, alt) {
      const old = cards;
      const build = () => {
        root.innerHTML = '';
        cards = images.map((src, i) => {
          const d = document.createElement('div'); d.className = 'deck-card';
          d.innerHTML = `<img src="${esc(img(src))}" alt="${esc(alt)} — photo ${i + 1}" draggable="false" onerror="this.classList.add('broken')">`;
          root.appendChild(d); return d;
        });
        root.append(count, hint);
        order = cards.map((_, i) => i);
        if (gsap && !reduced) {
          place(false);
          gsap.from(cards, { y: -140, rotation: () => gsap.utils.random(-18, 18), opacity: 0, duration: 0.9, ease: 'expo.out', stagger: { each: 0.06, from: 'end' } });
        } else place(false);
        bindTop();
      };
      if (old.length && gsap && !reduced) {
        busy = true;
        gsap.to(old, { y: 160, rotation: () => gsap.utils.random(-25, 25), opacity: 0, duration: 0.45, ease: 'power3.in', stagger: 0.03, onComplete: () => { busy = false; build(); } });
      } else build();
    },
    next: () => fly(1),
  };
}

/* ═════════ the reel ═════════ */
const info = document.getElementById('reelInfo');
const rail = document.getElementById('reelRail');
const num = document.getElementById('reelNum');
const deck = Deck(document.getElementById('deck'));

info.innerHTML = hotels.map((h, i) => `
  <article class="reel-card" data-i="${i}">
    <p class="eyebrow">${esc(h.category || 'Stay')} · ${esc(h.city || '')}</p>
    <h2>${esc(h.name)}</h2>
    <div class="loc"><span class="stars">${starStr(h.stars)}</span><span>${esc(h.location || '')}</span></div>
    <p>${esc(h.description || '')}</p>
    <div class="chips">${(h.amenities || []).slice(0, 6).map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>
    <div class="actions">
      <a href="#enquire" class="btn" data-enquire="${esc(h.name)}" data-magnetic>Enquire <span class="arr">→</span></a>
      <button class="btn btn-ghost" data-gallery="${i}">Full gallery</button>
      ${h.price ? `<span class="price">${esc(h.price)}</span>` : ''}
    </div>
  </article>`).join('');
rail.innerHTML = hotels.map((h, i) => `<button data-i="${i}"><i></i>${String(i + 1).padStart(2, '0')} · ${esc(h.name)}</button>`).join('');

let cur = -1;
function show(i) {
  if (i === cur || !hotels[i]) return;
  const prev = info.querySelector('.reel-card.on');
  const next = info.querySelector(`.reel-card[data-i="${i}"]`);
  const dir = i > cur ? 1 : -1;
  cur = i;
  if (gsap && !reduced) {
    if (prev) gsap.to(prev.children, { y: -40 * dir, autoAlpha: 0, duration: 0.35, stagger: 0.03, ease: 'power2.in', onComplete: () => prev.classList.remove('on') });
    next.classList.add('on');
    gsap.fromTo(next.children, { y: 50 * dir, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.06, ease: 'expo.out', delay: prev ? 0.25 : 0 });
    gsap.fromTo(num, { yPercent: 40 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out' });
  } else { prev?.classList.remove('on'); next.classList.add('on'); }
  num.textContent = String(i + 1).padStart(2, '0');
  rail.querySelectorAll('button').forEach((b, k) => {
    b.classList.toggle('on', k === i);
    gsap?.to(b.querySelector('i'), { width: k <= i ? '100%' : '0%', duration: 0.6, ease: 'expo.out' });
  });
  deck.set(imagesOf(hotels[i]), hotels[i].name);
}

let reelST = null;
if (hotels.length) {
  show(0);
  if (gsap && ST && desktop() && hotels.length > 1 && !reduced) {
    const n = hotels.length;
    reelST = ST.create({
      trigger: '#reel', start: 'top top', end: () => '+=' + (n * innerHeight * 0.85), pin: true, anticipatePin: 1,
      snap: { snapTo: 1 / (n - 1), duration: { min: 0.2, max: 0.6 }, ease: 'power2.inOut', delay: 0.08 },
      onUpdate: s => show(Math.round(s.progress * (n - 1))),
    });
  }
  rail.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = Number(b.dataset.i);
    if (reelST) {
      const y = reelST.start + (i / Math.max(1, hotels.length - 1)) * (reelST.end - reelST.start);
      window.__lenis ? window.__lenis.scrollTo(y) : scrollTo({ top: y, behavior: 'smooth' });
    } else show(i);
  });
} else {
  info.innerHTML = '<p class="empty-note">Hotels are being updated.</p>';
}

/* ═════════ gallery lightbox ═════════ */
const lb = document.getElementById('lb'), lbMedia = document.getElementById('lbMedia');
let lbH = null, lbI = 0;
function lbShow(i, dir = 1) {
  const ims = imagesOf(lbH);
  lbI = (i + ims.length) % ims.length;
  const el = document.createElement('img');
  el.src = img(ims[lbI]); el.alt = `${lbH.name} — photo ${lbI + 1}`;
  const olds = [...lbMedia.querySelectorAll(':scope > img')];
  lbMedia.insertBefore(el, lbMedia.querySelector('.lb-nav')); // later in DOM = on top of the old photo
  if (gsap && !reduced) {
    gsap.fromTo(el, { clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', scale: 1.15 }, {
      clipPath: 'inset(0 0% 0 0%)', scale: 1, duration: 1, ease: 'expo.inOut', onComplete: () => olds.forEach(o => o.remove()),
    });
  } else olds.forEach(o => o.remove());
  document.querySelectorAll('#lbThumbs button').forEach((b, k) => b.classList.toggle('on', k === lbI));
}
function openLB(h, i = 0) {
  lbH = h;
  const ims = imagesOf(h);
  document.getElementById('lbThumbs').innerHTML = ims.map((s, k) => `<button data-k="${k}" aria-label="Photo ${k + 1}"><img src="${esc(img(s))}" alt=""></button>`).join('');
  document.getElementById('lbSide').innerHTML = `
    <p class="eyebrow" style="color:var(--accent-2)">${esc(h.category || 'Stay')} · ${esc(h.city || '')}</p>
    <h2>${esc(h.name)}</h2>
    <div class="loc" style="display:flex;gap:12px;opacity:.8"><span class="stars">${starStr(h.stars)}</span>${esc(h.location || '')}</div>
    <p>${esc(h.description || '')}</p>
    <div class="chips">${(h.amenities || []).map(a => `<span class="chip" style="box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)">${esc(a)}</span>`).join('')}</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px;align-items:center">
      <a href="#enquire" class="btn btn-accent" data-lb-enquire>Enquire about this hotel <span class="arr">→</span></a>
      ${h.booking_url ? `<a href="${esc(h.booking_url)}" target="_blank" rel="noopener" class="link-u">Hotel website ↗</a>` : ''}
    </div>
    ${h.price ? `<p style="font-family:var(--f-display);font-style:italic;font-size:1.3rem;color:var(--accent-2);margin-top:22px">${esc(h.price)}</p>` : ''}`;
  lbMedia.querySelectorAll(':scope > img').forEach(x => x.remove());
  lb.classList.add('open');
  window.__lenis?.stop();
  document.body.style.overflow = 'hidden';
  gsap?.fromTo(lb, { clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0% 0 0% 0)', duration: 0.8, ease: 'expo.inOut' });
  gsap?.fromTo('#lbSide > *', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.05, duration: 0.8, ease: 'expo.out', delay: 0.4 });
  lbShow(i);
}
function closeLB() {
  const done = () => { lb.classList.remove('open'); window.__lenis?.start(); document.body.style.overflow = ''; };
  gsap ? gsap.to(lb, { clipPath: 'inset(50% 0 50% 0)', duration: 0.6, ease: 'expo.inOut', onComplete: done }) : done();
}
document.getElementById('lbClose').onclick = closeLB;
document.getElementById('lbPrev').onclick = () => lbShow(lbI - 1, -1);
document.getElementById('lbNext').onclick = () => lbShow(lbI + 1, 1);
document.getElementById('lbThumbs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) lbShow(Number(b.dataset.k), Number(b.dataset.k) > lbI ? 1 : -1); });
addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') closeLB();
  if (e.key === 'ArrowRight') lbShow(lbI + 1, 1);
  if (e.key === 'ArrowLeft') lbShow(lbI - 1, -1);
});
lb.addEventListener('click', e => {
  if (e.target.closest('[data-lb-enquire]')) { e.preventDefault(); const name = lbH.name; closeLB(); setTimeout(() => prefill(name), 650); }
});
document.addEventListener('click', e => {
  const g = e.target.closest('[data-gallery]');
  if (g) openLB(hotels[Number(g.dataset.gallery)]);
});

/* ═════════ grid + Flip filter ═════════ */
const grid = document.getElementById('hotelGrid');
grid.innerHTML = allHotels.map((h, i) => stayCard(h, { href: '#', i })).join('');
wireStays(grid);
grid.addEventListener('click', e => {
  const a = e.target.closest('.stay'); if (!a) return;
  e.preventDefault();
  openLB(allHotels.find(h => h.id === a.dataset.hotel));
});
const cities = [...new Set(allHotels.map(h => h.city).filter(Boolean))];
const chips = document.getElementById('cityChips');
chips.innerHTML = ['All', ...cities].map((c, i) => `<button class="chip${i ? '' : ' on'}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
const countEl = document.getElementById('hotelCount');
const setCount = n => { countEl.textContent = `${n} stay${n === 1 ? '' : 's'}`; };
setCount(allHotels.length);
chips.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === b));
  const c = b.dataset.c;
  const cards = [...grid.querySelectorAll('.stay')];
  const Flip = window.Flip;
  const state = Flip ? Flip.getState(cards) : null;
  let n = 0;
  cards.forEach(card => {
    const h = allHotels.find(x => x.id === card.dataset.hotel);
    const on = c === 'All' || h.city === c;
    card.style.display = on ? '' : 'none'; if (on) n++;
  });
  setCount(n);
  if (Flip && !reduced) {
    Flip.from(state, {
      duration: 0.8, ease: 'expo.inOut', scale: true, absolute: true,
      onEnter: els => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6 }),
      onLeave: els => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.4 }),
      onComplete: () => ST?.refresh(),
    });
  }
});

if (gsap && window.Flip) gsap.registerPlugin(window.Flip);
initEnquiries('inbound');
boot();
refresh();
void scrollToEl;
