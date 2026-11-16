// Home — Amja Tours
import { renderLayout, statsHTML } from '../layout.js';
import { list, esc } from '../store.js';
import { boot, reduced, refresh, initVideoHero } from '../motion.js';
import { buildIsland } from '../island.js';
import { stayCard, wireStays } from '../stays.js';

const gsap = window.gsap;
const desktop = () => matchMedia('(min-width: 901px)').matches;

import { runLoader } from '../loader.js';
const site = await renderLayout('inbound', 'index.html');
const loading = runLoader(site.brandInbound, `Colombo · Sri Lanka · Since ${site.since}`);

// brand copy from Admin → Company & Brand
document.getElementById('aboutTitle').textContent = site.aboutTitle;
document.getElementById('aboutText').textContent = site.aboutText;
document.getElementById('stats').innerHTML = statsHTML(site);

// live data
const [cities, hotels] = await Promise.all([list('expertCities'), list('hotels')]);
const places = cities.filter(c => !c.hubOnly && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)))
  .map(c => ({ ...c, lat: Number(c.lat), lng: Number(c.lng) }));

// island map + list
const { ordered } = buildIsland(document.getElementById('islandMap'), places);
document.getElementById('islandList').innerHTML = ordered.map((c, i) => `<li data-city="${esc(c.title)}"><em>${String(i + 1).padStart(2, '0')}</em>${esc(c.title)}</li>`).join('');

// featured stays
const featured = (hotels.filter(h => h.featured).length ? hotels.filter(h => h.featured) : hotels).slice(0, 3);
const fs = document.getElementById('featuredStays');
fs.innerHTML = featured.map((h, i) => stayCard(h, { i })).join('') || '<p class="empty-note">Hotels are being updated — please check back shortly.</p>';
fs.setAttribute('data-stagger', '');
wireStays(fs);

boot();
await loading;
initVideoHero();

/* ── island: draw the coast, drop the pins, drive the route ── */
(function island() {
  const sec = document.getElementById('island');
  const svg = sec.querySelector('#islandMap svg');
  if (!svg || !gsap) return;
  const outline = svg.querySelector('.lk-outline');
  const route = svg.querySelector('.lk-route-solid');
  const dashed = svg.querySelector('.lk-route');
  const car = svg.querySelector('.lk-car');
  const dots = [...svg.querySelectorAll('.lk-dot')];
  const lis = [...sec.querySelectorAll('.island-list li')];
  const oLen = outline.getTotalLength();
  const rLen = route ? route.getTotalLength() : 0;
  // where along the route each ordered city sits
  const stops = [];
  if (route) {
    const n = 400;
    ordered.forEach(c => {
      const dot = dots.find(d => d.dataset.city === c.title);
      if (!dot) return;
      const m = dot.transform.baseVal.consolidate().matrix;
      let bestL = 0, best = 1e9;
      for (let k = 0; k <= n; k++) { const L = (k / n) * rLen, p = route.getPointAtLength(L), dd = (p.x - m.e) ** 2 + (p.y - m.f) ** 2; if (dd < best) { best = dd; bestL = L; } }
      stops.push({ name: c.title, at: bestL / rLen });
    });
  }
  if (reduced) return;
  gsap.set(outline, { strokeDasharray: oLen, strokeDashoffset: oLen });
  if (route) gsap.set(route, { strokeDasharray: rLen, strokeDashoffset: rLen });
  gsap.set(dashed, { opacity: 0 });
  gsap.set(dots, { scale: 0, transformOrigin: 'center', transformBox: 'fill-box' });
  gsap.set(svg.querySelector('.lk-grid'), { opacity: 0 });

  const state = { r: 0 };
  const tl = gsap.timeline({
    scrollTrigger: desktop()
      ? { trigger: sec, start: 'top top', end: '+=230%', pin: sec.querySelector('.island-pin'), scrub: 0.8, anticipatePin: 1 }
      : { trigger: sec, start: 'top 75%', end: 'bottom 60%', scrub: 0.8 },
  });
  tl.to(svg.querySelector('.lk-grid'), { opacity: 1, duration: 0.15 }, 0)
    .to(outline, { strokeDashoffset: 0, duration: 0.3, ease: 'none' }, 0)
    .to(dots, { scale: 1, duration: 0.05, stagger: 0.022, ease: 'back.out(3)' }, 0.18);
  dots.forEach((d, i) => tl.call(() => lis.find(l => l.dataset.city === d.dataset.city)?.classList.add('lit'), null, 0.18 + i * 0.022 + 0.03));
  if (route) {
    tl.to(dashed, { opacity: 0.5, duration: 0.05 }, 0.45)
      .to(car, { opacity: 1, duration: 0.03 }, 0.47)
      .to(state, {
        r: 1, duration: 0.5, ease: 'none',
        onUpdate: () => {
          route.style.strokeDashoffset = rLen * (1 - state.r);
          const p = route.getPointAtLength(rLen * state.r);
          car.setAttribute('transform', `translate(${p.x} ${p.y})`);
          let cur = null;
          stops.forEach(s => { if (state.r >= s.at - 0.002) cur = s.name; });
          dots.forEach(d => d.classList.toggle('on', d.dataset.city === cur));
          lis.forEach(l => l.classList.toggle('on', l.dataset.city === cur));
        },
      }, 0.47);
  }
})();

/* ── three ways: horizontal pinned scroll on desktop ── */
(function ways() {
  const sec = document.getElementById('ways');
  const track = document.getElementById('waysTrack');
  if (!gsap || reduced || !desktop()) return;
  const dist = () => track.scrollWidth - innerWidth;
  const tween = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: sec.querySelector('.ways-pin'), start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1 },
  });
  track.querySelectorAll('.way').forEach(w => {
    gsap.fromTo(w.querySelector('img'), { scale: 1.3, xPercent: -6 }, {
      scale: 1, xPercent: 6, ease: 'none',
      scrollTrigger: { trigger: w, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
    });
    gsap.from(w.querySelector('.way-in'), {
      y: 60, autoAlpha: 0, duration: 1, ease: 'expo.out',
      scrollTrigger: { trigger: w, containerAnimation: tween, start: 'left 70%' },
    });
  });
})();

refresh();
