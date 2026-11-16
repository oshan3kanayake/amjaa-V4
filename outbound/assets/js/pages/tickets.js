// Air tickets — boarding-pass request form + departures board.
import { renderLayout } from '../layout.js';
import { list } from '../store.js';
import { boot, reduced, refresh } from '../motion.js';
import { initEnquiries } from '../enquiry.js';
import { boardHTML, flipAllOnView } from '../fx.js';

const gsap = window.gsap;
const $ = s => document.querySelector(s);
await renderLayout('outbound', 'tickets.html');

const board = $('#board');
board.innerHTML = boardHTML(await list('flight_deals'));
const clock = $('#boardClock');
const tick = () => { clock.textContent = 'COLOMBO ' + new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 15000);

/* trip type pill with a sliding indicator */
const trip = $('#tkTrip'), pill = trip.querySelector('i');
const movePill = b => { pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft - 5}px)`; };
requestAnimationFrame(() => movePill(trip.querySelector('.on')));
trip.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  trip.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  movePill(b);
  $('#tripType').value = b.dataset.trip;
  $('#retWrap').style.opacity = b.dataset.trip === 'One way' ? 0.35 : 1;
  $('#retWrap input').disabled = b.dataset.trip === 'One way';
  stub();
});
addEventListener('resize', () => movePill(trip.querySelector('.on')));

/* swap from / to with a little flip */
$('#tkSwap').onclick = () => {
  const a = $('#tkFrom'), b = $('#tkTo');
  [a.value, b.value] = [b.value, a.value];
  if (gsap && !reduced) gsap.fromTo([a, b], { rotateX: 90, opacity: 0 }, { rotateX: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.06 });
  stub();
};

/* the stub mirrors what you type */
const code = v => (v || '').trim().toUpperCase().slice(0, 3) || '···';
function stub() {
  $('#stubRoute').textContent = `${code($('#tkFrom').value)} → ${code($('#tkTo').value)}`;
  $('#stubMeta').textContent = `${$('#tripType').value.toUpperCase()} · ${$('#tkForm').cabin.value.toUpperCase()}`;
}
$('#tkForm').addEventListener('input', stub);
$('#tkForm').addEventListener('change', stub);

/* sent: stamp the pass */
$('#tkForm').addEventListener('enquiry:sent', () => {
  const tk = $('#tk'), st = $('#tkStamp');
  tk.classList.add('sent');
  if (gsap && !reduced) {
    gsap.fromTo(st, { scale: 2.4, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: -14, duration: 0.5, ease: 'back.out(2.5)' });
    gsap.fromTo(tk, { x: -6 }, { x: 0, duration: 0.6, ease: 'elastic.out(1,.3)', delay: 0.35 });
  } else st.style.opacity = 1;
  setTimeout(() => { tk.classList.remove('sent'); if (gsap) gsap.to(st, { opacity: 0, duration: 0.6 }); else st.style.opacity = 0; stub(); }, 6000);
});

initEnquiries('outbound');
boot();
flipAllOnView(board);
refresh();

/* tapping a board row drops that destination into the pass */
board.addEventListener('click', e => {
  const r = e.target.closest('.board-row'); if (!r) return;
  if (r.dataset.to) { $('#tkTo').value = r.dataset.to; stub(); }
});
