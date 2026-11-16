// ─────────────────────────────────────────────────────────────
// layout.js — header, full-screen menu and footer for both sites.
// Company name, phones, address, socials and accreditations all come
// from settings/site (Admin → Company & Brand), so the brand is
// consistent everywhere and editable without touching code.
// ─────────────────────────────────────────────────────────────
import { getSite, esc } from './store.js';

export const MARK = `<svg class="mark" viewBox="0 0 104 64" aria-hidden="true"><path d="M4 60 31 5l27 55" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linejoin="miter"/><path d="M19 60 31 36l12 24" fill="none" stroke="currentColor" stroke-width="6"/><path d="M52 8h48M76 8v52" fill="none" stroke="currentColor" stroke-width="8"/></svg>`;

const ICON = {
  facebook: '<path d="M13 22v-8h3l.5-3.5H13V8.3c0-1 .3-1.7 1.7-1.7H17V3.5A24 24 0 0 0 14.6 3C12 3 10.3 4.6 10.3 7.6v2.9H7V14h3.3v8H13Z"/>',
  instagram: '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4ZM12 3c-2.4 0-2.7 0-3.7.1C5.4 3.2 3.2 5.4 3.1 8.3 3 9.3 3 9.6 3 12s0 2.7.1 3.7c.1 2.9 2.3 5.1 5.2 5.2 1 .1 1.3.1 3.7.1s2.7 0 3.7-.1c2.9-.1 5.1-2.3 5.2-5.2.1-1 .1-1.3.1-3.7s0-2.7-.1-3.7c-.1-2.9-2.3-5.1-5.2-5.2C14.7 3 14.4 3 12 3Z"/>',
  youtube: '<path d="M23 12s0-3.3-.4-4.9a2.5 2.5 0 0 0-1.8-1.8C19.2 5 12 5 12 5s-7.2 0-8.8.4A2.5 2.5 0 0 0 1.4 7.2C1 8.7 1 12 1 12s0 3.3.4 4.9a2.5 2.5 0 0 0 1.8 1.8C4.8 19 12 19 12 19s7.2 0 8.8-.4a2.5 2.5 0 0 0 1.8-1.8C23 15.3 23 12 23 12ZM9.8 15.2V8.8l6 3.2-6 3.2Z"/>',
  x: '<path d="M17.5 3h3l-6.6 7.5L22 21h-6l-4.4-5.8L6.4 21H3.3l7-8L2.5 3h6.2l4 5.3L17.5 3Zm-1 16h1.7L7.6 4.8H5.8L16.5 19Z"/>',
  tiktok: '<path d="M16.6 3c.4 2.2 1.8 3.6 4 3.8v3.1c-1.5.1-2.9-.3-4-1v6.6c0 3.7-3.5 6.4-7.1 5.3-3.4-1-4.7-5.3-2.4-8.1 1.3-1.6 3.4-2.3 5.3-1.8v3.2c-1.1-.4-2.4.1-2.9 1.2-.6 1.3.3 2.9 1.7 3 1.4.2 2.4-.9 2.4-2.3V3h3Z"/>',
  whatsapp: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.6 14.2c-.2.6-1.4 1.2-1.9 1.2-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.4Z"/>',
};

const SITES = {
  inbound: {
    nav: [['index.html', 'Home'], ['plan.html', 'Plan a trip'], ['hotels.html', 'Hotels'], ['rent-a-car.html', 'Rent a car'], ['about.html', 'Our story'], ['contact.html', 'Contact']],
    cta: ['plan.html', 'Plan my trip'],
    sub: 'Sri Lanka · Inbound',
    cross: s => s.outboundUrl ? [s.outboundUrl, 'Hajj, Umrah & flights ↗'] : null,
    admin: () => 'admin/',
  },
  outbound: {
    nav: [['index.html', 'Home'], ['hajj.html', 'Hajj'], ['umrah.html', 'Umrah'], ['tickets.html', 'Air tickets'], ['about.html', 'Our story'], ['contact.html', 'Contact']],
    cta: ['tickets.html', 'Book a ticket'],
    sub: 'Worldwide · Outbound',
    cross: s => s.inboundUrl ? [s.inboundUrl, 'Touring Sri Lanka? ↗'] : null,
    admin: s => s.inboundUrl ? s.inboundUrl.replace(/\/$/, '') + '/admin/' : '#',
  },
};

function brandOf(site, s) { return site === 'inbound' ? s.brandInbound : s.brandOutbound; }

function header(site, s, page) {
  const cfg = SITES[site];
  const brand = brandOf(site, s);
  const links = cfg.nav.map(([h, l]) => `<a href="${h}"${h === page ? ' class="on" aria-current="page"' : ''}><span>${l}</span></a>`).join('');
  return `
  <header class="hd">
    <a href="index.html" class="logo" aria-label="${esc(brand)} home">${MARK}<span class="logo-txt"><b>${esc(brand)}</b><small>${cfg.sub}</small></span></a>
    <nav class="hd-nav" aria-label="Main">${links}</nav>
    <div class="hd-right">
      <a href="${cfg.cta[0]}" class="btn btn-sm hd-cta" data-magnetic>${cfg.cta[1]}</a>
      <button class="menu-btn" aria-expanded="false" aria-label="Open menu"><i></i><i></i></button>
    </div>
  </header>
  <div class="menu" role="dialog" aria-label="Menu">
    <div class="menu-inner">
      <nav class="menu-links">${cfg.nav.map(([h, l], i) => `<a href="${h}"><em>0${i + 1}</em>${l}</a>`).join('')}</nav>
      <div class="menu-foot">
        <a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a>
        <a href="mailto:${esc(s.email)}">${esc(s.email)}</a>
        ${cfg.cross(s) ? `<a href="${esc(cfg.cross(s)[0])}" class="cross">${cfg.cross(s)[1]}</a>` : ''}
      </div>
    </div>
  </div>`;
}

function footer(site, s) {
  const cfg = SITES[site];
  const brand = brandOf(site, s);
  const socials = ['facebook', 'instagram', 'youtube', 'x', 'tiktok'].filter(k => s[k]).map(k => `<a href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg viewBox="0 0 24 24" fill="currentColor">${ICON[k]}</svg></a>`).join('');
  const year = new Date().getFullYear();
  const cross = cfg.cross(s);
  return `
  <footer class="ft">
    <div class="wrap">
      <div class="ft-cta">
        <p class="eyebrow">Talk to a real person</p>
        <h2 class="ft-cta-h" data-split>Let's plan it <em>together.</em></h2>
        <div class="ft-cta-row">
          <a class="btn btn-lg" href="contact.html" data-magnetic>Start a conversation <span class="arr">→</span></a>
          ${s.whatsapp ? `<a class="btn btn-lg btn-ghost" href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener" data-magnetic><svg viewBox="0 0 24 24" fill="currentColor" width="18">${ICON.whatsapp}</svg> WhatsApp us</a>` : ''}
        </div>
      </div>
      <div class="ft-grid">
        <div class="ft-brand">
          <a href="index.html" class="logo logo-ft">${MARK}<span class="logo-txt"><b>${esc(brand)}</b><small>by ${esc(s.legalName)} · since ${esc(s.since)}</small></span></a>
          <p>${esc(site === 'inbound' ? s.taglineInbound : s.taglineOutbound)} Accredited, local and personal since ${esc(s.since)}.</p>
          <div class="ft-social">${socials}</div>
        </div>
        <div><h4>Explore</h4><ul>${cfg.nav.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}${cross ? `<li><a href="${esc(cross[0])}">${cross[1]}</a></li>` : ''}</ul></div>
        <div><h4>Head office</h4><ul>
          <li>${esc(s.address)}</li>
          <li><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a></li>
          ${s.phone2 ? `<li><a href="tel:${esc(s.phone2.replace(/\s/g, ''))}">${esc(s.phone2)}</a></li>` : ''}
          <li><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>
          <li>${esc(s.hours)}</li>
        </ul></div>
        <div><h4>Accredited</h4><ul class="ft-acc">${(s.accreditations || []).map(a => `<li><span class="seal"></span>${esc(a)}</li>`).join('')}</ul></div>
      </div>
    </div>
    <div class="ft-mark" aria-hidden="true">AMJA</div>
    <div class="wrap ft-bar">
      <span>© ${year} ${esc(s.legalName)}. All rights reserved.</span>
      <span>Colombo · Since ${esc(s.since)}</span>
      <a href="${esc(cfg.admin(s))}" class="admin-dot" aria-label="Staff login" title="Staff"></a>
    </div>
  </footer>`;
}

/** Render header + menu + footer, return site settings for the page to use. */
export async function renderLayout(site, page) {
  const s = await getSite();
  const top = document.getElementById('layout-top');
  const bottom = document.getElementById('layout-bottom');
  if (top) top.outerHTML = header(site, s, page);
  if (bottom) bottom.outerHTML = footer(site, s);
  document.querySelectorAll('[data-site="brand"]').forEach(el => { el.textContent = brandOf(site, s); });
  document.querySelectorAll('[data-site]').forEach(el => {
    const k = el.dataset.site;
    if (k === 'brand') return;
    if (s[k] != null && typeof s[k] !== 'object') el.textContent = s[k];
  });
  document.querySelectorAll('[data-site-href]').forEach(el => {
    const k = el.dataset.siteHref;
    const v = s[k];
    if (!v) return;
    if (k === 'email') el.href = 'mailto:' + v;
    else if (k === 'phone' || k === 'phone2') el.href = 'tel:' + v.replace(/\s/g, '');
    else if (k === 'whatsapp') el.href = 'https://wa.me/' + v.replace(/\D/g, '');
    else el.href = v;
  });
  return s;
}

export function statsHTML(s) {
  return (s.stats || []).map(st => `
    <div class="stat"><b data-count="${Number(st.value) || 0}" data-suffix="${esc(st.suffix || '')}">0</b><span>${esc(st.label)}</span></div>`).join('');
}
