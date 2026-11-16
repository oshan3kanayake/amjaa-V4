// Home — Amja Travels (outbound)
import { renderLayout, statsHTML } from '../layout.js';
import { list } from '../store.js';
import { boot, reduced, refresh, initVideoHero } from '../motion.js';
import { initEnquiries } from '../enquiry.js';
import { boardHTML, flipAllOnView, pattern, tilt } from '../fx.js';

const gsap = window.gsap;
const desktop = () => matchMedia('(min-width: 981px)').matches;
import { runLoader } from '../loader.js';
const site = await renderLayout('outbound', 'index.html');
const loading = runLoader(site.brandOutbound, `Hajj · Umrah · Air tickets · Since ${site.since}`);
document.getElementById('stats').innerHTML = statsHTML(site);

const deals = await list('flight_deals');
const board = document.getElementById('board');
board.innerHTML = boardHTML(deals.slice(0, 8));
const clock = document.getElementById('boardClock');
const tickClock = () => { clock.textContent = 'COLOMBO ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
tickClock(); setInterval(tickClock, 1000);

initEnquiries('outbound');
boot();
await loading;
flipAllOnView(board);
pattern(document.getElementById('pattern'));
tilt(document);

initVideoHero();

/* ── passes: dealt from one stack into a row as they scroll into view ── */
(function deal() {
  const cards = [...document.querySelectorAll('#passCards .pass')];
  if (!gsap || reduced) return;
  if (!desktop()) {
    gsap.from(cards, { y: 80, rotation: i => (i - 1) * 6, autoAlpha: 0, stagger: 0.12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '#passCards', start: 'top 85%' } });
    return;
  }
  const wrap = document.getElementById('passCards');
  const off = () => { const wr = wrap.getBoundingClientRect(); return cards.map(c => { const r = c.getBoundingClientRect(); return wr.left + wr.width / 2 - (r.left + r.width / 2); }); };
  const dx = off();
  gsap.from(cards, {
    x: i => dx[i], y: i => 50 - i * 12, rotation: i => [-8, 3, 10][i] || 0, scale: 0.92, ease: 'power2.out', stagger: 0.04,
    scrollTrigger: { trigger: wrap, start: 'top 95%', end: 'top 35%', scrub: 0.8 },
  });
})();

refresh();
