// Simple content pages (Our story, Contact) — layout, live brand data, enquiry form.
import { renderLayout, statsHTML } from '../layout.js';
import { esc } from '../store.js';
import { boot, refresh } from '../motion.js';
import { initEnquiries } from '../enquiry.js';

const SITE = 'outbound';
const s = await renderLayout(SITE, document.body.dataset.page);
const stats = document.getElementById('stats');
if (stats) stats.innerHTML = statsHTML(s);
const accs = document.getElementById('accs');
if (accs) accs.innerHTML = (s.accreditations || []).map(a => `<span class="chip" style="box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)"><span class="seal" style="display:inline-block;margin-right:10px"></span>${esc(a)}</span>`).join('');
const map = document.getElementById('mapFrame');
if (map) map.src = `https://maps.google.com/maps?q=${encodeURIComponent(s.mapQuery || s.address)}&z=15&output=embed`;
initEnquiries(SITE);
boot();
refresh();
