// app.js — interaction layer (Lenis smooth scroll, cursor, reveals, counters, magnetic, marquee)
// Lenis & GSAP are loaded as globals via <script> before this module.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');

/* ---------------- Preloader ---------------- */
export function runPreloader(onDone) {
  const pl = document.querySelector('.preloader');
  const countEl = pl?.querySelector('.pl-count');
  const bar = pl?.querySelector('.pl-bar');
  const words = pl ? pl.querySelectorAll('.pl-word span') : [];
  words.forEach((w, i) => setTimeout(() => (w.style.transition = 'transform .9s cubic-bezier(.19,1,.22,1)', w.style.transform = 'translateY(0)'), 80 + i * 60));

  let p = 0;
  const finish = () => {
    if (!pl) { onDone && onDone(); return; }
    pl.classList.add('done');
    setTimeout(() => { pl.style.display = 'none'; onDone && onDone(); }, 1000);
  };
  if (!pl) { onDone && onDone(); return; }
  const tick = () => {
    p += Math.max(1, (100 - p) * (0.04 + Math.random() * 0.06));
    if (p >= 100) p = 100;
    if (countEl) countEl.textContent = String(Math.floor(p)).padStart(2, '0');
    if (bar) bar.style.width = p + '%';
    if (p < 100) setTimeout(tick, 60 + Math.random() * 70);
    else setTimeout(finish, 450);
  };
  setTimeout(tick, 300);
}

/* ---------------- Custom cursor ---------------- */
export function initCursor() {
  if (isTouch) return;
  const dot = document.querySelector('.cursor');
  const ring = document.querySelector('.cursor-ring');
  if (!dot || !ring) return;
  let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate3d(${mx}px,${my}px,0) translate(-50%,-50%)`; }, { passive: true });
  (function loop() {
    rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
  document.querySelectorAll('a,button,[data-cursor]').forEach((el) => {
    el.addEventListener('mouseenter', () => {
      ring.classList.add('is-hover');
      ring.dataset.label = el.getAttribute('data-cursor') || '';
    });
    el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
  });
}

/* ---------------- Smooth scroll (Lenis) ---------------- */
export function initSmooth() {
  if (reduce || typeof Lenis === 'undefined') return null;
  const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true, touchMultiplier: 1.4 });
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  if (typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
  }
  // anchor links
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length > 1) { const t = document.querySelector(id); if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -10 }); } }
    });
  });
  return lenis;
}

/* ---------------- Reveal on scroll ---------------- */
export function initReveals() {
  const items = document.querySelectorAll('.reveal, .rmask');
  if (reduce) { items.forEach((i) => i.classList.add('in')); return; }
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  items.forEach((i) => io.observe(i));
}

/* ---------------- Number counters ---------------- */
export function initCounters() {
  const nums = document.querySelectorAll('[data-count]');
  const fmt = (v, dec) => dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const dec = (el.dataset.dec ? parseInt(el.dataset.dec) : 0);
      if (reduce) { el.textContent = fmt(target, dec); return; }
      const dur = 1600, t0 = performance.now();
      const step = (now) => {
        const p = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e, dec);
        if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(target, dec);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.5 });
  nums.forEach((n) => io.observe(n));
}

/* ---------------- Marquee ---------------- */
export function initMarquee() {
  document.querySelectorAll('.marquee .track').forEach((track) => {
    track.innerHTML += track.innerHTML; // duplicate for seamless loop
    let x = 0, w = track.scrollWidth / 2, running = true, raf = 0;
    const dir = track.dataset.dir === 'right' ? -1 : 1;
    const speed = parseFloat(track.dataset.speed || '0.4');
    const loop = () => {
      if (!running) return;
      x -= speed * dir;
      if (dir === 1 && -x >= w) x += w;
      if (dir === -1 && x >= 0) x -= w;
      track.style.transform = `translateX(${x}px)`;
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) loop();
    const io = new IntersectionObserver((e) => {
      running = e[0].isIntersecting && !reduce;
      if (running) loop(); else cancelAnimationFrame(raf);
    }, { threshold: 0 });
    io.observe(track.closest('.marquee'));
  });
}

/* ---------------- Magnetic buttons ---------------- */
export function initMagnetic() {
  if (isTouch || reduce) return;
  document.querySelectorAll('.mag').forEach((el) => {
    const inner = el.querySelector('.mag-in') || el;
    const strength = 0.35;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * strength}px,${y * strength}px)`;
      inner.style.transform = `translate(${x * strength * 0.5}px,${y * strength * 0.5}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = ''; inner.style.transform = '';
      el.style.transition = 'transform .5s cubic-bezier(.19,1,.22,1)';
      setTimeout(() => (el.style.transition = ''), 500);
    });
  });
}

export function boot() {
  initCursor();
  runPreloader(() => {
    document.body.classList.add('loaded');
    document.querySelectorAll('.hero .rmask, .hero .ln, .c-hero .ln').forEach((el, i) => {
      const s = el.querySelector('span') || el; setTimeout(() => (s.style.transform = 'translateY(0)'), 120 + i * 90);
    });
  });
  initSmooth();
  initReveals();
  initCounters();
  initMarquee();
  initMagnetic();
}
