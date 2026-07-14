// app.js — orchestration: preloader, cursor, Lenis, ScrollTrigger scrub → 3D + text sync
// Lenis, gsap, ScrollTrigger are globals (loaded via <script> before this module).

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/* ---------------- Preloader ---------------- */
export function runPreloader(onDone) {
  const pl = document.querySelector('.preloader');
  const countEl = pl?.querySelector('.pl-count');
  const bar = pl?.querySelector('.pl-bar');
  if (!pl) { onDone && onDone(); return; }
  let p = 0;
  const finish = () => { pl.classList.add('done'); setTimeout(() => { pl.style.display = 'none'; onDone && onDone(); }, 1050); };
  const tick = () => {
    p += Math.max(1, (100 - p) * (0.05 + Math.random() * 0.06));
    if (p >= 100) p = 100;
    if (countEl) countEl.textContent = String(Math.floor(p)).padStart(2, '0');
    if (bar) bar.style.width = p + '%';
    if (p < 100) setTimeout(tick, 55 + Math.random() * 70); else setTimeout(finish, 420);
  };
  setTimeout(tick, 260);
}

/* ---------------- Custom cursor ---------------- */
export function initCursor() {
  if (isTouch) return;
  const dot = document.querySelector('.cursor'), ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, shown = false;
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY;
    if (!shown) { shown = true; dot.classList.add('on'); ring.classList.add('on'); }
    dot.style.transform = `translate3d(${mx}px,${my}px,0) translate(-50%,-50%)`; }, { passive: true });
  (function loop() { rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
  document.querySelectorAll('a,button,[data-cursor]').forEach((el) => {
    el.addEventListener('mouseenter', () => { ring.classList.add('hover'); ring.dataset.label = el.getAttribute('data-cursor') || ''; });
    el.addEventListener('mouseleave', () => ring.classList.remove('hover'));
  });
}

/* ---------------- Smooth scroll ---------------- */
export function initSmooth() {
  if (reduce || typeof Lenis === 'undefined') return null;
  const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, touchMultiplier: 1.5 });
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  if (typeof ScrollTrigger !== 'undefined') { lenis.on('scroll', ScrollTrigger.update); }
  return lenis;
}

/* ---------------- Magnetic ---------------- */
export function initMagnetic() {
  if (isTouch || reduce) return;
  document.querySelectorAll('[data-mag]').forEach((el) => {
    const s = 0.3;
    el.addEventListener('mousemove', (e) => { const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * s}px,${(e.clientY - r.top - r.height / 2) * s}px)`; });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; el.style.transition = 'transform .5s cubic-bezier(.19,1,.22,1)';
      setTimeout(() => (el.style.transition = ''), 500); });
  });
}

/* ---------------- Reveal (chapter pages) ---------------- */
export function initReveals() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (reduce) { items.forEach((i) => i.classList.add('in')); return; }
  const io = new IntersectionObserver((e) => e.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }),
    { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  items.forEach((i) => io.observe(i));
}

/* ---------------- The scroll journey: scrub 3D + scene text ---------------- */
export function initJourney(sceneApi) {
  const scenes = [...document.querySelectorAll('.scene')];
  const N = scenes.length;
  if (!N) return;

  function paint(p) {
    sceneApi && sceneApi.setProgress(p);
    for (let k = 0; k < N; k++) {
      const pk = k / (N - 1);
      const local = (p - pk) * (N - 1);          // 0 at this scene's moment
      const vis = 1 - smooth(Math.min(Math.abs(local) / 0.62, 1));
      const el = scenes[k];
      el.style.opacity = vis.toFixed(3);
      el.style.transform = `translateY(${(local * -60).toFixed(1)}px)`;
      el.style.visibility = vis < 0.01 ? 'hidden' : 'visible';
    }
  }

  if (reduce || typeof ScrollTrigger === 'undefined') {
    scenes.forEach((s, k) => { s.style.opacity = k === 0 ? 1 : 0; s.style.visibility = k === 0 ? 'visible' : 'hidden'; });
    sceneApi && sceneApi.snapProgress(0);
    return;
  }

  const driver = document.querySelector('.driver');
  ScrollTrigger.create({
    trigger: driver, start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate: (self) => paint(self.progress),
    onRefresh: (self) => paint(self.progress),
  });
  paint(0);
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export function boot(sceneApi) {
  initCursor();
  runPreloader(() => { document.body.classList.add('loaded'); });
  const lenis = initSmooth();
  initMagnetic();
  initReveals();
  initJourney(sceneApi);
  return lenis;
}
