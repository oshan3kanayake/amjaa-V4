// ─────────────────────────────────────────────────────────────
// planner.js — the tour-planner interface.
// Every option on screen is built from admin data:
//   settings/expertSystem → night options, budget bands, rates, FX
//   expertCities          → destinations, regions, interests, hubs
//   hotels                → optional hotel picks per destination
// The maths happens in engine.js (ported expert system).
// ─────────────────────────────────────────────────────────────
import { renderLayout } from '../layout.js';
import { list, getRules, esc, img } from '../store.js';
import { boot, reduced, scrollToEl, refresh } from '../motion.js';
import { initEnquiries } from '../enquiry.js';
import { planTrip, decodePolyline } from './engine.js';
import { buildIsland } from '../island.js';

const gsap = window.gsap;
const $ = s => document.querySelector(s);
const site = await renderLayout('inbound', 'plan.html');
const [rules, rawCities, hotels] = await Promise.all([getRules(), list('expertCities'), list('hotels')]);
const cities = rawCities.map(c => ({ ...c, lat: Number(c.lat), lng: Number(c.lng) })).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));
const places = cities.filter(c => !c.hubOnly);
const hubs = cities.filter(c => c.airportCode);

/* ── money ── */
const lkr = n => 'LKR ' + Math.round(Number(n) || 0).toLocaleString('en-LK');
const fx = n => {
  const cur = (rules.displayCurrency || '').toUpperCase(), rate = Number(rules.fxRate);
  if (!cur || cur === 'LKR' || !(rate > 0)) return '';
  return `≈ ${cur} ${Math.round(n / rate).toLocaleString()}`;
};

/* ── admin-driven options ── */
const limits = (Array.isArray(rules.cityLimits) && rules.cityLimits.length ? rules.cityLimits : [{ days: 7, cities: 3 }])
  .map(p => ({ days: Number(p.days), cities: Number(p.cities) })).filter(p => p.days > 0 && p.cities > 0).sort((a, b) => a.days - b.days);
const tierFor = d => (limits.find(p => d <= p.days) || limits[limits.length - 1]);
const bands = (Array.isArray(rules.budgetBands) && rules.budgetBands.length ? rules.budgetBands : [{ label: 'Signature', amount: 45000, note: '' }]).filter(b => Number(b.amount) > 0);
const TIERS = [
  ['standard', 'Standard', 'Comfortable 3★', 'tierStandard'], ['boutique', 'Boutique', 'Small & characterful', 'tierBoutique'],
  ['fiveStar', 'Superior', 'Upscale 4★', 'tierFiveStar'], ['deluxe', 'Deluxe', 'Top 5★ resorts', 'tierDeluxe'], ['villa', 'Private villa', 'Ultimate privacy', 'tierVilla'],
].filter(t => Number(rules[t[3]]) > 0);
const MEALS = [['breakfast', 'Bed & breakfast', 'mealBreakfast'], ['halfBoard', 'Half board', 'mealHalfBoard'], ['fullBoard', 'Full board', 'mealFullBoard'], ['allInclusive', 'All inclusive', 'mealAllInclusive']].filter(m => Number(rules[m[2]]) > 0);
const PACES = [['relaxed', 'Relaxed', 'Long lunches, late starts'], ['balanced', 'Balanced', 'A bit of everything'], ['active', 'Active', 'Early starts, full days']];
const INTERESTS = [...new Set(places.flatMap(c => (c.interests || c.tags || []).map(s => String(s).toLowerCase())))].filter(i => i && i !== 'transit').sort();

/* ── state ── */
const S = {
  days: limits[Math.min(2, limits.length - 1)].days, adults: 2, children: 0, ages: [],
  band: Math.min(1, bands.length - 1), tier: TIERS.find(t => t[0] === 'fiveStar') ? 'fiveStar' : TIERS[0]?.[0],
  meal: MEALS.find(m => m[0] === 'halfBoard') ? 'halfBoard' : MEALS[0]?.[0],
  cities: [], hotelPicks: {}, arrival: (hubs[0]?.airportCode || '').toLowerCase(), departure: (hubs[0]?.airportCode || '').toLowerCase(),
  pace: 'balanced', interests: [], notes: '',
};

const STEPS = [
  ['Nights', 'How many nights do you have?', 'Each option comes with a sensible number of destinations, so you are not rushed.'],
  ['Travellers', "Who's coming along?", 'We size rooms and vehicles around your group.'],
  ['Budget', 'How would you like to spend?', 'A guide price per person, per day — we will tune it exactly later.'],
  ['Stay', 'How do you like to stay?', 'Choose a hotel style and how much dining is included.'],
  ['Places', 'Where would you like to go?', 'Pick the places that excite you — we will put them in the best driving order.'],
  ['Airports', 'Where do you land and leave?', 'Starting and ending at the right airport saves hours of driving.'],
  ['Style', 'Set the rhythm of your trip.', 'Your pace and passions shape the plan.'],
  ['Review', 'Here is your brief.', 'Check it over, then let the planner build your journey.'],
];
let step = 1;

/* ── building blocks ── */
const opt = (group, value, title, sub = '', meta = '', on = false, extra = '') =>
  `<button type="button" class="opt${on ? ' on' : ''}" data-group="${group}" data-value="${esc(value)}" aria-pressed="${on}" ${extra}><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}${meta ? `<em>${meta}</em>` : ''}</button>`;

function renderNights() {
  $('#nightCards').innerHTML = limits.map(p => opt('days', p.days, `<span class="big">${p.days}</span> nights`, `up to ${p.cities} destination${p.cities === 1 ? '' : 's'}`, '', S.days === p.days)).join('');
}
function renderBudgets() {
  $('#budgetCards').innerHTML = bands.map((b, i) => opt('band', i, esc(b.label), esc(b.note || ''), `${lkr(b.amount)} <i>per person / day</i>${fx(b.amount) ? `<i>${fx(b.amount)}</i>` : ''}`, S.band === i)).join('');
}
function renderStay() {
  $('#tierCards').innerHTML = TIERS.map(([v, t, s, k]) => opt('tier', v, t, s, `${lkr(rules[k])} <i>room / night</i>`, S.tier === v)).join('');
  $('#mealCards').innerHTML = MEALS.map(([v, t, k]) => opt('meal', v, t, '', `${lkr(rules[k])} <i>adult / day</i>`, S.meal === v)).join('');
}
function cityPool() {
  const tierDays = tierFor(S.days).days;
  const anyTagged = places.some(c => Array.isArray(c.tiers) && c.tiers.length);
  return anyTagged ? places.filter(c => (c.tiers || []).map(Number).includes(tierDays)) : places;
}
function renderCities() {
  const max = tierFor(S.days).cities;
  const pool = cityPool();
  S.cities = S.cities.filter(id => pool.some(c => c.id === id)).slice(0, max);
  $('#maxCities').textContent = max; $('#maxDays').textContent = S.days; $('#pickedCount').textContent = S.cities.length;
  $('#cityGrid').innerHTML = pool.length ? pool.map(c => `
    <button type="button" class="city${S.cities.includes(c.id) ? ' on' : ''}" data-city="${esc(c.id)}" aria-pressed="${S.cities.includes(c.id)}">
      <span class="city-img">${c.image ? `<img src="${esc(img(c.image))}" alt="" loading="lazy" onerror="this.remove()">` : ''}<span class="city-emo">${esc(c.emoji || '📍')}</span></span>
      <span class="city-txt"><b>${esc(c.title)}</b><small>${esc(c.region || '')}</small><span class="city-tags">${(c.interests || []).slice(0, 3).map(t => `<i>${esc(t)}</i>`).join('')}</span></span>
      <span class="city-check" aria-hidden="true"></span>
    </button>`).join('') : '<p class="empty-note">No destinations are set up for this trip length yet — choose another length or contact us and we will tailor it.</p>';
  renderHotelPicks();
}
function hotelsFor(city) { return hotels.filter(h => (h.city || '').trim().toLowerCase() === (city.title || '').trim().toLowerCase()); }
function renderHotelPicks() {
  const chosen = places.filter(c => S.cities.includes(c.id));
  const groups = chosen.map(c => ({ c, hs: hotelsFor(c) })).filter(g => g.hs.length);
  $('#hotelPick').hidden = !groups.length;
  $('#hotelGroups').innerHTML = groups.map(({ c, hs }) => `
    <div class="hp-group"><span class="hp-city">${esc(c.title)}</span><div class="hp-list">${hs.map(h => {
      const on = (S.hotelPicks[c.id] || []).includes(h.id);
      const im = (h.images || [h.image]).filter(Boolean)[0];
      return `<button type="button" class="hp${on ? ' on' : ''}" data-hcity="${esc(c.id)}" data-hotel="${esc(h.id)}">${im ? `<img src="${esc(img(im))}" alt="" loading="lazy">` : ''}<span><b>${esc(h.name)}</b><small>${'★'.repeat(Number(h.stars) || 0)} ${esc(h.price || '')}</small></span></button>`;
    }).join('')}</div></div>`).join('');
}
function renderHubs() {
  if (!hubs.length) {
    $('#arrivalCards').innerHTML = $('#departureCards').innerHTML = '<p class="muted">We will arrange this with you.</p>';
    return;
  }
  const card = (g, h, cur) => opt(g, h.airportCode.toLowerCase(), esc(h.title.replace(/\s*\(.*\)/, '')), esc(h.airportCode.toUpperCase()) + (h.region ? ' · ' + esc(h.region) : ''), '', cur === h.airportCode.toLowerCase());
  $('#arrivalCards').innerHTML = hubs.map(h => card('arrival', h, S.arrival)).join('');
  $('#departureCards').innerHTML = hubs.map(h => card('departure', h, S.departure)).join('');
}
function renderStyle() {
  $('#paceCards').innerHTML = PACES.map(([v, t, s]) => opt('pace', v, t, s, '', S.pace === v)).join('');
  $('#interestChips').innerHTML = INTERESTS.map(i => `<button type="button" class="chip${S.interests.includes(i) ? ' on' : ''}" data-interest="${esc(i)}">${esc(i[0].toUpperCase() + i.slice(1))}</button>`).join('');
}
function renderAges() {
  const n = S.children;
  $('#childAges').hidden = n === 0;
  S.ages = S.ages.slice(0, n);
  $('#agesGrid').innerHTML = Array.from({ length: n }, (_, i) => `<label class="age"><span>Child ${i + 1}</span><select data-age="${i}"><option value="">Age</option>${Array.from({ length: 13 }, (_, a) => `<option${String(S.ages[i]) === String(a) ? ' selected' : ''}>${a}</option>`).join('')}</select></label>`).join('');
}

const cityName = id => places.find(c => c.id === id)?.title || '';
const hubName = code => (hubs.find(h => h.airportCode.toLowerCase() === code)?.title || code.toUpperCase()).replace(/\s*\(.*\)/, '');
const tierLabel = () => TIERS.find(t => t[0] === S.tier)?.[1] || S.tier;
const mealLabel = () => MEALS.find(m => m[0] === S.meal)?.[1] || S.meal;

function summaryRows() {
  return [
    ['Trip', `${S.days} nights`],
    ['Travellers', `${S.adults} adult${S.adults > 1 ? 's' : ''}${S.children ? ` · ${S.children} child${S.children > 1 ? 'ren' : ''}` : ''}`],
    ['Budget', bands[S.band] ? `${bands[S.band].label} · ${lkr(bands[S.band].amount)}/day` : '—'],
    ['Stay', `${tierLabel()} · ${mealLabel()}`],
    ['Places', S.cities.map(cityName).join(', ') || '—'],
    ['Airports', S.arrival ? `${hubName(S.arrival)} → ${hubName(S.departure)}` : '—'],
    ['Style', `${S.pace}${S.interests.length ? ' · ' + S.interests.join(', ') : ''}`],
  ];
}
function renderSummary() {
  $('#plSummary').innerHTML = `<p class="pl-sub">Your trip so far</p>` + summaryRows().slice(0, Math.max(1, step - 1)).map(([k, v]) => `<div><small>${k}</small><span>${esc(v)}</span></div>`).join('');
  $('#review').innerHTML = summaryRows().map(([k, v], i) => `<button type="button" class="rv-row" data-goto="${i + 1}"><small>${k}</small><b>${esc(v)}</b><span>Edit</span></button>`).join('')
    + (S.notes ? `<div class="rv-row"><small>Notes</small><b>${esc(S.notes)}</b></div>` : '');
}

/* ── step machine ── */
$('#plTotal').textContent = String(STEPS.length).padStart(2, '0');
$('#plSteps').innerHTML = STEPS.map(([n], i) => `<li data-rail="${i + 1}"><button type="button" data-goto="${i + 1}"><em>${String(i + 1).padStart(2, '0')}</em>${n}</button></li>`).join('');

function validate(n) {
  if (n === 2 && S.adults < 1) return 'Add at least one adult.';
  if (n === 3 && !bands[S.band]) return 'Please choose a budget.';
  if (n === 4 && (!S.tier || !S.meal)) return 'Please choose a stay style and a meal plan.';
  if (n === 5 && !S.cities.length) return 'Pick at least one destination.';
  return null;
}
function err(msg) { const e = $('#plError'); e.textContent = msg || ''; e.hidden = !msg; if (msg && gsap) gsap.fromTo(e, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,.3)' }); }

function setStep(n, dir = 1) {
  const prev = document.querySelector(`.pl-step[data-step="${step}"]`);
  const next = document.querySelector(`.pl-step[data-step="${n}"]`);
  const first = prev === next;
  step = n;
  if (n === 5) renderCities();
  if (n === 8) S.notes = $('#extraNotes').value.trim();
  renderSummary();
  $('#plNum').textContent = String(n).padStart(2, '0');
  $('#plTitle').textContent = STEPS[n - 1][1];
  $('#plHelp').textContent = STEPS[n - 1][2];
  $('#plBack').hidden = n === 1;
  $('#plNext').hidden = n === STEPS.length;
  $('#plGo').hidden = n !== STEPS.length;
  document.querySelectorAll('.pl-steps li').forEach(li => { const k = Number(li.dataset.rail); li.classList.toggle('done', k < n); li.classList.toggle('cur', k === n); });
  if (gsap) gsap.to('#plBar', { scaleY: n / STEPS.length, duration: 0.8, ease: 'expo.out' });
  err('');
  if (first || !gsap || reduced) { document.querySelectorAll('.pl-step').forEach(f => { f.hidden = f !== next; }); return; }
  // swap immediately (never wait on an animation to show the next question)
  prev.hidden = true;
  next.hidden = false;
  gsap.fromTo(next, { x: 40 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'expo.out', clearProps: 'transform,opacity' });
  gsap.fromTo(next.querySelectorAll('.opt,.city,.counter,.chip,.rv-row'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.03, ease: 'expo.out', clearProps: 'transform,opacity' });
  gsap.fromTo(['#plTitle', '#plHelp'], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity' });
  if (innerWidth < 900) scrollToEl($('#planner'), -70);
}

/* ── interactions ── */
const form = $('#plForm');
form.addEventListener('click', e => {
  const o = e.target.closest('.opt');
  if (o) {
    const g = o.dataset.group, v = o.dataset.value;
    form.querySelectorAll(`.opt[data-group="${g}"]`).forEach(b => { const on = b === o; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    if (g === 'days') { S.days = Number(v); }
    else if (g === 'band') S.band = Number(v);
    else S[g] = v;
    if (gsap) gsap.fromTo(o, { scale: 0.96 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.4)' });
    renderSummary();
    return;
  }
  const c = e.target.closest('.city');
  if (c) {
    const id = c.dataset.city, max = tierFor(S.days).cities;
    if (S.cities.includes(id)) { S.cities = S.cities.filter(x => x !== id); delete S.hotelPicks[id]; }
    else if (S.cities.length < max) S.cities.push(id);
    else { err(`A ${S.days}-night trip has room for ${max} destination${max === 1 ? '' : 's'} — remove one first.`); setTimeout(() => err(''), 3200); return; }
    c.classList.toggle('on', S.cities.includes(id)); c.setAttribute('aria-pressed', S.cities.includes(id));
    $('#pickedCount').textContent = S.cities.length;
    if (gsap && S.cities.includes(id)) gsap.fromTo(c.querySelector('.city-check'), { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    renderHotelPicks(); renderSummary();
    return;
  }
  const hp = e.target.closest('.hp');
  if (hp) {
    const cid = hp.dataset.hcity, hid = hp.dataset.hotel;
    const arr = S.hotelPicks[cid] || (S.hotelPicks[cid] = []);
    const k = arr.indexOf(hid);
    if (k >= 0) arr.splice(k, 1); else arr.push(hid);
    hp.classList.toggle('on', k < 0);
    return;
  }
  const ch = e.target.closest('[data-interest]');
  if (ch) {
    const i = ch.dataset.interest;
    S.interests = S.interests.includes(i) ? S.interests.filter(x => x !== i) : [...S.interests, i];
    ch.classList.toggle('on');
    return;
  }
  const cnt = e.target.closest('[data-cnt]');
  if (cnt) {
    const k = cnt.dataset.cnt, d = Number(cnt.dataset.d);
    S[k] = Math.max(k === 'adults' ? 1 : 0, Math.min(20, S[k] + d));
    $(`#${k}Out`).textContent = S[k];
    if (gsap) gsap.fromTo(`#${k}Out`, { yPercent: -40 * d, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'expo.out' });
    if (k === 'children') renderAges();
    renderSummary();
  }
});
form.addEventListener('change', e => { const a = e.target.closest('[data-age]'); if (a) S.ages[Number(a.dataset.age)] = a.value; });
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]');
  if (!g || !g.closest('.pl-grid')) return;
  const n = Number(g.dataset.goto);
  if (n < step) setStep(n, -1);
});
$('#plNext').onclick = () => { const m = validate(step); if (m) return err(m); setStep(step + 1, 1); };
$('#plBack').onclick = () => setStep(step - 1, -1);

/* ── itinerary helpers ── */
function dayRanges(stops, days) {
  const n = stops.length;
  if (n <= 1) return [[1, days]];
  const inner = n - 1, avail = Math.max(inner, days - 1);
  const base = Math.floor(avail / inner), extra = avail % inner;
  const out = []; let d = 1;
  for (let i = 0; i < inner; i++) { const len = base + (i < extra ? 1 : 0); out.push([d, d + len - 1]); d += len; }
  out.push([Math.min(days, d), days]);
  return out;
}

/* ── build ── */
let result = null, map = null;
form.addEventListener('submit', async e => {
  e.preventDefault();
  for (let k = 1; k < STEPS.length; k++) { const m = validate(k); if (m) { setStep(k, -1); return err(m); } }
  S.notes = $('#extraNotes').value.trim();
  const facts = {
    days: S.days, adults: S.adults, children: S.children,
    budget: { amountMinor: Math.round(Number(bands[S.band].amount) * S.days), basis: 'perPerson', currency: 'LKR' },
    interests: S.interests, pace: S.pace, accommodationTier: S.tier, mealPlan: S.meal,
    arrivalHubId: S.arrival || undefined, departureHubId: S.departure || undefined,
    excursionIds: S.cities.slice(), excursionNames: S.cities.map(cityName),
  };
  Object.keys(facts).forEach(k => facts[k] === undefined && delete facts[k]);

  // the "building" moment: a mini island draws your chosen places
  const ov = $('#plBuilding');
  ov.hidden = false;
  const chosen = cities.filter(c => S.cities.includes(c.id) || (c.airportCode && [S.arrival, S.departure].includes(c.airportCode.toLowerCase())));
  buildIsland($('#buildMap'), chosen, { route: true, labels: false });
  const msgs = ['Reading your answers…', 'Choosing the best order…', 'Measuring real road distances…', 'Pricing rooms, meals and kilometres…', 'Drawing your route…'];
  let mi = 0; const tick = setInterval(() => { mi = (mi + 1) % msgs.length; $('#buildMsg').textContent = msgs[mi]; }, 650);
  if (gsap) {
    gsap.fromTo(ov, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    const o = $('#buildMap .lk-outline'), r = $('#buildMap .lk-route-solid');
    if (o) { const L = o.getTotalLength(); gsap.fromTo(o, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }); }
    if (r) { const L = r.getTotalLength(); gsap.fromTo(r, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.3, delay: 0.9, ease: 'power2.inOut' }); }
    gsap.from('#buildMap .lk-dot', { scale: 0, transformOrigin: 'center', transformBox: 'fill-box', stagger: 0.12, delay: 0.6, ease: 'back.out(3)' });
  }
  const t0 = Date.now();
  try {
    result = await planTrip(facts, cities, rules);
    await new Promise(r => setTimeout(r, Math.max(0, 2300 - (Date.now() - t0))));
    clearInterval(tick);
    ov.hidden = true; if (gsap) gsap.set(ov, { clearProps: 'all' });
    showResult(facts);
  } catch (ex) {
    clearInterval(tick); ov.hidden = true;
    console.error(ex);
    err(ex.message || 'The planner could not build this route — please adjust and try again.');
  }
});

function showResult(facts) {
  const r = result;
  $('#plannerCard').hidden = true;
  $('#result').hidden = false;
  const names = r.route.stops.map(s => s.title.replace(/\s*\(.*\)/, ''));
  const uniq = [...new Set(names)];
  $('#resTitle').innerHTML = uniq.length > 2 ? `${esc(uniq.slice(1, -1).slice(0, 3).join(', '))} <em>& beyond.</em>` : `${esc(uniq.join(' & '))} <em>in ${facts.days} nights.</em>`;
  $('#resBadge').textContent = r.bookable ? 'Live road route' : 'Estimated distances';
  $('#resTotalFx').textContent = fx(r.totalMinor);
  $('#resPPFx').textContent = fx(r.perPersonMinor);
  const hrs = Math.floor((r.route.durationMinutes || 0) / 60), mins = (r.route.durationMinutes || 0) % 60;
  $('#resTime').textContent = `${hrs}h ${String(mins).padStart(2, '0')}m`;
  $('#resNote').textContent = [r.budgetComparison.status === 'within' ? 'Good news — this plan sits inside your budget.' : r.budgetComparison.status === 'over' ? 'This plan is a little above your budget; your coordinator can suggest savings.' : '', ...(r.warnings || []), r.unvisitedDestinationNames?.length ? `We left out ${r.unvisitedDestinationNames.join(', ')} to keep driving comfortable.` : ''].filter(Boolean).join(' ');

  const ranges = dayRanges(r.itinerary, facts.days);
  $('#resDays').innerHTML = r.itinerary.map((d, i) => {
    const [a, b] = ranges[i] || [d.day, d.day];
    const city = cities.find(c => c.id === d.destinationId);
    const picked = (S.hotelPicks[d.destinationId] || []).map(id => hotels.find(h => h.id === id)?.name).filter(Boolean);
    return `<li class="day" data-stop="${i}" tabindex="0">
      <span class="day-n">${a === b ? `Day ${a}` : `Days ${a}–${b}`}</span>
      <div class="day-card">
        ${city?.image ? `<img src="${esc(img(city.image))}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <div><h3>${esc(d.title.replace(/\s*\(.*\)/, ''))}</h3>${d.region ? `<small>${esc(d.region)}</small>` : ''}
        <p>${esc((d.highlights || []).slice(0, 4).join(' · ') || (i === 0 ? 'Arrival, meet your chauffeur-guide and settle in.' : 'Transfer and departure.'))}</p>
        ${picked.length ? `<p class="day-hotel">🏨 ${esc(picked.join(', '))}</p>` : ''}</div>
      </div></li>`;
  }).join('');
  $('#resStops').innerHTML = r.route.stops.map((s, i) => `<li data-stop="${i}"><b>${i + 1}</b>${esc(s.title.replace(/\s*\(.*\)/, ''))}</li>`).join('');
  $('#resItems').innerHTML = r.lineItems.map(li => `<tr><td>${esc(li.label)}</td><td>${lkr(li.totalMinor)}</td></tr>`).join('') + `<tr class="tot"><td>Total</td><td>${lkr(r.totalMinor)}</td></tr>`;

  scrollToEl($('#result'), -90);
  const count = (el, to, f) => { const o = { v: 0 }; el.textContent = f(to); if (!gsap || reduced) return; gsap.to(o, { v: to, duration: 2, ease: 'power3.out', delay: 0.4, onUpdate: () => { el.textContent = f(o.v); } }); };
  count($('#resTotal'), r.totalMinor, lkr);
  count($('#resPP'), r.perPersonMinor, lkr);
  count($('#resKm'), r.route.distanceKm, v => Math.round(v).toLocaleString());
  if (gsap && !reduced) {
    gsap.fromTo('.res-head > *, .res-stats > div', { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.07, duration: 0.9, ease: 'expo.out', clearProps: 'transform,opacity' });
    gsap.fromTo('.day', { x: -30, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.1, duration: 0.8, ease: 'expo.out', delay: 0.3, clearProps: 'transform,opacity' });
  }
  drawMap(r);
  window.__aiQuote = {
    tripFacts: { ...facts, childAges: S.ages.filter(a => a !== '').map(Number), specialNotes: S.notes },
    totalPriceLKR: r.totalMinor, perPersonLKR: r.perPersonMinor,
    route: { distanceKm: r.route.distanceKm, durationMinutes: r.route.durationMinutes, provider: r.route.provider, stops: r.route.stops.map(s => s.title) },
    selectedHotels: Object.entries(S.hotelPicks).flatMap(([cid, ids]) => ids.map(id => `${hotels.find(h => h.id === id)?.name || id} (${cityName(cid)})`)),
  };
  refresh();
}

/* ── map: route draws itself, pins drop in order ── */
function drawMap(r) {
  const el = $('#resMap');
  if (!window.L) { el.innerHTML = '<p class="empty-note">Map unavailable offline.</p>'; return; }
  if (map) { map.remove(); map = null; }
  map = L.map(el, { zoomControl: false, scrollWheelZoom: true, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const stops = r.route.stops.map(s => [Number(s.latitude), Number(s.longitude)]);
  const path = r.route.encodedPolyline ? decodePolyline(r.route.encodedPolyline) : stops;
  map.fitBounds(L.latLngBounds(path.length ? path : stops), { padding: [40, 40] });
  const line = L.polyline([], { color: '#BF5530', weight: 4, opacity: 0.9, lineCap: 'round' }).addTo(map);
  L.polyline(path, { color: '#14203A', weight: 9, opacity: 0.08 }).addTo(map);
  const icon = n => L.divIcon({ className: 'pin', html: `<span>${n}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
  const markers = stops.map((p, i) => L.marker(p, { icon: icon(i + 1), opacity: 0 }).bindTooltip(r.route.stops[i].title.replace(/\s*\(.*\)/, ''), { direction: 'top', offset: [0, -14] }).addTo(map));
  const o = { k: 0 }, n = path.length;
  const shown = new Set();
  const step = () => {
    const k = Math.floor(o.k);
    line.setLatLngs(path.slice(0, Math.max(1, k)));
    stops.forEach((s, i) => {
      if (shown.has(i)) return;
      const near = path.slice(0, k + 1).some(p => Math.abs(p[0] - s[0]) < 0.02 && Math.abs(p[1] - s[1]) < 0.02);
      if (near || (i === 0)) { shown.add(i); markers[i].setOpacity(1); const ie = markers[i].getElement(); if (ie && gsap) gsap.fromTo(ie.firstChild, { scale: 0, y: -20 }, { scale: 1, y: 0, duration: 0.6, ease: 'back.out(3)' }); }
    });
  };
  if (gsap && !reduced) gsap.to(o, { k: n, duration: Math.min(4, 1.4 + n / 400), ease: 'power1.inOut', delay: 0.7, onUpdate: step, onComplete: () => { line.setLatLngs(path); markers.forEach(m => m.setOpacity(1)); } });
  else { line.setLatLngs(path); markers.forEach(m => m.setOpacity(1)); }
  const focus = i => { const s = stops[i]; if (!s) return; map.flyTo(s, 11, { duration: 1.2 }); document.querySelectorAll('[data-stop]').forEach(x => x.classList.toggle('on', Number(x.dataset.stop) === i)); };
  document.querySelectorAll('#resStops li, #resDays .day').forEach(li => li.addEventListener('click', () => {
    const t = li.closest('.day') ? r.route.stops.findIndex(s => s.id === r.itinerary[Number(li.dataset.stop)]?.destinationId) : Number(li.dataset.stop);
    focus(t >= 0 ? t : Number(li.dataset.stop));
  }));
  setTimeout(() => map.invalidateSize(), 300);
}

/* ── actions ── */
$('#resRestart').onclick = () => {
  $('#result').hidden = true; $('#plannerCard').hidden = false;
  window.__aiQuote = null;
  setStep(1, -1); scrollToEl($('#planner'), -80); refresh();
};
$('#resBook').onclick = () => {
  const f = $('#planEnquiry');
  const r = result;
  f.querySelector('[name="travellers"]').value = S.adults + S.children;
  const lines = [
    `My planned trip (${S.days} nights): ${r.route.stops.map(s => s.title.replace(/\s*\(.*\)/, '')).join(' → ')}`,
    `${S.adults} adults${S.children ? `, ${S.children} children (ages ${S.ages.filter(Boolean).join(', ') || '—'})` : ''}`,
    `Style: ${tierLabel()}, ${mealLabel()}, ${S.pace} pace${S.interests.length ? '; loves ' + S.interests.join(', ') : ''}`,
    `Estimate: ${lkr(r.totalMinor)} (${lkr(r.perPersonMinor)} per person)`,
    ...(window.__aiQuote.selectedHotels.length ? [`Hotels I liked: ${window.__aiQuote.selectedHotels.join('; ')}`] : []),
    ...(S.notes ? [`Notes: ${S.notes}`] : []),
  ];
  f.querySelector('[name="message"]').value = lines.join('\n');
  const chip = f.querySelector('.enq-chip'); chip.hidden = false; chip.textContent = 'Planner itinerary attached';
  let h = f.querySelector('[name="item_title"]'); if (!h) { h = document.createElement('input'); h.type = 'hidden'; h.name = 'item_title'; f.appendChild(h); }
  h.value = `Planner: ${S.days} nights — ${r.route.stops.slice(1, -1).map(s => s.title).join(', ')}`;
  scrollToEl($('#enquire'), -60);
  setTimeout(() => f.querySelector('[name="name"]').focus({ preventScroll: true }), 900);
};
$('#resPdf').onclick = () => pdf();
document.addEventListener('enquiry:sent', () => { if ($('#result').hidden === false) $('#resBook').textContent = 'Sent ✓ — we will be in touch'; });

/* ── PDF (vector, jsPDF) ── */
function pdf() {
  const J = window.jspdf?.jsPDF; if (!J || !result) return alert('PDF library is still loading — try again in a moment.');
  const r = result, d = new J({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16; let y = M;
  const NAVY = [20, 32, 58], CLAY = [191, 85, 48], GOLD = [227, 166, 70], MUTE = [110, 116, 130], CREAM = [243, 236, 223];
  d.setFillColor(...NAVY); d.rect(0, 0, W, 34, 'F');
  d.setTextColor(255, 255, 255); d.setFont('times', 'bold'); d.setFontSize(22); d.text(site.brandInbound || 'Amja Tours', M, 17);
  d.setFont('helvetica', 'normal'); d.setFontSize(8); d.setTextColor(...GOLD); d.text(`BY ${(site.legalName || '').toUpperCase()} · SINCE ${site.since}`, M, 24);
  d.setTextColor(255, 255, 255); d.setFontSize(10); d.text('Route proposal', W - M, 15, { align: 'right' });
  d.setFontSize(8); d.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, 21, { align: 'right' });
  y = 46;
  d.setTextColor(...NAVY); d.setFont('times', 'italic'); d.setFontSize(15);
  const t = d.splitTextToSize(r.route.stops.map(s => s.title.replace(/\s*\(.*\)/, '')).join('  →  '), W - 2 * M); d.text(t, M, y); y += t.length * 6 + 4;
  const stats = [['TOTAL (EST.)', lkr(r.totalMinor)], ['PER PERSON', lkr(r.perPersonMinor)], ['DRIVING', `${Math.round(r.route.distanceKm)} km`], ['NIGHTS', String(S.days)]];
  const cw = (W - 2 * M - 9) / 4;
  stats.forEach(([k, v], i) => { const x = M + i * (cw + 3); d.setFillColor(...CREAM); d.roundedRect(x, y, cw, 18, 2, 2, 'F'); d.setFont('helvetica', 'bold'); d.setFontSize(6.5); d.setTextColor(...CLAY); d.text(k, x + 3, y + 6); d.setFont('times', 'bold'); d.setFontSize(11.5); d.setTextColor(...NAVY); d.text(v, x + 3, y + 13.5); });
  y += 27;
  d.setFont('times', 'bold'); d.setFontSize(13); d.text('Day by day', M, y); y += 7;
  const ranges = dayRanges(r.itinerary, S.days);
  r.itinerary.forEach((it, i) => {
    if (y > 250) return;
    const [a, b] = ranges[i] || [it.day, it.day];
    d.setFillColor(...CLAY); d.circle(M + 3, y - 1.3, 3, 'F'); d.setTextColor(255, 255, 255); d.setFontSize(7); d.setFont('helvetica', 'bold'); d.text(String(i + 1), M + 3, y - 0.2, { align: 'center' });
    d.setTextColor(...NAVY); d.setFontSize(10.5); d.text(`${a === b ? 'Day ' + a : `Days ${a}–${b}`}  ·  ${it.title.replace(/\s*\(.*\)/, '')}`, M + 9, y);
    const hl = (it.highlights || []).join('  ·  ');
    if (hl) { d.setFont('helvetica', 'normal'); d.setFontSize(8.5); d.setTextColor(...MUTE); const L = d.splitTextToSize(hl, W - 2 * M - 9); d.text(L, M + 9, y + 4.6); y += 4.6 + L.length * 4 + 4; } else y += 8;
  });
  if (y < 262) {
    d.setDrawColor(220, 210, 190); d.line(M, y, W - M, y); y += 6;
    d.setFont('helvetica', 'normal'); d.setFontSize(8.5); d.setTextColor(...MUTE);
    d.text(d.splitTextToSize(`${S.adults} adults${S.children ? `, ${S.children} children` : ''} · ${tierLabel()} · ${mealLabel()} · ${S.pace} pace. A planning estimate from current rates; final prices are confirmed by your coordinator.`, W - 2 * M), M, y);
  }
  d.setDrawColor(...GOLD); d.line(M, 282, W - M, 282);
  d.setFontSize(8); d.setTextColor(...MUTE);
  d.text(`${site.address}`, M, 287); d.text(`${site.phone} · ${site.email}`, W - M, 287, { align: 'right' });
  d.save(`${(site.brandInbound || 'Amja-Tours').replace(/\s+/g, '-')}-route.pdf`);
}

/* ── go ── */
renderNights(); renderBudgets(); renderStay(); renderHubs(); renderStyle(); renderAges();
setStep(1);
initEnquiries('inbound');
boot();
refresh();
