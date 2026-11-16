// fx.js — outbound signature effects:
//   flap()     split-flap departure-board letters
//   pattern()  geometric eight-point star lattice that draws itself
//   tilt()     3D tilt on boarding passes
import { reduced, isTouch } from './motion.js';
import { esc } from './store.js';

const gsap = window.gsap;
const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-·,';

export function flapHTML(text, len, cls = '') {
  const t = String(text || '').toUpperCase().padEnd(len, ' ').slice(0, len);
  return `<span class="flap ${cls}" data-flap="${esc(t)}" aria-label="${esc(String(text || ''))}">${[...t].map(() => '<i aria-hidden="true">&nbsp;</i>').join('')}</span>`;
}

/** Spin every letter of a .flap element to its target, like a Solari board. */
export function flip(el, delay = 0) {
  const target = el.dataset.flap || '';
  const cells = [...el.querySelectorAll('i')];
  cells.forEach((c, i) => {
    const goal = target[i] || ' ';
    if (reduced || !gsap) { c.textContent = goal === ' ' ? ' ' : goal; return; }
    const spins = 6 + Math.floor(Math.random() * 10);
    let n = 0;
    gsap.delayedCall(delay + i * 0.035, function step() {
      n++;
      const ch = n >= spins ? goal : CHARS[(Math.random() * CHARS.length) | 0];
      c.textContent = ch === ' ' ? ' ' : ch;
      gsap.fromTo(c, { rotateX: -70 }, { rotateX: 0, duration: 0.06, ease: 'none' });
      if (n < spins) gsap.delayedCall(0.05, step);
    });
  });
}

export function flipAllOnView(root) {
  const rows = [...root.querySelectorAll('[data-row]')];
  if (!window.ScrollTrigger || reduced) { root.querySelectorAll('.flap').forEach(f => flip(f)); return; }
  window.ScrollTrigger.create({
    trigger: root, start: 'top 80%', once: true,
    onEnter: () => rows.forEach((r, k) => r.querySelectorAll('.flap').forEach((f, j) => flip(f, k * 0.18 + j * 0.08))),
  });
  rows.forEach(r => r.addEventListener('mouseenter', () => r.querySelectorAll('.flap').forEach((f, j) => flip(f, j * 0.05))));
}

/** Eight-point-star lattice (two overlapping squares per cell, joined by lines). */
export function pattern(svg, { cell = 120 } = {}) {
  const W = 1600, H = 1000, s = cell, r = s * 0.34;
  let d = '';
  for (let y = -s; y <= H + s; y += s) {
    for (let x = -s; x <= W + s; x += s) {
      const sq = (rot) => {
        const pts = [0, 1, 2, 3].map(k => { const a = rot + k * Math.PI / 2; return [x + r * Math.cos(a), y + r * Math.sin(a)]; });
        return 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L') + 'Z';
      };
      d += sq(Math.PI / 4) + sq(0);
      d += `M${x + r} ${y}L${x + s - r} ${y}M${x} ${y + r}L${x} ${y + s - r}`;
      d += `M${(x + s / 2).toFixed(1)} ${(y + s / 2 - r * 0.42).toFixed(1)}l${(r * 0.42).toFixed(1)} ${(r * 0.42).toFixed(1)}l${(-r * 0.42).toFixed(1)} ${(r * 0.42).toFixed(1)}l${(-r * 0.42).toFixed(1)} ${(-r * 0.42).toFixed(1)}Z`;
    }
  }
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.innerHTML = `<path d="${d}"/>`;
  const p = svg.querySelector('path');
  if (!gsap || reduced || !window.ScrollTrigger) return;
  const L = p.getTotalLength();
  gsap.set(p, { strokeDasharray: L, strokeDashoffset: L });
  gsap.to(p, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: svg.parentElement, start: 'top 85%', end: 'bottom 30%', scrub: 1.2 } });
}

export function tilt(root) {
  if (isTouch || reduced || !gsap) return;
  root.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotateY: x * 14, rotateX: -y * 12, y: -6, duration: 0.6, ease: 'power3.out', transformPerspective: 1000 });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { rotateY: 0, rotateX: 0, y: 0, duration: 1, ease: 'elastic.out(1,.4)' }));
  });
}

/** Departure board rows from Admin → Flight deals. */
export function boardHTML(deals) {
  const head = '<div class="board-head"><span>DESTINATION</span><span>CODE</span><span>AIRLINE</span><span>FARE</span><span>STATUS</span></div>';
  const rows = deals.map(f => `
    <div class="board-row" data-row data-to="${esc(f.to || f.toCity || "")}" data-enquire="${esc(`${f.fromCity || f.from || 'Colombo'} → ${f.toCity || f.to} (${f.airline || 'best airline'})`)}" data-enquire-msg="${esc(`I'd like a fare for ${f.fromCity || f.from} → ${f.toCity || f.to}${f.trip ? ' (' + f.trip + ')' : ''}. My dates are: `)}" role="button" tabindex="0">
      ${flapHTML(f.toCity || f.to, 12)}
      ${flapHTML(f.to || '', 3, 'gold')}
      ${flapHTML(f.airline || '', 18, 'sky')}
      ${flapHTML(f.fare || 'ON REQUEST', 16, 'gold')}
      <span class="status">${esc((f.note || 'Book now').toUpperCase())}</span>
    </div>`).join('');
  return head + rows;
}
