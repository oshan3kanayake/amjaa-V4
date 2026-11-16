// island.js — draws Sri Lanka as SVG and plots the planner's cities on it.
// Cities (and their coordinates) come live from Admin → Planner cities.
import { LK_PATH, LK_VIEWBOX, project } from './lk-map.js';
import { esc } from './store.js';

const hav = (a, b) => {
  const R = 6371, t = x => x * Math.PI / 180;
  const dLa = t(b.lat - a.lat), dLo = t(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(t(a.lat)) * Math.cos(t(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Nearest-neighbour tour from the first city — a readable demo route. */
export function demoRoute(cities) {
  if (!cities.length) return [];
  const left = cities.slice(1), out = [cities[0]];
  while (left.length) {
    const cur = out[out.length - 1];
    left.sort((a, b) => hav(cur, a) - hav(cur, b));
    out.push(left.shift());
  }
  return out;
}

function curvePath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0;
    const k = (i % 2 ? 0.18 : -0.18);
    d += ` Q${(mx - dy * k).toFixed(1)} ${(my + dx * k).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

export function buildIsland(container, cities, { route = true, labels = true } = {}) {
  const [vw, vh] = LK_VIEWBOX;
  const grid = [];
  for (let lat = 6; lat <= 9.5; lat += 0.5) { const [, y] = project(lat, 80); grid.push(`<line x1="-40" x2="${vw + 40}" y1="${y}" y2="${y}"/>`); }
  for (let lng = 79.5; lng <= 82; lng += 0.5) { const [x] = project(8, lng); grid.push(`<line y1="-20" y2="${vh + 20}" x1="${x}" x2="${x}"/>`); }
  const ordered = route ? demoRoute(cities) : cities;
  const pts = ordered.map(c => project(c.lat, c.lng));
  const dots = cities.map(c => {
    const [x, y] = project(c.lat, c.lng);
    const left = x > vw * 0.62;
    return `<g class="lk-dot" data-city="${esc(c.title)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
      <circle class="halo" r="11"/><circle class="core" r="4.2"/>
      ${labels ? `<text x="${left ? -12 : 12}" y="4" text-anchor="${left ? 'end' : 'start'}">${esc(c.title)}</text>` : ''}</g>`;
  }).join('');
  container.innerHTML = `
  <svg viewBox="-70 -24 ${vw + 140} ${vh + 48}" role="img" aria-label="Map of Sri Lanka with tour destinations">
    <g class="lk-grid">${grid.join('')}</g>
    <path class="lk-outline" d="${LK_PATH}"/>
    ${route && pts.length > 1 ? `<path class="lk-route" d="${curvePath(pts)}"/><path class="lk-route-solid" d="${curvePath(pts)}"/>` : ''}
    <g class="lk-dots">${dots}</g>
    <g class="lk-car" opacity="0"><circle r="9" fill="#F6D3CE" opacity=".3"/><circle r="5" fill="#fff"/></g>
  </svg>
  <svg class="lk-compass" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="30" fill="none" stroke="currentColor"/><path d="M40 8 46 40 40 72 34 40Z" fill="currentColor" opacity=".6"/><text x="40" y="6" text-anchor="middle" font-size="9" fill="currentColor" font-weight="700">N</text></svg>`;
  return { ordered, svg: container.querySelector('svg') };
}
