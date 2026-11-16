// Rent a car — the showroom.
// Each vehicle's photos (Admin → Rent a car → images) become a "turntable":
// drag sideways to turn through the angles. Switching car slides the old one
// out with a motion blur and ticks the spec numbers over to the new car.
import { renderLayout } from '../layout.js';
import { list, esc, img, imagesOf } from '../store.js';
import { boot, reduced, refresh } from '../motion.js';
import { initEnquiries, prefill } from '../enquiry.js';

const gsap = window.gsap;
await renderLayout('inbound', 'rent-a-car.html');
const cars = (await list('fleet')).filter(c => imagesOf(c).length);

const spin = document.getElementById('spin');
const dotsEl = document.getElementById('spinDots');
const spec = document.getElementById('spec');
const ghost = document.getElementById('carGhost');
const strip = document.getElementById('strip');
const chipsEl = document.getElementById('carChips');

let filter = 'All', view = cars.slice(), cur = -1, frame = 0, frames = [], busy = false;
const nums = { seats: 0, luggage: 0 };

/* ── spec panel ── */
function specHTML(c) {
  return `
    <p class="eyebrow">${esc(c.category || 'Vehicle')}</p>
    <h2>${esc(c.name)}</h2>
    <p class="model">${esc(c.model || '')}</p>
    <div class="spec-grid">
      <div><b data-n="seats">${nums.seats}</b><small>Seats</small></div>
      <div><b data-n="luggage">${nums.luggage}</b><small>Bags</small></div>
      <div><b style="font-size:1.25rem">${esc(c.transmission || '—')}</b><small>Gearbox</small></div>
      <div><b style="font-size:1.25rem">${c.fuel ? esc(c.fuel) + (c.ac !== false ? ' · A/C' : '') : (c.ac !== false ? 'A/C' : '—')}</b><small>Fuel · climate</small></div>
    </div>
    <p>${esc(c.description || '')}</p>
    <div class="chips" style="margin-top:16px">${[c.withDriver, ...(c.features || [])].filter(Boolean).map(f => `<span class="chip">${esc(f)}</span>`).join('')}</div>
    <div class="actions">
      <a href="#enquire" class="btn" data-car-enquire data-magnetic>Request this car <span class="arr">→</span></a>
      <span style="font-family:var(--f-display);font-style:italic;font-size:1.2rem;color:var(--accent-2)">${esc(c.price || '')}</span>
    </div>`;
}

function tick(key, to) {
  const el = spec.querySelector(`[data-n="${key}"]`);
  const o = { v: nums[key] };
  nums[key] = to;
  if (!gsap || reduced) { el.textContent = to; return; }
  gsap.to(o, { v: to, duration: 1.1, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
}

/* ── turntable ── */
function setFrame(k) {
  if (!frames.length) return;
  frame = (k + frames.length) % frames.length;
  frames.forEach((f, i) => f.classList.toggle('on', i === frame));
  dotsEl.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === frame));
}

function buildFrames(c) {
  spin.querySelectorAll('img').forEach(i => i.remove());
  frames = imagesOf(c).map((s, i) => {
    const im = document.createElement('img');
    im.src = img(s); im.alt = `${c.name} — view ${i + 1}`; im.draggable = false;
    im.onerror = () => im.classList.add('broken');
    spin.insertBefore(im, spin.querySelector('.spin-ui'));
    return im;
  });
  dotsEl.innerHTML = frames.map(() => '<i></i>').join('');
  setFrame(0);
}

(function drag() {
  let sx = 0, startFrame = 0, down = false;
  spin.addEventListener('pointerdown', e => { down = true; sx = e.clientX; startFrame = frame; spin.setPointerCapture(e.pointerId); idle.stop(); });
  spin.addEventListener('pointermove', e => {
    if (!down) return;
    const step = Math.max(40, spin.clientWidth / (frames.length * 1.6));
    setFrame(startFrame - Math.round((e.clientX - sx) / step));
  });
  const up = () => { if (down) { down = false; idle.start(); } };
  spin.addEventListener('pointerup', up);
  spin.addEventListener('pointercancel', up);
})();

const idle = (() => {
  let t = null;
  return {
    start() { this.stop(); if (frames.length > 1 && !reduced) t = setInterval(() => setFrame(frame + 1), 2600); },
    stop() { clearInterval(t); },
  };
})();

/* ── switching car ── */
function select(i, dir = 1) {
  if (busy || !view[i] || i === cur) return;
  const c = view[i];
  const first = cur === -1;
  cur = i; busy = true;
  strip.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
  strip.querySelector('button.on')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

  const swapIn = () => {
    buildFrames(c);
    spec.innerHTML = specHTML(c);
    ghost.textContent = (c.category || c.name).toUpperCase();
    tick('seats', Number(c.seats) || 0);
    tick('luggage', Number(c.luggage) || 0);
    if (gsap && !reduced) {
      gsap.fromTo(spin, { x: 140 * dir, skewX: -8 * dir, filter: 'blur(14px)', opacity: 0 }, { x: 0, skewX: 0, filter: 'blur(0px)', opacity: 1, duration: 0.9, ease: 'expo.out' });
      gsap.fromTo(spec.children, { y: 34, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.05, ease: 'expo.out' });
      gsap.fromTo(ghost, { xPercent: 18 * dir, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out' });
    }
    idle.start();
    busy = false;
  };
  if (!first && gsap && !reduced) {
    idle.stop();
    gsap.to(spin, { x: -160 * dir, skewX: 10 * dir, filter: 'blur(14px)', opacity: 0, duration: 0.42, ease: 'power3.in' });
    gsap.to(spec.children, { y: -24, autoAlpha: 0, duration: 0.3, stagger: 0.02, ease: 'power2.in' });
    gsap.to(ghost, { xPercent: -14 * dir, opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: swapIn });
  } else swapIn();
}

function renderStrip() {
  strip.innerHTML = view.map((c, i) => `
    <button data-i="${i}" aria-label="${esc(c.name)}"><img src="${esc(img(imagesOf(c)[0]))}" alt="" loading="lazy"><span>${esc(c.name)}<small>${esc(c.seats ? c.seats + ' seats · ' : '')}${esc(c.category || '')}</small></span></button>`).join('');
  if (gsap && !reduced) gsap.fromTo(strip.children, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
}

const cats = ['All', ...new Set(cars.map(c => c.category).filter(Boolean))];
chipsEl.innerHTML = cats.map((c, i) => `<button class="chip${i ? '' : ' on'}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
chipsEl.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b || b.dataset.c === filter) return;
  filter = b.dataset.c;
  chipsEl.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
  view = filter === 'All' ? cars.slice() : cars.filter(c => c.category === filter);
  renderStrip();
  cur = -2; busy = false;   // force a fresh selection with the slide-out transition
  select(0, 1);
});
strip.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const i = Number(b.dataset.i);
  select(i, i > cur ? 1 : -1);
});
addEventListener('keydown', e => {
  const r = document.getElementById('showroom').getBoundingClientRect();
  if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.5) return;
  if (e.key === 'ArrowRight') select(Math.min(view.length - 1, cur + 1), 1);
  if (e.key === 'ArrowLeft') select(Math.max(0, cur - 1), -1);
});
spec.addEventListener('click', e => {
  if (!e.target.closest('[data-car-enquire]')) return;
  e.preventDefault();
  const c = view[cur];
  prefill(`${c.name}${c.model ? ' (' + c.model + ')' : ''}`);
});

if (cars.length) { renderStrip(); select(0); }
else spec.innerHTML = '<p class="empty-note">Our fleet list is being updated — call us for availability.</p>';

initEnquiries('inbound');
boot();
refresh();
