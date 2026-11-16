// ─────────────────────────────────────────────────────────────
// admin.js — ONE admin panel for BOTH websites.
//   Amja Tours (inbound):   hotels, rent a car, planner cities, planner rules
//   Amja Travels (outbound): Hajj, Umrah, flight deals
//   Shared: company & brand, enquiries from both sites
// Writes are allowed by Firestore Security Rules only for users with the
// custom claim admin:true.
// ─────────────────────────────────────────────────────────────
import { db, auth } from '/assets/js/firebase.js';
import { onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, onSnapshot, serverTimestamp, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { DEFAULT_SITE, DEFAULT_RULES, STARTER } from '/assets/js/defaults.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pic = src => !src ? '' : (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('/')) ? src : '/' + src;

/* ═════════ ui helpers ═════════ */
function toast(msg, type = 'ok') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 3200);
}
function confirmBox(title, msg, yes = 'Delete') {
  return new Promise(res => {
    $('#cTitle').textContent = title; $('#cMsg').textContent = msg; $('#cYes').textContent = yes;
    $('#confirm').hidden = false;
    const done = v => { $('#confirm').hidden = true; $('#cYes').onclick = $('#cNo').onclick = null; res(v); };
    $('#cYes').onclick = () => done(true); $('#cNo').onclick = () => done(false);
  });
}
function openModal(title, bodyHTML, footHTML) {
  $('#mTitle').textContent = title; $('#mBody').innerHTML = bodyHTML; $('#mFoot').innerHTML = footHTML || '';
  $('#modal').hidden = false; document.body.classList.add('locked');
  $('#mBody').scrollTop = 0;
}
function closeModal() { $('#modal').hidden = true; document.body.classList.remove('locked'); }
$('#mClose').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

/* ═════════ schemas — every editable collection ═════════ */
const HOTEL_CATS = ['Our hotel', 'Beach resort', 'Boutique', 'City & river', 'Nature', 'Villa', 'Hill country'];
const CAR_CATS = ['Mini Car', 'Standard Car', 'Executive Car', 'Luxury Car', 'SUV', 'Van', 'Bus'];
const SCHEMAS = {
  hotels: {
    label: 'Hotels', site: 'inbound', icon: '🏨', title: 'name', sub: h => `${h.city || ''}${h.stars ? ' · ' + '★'.repeat(h.stars) : ''}${h.featured ? ' · Featured' : ''}`,
    help: 'Every hotel can have as many photos as you like — they appear as a draggable photo deck on the Hotels page, in the gallery and on Home. Link a hotel to a planner city by using the same city name.',
    fields: [
      ['name', 'Hotel name', 'text', { required: true }],
      ['city', 'City (match a planner city to offer it in the planner)', 'text', { datalist: 'cityList' }],
      ['location', 'Location line', 'text', { ph: 'Beruwala · West Coast' }],
      ['stars', 'Stars', 'number', { min: 0, max: 5 }],
      ['category', 'Category', 'text', { datalist: 'hotelCats' }],
      ['price', 'Price note', 'text', { ph: 'From LKR 38,000 / night' }],
      ['booking_url', 'Hotel website (optional)', 'url'],
      ['featured', 'Feature on the Home page', 'check'],
      ['ownHotel', 'This is OUR hotel (shown in its own section at the top of the Hotels page)', 'check'],
      ['description', 'Description', 'textarea'],
      ['amenities', 'Amenities (one per line)', 'list'],
      ['images', 'Photos', 'images'],
      ['videos', 'Video links (.mp4, one per line) — shown for our own hotel', 'list'],
      ['order', 'Sort order', 'number'],
      ['hidden', 'Hide from website', 'check'],
    ],
  },
  fleet: {
    label: 'Rent a car', site: 'inbound', icon: '🚘', title: 'name', sub: c => `${c.category || ''}${c.seats ? ' · ' + c.seats + ' seats' : ''}`,
    help: 'Add several photos per vehicle (front, side, interior…). On the website visitors drag sideways to "turn" the car through them.',
    fields: [
      ['name', 'Vehicle name', 'text', { required: true }],
      ['category', 'Category', 'text', { datalist: 'carCats' }],
      ['model', 'Model line', 'text', { ph: 'Toyota Prado or similar' }],
      ['seats', 'Seats', 'number', { min: 1 }], ['luggage', 'Bags', 'number', { min: 0 }],
      ['transmission', 'Gearbox', 'select', { options: ['Automatic', 'Manual'] }],
      ['fuel', 'Fuel', 'select', { options: ['Petrol', 'Diesel', 'Hybrid', 'Electric'] }],
      ['ac', 'Air-conditioned', 'check'],
      ['withDriver', 'Driver options', 'select', { options: ['Self-drive or chauffeur', 'Chauffeur driven', 'Self-drive only'] }],
      ['price', 'Price note', 'text', { ph: 'From LKR 9,500 / day' }],
      ['description', 'Description', 'textarea'],
      ['features', 'Features (one per line)', 'list'],
      ['images', 'Photos', 'images'],
      ['order', 'Sort order', 'number'], ['hidden', 'Hide from website', 'check'],
    ],
  },
  expertCities: {
    label: 'Planner cities', site: 'inbound', icon: '📍', title: 'title', sub: c => `${c.region || ''}${c.airportCode ? ' · ✈ ' + c.airportCode.toUpperCase() : ''}${c.hubOnly ? ' · airport only' : ''}`,
    help: 'These are the destinations the tour planner can use. Tick which trip lengths each city appears for. Give a city an airport code to make it an arrival/departure option; tick "airport only" if it should never be a stop.',
    fields: [
      ['title', 'City / place name', 'text', { required: true }],
      ['region', 'Region', 'text', { ph: 'Cultural Triangle' }],
      ['emoji', 'Emoji', 'text', { ph: '🦁' }],
      ['lat', 'Latitude', 'number', { step: 'any', required: true }], ['lng', 'Longitude', 'number', { step: 'any', required: true }],
      ['airportCode', 'Airport code (makes it an arrival/departure option)', 'text', { ph: 'cmb' }],
      ['hubOnly', 'Airport only — never a sightseeing stop', 'check'],
      ['interests', 'Interests (comma separated) — matched to traveller interests', 'tags', { ph: 'culture, heritage, nature' }],
      ['tiers', 'Show for trip lengths', 'tiers'],
      ['description', 'Short description', 'textarea'],
      ['activities', 'Activities (one per line)', 'list'],
      ['image', 'Photo', 'image'],
      ['order', 'Sort order', 'number'], ['hidden', 'Hide from planner', 'check'],
    ],
  },
  hajj_packages: {
    label: 'Hajj packages', site: 'outbound', icon: '🕋', title: 'title', sub: p => `${p.tier || ''}${p.duration ? ' · ' + p.duration : ''}${p.featured ? ' · Most chosen' : ''}`,
    fields: [
      ['title', 'Package name', 'text', { required: true }], ['tier', 'Tier label', 'text', { ph: 'Premium' }],
      ['price', 'Price', 'text', { ph: 'LKR 1,450,000 or On request' }], ['duration', 'Duration', 'text', { ph: '25 – 30 days' }],
      ['departure', 'Departure', 'text', { ph: 'Colombo (CMB)' }],
      ['makkahHotel', 'Makkah hotel', 'text'], ['madinahHotel', 'Madinah hotel', 'text'],
      ['featured', 'Highlight as most chosen', 'check'],
      ['description', 'Description', 'textarea'], ['includes', 'Includes (one per line)', 'list'],
      ['image', 'Photo', 'image'], ['order', 'Sort order', 'number'], ['hidden', 'Hide from website', 'check'],
    ],
  },
  umrah_packages: { label: 'Umrah packages', site: 'outbound', icon: '🌙', title: 'title', sub: p => `${p.tier || ''}${p.duration ? ' · ' + p.duration : ''}${p.featured ? ' · Most chosen' : ''}` },
  flight_deals: {
    label: 'Flight deals', site: 'outbound', icon: '✈️', title: 'toCity', sub: f => `${f.from || 'CMB'} → ${f.to || ''} · ${f.airline || ''} · ${f.fare || ''}`,
    help: 'Shown on the split-flap departures board (Outbound home + Air tickets). Keep names short — the board has 12 letters for the city.',
    fields: [
      ['toCity', 'Destination city', 'text', { required: true, ph: 'Dubai' }], ['to', 'Destination code', 'text', { ph: 'DXB' }],
      ['fromCity', 'From city', 'text', { ph: 'Colombo' }], ['from', 'From code', 'text', { ph: 'CMB' }],
      ['airline', 'Airline(s)', 'text'], ['fare', 'Fare text', 'text', { ph: 'From LKR 92,000' }],
      ['trip', 'Trip', 'select', { options: ['Return', 'One way'] }], ['note', 'Status note', 'text', { ph: 'Daily departures' }],
      ['order', 'Sort order', 'number'], ['hidden', 'Hide from website', 'check'],
    ],
  },
};
SCHEMAS.umrah_packages.fields = SCHEMAS.hajj_packages.fields;

const NAV = [
  ['Overview', [['dashboard', 'Dashboard', '◎']]],
  ['Brand · both sites', [['site', 'Company & brand', '✦']]],
  ['Amja Tours · inbound', [['hotels', 'Hotels', '🏨'], ['fleet', 'Rent a car', '🚘'], ['expertCities', 'Planner cities', '📍'], ['rules', 'Planner rules & pricing', '⚙']]],
  ['Amja Travels · outbound', [['hajj_packages', 'Hajj packages', '🕋'], ['umrah_packages', 'Umrah packages', '🌙'], ['flight_deals', 'Flight deals', '✈️']]],
  ['Inbox', [['enquiries', 'Enquiries', '✉'], ['email', 'Email replies setup', '✎']]],
  ['Settings', [['account', 'Admin login', '🔑']]],
];

/* ═════════ state ═════════ */
let current = 'dashboard', items = [], rules = null, enquiries = [], unsubEnq = null;
const titleOf = (sch, it) => it[sch.title] || '(untitled)';

/* ═════════ auth guard ═════════ */
onAuthStateChanged(auth, async user => {
  if (!user) return location.replace('/admin/login.html');
  const t = await user.getIdTokenResult();
  if (t.claims.admin !== true) { await signOut(auth); return location.replace('/admin/login.html'); }
  $('#who').textContent = user.email;
  $('#boot').remove(); $('#app').hidden = false;
  buildNav();
  listenEnquiries();
  go(location.hash.slice(1) || 'dashboard');
});
$('#logout').onclick = () => signOut(auth);
$('#menuToggle').onclick = () => document.body.classList.toggle('nav-open');
addEventListener('hashchange', () => go(location.hash.slice(1) || 'dashboard'));

function buildNav() {
  $('#nav').innerHTML = NAV.map(([group, links]) => `<p class="nav-g">${group}</p>` + links.map(([k, l, i]) => `<a href="#${k}" data-k="${k}"><span class="ni">${i}</span>${l}${k === 'enquiries' ? '<em class="badge" id="enqBadge" hidden>0</em>' : ''}</a>`).join('')).join('');
}

function head(crumb, title, sub = '', actions = '') {
  $('#crumb').textContent = crumb; $('#title').textContent = title; $('#sub').textContent = sub; $('#topActions').innerHTML = actions;
}

async function go(k) {
  current = k;
  document.body.classList.remove('nav-open');
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.k === k));
  $('#view').innerHTML = '<div class="spin"></div>';
  try {
    if (k === 'dashboard') return await dashboard();
    if (k === 'site') return await siteForm();
    if (k === 'rules') return await rulesForm();
    if (k === 'enquiries') return renderEnquiries();
    if (k === 'email') return await emailForm();
    if (k === 'account') return accountForm();
    if (SCHEMAS[k]) return await collectionView(k);
    go('dashboard');
  } catch (ex) {
    console.error(ex);
    $('#view').innerHTML = `<div class="empty"><b>Couldn't load this section</b><p>${esc(ex.message)}</p><p class="muted">If this says "permission-denied", the signed-in account needs the admin claim and the latest Firestore rules must be deployed.</p></div>`;
  }
}

/* ═════════ dashboard ═════════ */
async function dashboard() {
  head('Overview', 'Dashboard', 'Everything on both websites, at a glance.');
  const cols = Object.keys(SCHEMAS);
  const counts = await Promise.all(cols.map(async c => { try { return (await getDocs(collection(db, c))).size; } catch { return '—'; } }));
  const unread = enquiries.filter(e => !e.read).length;
  const recent = enquiries.slice(0, 6);
  $('#view').innerHTML = `
    <div class="dash-sites">
      <div class="site-card in"><small>Amja Tours</small><b>Inbound website</b><p>Sri Lanka tours, hotels, rent a car and the tour planner.</p><a class="abtn small" href="../index.html" target="_blank">Open site ↗</a></div>
      <div class="site-card out"><small>Amja Travels</small><b>Outbound website</b><p>Hajj, Umrah and air tickets.</p><a class="abtn small" id="outLink" href="#" target="_blank">Open site ↗</a></div>
      <div class="site-card inbox"><small>Inbox</small><b>${unread} unread</b><p>${enquiries.length} enquiries in total from both sites.</p><a class="abtn small" href="#enquiries">Open inbox →</a></div>
    </div>
    <div class="dash-grid">${cols.map((c, i) => `<a class="stat-card" href="#${c}"><span>${SCHEMAS[c].icon}</span><b>${counts[i]}</b><small>${SCHEMAS[c].label}</small><em class="tag ${SCHEMAS[c].site}">${SCHEMAS[c].site}</em></a>`).join('')}</div>
    <h3 class="h3">Latest enquiries</h3>
    <div class="enq-list">${recent.map(enqRow).join('') || '<div class="empty small">No enquiries yet.</div>'}</div>
    ${counts.some(n => n === 0) ? `<div class="hint-box"><b>Some sections are empty.</b> Open a section and use <i>Load starter data</i> to fill it with ready-made content you can then edit.</div>` : ''}`;
  try { const s = await getDoc(doc(db, 'settings', 'site')); const u = (s.exists() ? s.data().outboundUrl : '') || DEFAULT_SITE.outboundUrl; $('#outLink').href = u || '#'; } catch { /* ignore */ }
  bindEnqRows();
}

/* ═════════ generic collection view ═════════ */
async function loadRules() {
  if (rules) return rules;
  try { const s = await getDoc(doc(db, 'settings', 'expertSystem')); rules = { ...DEFAULT_RULES, ...(s.exists() ? s.data() : {}) }; } catch { rules = { ...DEFAULT_RULES }; }
  return rules;
}

async function collectionView(k) {
  const sch = SCHEMAS[k];
  head(sch.site === 'inbound' ? 'Amja Tours · inbound' : 'Amja Travels · outbound', sch.label, sch.help || '',
    `<input class="search" id="search" placeholder="Search…"><button class="abtn primary" id="addBtn">+ Add</button>`);
  const snap = await getDocs(collection(db, k));
  items = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
  if (k === 'hotels' || k === 'expertCities') await loadRules();
  window.__cityNames = k === 'hotels' ? (await getDocs(collection(db, 'expertCities'))).docs.map(d => d.data().title).filter(Boolean) : [];
  renderList(k);
  $('#addBtn').onclick = () => editor(k, null);
  $('#search').oninput = e => renderList(k, e.target.value.toLowerCase());
}

function renderList(k, q = '') {
  const sch = SCHEMAS[k];
  const shown = items.filter(it => !q || JSON.stringify(it).toLowerCase().includes(q));
  if (!items.length) {
    $('#view').innerHTML = `<div class="empty"><b>Nothing here yet</b><p>Add your first item, or load the ready-made starter content and edit it.</p><div class="row center"><button class="abtn primary" id="seedBtn">Load starter data</button><button class="abtn ghost" id="add2">+ Add manually</button></div></div>`;
    $('#seedBtn').onclick = () => seed(k);
    $('#add2').onclick = () => editor(k, null);
    return;
  }
  $('#view').innerHTML = `<div class="list">${shown.map((it, i) => {
    const thumb = (Array.isArray(it.images) && it.images[0]) || it.image || it.image_url || '';
    const nImgs = Array.isArray(it.images) ? it.images.length : (it.image ? 1 : 0);
    return `<div class="item${it.hidden ? ' is-hidden' : ''}" data-id="${it.id}">
      <div class="thumb">${thumb ? `<img src="${esc(pic(thumb))}" alt="" loading="lazy" onerror="this.remove()">` : `<span>${sch.icon}</span>`}${nImgs > 1 ? `<em>${nImgs} photos</em>` : ''}</div>
      <div class="meta"><b>${esc(titleOf(sch, it))}</b><small>${esc(sch.sub ? sch.sub(it) : '')}</small>${it.hidden ? '<span class="tag gray">hidden</span>' : ''}</div>
      <div class="acts">
        <button class="ic" data-act="up" title="Move up" ${i === 0 || q ? 'disabled' : ''}>↑</button>
        <button class="ic" data-act="down" title="Move down" ${i === shown.length - 1 || q ? 'disabled' : ''}>↓</button>
        <button class="ic" data-act="dup" title="Duplicate">⧉</button>
        <button class="abtn small" data-act="edit">Edit</button>
        <button class="ic danger" data-act="del" title="Delete">🗑</button>
      </div></div>`;
  }).join('')}</div><p class="muted small" style="margin-top:14px">${items.length} item${items.length === 1 ? '' : 's'} · changes appear on the website immediately (visitors may need to refresh).</p>`;
  $('#view').querySelectorAll('.item').forEach(row => row.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const it = items.find(x => x.id === row.dataset.id);
    const act = b.dataset.act;
    if (act === 'edit') editor(k, it);
    if (act === 'dup') { const { id, ...rest } = it; editor(k, { ...rest, [sch.title]: titleOf(sch, it) + ' (copy)' }, true); }
    if (act === 'del') {
      if (!(await confirmBox('Delete this item?', `“${titleOf(sch, it)}” will be removed from the website.`))) return;
      await deleteDoc(doc(db, k, it.id)); toast('Deleted'); collectionView(k);
    }
    if (act === 'up' || act === 'down') {
      const i = items.indexOf(it), j = act === 'up' ? i - 1 : i + 1;
      [items[i], items[j]] = [items[j], items[i]];
      const batch = writeBatch(db);
      items.forEach((x, n) => { x.order = n + 1; batch.update(doc(db, k, x.id), { order: n + 1 }); });
      await batch.commit(); renderList(k);
    }
  }));
}

async function seed(k) {
  const data = STARTER[k];
  if (!data) return;
  if (!(await confirmBox('Load starter data?', `This adds ${data.length} ready-made ${SCHEMAS[k].label.toLowerCase()} you can edit or delete.`, 'Load'))) return;
  const batch = writeBatch(db);
  data.forEach(x => batch.set(doc(collection(db, k)), { ...x, created_at: serverTimestamp() }));
  await batch.commit();
  toast(`${data.length} items added`);
  collectionView(k);
}

/* ═════════ the editor ═════════ */
function fieldHTML([key, label, type, o = {}], v) {
  const req = o.required ? ' required' : '';
  const id = 'f_' + key;
  if (type === 'textarea') return `<label class="fld full"><span>${label}</span><textarea id="${id}"${req}>${esc(v ?? '')}</textarea></label>`;
  if (type === 'list') return `<label class="fld full"><span>${label}</span><textarea id="${id}" class="mono">${esc((v || []).join('\n'))}</textarea></label>`;
  if (type === 'tags') return `<label class="fld full"><span>${label}</span><input id="${id}" value="${esc((v || []).join(', '))}" placeholder="${esc(o.ph || '')}"></label>`;
  if (type === 'check') return `<label class="fld check"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}><span>${label}</span></label>`;
  if (type === 'select') return `<label class="fld"><span>${label}</span><select id="${id}">${o.options.map(op => `<option${op === v ? ' selected' : ''}>${esc(op)}</option>`).join('')}</select></label>`;
  if (type === 'tiers') {
    const tiers = (rules?.cityLimits || DEFAULT_RULES.cityLimits).map(p => Number(p.days));
    const on = (v || []).map(Number);
    return `<div class="fld full"><span>${label}</span><div class="tier-row">${tiers.map(n => `<label class="pillcheck"><input type="checkbox" class="f_tier" value="${n}" ${on.includes(n) ? 'checked' : ''}>${n} nights</label>`).join('')}</div><p class="muted small">Trip lengths come from Planner rules → Trip options.</p></div>`;
  }
  if (type === 'image') return `<div class="fld full"><span>${label}</span><div class="img-one"><div class="prev" id="${id}_prev">${v ? `<img src="${esc(pic(v))}" alt="">` : 'No photo'}</div><input id="${id}" value="${esc(v || '')}" placeholder="Paste an image URL (https://…) or images/…"></div></div>`;
  if (type === 'images') return `<div class="fld full"><span>${label} <i class="muted">— drag ⠿ to reorder, first photo is the cover</i></span><div class="imgs" id="imgs"></div><div class="row"><input id="newImg" placeholder="Paste an image URL and press Add (you can paste several, one per line)"><button type="button" class="abtn" id="addImg">Add</button></div></div>`;
  const dl = o.datalist ? ` list="${o.datalist}"` : '';
  return `<label class="fld"><span>${label}</span><input id="${id}" type="${type === 'number' ? 'number' : type === 'url' ? 'url' : 'text'}" value="${esc(v ?? '')}"${req}${dl}${o.min != null ? ` min="${o.min}"` : ''}${o.max != null ? ` max="${o.max}"` : ''}${o.step ? ` step="${o.step}"` : ''} placeholder="${esc(o.ph || '')}"></label>`;
}

function editor(k, it, isCopy = false) {
  const sch = SCHEMAS[k];
  const editingId = it && !isCopy ? it.id : null;
  const d = it || { order: (items.length ? Math.max(...items.map(x => Number(x.order) || 0)) + 1 : 1), ac: true };
  if (!d.image && d.image_url) d.image = d.image_url;               // older records
  let imgs = Array.isArray(d.images) && d.images.length ? d.images.slice() : [d.image, d.image_url].filter(Boolean);
  openModal(editingId ? `Edit ${titleOf(sch, d)}` : `New — ${sch.label}`, `
    <form id="edForm" class="grid2">${sch.fields.map(f => fieldHTML(f, d[f[0]])).join('')}</form>
    <datalist id="hotelCats">${HOTEL_CATS.map(c => `<option>${c}</option>`).join('')}</datalist>
    <datalist id="carCats">${CAR_CATS.map(c => `<option>${c}</option>`).join('')}</datalist>
    <datalist id="cityList">${(window.__cityNames || []).map(c => `<option>${esc(c)}</option>`).join('')}</datalist>`,
    `<button class="abtn ghost" id="edCancel">Cancel</button><button class="abtn primary" id="edSave">${editingId ? 'Save changes' : 'Create'}</button>`);
  $('#edCancel').onclick = closeModal;

  // single image preview
  $('#mBody').querySelectorAll('.img-one input').forEach(inp => inp.addEventListener('input', () => {
    const p = $('#' + inp.id + '_prev'); const v = inp.value.trim();
    p.innerHTML = v ? `<img src="${esc(pic(v))}" alt="" onerror="this.parentNode.textContent='Image could not load'">` : 'No photo';
  }));

  // multi-image manager with drag-to-reorder
  const imgsEl = $('#imgs');
  const drawImgs = () => {
    if (!imgsEl) return;
    imgsEl.innerHTML = imgs.map((s, i) => `<div class="imgc" draggable="true" data-i="${i}"><img src="${esc(pic(s))}" alt="" onerror="this.classList.add('bad')"><span class="grip">⠿</span>${i === 0 ? '<em>Cover</em>' : ''}<button type="button" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('') || '<p class="muted small">No photos yet — paste image links below.</p>';
    let from = null;
    imgsEl.querySelectorAll('.imgc').forEach(c => {
      c.addEventListener('dragstart', () => { from = Number(c.dataset.i); c.classList.add('drag'); });
      c.addEventListener('dragend', () => c.classList.remove('drag'));
      c.addEventListener('dragover', e => e.preventDefault());
      c.addEventListener('drop', e => { e.preventDefault(); const to = Number(c.dataset.i); if (from == null || from === to) return; const [m] = imgs.splice(from, 1); imgs.splice(to, 0, m); drawImgs(); });
    });
    imgsEl.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { imgs.splice(Number(b.dataset.rm), 1); drawImgs(); });
  };
  if (imgsEl) {
    drawImgs();
    const add = () => { const v = $('#newImg').value.split(/\n|\s{2,}|,(?=\s*https?:)/).map(s => s.trim()).filter(Boolean); if (!v.length) return; imgs.push(...v); $('#newImg').value = ''; drawImgs(); };
    $('#addImg').onclick = add;
    $('#newImg').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  }

  $('#edSave').onclick = async () => {
    const form = $('#edForm');
    if (!form.reportValidity()) return;
    const out = {};
    for (const [key, , type] of sch.fields) {
      const el = $('#f_' + key);
      if (type === 'check') out[key] = !!el.checked;
      else if (type === 'number') { const n = el.value === '' ? null : Number(el.value); out[key] = Number.isFinite(n) ? n : null; }
      else if (type === 'list') out[key] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
      else if (type === 'tags') out[key] = el.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      else if (type === 'tiers') out[key] = [...document.querySelectorAll('.f_tier:checked')].map(c => Number(c.value)).sort((a, b) => a - b);
      else if (type === 'images') out[key] = imgs.slice();
      else out[key] = el.value.trim();
    }
    if (k === 'expertCities') out.airportCode = (out.airportCode || '').toLowerCase();
    if (k === 'hotels' && !out.images.length) return toast('Add at least one photo for the hotel.', 'err');
    if (k === 'fleet' && !out.images.length) return toast('Add at least one photo for the vehicle.', 'err');
    out.updated_at = serverTimestamp();
    const btn = $('#edSave'); btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (editingId) await updateDoc(doc(db, k, editingId), out);
      else await addDoc(collection(db, k), { ...out, created_at: serverTimestamp() });
      closeModal(); toast(editingId ? 'Saved' : 'Created'); collectionView(k);
    } catch (ex) { toast(ex.message, 'err'); btn.disabled = false; btn.textContent = 'Save'; }
  };
}

/* ═════════ company & brand ═════════ */
async function siteForm() {
  head('Brand · both sites', 'Company & brand', 'Names, contact details, story and numbers used across both websites — header, footer, About and Contact.',
    `<button class="abtn primary" id="saveSite">Save</button>`);
  const snap = await getDoc(doc(db, 'settings', 'site'));
  const s = { ...DEFAULT_SITE, ...(snap.exists() ? snap.data() : {}) };
  const F = (k, l, t = 'text', ph = '') => t === 'textarea'
    ? `<label class="fld full"><span>${l}</span><textarea id="s_${k}">${esc(s[k] ?? '')}</textarea></label>`
    : `<label class="fld"><span>${l}</span><input id="s_${k}" type="${t}" value="${esc(s[k] ?? '')}" placeholder="${esc(ph)}"></label>`;
  let stats = (s.stats || []).map(x => ({ ...x }));
  $('#view').innerHTML = `
    <div class="card"><h3 class="h3">Brand names</h3><div class="grid2">
      ${F('brandInbound', 'Inbound brand (Sri Lanka site)')}${F('brandOutbound', 'Outbound brand (Hajj / Umrah / tickets site)')}
      ${F('legalName', 'Registered company name')}${F('since', 'Established (year)', 'number')}
      ${F('taglineInbound', 'Inbound tagline (Home hero)')}${F('taglineOutbound', 'Outbound tagline (Home hero)')}
    </div></div>
    <div class="card"><h3 class="h3">Story</h3><div class="grid2">${F('aboutTitle', 'Headline sentence', 'textarea')}${F('aboutText', 'About paragraph', 'textarea')}</div></div>
    <div class="card"><h3 class="h3">Contact</h3><div class="grid2">
      ${F('phone', 'Office phone')}${F('phone2', 'Mobile')}${F('whatsapp', 'WhatsApp number (digits, with country code)')}${F('email', 'Email', 'email')}
      ${F('address', 'Address')}${F('hours', 'Opening hours')}${F('mapQuery', 'Map search text')}
    </div></div>
    <div class="card"><h3 class="h3">Website addresses</h3><p class="muted small">Used to link the two sites to each other and for the hidden staff link on the outbound site.</p><div class="grid2">
      ${F('inboundUrl', 'Inbound site URL', 'url', 'https://…')}${F('outboundUrl', 'Outbound site URL', 'url', 'https://…')}
    </div></div>
    <div class="card"><h3 class="h3">Social</h3><div class="grid2">${F('facebook', 'Facebook', 'url')}${F('instagram', 'Instagram', 'url')}${F('youtube', 'YouTube', 'url')}${F('x', 'X / Twitter', 'url')}${F('tiktok', 'TikTok', 'url')}</div></div>
    <div class="card"><h3 class="h3">Accreditations</h3><label class="fld full"><span>One per line</span><textarea id="s_accreditations" class="mono">${esc((s.accreditations || []).join('\n'))}</textarea></label></div>
    <div class="card"><h3 class="h3">Numbers that count up on the sites</h3><div id="statRows"></div><button class="abtn ghost small" id="addStat">+ Add number</button></div>`;
  const drawStats = () => {
    $('#statRows').innerHTML = stats.map((x, i) => `<div class="rep"><input data-st="${i}" data-k="value" type="number" value="${esc(x.value)}" placeholder="27"><input data-st="${i}" data-k="suffix" value="${esc(x.suffix || '')}" placeholder="+" style="max-width:80px"><input data-st="${i}" data-k="label" value="${esc(x.label)}" placeholder="Years in travel"><button class="ic danger" data-strm="${i}">✕</button></div>`).join('');
    $('#statRows').querySelectorAll('[data-st]').forEach(inp => inp.oninput = () => { stats[inp.dataset.st][inp.dataset.k] = inp.dataset.k === 'value' ? Number(inp.value) : inp.value; });
    $('#statRows').querySelectorAll('[data-strm]').forEach(b => b.onclick = () => { stats.splice(Number(b.dataset.strm), 1); drawStats(); });
  };
  drawStats();
  $('#addStat').onclick = () => { stats.push({ value: 0, suffix: '', label: '' }); drawStats(); };
  $('#saveSite').onclick = async () => {
    const out = {};
    Object.keys(DEFAULT_SITE).forEach(k => { const el = $('#s_' + k); if (el && k !== 'accreditations') out[k] = el.type === 'number' ? Number(el.value) : el.value.trim(); });
    out.accreditations = $('#s_accreditations').value.split('\n').map(x => x.trim()).filter(Boolean);
    out.stats = stats.filter(x => x.label);
    out.updated_at = serverTimestamp();
    try { await setDoc(doc(db, 'settings', 'site'), out, { merge: true }); toast('Company details saved — both sites updated'); } catch (ex) { toast(ex.message, 'err'); }
  };
}

/* ═════════ planner rules & pricing ═════════ */
async function rulesForm() {
  head('Amja Tours · inbound', 'Planner rules & pricing', 'Every number the tour planner uses. Change a rate here and the next quote uses it.', `<button class="abtn primary" id="saveRules">Save rules</button>`);
  rules = null;
  const r = await loadRules();
  let limits = (r.cityLimits || []).map(p => ({ ...p }));
  let bands = (r.budgetBands || []).map(b => ({ ...b }));
  const N = (k, l, step = '1') => `<label class="fld"><span>${l}</span><input type="number" step="${step}" min="0" id="r_${k}" value="${esc(r[k] ?? '')}"></label>`;
  $('#view').innerHTML = `
    <div class="card explain"><h3 class="h3">How a quote is calculated</h3>
      <ul><li><b>Transport</b> = driving km × rate per km × vehicles (1 per 4 travellers)</li><li><b>Hotels</b> = rooms (1 per 2 travellers) × nights × style rate</li><li><b>Meals</b> = days × (adults × meal rate + children × half rate)</li><li><b>Guide & activities</b> = days × guide fee + stops × travellers × activity allowance</li><li><b>Total</b> = all of the above + your markup %</li></ul></div>
    <div class="card"><h3 class="h3">Core rates (LKR)</h3><div class="grid3">
      ${N('transportPerKm', 'Transport per km')}${N('guidePerDay', 'Chauffeur-guide per day')}${N('activityPerPerson', 'Activity allowance per person / stop')}
      ${N('markupPercent', 'Markup %', '0.5')}${N('maxTripDays', 'Maximum trip length (days)')}${N('maxKmPerDay', 'Max driving per day (km)')}
      <label class="fld full"><span>Default interests (used when a traveller picks none)</span><input id="r_defaultInterests" value="${esc(r.defaultInterests || '')}"></label>
    </div></div>
    <div class="card"><h3 class="h3">Hotel style — per room, per night (LKR)</h3><p class="muted small">Set a rate to 0 to hide that style from the planner.</p><div class="grid3">
      ${N('tierStandard', 'Standard (3★)')}${N('tierBoutique', 'Boutique')}${N('tierFiveStar', 'Superior (4★)')}${N('tierDeluxe', 'Deluxe (5★)')}${N('tierVilla', 'Private villa')}
    </div></div>
    <div class="card"><h3 class="h3">Meal plans — per adult, per day (LKR)</h3><p class="muted small">Children are charged 50%. Set 0 to hide a plan.</p><div class="grid3">
      ${N('mealBreakfast', 'Bed & breakfast')}${N('mealHalfBoard', 'Half board')}${N('mealFullBoard', 'Full board')}${N('mealAllInclusive', 'All inclusive')}
    </div></div>
    <div class="card"><h3 class="h3">Trip options — nights → maximum destinations</h3><p class="muted small">Each row becomes a choice on step 1 of the planner. Tag cities for these lengths in Planner cities.</p><div id="limRows"></div><button class="abtn ghost small" id="addLim">+ Add trip option</button></div>
    <div class="card"><h3 class="h3">Budget choices — per person, per day (LKR)</h3><div id="bandRows"></div><button class="abtn ghost small" id="addBand">+ Add budget choice</button></div>
    <div class="card"><h3 class="h3">Show prices in a second currency</h3><p class="muted small">Quotes are calculated in LKR. For foreign visitors we also show an approximate amount. Leave the currency as LKR to switch this off.</p><div class="grid3">
      <label class="fld"><span>Display currency</span><select id="r_displayCurrency">${['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'INR', 'CNY', 'JPY', 'AED', 'SAR'].map(c => `<option${c === (r.displayCurrency || 'LKR') ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
      ${N('fxRate', 'LKR per 1 unit of that currency', '0.01')}
    </div></div>`;
  const drawLim = () => {
    $('#limRows').innerHTML = limits.map((p, i) => `<div class="rep"><label>Nights<input type="number" min="1" data-li="${i}" data-k="days" value="${p.days}"></label><label>Max destinations<input type="number" min="1" data-li="${i}" data-k="cities" value="${p.cities}"></label><button class="ic danger" data-lirm="${i}">✕</button></div>`).join('');
    $('#limRows').querySelectorAll('[data-li]').forEach(inp => inp.oninput = () => { limits[inp.dataset.li][inp.dataset.k] = Number(inp.value); });
    $('#limRows').querySelectorAll('[data-lirm]').forEach(b => b.onclick = () => { if (limits.length < 2) return toast('Keep at least one trip option', 'err'); limits.splice(Number(b.dataset.lirm), 1); drawLim(); });
  };
  const drawBands = () => {
    $('#bandRows').innerHTML = bands.map((b, i) => `<div class="rep"><label>Name<input data-bi="${i}" data-k="label" value="${esc(b.label)}"></label><label>LKR / person / day<input type="number" min="0" data-bi="${i}" data-k="amount" value="${b.amount}"></label><label>Note<input data-bi="${i}" data-k="note" value="${esc(b.note || '')}"></label><button class="ic danger" data-birm="${i}">✕</button></div>`).join('');
    $('#bandRows').querySelectorAll('[data-bi]').forEach(inp => inp.oninput = () => { bands[inp.dataset.bi][inp.dataset.k] = inp.dataset.k === 'amount' ? Number(inp.value) : inp.value; });
    $('#bandRows').querySelectorAll('[data-birm]').forEach(b => b.onclick = () => { if (bands.length < 2) return toast('Keep at least one budget choice', 'err'); bands.splice(Number(b.dataset.birm), 1); drawBands(); });
  };
  drawLim(); drawBands();
  $('#addLim').onclick = () => { const l = limits[limits.length - 1] || { days: 3, cities: 1 }; limits.push({ days: l.days + 2, cities: l.cities + 1 }); drawLim(); };
  $('#addBand').onclick = () => { bands.push({ label: 'New', amount: 30000, note: '' }); drawBands(); };
  $('#saveRules').onclick = async () => {
    const out = {};
    Object.keys(DEFAULT_RULES).forEach(k => { const el = $('#r_' + k); if (!el) return; out[k] = el.tagName === 'SELECT' || k === 'defaultInterests' ? el.value.trim() : Number(el.value); });
    const cl = limits.filter(p => p.days > 0 && p.cities > 0).sort((a, b) => a.days - b.days);
    if (!cl.length) return toast('Add at least one valid trip option', 'err');
    out.cityLimits = cl;
    out.budgetBands = bands.filter(b => b.label && b.amount > 0);
    // legacy fields kept in sync, exactly like the original expert system
    out.maxCities3Days = (cl.find(p => p.days >= 3) || cl[0]).cities;
    out.maxCities5Days = (cl.find(p => p.days >= 5) || cl[cl.length - 1]).cities;
    out.maxCities7Days = (cl.find(p => p.days >= 7) || cl[cl.length - 1]).cities;
    out.maxCities10Days = (cl.find(p => p.days >= 10) || cl[cl.length - 1]).cities;
    out.updatedAt = new Date().toISOString();
    try { await setDoc(doc(db, 'settings', 'expertSystem'), out); rules = { ...DEFAULT_RULES, ...out }; toast('Planner rules saved — the next quote uses them'); } catch (ex) { toast(ex.message, 'err'); }
  };
}

/* ═════════ enquiries (both sites, live) ═════════ */
let enqFilter = 'all';
function listenEnquiries() {
  unsubEnq?.();
  unsubEnq = onSnapshot(query(collection(db, 'enquiries'), orderBy('created_at', 'desc')), snap => {
    enquiries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const n = enquiries.filter(e => !e.read).length;
    const b = $('#enqBadge'); if (b) { b.textContent = n; b.hidden = !n; }
    document.title = (n ? `(${n}) ` : '') + 'Amja admin — both websites';
    if (current === 'enquiries') renderEnquiries(true);
  }, err => console.warn('enquiries listener', err));
}
const when = e => e.created_at?.toDate ? e.created_at.toDate() : null;
const fmtDate = dt => dt ? dt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
function enqRow(e) {
  return `<div class="enq${e.read ? '' : ' unread'}" data-enq="${e.id}">
    <span class="dot"></span>
    <div class="enq-main"><b>${esc(e.name)}</b><small>${esc(e.phone)}${e.email ? ' · ' + esc(e.email) : ''}${e.country ? ' · ' + esc(e.country) : ''}</small>
      <p>${esc(e.item_title ? e.item_title + ' — ' : '')}${esc((e.message || '').slice(0, 140))}</p></div>
    <div class="enq-side"><span class="tag ${e.site || 'inbound'}">${esc(e.site || 'inbound')}</span><span class="tag gray">${esc(e.category || 'general')}</span><small>${fmtDate(when(e))}</small>${e.handled ? '<span class="tag ok">handled</span>' : ''}</div>
  </div>`;
}
function bindEnqRows() { document.querySelectorAll('[data-enq]').forEach(r => r.onclick = () => viewEnquiry(enquiries.find(x => x.id === r.dataset.enq))); }

function renderEnquiries(live = false) {
  if (!live) head('Inbox', 'Enquiries', 'Every message from both websites, newest first. Updates live.', `<button class="abtn ghost" id="csv">Export CSV</button>`);
  const tabs = [['all', 'All'], ['unread', 'Unread'], ['inbound', 'Amja Tours'], ['outbound', 'Amja Travels'], ['planner', 'Planner trips']];
  const list = enquiries.filter(e => enqFilter === 'all' || (enqFilter === 'unread' && !e.read) || e.site === enqFilter || (enqFilter === 'planner' && e.category === 'planner'));
  $('#view').innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button class="${enqFilter === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div class="enq-list">${list.map(enqRow).join('') || '<div class="empty small">Nothing here.</div>'}</div>`;
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { enqFilter = b.dataset.tab; renderEnquiries(true); });
  bindEnqRows();
  const csv = $('#csv'); if (csv) csv.onclick = exportCSV;
}

async function viewEnquiry(e) {
  if (!e) return;
  if (!e.read) updateDoc(doc(db, 'enquiries', e.id), { read: true }).catch(() => {});
  const extra = Object.entries(e.extra || {});
  const q = e.aiQuote;
  const wa = (e.phone || '').replace(/\D/g, '');
  const subject = encodeURIComponent(`Re: your enquiry${e.item_title ? ' — ' + e.item_title : ''}`);
  const body = encodeURIComponent(`Dear ${e.name || ''},\n\nThank you for contacting ${e.site === 'outbound' ? 'Amja Travels' : 'Amja Tours'}.\n\n`);
  openModal(`Enquiry from ${e.name || 'visitor'}`, `
    <div class="enq-detail">
      <div class="kv"><small>Website</small><b>${e.site === 'outbound' ? 'Amja Travels (outbound)' : 'Amja Tours (inbound)'}</b></div>
      <div class="kv"><small>Type</small><b>${esc(e.category)}</b></div>
      <div class="kv"><small>Received</small><b>${fmtDate(when(e))}</b></div>
      <div class="kv"><small>Name</small><b>${esc(e.name)}</b></div>
      <div class="kv"><small>Phone</small><b><a href="tel:${esc(e.phone)}">${esc(e.phone)}</a></b></div>
      <div class="kv"><small>Email</small><b>${e.email ? `<a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : '—'}</b></div>
      ${e.country ? `<div class="kv"><small>Country</small><b>${esc(e.country)}</b></div>` : ''}
      ${e.item_title ? `<div class="kv full"><small>Regarding</small><b>${esc(e.item_title)}</b></div>` : ''}
      ${extra.map(([k, v]) => `<div class="kv"><small>${esc(k.replace(/_/g, ' '))}</small><b>${esc(v)}</b></div>`).join('')}
      ${e.message ? `<div class="kv full"><small>Message</small><p class="pre">${esc(e.message)}</p></div>` : ''}
      ${q ? `<div class="kv full quote"><small>Planner itinerary</small>
        <p><b>${esc((q.route?.stops || []).join(' → '))}</b></p>
        <p>${esc(q.tripFacts?.days)} nights · ${esc(q.tripFacts?.adults)} adults${q.tripFacts?.children ? ', ' + esc(q.tripFacts.children) + ' children' + (q.tripFacts.childAges?.length ? ' (ages ' + esc(q.tripFacts.childAges.join(', ')) + ')' : '') : ''} · ${esc(q.tripFacts?.accommodationTier)} · ${esc(q.tripFacts?.mealPlan)} · ${esc(q.tripFacts?.pace)}</p>
        <p>Estimate: <b>LKR ${Number(q.totalPriceLKR || 0).toLocaleString()}</b> (${Number(q.perPersonLKR || 0).toLocaleString()} per person) · ${Math.round(q.route?.distanceKm || 0)} km</p>
        ${q.selectedHotels?.length ? `<p>Hotels liked: ${esc(q.selectedHotels.join('; '))}</p>` : ''}
        ${q.tripFacts?.specialNotes ? `<p>Notes: ${esc(q.tripFacts.specialNotes)}</p>` : ''}</div>` : ''}
      ${(e.replies || []).length ? `<div class="kv full"><small>Replies sent</small>${e.replies.map(r => `<p class="pre" style="margin-top:8px"><b>${esc(r.subject)}</b> · ${esc(new Date(r.at).toLocaleString('en-GB'))}<br>${esc(r.message)}</p>`).join('')}</div>` : ''}
    </div>`,
    `<button class="abtn danger ghost" id="eDel">Delete</button><span style="flex:1"></span>
     <button class="abtn ghost" id="eHandled">${e.handled ? 'Mark not handled' : 'Mark handled'}</button>
     ${wa ? `<a class="abtn ghost" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>` : ''}
     ${e.email ? `<a class="abtn ghost" href="mailto:${esc(e.email)}?subject=${subject}&body=${body}">Open in mail app</a><button class="abtn primary" id="eReply">Reply from here</button>` : ''}`);
  if (e.email) $('#eReply').onclick = () => compose(e);
  $('#eHandled').onclick = async () => { await updateDoc(doc(db, 'enquiries', e.id), { handled: !e.handled }); toast('Updated'); closeModal(); };
  $('#eDel').onclick = async () => { if (!(await confirmBox('Delete enquiry?', 'This cannot be undone.'))) return; await deleteDoc(doc(db, 'enquiries', e.id)); toast('Deleted'); closeModal(); };
}

function exportCSV() {
  const cols = ['created', 'site', 'category', 'name', 'phone', 'email', 'country', 'item_title', 'message', 'extra', 'estimate_lkr', 'read', 'handled'];
  const rows = enquiries.map(e => [fmtDate(when(e)), e.site, e.category, e.name, e.phone, e.email, e.country, e.item_title, e.message, JSON.stringify(e.extra || {}), e.aiQuote?.totalPriceLKR || '', e.read, e.handled]);
  const csv = [cols, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `amja-enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}


/* ═════════ email replies (EmailJS — works without a server) ═════════ */
async function emailSettings() {
  try { const s = await getDoc(doc(db, 'private', 'email')); return s.exists() ? s.data() : {}; } catch { return {}; }
}
async function emailForm() {
  head('Inbox', 'Email replies setup', 'Connect a free EmailJS account once — then you can answer enquiries straight from the admin and the reply comes from your own email address.', `<button class="abtn primary" id="saveMail">Save</button>`);
  const m = await emailSettings();
  const F = (k, l, ph = '') => `<label class="fld"><span>${l}</span><input id="m_${k}" value="${esc(m[k] || '')}" placeholder="${esc(ph)}"></label>`;
  $('#view').innerHTML = `
    <div class="card explain"><h3 class="h3">One-time setup (about 5 minutes)</h3><ul>
      <li>Create a free account at <b>emailjs.com</b> and add an <b>Email Service</b> (connect the Gmail / Outlook address you reply from). Copy its <b>Service ID</b>.</li>
      <li>Create an <b>Email Template</b>. Set <i>To email</i> = <code>{{to_email}}</code>, <i>From name</i> = <code>{{from_name}}</code>, <i>Reply to</i> = <code>{{reply_to}}</code>, <i>Subject</i> = <code>{{subject}}</code> and the body = <code>{{message}}</code>. Copy the <b>Template ID</b>.</li>
      <li>Account → API keys: copy the <b>Public Key</b>. Paste the three values below and press Save.</li></ul></div>
    <div class="card"><div class="grid2">
      ${F('serviceId', 'Service ID', 'service_xxxxxxx')}${F('templateId', 'Template ID', 'template_xxxxxxx')}
      ${F('publicKey', 'Public key', 'xxxxxxxxxxxxxxxxx')}${F('fromName', 'From name', 'Amja Travels')}
      ${F('replyTo', 'Reply-to email', 'amjatrvl@sltnet.lk')}
      <label class="fld full"><span>Signature (added under every reply)</span><textarea id="m_signature">${esc(m.signature || 'Kind regards,\nAmja Travels (Pvt) Ltd\nNo. 30, Dias Place, Colombo 12\n+94 11 233 5657')}</textarea></label>
    </div>
    <div class="row" style="margin-top:14px"><input id="testTo" class="search" placeholder="Send a test email to…"><button class="abtn ghost" id="testMail">Send test</button></div></div>`;
  const read = () => ({ serviceId: $('#m_serviceId').value.trim(), templateId: $('#m_templateId').value.trim(), publicKey: $('#m_publicKey').value.trim(), fromName: $('#m_fromName').value.trim(), replyTo: $('#m_replyTo').value.trim(), signature: $('#m_signature').value });
  $('#saveMail').onclick = async () => { try { await setDoc(doc(db, 'private', 'email'), { ...read(), updated_at: serverTimestamp() }); toast('Email settings saved'); } catch (ex) { toast(ex.message, 'err'); } };
  $('#testMail').onclick = async () => {
    const to = $('#testTo').value.trim(); if (!to) return toast('Enter an address for the test', 'err');
    try { await sendMail(read(), { to_email: to, to_name: 'Test', subject: 'Test from the Amja admin', message: 'If you can read this, replies from the admin panel are working.' }); toast('Test email sent ✓'); }
    catch (ex) { toast(ex.message, 'err'); }
  };
}
async function sendMail(cfg, params) {
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey) throw new Error('Email replies are not set up yet — open Inbox → Email replies setup.');
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id: cfg.serviceId, template_id: cfg.templateId, user_id: cfg.publicKey,
      template_params: { from_name: cfg.fromName || 'Amja Travels', reply_to: cfg.replyTo || '', ...params } }),
  });
  if (!res.ok) throw new Error('Email service said: ' + (await res.text()));
}
async function compose(e) {
  const cfg = await emailSettings();
  const brand = e.site === 'outbound' ? 'Amja Travels' : 'Amja Tours';
  const subj = `Re: your enquiry to ${brand}${e.item_title ? ' — ' + e.item_title : ''}`;
  const body = `Dear ${e.name || 'traveller'},\n\nThank you for contacting ${brand}.\n\n\n\n${cfg.signature || ''}`;
  openModal(`Reply to ${e.name || e.email}`, `
    ${!cfg.publicKey ? '<div class="hint-box" style="margin:0 0 14px"><b>Email replies are not set up yet.</b> Open <a href="#email">Inbox → Email replies setup</a> and add your EmailJS keys.</div>' : ''}
    <div class="grid2">
      <label class="fld"><span>To</span><input id="rTo" value="${esc(e.email)}"></label>
      <label class="fld"><span>Subject</span><input id="rSubj" value="${esc(subj)}"></label>
      <label class="fld full"><span>Message</span><textarea id="rMsg" style="min-height:260px">${esc(body)}</textarea></label>
    </div>
    ${e.message ? `<div class="kv" style="margin-top:12px"><small>Their message</small><p class="pre">${esc(e.message)}</p></div>` : ''}`,
    `<button class="abtn ghost" id="rBack">Back</button><button class="abtn primary" id="rSend">Send reply</button>`);
  $('#rBack').onclick = () => viewEnquiry(e);
  $('#rSend').onclick = async () => {
    const btn = $('#rSend'); btn.disabled = true; btn.textContent = 'Sending…';
    const reply = { to: $('#rTo').value.trim(), subject: $('#rSubj').value.trim(), message: $('#rMsg').value, at: new Date().toISOString(), by: auth.currentUser?.email || '' };
    try {
      await sendMail(cfg, { to_email: reply.to, to_name: e.name || '', subject: reply.subject, message: reply.message });
      await updateDoc(doc(db, 'enquiries', e.id), { replies: arrayUnion(reply), handled: true, read: true });
      toast('Reply sent ✓'); closeModal();
    } catch (ex) { toast(ex.message, 'err'); btn.disabled = false; btn.textContent = 'Send reply'; }
  };
}


/* ═════════ admin login (change email / password) ═════════ */
function accountForm() {
  const u = auth.currentUser;
  head('Settings', 'Admin login', 'Change the email or password used to sign in to this panel. Your current password is needed to confirm.', '');
  $('#view').innerHTML = `
    <div class="card" style="max-width:640px">
      <h3 class="h3">Signed in as ${esc(u?.email || '')}</h3>
      <div class="grid2">
        <label class="fld full"><span>Current password (required)</span><input id="a_cur" type="password" autocomplete="current-password"></label>
        <label class="fld full"><span>New email (leave as is to keep)</span><input id="a_email" type="email" value="${esc(u?.email || '')}" autocomplete="username"></label>
        <label class="fld"><span>New password (min 8 characters)</span><input id="a_pw" type="password" autocomplete="new-password"></label>
        <label class="fld"><span>Repeat new password</span><input id="a_pw2" type="password" autocomplete="new-password"></label>
      </div>
      <div class="row" style="margin-top:18px"><button class="abtn primary" id="a_save">Update login</button></div>
      <p class="muted small" style="margin-top:12px">Admin access stays with this account after the change. You'll stay signed in on this device.</p>
    </div>`;
  $('#a_save').onclick = async () => {
    const cur = $('#a_cur').value, email = $('#a_email').value.trim(), pw = $('#a_pw').value, pw2 = $('#a_pw2').value;
    if (!cur) return toast('Enter your current password', 'err');
    if (pw && pw.length < 8) return toast('New password must be at least 8 characters', 'err');
    if (pw !== pw2) return toast('The new passwords do not match', 'err');
    if (email === u.email && !pw) return toast('Nothing to change', 'err');
    const btn = $('#a_save'); btn.disabled = true; btn.textContent = 'Updating…';
    try {
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, cur));
      if (email && email !== u.email) await updateEmail(u, email);
      if (pw) await updatePassword(u, pw);
      toast('Admin login updated ✓');
      $('#who').textContent = auth.currentUser.email;
      accountForm();
    } catch (ex) {
      const m = {
        'auth/wrong-password': 'Current password is incorrect.', 'auth/invalid-credential': 'Current password is incorrect.',
        'auth/email-already-in-use': 'That email is already used by another account.', 'auth/invalid-email': 'That email address is not valid.',
        'auth/operation-not-allowed': 'Firebase blocked the email change. In Firebase console → Authentication → Settings, turn off "Email enumeration protection", then try again.',
        'auth/weak-password': 'Please choose a stronger password.',
      }[ex.code] || ex.message;
      toast(m, 'err');
    } finally { btn.disabled = false; btn.textContent = 'Update login'; }
  };
}
