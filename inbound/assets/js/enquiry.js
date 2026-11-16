// ─────────────────────────────────────────────────────────────
// enquiry.js — every enquiry form on both sites.
//   <form data-enquiry="hotels"> … name, phone, email, country, message …
// Any extra named fields are saved under `extra` so the admin sees them.
// Buttons/links with data-enquire="Galaxy Grand Hotel" prefill the form.
// ─────────────────────────────────────────────────────────────
import { submitEnquiry } from './store.js';
import { scrollToEl } from './motion.js';

const COUNTRIES = 'Sri Lanka,India,Maldives,United Kingdom,Germany,France,Netherlands,Italy,Spain,Switzerland,Sweden,Norway,Denmark,Russia,Ukraine,Poland,Czech Republic,Austria,Belgium,Ireland,United States,Canada,Australia,New Zealand,China,Japan,South Korea,Singapore,Malaysia,Thailand,Indonesia,Philippines,Vietnam,Bangladesh,Pakistan,Nepal,Saudi Arabia,United Arab Emirates,Qatar,Kuwait,Bahrain,Oman,Jordan,Egypt,Turkey,Israel,Iran,South Africa,Kenya,Nigeria,Brazil,Argentina,Mexico,Other'.split(',');

export function fillCountries(root = document) {
  root.querySelectorAll('select[name="country"]').forEach(sel => {
    if (sel.options.length > 2) return;
    sel.innerHTML = '<option value="">Country of residence</option>' + COUNTRIES.map(c => `<option>${c}</option>`).join('');
  });
}

export function initEnquiries(site) {
  fillCountries();
  document.querySelectorAll('form[data-enquiry]').forEach(form => {
    if (form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('[type="submit"]');
      const status = form.querySelector('.form-status');
      const label = btn?.innerHTML;
      const fd = Object.fromEntries(new FormData(form).entries());
      const base = ['name', 'phone', 'email', 'country', 'message', 'item_title'];
      const extra = {};
      Object.entries(fd).forEach(([k, v]) => { if (!base.includes(k) && String(v).trim()) extra[k] = String(v).trim(); });
      if (btn) { btn.disabled = true; btn.innerHTML = 'Sending…'; }
      try {
        await submitEnquiry(site, form.dataset.enquiry, { ...fd, extra, ...(window.__aiQuote && form.dataset.enquiry === 'planner' ? { aiQuote: window.__aiQuote } : {}) });
        form.classList.add('sent');
        if (status) { status.textContent = `Thank you${fd.name ? ', ' + fd.name.split(' ')[0] : ''} — we'll be in touch within one working day.`; status.className = 'form-status ok'; }
        form.dispatchEvent(new CustomEvent('enquiry:sent', { detail: fd, bubbles: true }));
        form.reset();
      } catch (err) {
        console.error(err);
        if (status) { status.textContent = err.message || 'Could not send right now — please call or WhatsApp us.'; status.className = 'form-status err'; }
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
      }
    });
  });

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-enquire]');
    if (!t) return;
    e.preventDefault();
    prefill(t.dataset.enquire, t.dataset.enquireMsg);
  });
}

export function prefill(title, msg) {
  const form = document.querySelector('form[data-enquiry]');
  if (!form) return;
  let hidden = form.querySelector('input[name="item_title"]');
  if (!hidden) { hidden = document.createElement('input'); hidden.type = 'hidden'; hidden.name = 'item_title'; form.appendChild(hidden); }
  hidden.value = title || '';
  const ms = form.querySelector('[name="message"]');
  if (ms && title && !ms.value.includes(title)) ms.value = msg || `I'm interested in "${title}". Please share availability and a quote.`;
  const chip = form.querySelector('.enq-chip');
  if (chip) { chip.textContent = title; chip.hidden = !title; }
  scrollToEl(form.closest('section') || form, -60);
  setTimeout(() => form.querySelector('[name="name"]')?.focus({ preventScroll: true }), 900);
  form.classList.remove('flash'); void form.offsetWidth; form.classList.add('flash');
}
