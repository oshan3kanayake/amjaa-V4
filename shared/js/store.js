// ─────────────────────────────────────────────────────────────
// store.js — read-only data access for the public sites.
// Everything visible on the sites comes from Firestore (edited in
// the admin). If a collection is empty or offline we fall back to
// the starter content so the page still renders.
// ─────────────────────────────────────────────────────────────
import { db } from './firebase.js';
import {
  collection, getDocs, doc, getDoc, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { DEFAULT_SITE, DEFAULT_RULES, STARTER } from './defaults.js';

const TTL = 20 * 1000;            // short session cache: snappy page-to-page, admin edits show within seconds
const mem = new Map();

function cacheGet(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const raw = sessionStorage.getItem('amja:' + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > TTL) return null;
    mem.set(key, v);
    return v;
  } catch { return null; }
}
function cacheSet(key, v) {
  mem.set(key, v);
  try { sessionStorage.setItem('amja:' + key, JSON.stringify({ t: Date.now(), v })); } catch { /* private mode */ }
}

const byOrder = (a, b) => (Number(a.order) || 999) - (Number(b.order) || 999);

// Records created by the first version of the site used slightly different
// field names — map them so older data still shows up correctly.
function normalize(col, x) {
  const o = { ...x };
  if (!Array.isArray(o.images) || !o.images.length) o.images = [o.image, o.image_url].filter(Boolean);
  if (!o.image && o.images.length) o.image = o.images[0];
  if (col === 'hotels') {
    if (o.stars == null && o.rating) o.stars = parseInt(o.rating, 10) || 0;
    if (!o.city && o.location) o.city = String(o.location).split(/[·,]/)[0].trim();
    if (!o.amenities && Array.isArray(o.features)) o.amenities = o.features;
  }
  if (col === 'fleet') {
    if (!o.category && o.vehicle_category) o.category = o.vehicle_category;
    if (o.seats == null && o.capacity) o.seats = parseInt(o.capacity, 10) || null;
    const f = (o.features || []).join(' ');
    if (o.luggage == null) { const m = f.match(/(\d+)\+?\s*Luggage/i); if (m) o.luggage = Number(m[1]); }
    if (!o.transmission) o.transmission = /manual/i.test(f) ? 'Manual' : /auto/i.test(f) ? 'Automatic' : '';
    if (!o.fuel) o.fuel = /V8|diesel/i.test(f) ? 'Diesel' : '';
  }
  if (col === 'flight_deals' && !o.toCity && o.route) o.toCity = String(o.route).split('→').pop().trim();
  return o;
}

/** List a collection, ordered by `order`. Falls back to starter data. */
export async function list(col, { fallback = true } = {}) {
  const hit = cacheGet('col:' + col);
  if (hit) return hit;
  let items = [];
  try {
    const snap = await getDocs(collection(db, col));
    items = snap.docs.map(d => normalize(col, { id: d.id, ...d.data() })).filter(i => i.hidden !== true).sort(byOrder);
  } catch (e) {
    console.warn(`[store] ${col} offline, using starter data`, e.code || e.message);
  }
  if (!items.length && fallback && STARTER[col]) {
    items = STARTER[col].map((x, i) => ({ id: `starter-${col}-${i}`, ...x })).sort(byOrder);
  }
  cacheSet('col:' + col, items);
  return items;
}

async function settingsDoc(id, defaults) {
  const hit = cacheGet('set:' + id);
  if (hit) return hit;
  let data = {};
  try {
    const snap = await getDoc(doc(db, 'settings', id));
    if (snap.exists()) data = snap.data();
  } catch (e) { console.warn(`[store] settings/${id} offline`, e.code || e.message); }
  const merged = { ...defaults, ...data };
  cacheSet('set:' + id, merged);
  return merged;
}

export const getSite  = () => settingsDoc('site', DEFAULT_SITE);
export const getRules = () => settingsDoc('expertSystem', DEFAULT_RULES);

/** Save a public enquiry (allowed by Security Rules for anyone). */
export async function submitEnquiry(site, category, payload) {
  const data = {
    site,
    category: String(category || 'general'),
    name:    String(payload.name || '').trim(),
    phone:   String(payload.phone || '').trim(),
    email:   String(payload.email || '').trim(),
    country: String(payload.country || '').trim(),
    message: String(payload.message || '').trim(),
    item_title: String(payload.item_title || ''),
    extra:   payload.extra || {},
    read: false,
    handled: false,
    created_at: serverTimestamp(),
  };
  if (payload.aiQuote) data.aiQuote = payload.aiQuote;
  if (!data.name || !data.phone) throw new Error('Please add your name and phone number.');
  const ref = await addDoc(collection(db, 'enquiries'), data);
  return ref.id;
}

/** Image path helper — works for absolute URLs and site-relative paths. */
export function img(src, base = '') {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:') || src.startsWith('/')) return src;
  return base + src;
}

export function imagesOf(item) {
  const arr = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  if (!arr.length && item?.image) arr.push(item.image);
  if (!arr.length && item?.image_url) arr.push(item.image_url);
  return arr;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
