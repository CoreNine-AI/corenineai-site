/* ============================================================
   CoreNine AI v4 — 공통 레이아웃(nav/footer) 주입 + 인터랙션
   각 페이지는 <body data-page="..."> 로 활성 메뉴를 지정한다.
   ============================================================ */
(function () {
  const EMAIL = 'contact@corenineai.com';

  // 심볼: 나인(9): 링 + 라임 꼬리 + 코어. data-tone="dark"면 어두운 배경용 색상.
  function logoSvg(tone) {
    const core = tone === 'dark' ? '#FFFFFF' : '#0D1B2A';
    const uid = 'czg' + Math.random().toString(36).slice(2, 7);
    return `
    <svg class="logo-mark" viewBox="0 0 88 88" aria-hidden="true">
      <defs><linearGradient id="${uid}" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#047857"/><stop offset="1" stop-color="#0BB985"/>
      </linearGradient></defs>
      <g transform="translate(44,38)"><circle r="21" fill="none" stroke="url(#${uid})" stroke-width="11"/><path d="M 21 2 L 21 26" fill="none" stroke="#C9F24E" stroke-width="11" stroke-linecap="round"/><circle r="9" fill="${core}"/></g>
    </svg>`;
  }
  const WORDMARK = `<span class="name">Core<b>Nine</b><em>AI</em></span>`;

  const NAV_ITEMS = [
    ['courses.html',  'courses',  '교육 과정'],
    ['roadmap.html',  'roadmap',  '교육 로드맵'],
    ['build.html',    'build',    '자동화 구축'],
    ['steel.html',    'steel',    '철강 유통 <span class="nav-new">전문</span>'],
    ['cases.html',    'cases',    '고객 사례'],
    ['insights.html', 'insights', '인사이트'],
  ];

  function renderNav() {
    const page = document.body.dataset.page || '';
    const links = NAV_ITEMS.map(([href, key, label]) =>
      `<a href="${href}"${key === page ? ' class="active"' : ''}>${label}</a>`).join('');
    const nav = document.createElement('nav');
    nav.innerHTML = `
      <div class="wrap nav-in">
        <a class="brand" href="index.html">${logoSvg()}${WORDMARK}</a>
        <button class="nav-burger" aria-label="메뉴 열기"><span></span><span></span><span></span></button>
        <div class="nav-links">
          ${links}
          <a class="cta" href="contact.html">상담 문의</a>
        </div>
      </div>`;
    document.body.prepend(nav);

    const bar = document.createElement('div');
    bar.className = 'scroll-bar';
    document.body.prepend(bar);
    addEventListener('scroll', () => {
      const h = document.documentElement;
      bar.style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
    }, { passive: true });

    nav.querySelector('.nav-burger').addEventListener('click', () => {
      nav.querySelector('.nav-links').classList.toggle('open');
    });
  }

  function renderFooter() {
    const f = document.createElement('footer');
    f.innerHTML = `
      <div class="wrap foot-grid">
        <div>
          <a class="brand" href="index.html">${logoSvg('dark')}${WORDMARK}</a>
          <p style="margin-top:14px;line-height:1.8">진단부터 교육 설계, 자동화 구축과 운영까지 —<br>일하는 방식이 바뀌는 AX 파트너</p>
        </div>
        <div>
          <p class="foot-head">교육</p>
          <p style="line-height:2"><a href="courses.html">교육 과정</a><br><a href="roadmap.html">교육 로드맵</a><br><a href="cases.html">고객 사례</a></p>
        </div>
        <div>
          <p class="foot-head">구축</p>
          <p style="line-height:2"><a href="build.html">자동화 구축</a><br><a href="cases.html#demos">체험 데모</a></p>
        </div>
        <div>
          <p class="foot-head">회사</p>
          <p style="line-height:2"><a href="team.html">팀 소개</a><br><a href="contact.html">상담 문의</a><br><a href="insights.html">자료실</a><br><a href="mailto:${EMAIL}">${EMAIL}</a></p>
        </div>
      </div>
      <div class="wrap foot-note">
        <span>© 2026 CoreNine AI. All rights reserved.</span>
        <span>대표 김효원 · ${EMAIL}</span>
      </div>`;
    document.body.appendChild(f);
  }

  function initReveal() {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
    }), { threshold: .12 });
    document.querySelectorAll('.reveal,.reveal-l,.reveal-r,.stagger').forEach(el => io.observe(el));
  }

  // 숫자 카운트업: <span data-count="64" data-decimals="1" data-suffix="%">
  function initCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target;
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.decimals || '0', 10);
      const suffix = el.dataset.suffix || '';
      const t0 = performance.now(), dur = 1200;
      (function tick(t) {
        const p = Math.min((t - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dec) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }), { threshold: .5 });
    els.forEach(el => io.observe(el));
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('link[rel="icon"]')) {
      const fav = document.createElement('link');
      fav.rel = 'icon';
      fav.type = 'image/svg+xml';
      fav.href = 'assets/favicon.svg';
      document.head.appendChild(fav);
    }
    renderNav();
    renderFooter();
    initReveal();
    initCounters();
  });
})();
