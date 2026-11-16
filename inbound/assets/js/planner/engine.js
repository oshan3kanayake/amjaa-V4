// ─────────────────────────────────────────────────────────────
// engine.js — the expert-system tour planner, running in the browser.
//
// Ported from the Al Musafir expert system (functions/src/domain:
// pricing-engine.js, routing-engine.js, quote-engine.js, route-provider.js).
// The rules, maths and validation are kept the same; the differences are:
//   • it runs client-side, so the site needs no paid server (Firebase Spark plan)
//   • it accepts travellers from ANY country (no GCC assumptions)
//   • airports/hubs are not hard-coded — any city with an airport code is a hub
//   • cities can be tagged by `tags` OR `interests` when scoring
// Every number used here comes from Admin → Planner rules / Planner cities.
// ─────────────────────────────────────────────────────────────

/* ════════════ pricing-engine ════════════ */
const BASIS_VALUES = new Set(['perPerson', 'total']);
const FORBIDDEN_PUBLIC_FIELDS = new Set(['name', 'fullName', 'email', 'phone', 'telephone', 'whatsapp', 'whatsappNumber', 'passport', 'passportNumber', 'nationality', 'nic', 'address', 'dateOfBirth', 'accountId', 'userId']);

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be a finite number`);
  return number;
}
function positiveInteger(value, label) {
  const number = finiteNumber(value, label);
  if (!Number.isInteger(number) || number < 1) throw new RangeError(`${label} must be a positive integer`);
  return number;
}
function nonNegativeInteger(value, label) {
  const number = finiteNumber(value, label);
  if (!Number.isInteger(number) || number < 0) throw new RangeError(`${label} must be a non-negative integer`);
  return number;
}
function basisPoints(value, label) {
  const number = nonNegativeInteger(value, label);
  if (number > 100_000) throw new RangeError(`${label} must be at most 100000 basis points`);
  return number;
}
function currencyCode(value, label = 'currency') {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) throw new TypeError(`${label} must be a three-letter uppercase currency code`);
  return value;
}
function walkKeys(value, path = 'tripFacts') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_FIELDS.has(key)) throw new TypeError(`${path}.${key} is not accepted by the anonymous planner`);
    if (child && typeof child === 'object') walkKeys(child, `${path}.${key}`);
  }
}

/** Validate the public, identity-free planner contract before pricing. */
export function validateAnonymousTripFacts(tripFacts, rules = {}) {
  if (!tripFacts || typeof tripFacts !== 'object' || Array.isArray(tripFacts)) throw new TypeError('tripFacts must be an object');
  walkKeys(tripFacts);
  const allowedKeys = new Set(['days', 'adults', 'children', 'childAgeBands', 'budget', 'interests', 'pace', 'accommodationTier', 'mealPlan', 'excursionIds', 'excursionNames', 'arrivalHubId', 'departureHubId']);
  for (const key of Object.keys(tripFacts)) {
    if (!allowedKeys.has(key)) throw new TypeError(`tripFacts.${key} is not an accepted planner field`);
  }
  const days = positiveInteger(tripFacts.days, 'tripFacts.days');
  const maxTripDays = Number(rules?.maxTripDays);
  if (!Number.isFinite(maxTripDays)) throw new Error('Missing Expert System Rule: maxTripDays');
  if (days > maxTripDays) throw new RangeError(`tripFacts.days must be at most ${maxTripDays}`);
  const adults = positiveInteger(tripFacts.adults, 'tripFacts.adults');
  const children = nonNegativeInteger(tripFacts.children ?? 0, 'tripFacts.children');
  for (const key of ['interests', 'excursionIds', 'excursionNames']) {
    if (tripFacts[key] !== undefined) {
      if (!Array.isArray(tripFacts[key]) || tripFacts[key].some(v => typeof v !== 'string' || v.length === 0 || v.length > 80)) {
        throw new TypeError(`tripFacts.${key} must be an array of short strings`);
      }
    }
  }
  if (tripFacts.childAgeBands !== undefined) {
    if (!Array.isArray(tripFacts.childAgeBands) || tripFacts.childAgeBands.length !== children) throw new RangeError('tripFacts.childAgeBands must match the child count');
    if (tripFacts.childAgeBands.some(b => typeof b !== 'string' || b.length > 24)) throw new TypeError('tripFacts.childAgeBands contains an invalid age band');
  }
  let budget;
  if (tripFacts.budget !== undefined) {
    if (!tripFacts.budget || typeof tripFacts.budget !== 'object') throw new TypeError('tripFacts.budget must be an object');
    const amountMinor = nonNegativeInteger(tripFacts.budget.amountMinor, 'tripFacts.budget.amountMinor');
    const basis = tripFacts.budget.basis;
    if (!BASIS_VALUES.has(basis)) throw new TypeError('tripFacts.budget.basis must be perPerson or total');
    budget = { amountMinor, basis, currency: currencyCode(tripFacts.budget.currency, 'tripFacts.budget.currency') };
  }
  return {
    days, adults, children,
    ...(tripFacts.childAgeBands ? { childAgeBands: [...tripFacts.childAgeBands] } : {}),
    ...(budget ? { budget } : {}),
    ...(tripFacts.interests ? { interests: [...tripFacts.interests] } : {}),
    ...(tripFacts.pace ? { pace: tripFacts.pace } : {}),
    ...(tripFacts.accommodationTier ? { accommodationTier: tripFacts.accommodationTier } : {}),
    ...(tripFacts.mealPlan ? { mealPlan: tripFacts.mealPlan } : {}),
    ...(tripFacts.excursionIds ? { excursionIds: [...tripFacts.excursionIds] } : {}),
    ...(tripFacts.excursionNames ? { excursionNames: [...tripFacts.excursionNames] } : {}),
    ...(tripFacts.arrivalHubId ? { arrivalHubId: tripFacts.arrivalHubId } : {}),
    ...(tripFacts.departureHubId ? { departureHubId: tripFacts.departureHubId } : {}),
  };
}

function validateRoute(route, allowNonBookableRoute) {
  if (!route || route.verified !== true) throw new Error('a verified road route is required before a quote can be issued');
  if (typeof route.provider !== 'string' || route.provider.length === 0) throw new TypeError('route.provider is required');
  const distanceKm = finiteNumber(route.distanceKm, 'route.distanceKm');
  if (distanceKm < 0) throw new RangeError('route.distanceKm cannot be negative');
  const bookable = route.bookable !== false;
  if (!bookable && !allowNonBookableRoute) throw new Error('a bookable route is required before a final quote can be issued');
  return { provider: route.provider, distanceKm, bookable };
}

function validateLineItems(lineItems, currency) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) throw new TypeError('at least one pricing line item is required');
  return lineItems.map((item, index) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') throw new TypeError(`lineItems[${index}] must have a string id`);
    const unitMinor = nonNegativeInteger(item.unitMinor, `lineItems[${index}].unitMinor`);
    const quantity = finiteNumber(item.quantity, `lineItems[${index}].quantity`);
    if (quantity < 0) throw new RangeError(`lineItems[${index}].quantity cannot be negative`);
    const itemCurrency = currencyCode(item.currency, `lineItems[${index}].currency`);
    if (itemCurrency !== currency) throw new Error(`lineItems[${index}] uses ${itemCurrency}; FX must be explicit before quoting`);
    return { id: item.id, ...(item.label ? { label: String(item.label) } : {}), unitMinor, quantity, currency, totalMinor: Math.round(unitMinor * quantity) };
  });
}

const rateAmount = (baseMinor, bps) => Math.round(baseMinor * bps / 10_000);

/** Calculate a reproducible quote from already-resolved admin rate line items. */
export function calculateQuote({ tripFacts, route, lineItems, currency, rateVersionId, engineVersion = 'pricing-v1', markupBps = 0, taxBps = 0, allowNonBookableRoute = false, rules = {} }) {
  const facts = validateAnonymousTripFacts(tripFacts, rules);
  const normalizedCurrency = currencyCode(currency);
  const normalizedRoute = validateRoute(route, allowNonBookableRoute);
  const items = validateLineItems(lineItems, normalizedCurrency);
  const normalizedMarkupBps = basisPoints(markupBps, 'markupBps');
  const normalizedTaxBps = basisPoints(taxBps, 'taxBps');
  const subtotalMinor = items.reduce((sum, item) => sum + item.totalMinor, 0);
  const markupMinor = rateAmount(subtotalMinor, normalizedMarkupBps);
  const taxableMinor = subtotalMinor + markupMinor;
  const taxMinor = rateAmount(taxableMinor, normalizedTaxBps);
  const totalMinor = taxableMinor + taxMinor;
  const travellers = facts.adults + facts.children;
  const perPersonMinor = Math.round(totalMinor / travellers);
  let budgetComparison = { status: 'not-provided' };
  if (facts.budget) {
    if (facts.budget.currency !== normalizedCurrency) budgetComparison = { status: 'currency-mismatch', currency: facts.budget.currency };
    else {
      const comparisonMinor = facts.budget.basis === 'perPerson' ? perPersonMinor : totalMinor;
      budgetComparison = { status: comparisonMinor <= facts.budget.amountMinor ? 'within' : 'over', basis: facts.budget.basis, targetMinor: facts.budget.amountMinor, actualMinor: comparisonMinor, currency: normalizedCurrency };
    }
  }
  return { engineVersion, ...(rateVersionId ? { rateVersionId: String(rateVersionId) } : {}), currency: normalizedCurrency, route: normalizedRoute, travellers, lineItems: items, subtotalMinor, markupBps: normalizedMarkupBps, markupMinor, taxBps: normalizedTaxBps, taxMinor, totalMinor, perPersonMinor, budgetComparison };
}

/* ════════════ routing-engine ════════════ */
const EARTH_RADIUS_KM = 6371;
function coordinates(destination) {
  if (!destination || typeof destination !== 'object') throw new TypeError('destination must be an object');
  const latitude = finiteNumber(destination.latitude, 'latitude');
  const longitude = finiteNumber(destination.longitude, 'longitude');
  if (latitude < -90 || latitude > 90) throw new RangeError('latitude must be between -90 and 90');
  if (longitude < -180 || longitude > 180) throw new RangeError('longitude must be between -180 and 180');
  return { latitude, longitude };
}

/** Great-circle distance used for fast itinerary ordering, not final road pricing. */
export function haversineKm(from, to) {
  const a = coordinates(from), b = coordinates(to);
  const r = d => d * Math.PI / 180;
  const dLat = r(b.latitude - a.latitude), dLng = r(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** City limits are admin-defined (days → cities) pairs in `rules.cityLimits`:
 *  the smallest tier whose `days` ≥ trip days, else the largest tier. */
export function maxCitiesForDays(days, rules) {
  if (!rules) throw new Error('Expert System Rules are missing for city limits.');
  const tripDays = positiveInteger(days, 'days');
  const limits = Array.isArray(rules.cityLimits)
    ? rules.cityLimits.map(p => ({ days: Number(p.days), cities: Number(p.cities) }))
      .filter(p => Number.isFinite(p.days) && p.days > 0 && Number.isFinite(p.cities) && p.cities >= 0)
      .sort((a, b) => a.days - b.days)
    : [];
  if (limits.length) return (limits.find(p => tripDays <= p.days) || limits[limits.length - 1]).cities;
  const getLimit = key => { const v = Number(rules[key]); if (!Number.isFinite(v)) throw new Error(`Missing Expert System Rule: ${key}`); return v; };
  if (tripDays <= 3) return getLimit('maxCities3Days');
  if (tripDays <= 5) return getLimit('maxCities5Days');
  if (tripDays <= 7) return getLimit('maxCities7Days');
  if (tripDays <= 10) return getLimit('maxCities10Days');
  return Math.min(tripDays - 3, getLimit('maxTripDays'));
}

/** Deterministic nearest-neighbour ordering within the daily driving budget. */
export function buildNearestNeighbourRoute({ destinations, preferredNames, startName, days, rules = {}, maxKmPerDay = 250 }) {
  if (!Array.isArray(destinations) || !Array.isArray(preferredNames)) throw new TypeError('destinations and preferredNames must be arrays');
  const tripDays = positiveInteger(days, 'days');
  const distanceBudget = finiteNumber(maxKmPerDay, 'maxKmPerDay') * tripDays;
  if (distanceBudget <= 0) throw new RangeError('maxKmPerDay must be greater than zero');
  const byName = new Map(destinations.map(d => { coordinates(d); if (!d.name) throw new TypeError('each destination needs a name'); return [d.name, d]; }));
  const start = byName.get(startName);
  if (!start) throw new RangeError(`unknown start destination: ${startName}`);
  const maximumCities = maxCitiesForDays(tripDays, rules);
  const validPreferredNames = preferredNames.filter(n => n !== startName && byName.has(n));
  const remainingToVisit = new Set(validPreferredNames.slice(0, Math.max(0, maximumCities)));
  const route = [{ ...start, legDistanceKm: 0 }];
  let current = start, totalDistanceKm = 0;
  while (remainingToVisit.size > 0 && route.length < maximumCities + 1) {
    const candidates = [...remainingToVisit].map(name => { const d = byName.get(name); return { destination: d, distanceKm: haversineKm(current, d) }; })
      .sort((l, r) => l.distanceKm - r.distanceKm || l.destination.name.localeCompare(r.destination.name));
    const next = candidates.find(({ distanceKm }) => totalDistanceKm + distanceKm <= distanceBudget);
    if (!next) break;
    route.push({ ...next.destination, legDistanceKm: next.distanceKm });
    remainingToVisit.delete(next.destination.name);
    current = next.destination;
    totalDistanceKm += next.distanceKm;
  }
  const visited = new Set(route.map(d => d.name));
  return { route, totalDistanceKm, unvisitedNames: validPreferredNames.filter(n => !visited.has(n)) };
}

/* ════════════ quote-engine ════════════ */
export const LOCAL_RATE_VERSION = 'dynamic-admin-rates';
const PACE_WEIGHT = Object.freeze({ relaxed: 0, balanced: 1, moderate: 1, active: 2 });

function extractRates(rules, facts) {
  if (!rules) throw new Error('Expert System Rules are missing from the database.');
  const mealPlanKey = { breakfast: 'mealBreakfast', halfBoard: 'mealHalfBoard', fullBoard: 'mealFullBoard', allInclusive: 'mealAllInclusive' }[facts.mealPlan || 'halfBoard'] || 'mealHalfBoard';
  const tierKey = { standard: 'tierStandard', boutique: 'tierBoutique', fiveStar: 'tierFiveStar', deluxe: 'tierDeluxe', villa: 'tierVilla' }[facts.accommodationTier || 'fiveStar'] || 'tierFiveStar';
  const requireRate = (key, label) => { const v = Number(rules[key]); if (!Number.isFinite(v)) throw new Error(`Missing Expert System Rule: ${label} (${key})`); return v; };
  return {
    currency: 'LKR',
    transportPerKmMinor: requireRate('transportPerKm', 'Transport Rate'),
    hotelPerRoomNightMinor: requireRate(tierKey, 'Hotel Tier Rate'),
    mealPerAdultDayMinor: requireRate(mealPlanKey, 'Meal Plan Rate'),
    mealPerChildDayMinor: Math.round(requireRate(mealPlanKey, 'Meal Plan Rate') / 2),
    guidePerDayMinor: requireRate('guidePerDay', 'Guide Fee'),
    activityPerPersonMinor: requireRate('activityPerPerson', 'Activity Allowance'),
    markupBps: Math.round(requireRate('markupPercent', 'Agency Markup') * 100),
    taxBps: 0,
  };
}

function scoreDestination(destination, interests, pace, excursionIds, excursionNames = []) {
  const destTags = (destination.tags || destination.interests || []).map(t => String(t).toLowerCase());
  const matching = interests.filter(i => destTags.includes(i)).length;
  const natureBonus = interests.includes('nature') && destTags.includes('mountains') ? 0.5 : 0;
  const paceBonus = PACE_WEIGHT[pace] === 2 && destTags.includes('adventure') ? 0.2 : 0;
  const nameLower = (destination.title || destination.name || '').toLowerCase();
  const userSelectedBonus = (excursionIds.includes(destination.id) || excursionNames.includes(nameLower)) ? 1000 : 0;
  return matching * 10 + natureBonus + paceBonus + userSelectedBonus;
}

const destinationOutput = d => ({ id: d.id, title: d.title || d.name, latitude: d.lat ?? d.latitude, longitude: d.lng ?? d.longitude });

function buildSelection(facts, destinations, rules = {}) {
  const getByHub = code => destinations.find(d => (d.airportCode && d.airportCode.toLowerCase() === code) || d.id === code || (d.title && d.title.toLowerCase() === code));
  let arrival = getByHub(facts.arrivalHubId?.toLowerCase());
  let departure = getByHub(facts.departureHubId?.toLowerCase());
  const firstHub = destinations.find(d => d.airportCode) || destinations[0];
  if (!arrival) arrival = firstHub;
  if (!departure) departure = arrival;
  if (!arrival || !departure) throw new RangeError('No planner cities available.');

  const defaultInterests = String(rules.defaultInterests || 'nature, culture, beach').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const interests = facts.interests?.length ? facts.interests.map(s => s.toLowerCase()) : defaultInterests;
  const ids = Array.isArray(facts.excursionIds) ? facts.excursionIds : [];
  const names = Array.isArray(facts.excursionNames) ? facts.excursionNames.map(n => String(n).toLowerCase()) : [];

  const candidates = destinations
    .filter(d => d.id !== arrival.id && d.id !== departure.id && !d.hubOnly)
    .map(d => ({ destination: d, score: scoreDestination(d, interests, facts.pace, ids, names) }))
    .sort((l, r) => r.score - l.score || (l.destination.title || '').localeCompare(r.destination.title || ''));

  let preferredNames = candidates.map(({ destination }) => destination.title || destination.name);
  // If the traveller picked cities, route strictly through those (never auto-fill).
  if (facts.excursionNames && facts.excursionNames.length > 0) preferredNames = facts.excursionNames;

  const normalized = destinations.map(d => ({ ...d, name: d.title || d.name, latitude: d.lat ?? d.latitude, longitude: d.lng ?? d.longitude }));
  const nearest = buildNearestNeighbourRoute({
    destinations: normalized, preferredNames, startName: arrival.title || arrival.name,
    days: facts.days, rules, maxKmPerDay: Number(rules.maxKmPerDay) || 300,
  });
  const stops = nearest.route.map(({ name }) => normalized.find(d => d.name === name)).filter(Boolean);
  if (stops.length > 0 && stops[stops.length - 1].id !== departure.id) stops.push(normalized.find(d => d.id === departure.id));
  else if (stops.length === 0) stops.push(arrival, departure);
  return { arrival, departure, stops, candidates, unvisitedNames: nearest.unvisitedNames };
}

function buildLineItems(facts, route, stops, rates) {
  const travellers = facts.adults + facts.children;
  const vehicles = Math.max(1, Math.ceil(travellers / 4));
  const nights = Math.max(0, facts.days - 1);
  const rooms = Math.max(1, Math.ceil(travellers / 2));
  const activityStops = Math.max(0, stops.length - 1);
  return [
    { id: 'transport', label: `Private transport (${vehicles} vehicle${vehicles === 1 ? '' : 's'})`, quantity: route.distanceKm * vehicles, unitMinor: rates.transportPerKmMinor, currency: rates.currency },
    { id: 'accommodation', label: `Accommodation · ${rooms} room${rooms === 1 ? '' : 's'} × ${nights} night${nights === 1 ? '' : 's'}`, quantity: rooms * nights, unitMinor: rates.hotelPerRoomNightMinor, currency: rates.currency },
    { id: 'meals', label: 'Meals (adults)', quantity: facts.adults * facts.days, unitMinor: rates.mealPerAdultDayMinor, currency: rates.currency },
    { id: 'child-meals', label: 'Meals (children, 50%)', quantity: facts.children * facts.days, unitMinor: rates.mealPerChildDayMinor, currency: rates.currency },
    { id: 'guide', label: 'Chauffeur-guide service', quantity: facts.days, unitMinor: rates.guidePerDayMinor, currency: rates.currency },
    { id: 'activities', label: 'Activities & entrance allowance', quantity: activityStops * travellers, unitMinor: rates.activityPerPersonMinor, currency: rates.currency },
  ].filter(i => i.quantity > 0);
}

export function selectRouteStops(tripFacts, destinations, rules) {
  const facts = validateAnonymousTripFacts(tripFacts, rules);
  return buildSelection(facts, destinations, rules).stops;
}

export function buildQuotePreview({ tripFacts, route, destinations, rules }) {
  const facts = validateAnonymousTripFacts(tripFacts, rules);
  const selection = buildSelection(facts, destinations, rules);
  const rates = extractRates(rules, facts);
  const lineItems = buildLineItems(facts, route, selection.stops, rates);
  const quote = calculateQuote({ tripFacts: facts, route, lineItems, currency: rates.currency, rateVersionId: LOCAL_RATE_VERSION, markupBps: rates.markupBps, taxBps: rates.taxBps, allowNonBookableRoute: true, rules });
  const markup = quote.markupMinor;
  return {
    ok: true,
    bookable: route.bookable !== false,
    currency: quote.currency,
    totalMinor: quote.totalMinor,
    perPersonMinor: quote.perPersonMinor,
    travellers: quote.travellers,
    budgetComparison: quote.budgetComparison,
    route: { provider: route.provider, distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, legsKm: route.legsKm || [], encodedPolyline: route.encodedPolyline ?? null, stops: selection.stops.map(destinationOutput) },
    itinerary: selection.stops.map((d, index) => ({ day: Math.min(index + 1, facts.days), destinationId: d.id, title: d.title || d.name, region: d.region || '', image: d.image || '', description: d.description || '', hub: !!d.hubOnly, highlights: d.activities || [] })),
    lineItems: [...quote.lineItems.map(({ id, label, totalMinor }) => ({ id, label, totalMinor })), ...(markup ? [{ id: 'service', label: 'Planning & service', totalMinor: markup }] : [])],
    warnings: route.bookable === false ? ['Distances are estimated (live road routing was unavailable).'] : [],
    unvisitedDestinationNames: selection.unvisitedNames,
  };
}

/* ════════════ route-provider (browser) ════════════ */
function fixtureRoute(points) {
  const legs = points.slice(1).map((p, i) => haversineKm(points[i], p));
  const distanceKm = legs.reduce((s, d) => s + d, 0) * 1.35;          // typical Sri Lankan road factor
  return {
    provider: 'estimate', verified: true, bookable: false,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes: Math.max(1, Math.round(distanceKm / 35 * 60)),   // ~35 km/h island average
    legsKm: legs.map(d => Math.round(d * 1.35 * 100) / 100), encodedPolyline: null,
  };
}

async function osrmRoute(points) {
  points.forEach((p, i) => { finiteNumber(p.latitude, `point[${i}].latitude`); finiteNumber(p.longitude, `point[${i}].longitude`); });
  const coords = points.map(p => `${p.longitude},${p.latitude}`).join(';');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const body = await res.json();
    const r = body.routes?.[0];
    if (!r || !Number.isFinite(r.distance)) throw new Error('OSRM returned no usable route');
    return {
      provider: 'osrm', verified: true, bookable: true,
      distanceKm: Math.round(r.distance / 10) / 100,
      durationMinutes: Math.max(1, Math.round(r.duration / 60)),
      legsKm: (r.legs || []).map(l => Math.round(l.distance / 10) / 100),
      encodedPolyline: r.geometry ?? null,
    };
  } finally { clearTimeout(timer); }
}

export async function calculateRoute(points) {
  if (!Array.isArray(points) || points.length < 2) throw new TypeError('at least an origin and destination are required');
  try { return await osrmRoute(points); }
  catch (e) { console.warn('[planner] live routing unavailable, estimating:', e.message); return fixtureRoute(points); }
}

/** One call: facts + admin data → full quote (what the old Cloud Function did). */
export async function planTrip(tripFacts, destinations, rules) {
  const stops = selectRouteStops(tripFacts, destinations, rules);
  const pts = stops.map(s => ({ latitude: Number(s.lat ?? s.latitude), longitude: Number(s.lng ?? s.longitude) }));
  const route = pts.length >= 2 ? await calculateRoute(pts) : { provider: 'estimate', verified: true, bookable: false, distanceKm: 0, durationMinutes: 0, legsKm: [], encodedPolyline: null };
  return buildQuotePreview({ tripFacts, route, destinations, rules });
}

export function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let r = 0, s = 0, b;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lat += (r & 1) ? ~(r >> 1) : r >> 1;
    r = 0; s = 0;
    do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20);
    lng += (r & 1) ? ~(r >> 1) : r >> 1;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}
