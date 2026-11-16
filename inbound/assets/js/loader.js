// loader.js — the 3D globe preloader from the original site (home pages only).
// Brand letters rise, the counter runs, then the panel slides away.
// Resolves when the page should start its hero animation.
export function runLoader(brand = 'Amja Travels', sub = '') {
  const load = document.getElementById('load');
  const gsap = window.gsap;
  if (!load) return Promise.resolve();
  const m = load.querySelector('.lm'), p = load.querySelector('.lp'), s = load.querySelector('.lsub');
  if (sub && s) s.textContent = sub;
  m.innerHTML = [...brand].map(c => `<span>${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  const done = () => { load.style.display = 'none'; window.__killGlobe?.(); document.body.classList.remove('loading'); };
  if (!gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) { done(); return Promise.resolve(); }
  return new Promise(resolve => {
    gsap.to(m.children, { y: '0%', rotationX: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.05 });
    gsap.to(s, { opacity: 1, duration: 0.8, delay: 0.4 });
    const o = { v: 0 };
    gsap.to(o, {
      v: 100, duration: 2.4, ease: 'power1.inOut',
      onUpdate: () => { p.textContent = String(Math.floor(o.v)).padStart(2, '0'); },
      onComplete: () => {
        window.__killGlobe?.();
        gsap.timeline()
          .to(m.children, { y: '-90%', rotationX: 90, opacity: 0, duration: 0.5, ease: 'power3.in', stagger: 0.025 })
          .to([s, p], { opacity: 0, duration: 0.35 }, '-=.45')
          .add(resolve, '-=.1')
          .to(load, { yPercent: -100, duration: 0.9, ease: 'expo.inOut', onComplete: done }, '-=.15');
      },
    });
    setTimeout(() => { resolve(); done(); }, 7000); // never trap the visitor
  });
}
