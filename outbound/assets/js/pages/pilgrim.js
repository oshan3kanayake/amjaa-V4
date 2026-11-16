// Hajj & Umrah pages — rites timeline (horizontal scroll), live packages, enquiry.
import { renderLayout } from '../layout.js';
import { list, esc, img } from '../store.js';
import { boot, reduced, refresh } from '../motion.js';
import { initEnquiries } from '../enquiry.js';
import { pattern, tilt } from '../fx.js';

const gsap = window.gsap;
const kind = document.body.dataset.kind;                    // 'hajj' | 'umrah'
await renderLayout('outbound', `${kind}.html`);
const pkgs = await list(`${kind}_packages`);

document.getElementById('pkgs').innerHTML = pkgs.map(p => `
  <article class="pkg${p.featured ? ' featured' : ''}" data-tilt>
    <div class="pkg-img">${p.image ? `<img src="${esc(img(p.image))}" alt="${esc(p.title)}" loading="lazy" onerror="this.remove()">` : ''}<span class="pkg-tier">${esc((p.tier || kind).toUpperCase())}${p.featured ? ' · MOST CHOSEN' : ''}</span></div>
    <div class="pkg-body">
      <h3>${esc(p.title)}</h3>
      ${p.duration ? `<span class="pkg-dur">${esc(p.duration)}${p.departure ? ' · FROM ' + esc(p.departure).toUpperCase() : ''}</span>` : ''}
      <p>${esc(p.description || '')}</p>
      ${(p.makkahHotel || p.madinahHotel) ? `<div class="pkg-hotels"><div><small>MAKKAH</small><b>${esc(p.makkahHotel || '—')}</b></div><div><small>MADINAH</small><b>${esc(p.madinahHotel || '—')}</b></div></div>` : ''}
      <ul>${(p.includes || []).map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="pkg-foot"><span class="pkg-price">${esc(p.price || 'On request')}</span><a href="#enquire" class="btn btn-sm" data-enquire="${esc(p.title)}">Enquire →</a></div>
    </div>
  </article>`).join('') || '<p class="empty-note">Packages for this season are being finalised — please enquire and we will send the latest options.</p>';

initEnquiries('outbound');
boot();
pattern(document.getElementById('pattern'));
tilt(document);
if (gsap && !reduced) gsap.from('#pkgs .pkg', { y: 70, autoAlpha: 0, stagger: 0.12, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '#pkgs', start: 'top 85%' } });

/* rites: a horizontal path you walk by scrolling */
(function rites() {
  const sec = document.getElementById('rites');
  const track = document.getElementById('ritesTrack');
  const line = track.querySelector('.rites-line i');
  if (!gsap || reduced || !matchMedia('(min-width: 761px)').matches) return;
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const tween = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: sec.querySelector('.rites-pin'), start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1 } });
  gsap.to(line, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), scrub: true } });
  track.querySelectorAll('.rite').forEach(r => gsap.from(r.children, {
    y: 50, autoAlpha: 0, stagger: 0.07, duration: 0.9, ease: 'expo.out',
    scrollTrigger: { trigger: r, containerAnimation: tween, start: 'left 80%' },
  }));
})();
refresh();
