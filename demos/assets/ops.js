/* ============================================================
   CoreNine Ops — 운영 콘솔 공통 셸(데모 바 + 사이드바 + 토스트)
   각 페이지는 <body data-ops="dashboard|review|erp|volume|accuracy|audit">
   로 활성 메뉴를 지정하고, 본문에 <div class="layout"><main>…</main></div>만 둔다.
   ============================================================ */
(function () {
  const PAGES = [
    { group: '운영',  key: 'dashboard', label: '대시보드',      href: 'demo4_구축_운영콘솔.html' },
    { group: '운영',  key: 'review',    label: '검수함',        href: 'demo4_검수함.html' },
    { group: '운영',  key: 'erp',       label: 'ERP 연동 상태', href: 'demo4_ERP연동상태.html' },
    { group: '분석',  key: 'volume',    label: '처리량 리포트', href: 'demo4_처리량리포트.html' },
    { group: '분석',  key: 'accuracy',  label: '정확도 추이',   href: 'demo4_정확도추이.html' },
    { group: '분석',  key: 'audit',     label: '감사 로그',     href: 'demo4_감사로그.html' },
  ];
  const SCOPE_ONLY = ['추출 규칙', '권한 관리']; // 데모 범위 밖 — 토스트 안내

  const LOGO = `<svg viewBox="0 0 88 88"><g transform="translate(44,38)"><circle r="21" fill="none" stroke="#0BA678" stroke-width="11"/><path d="M 21 2 L 21 26" fill="none" stroke="#C9F24E" stroke-width="11" stroke-linecap="round"/><circle r="9" fill="#0D1B2A"/></g></svg>`;

  window.opsToast = function (msg) {
    let t = document.getElementById('demoToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'demoToast';
      t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%);' +
        'background:#0D1B2A;color:#fff;font-size:13px;font-weight:700;padding:12px 22px;' +
        'border-radius:11px;box-shadow:0 12px 30px rgba(0,0,0,.3);z-index:99;transition:opacity .3s;max-width:88vw';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._h);
    t._h = setTimeout(() => t.style.opacity = '0', 2600);
  };

  window.opsNow = function () {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
  };

  // 차트 툴팁: opsTip.show(html, clientX, clientY) / opsTip.hide()
  window.opsTip = {
    el: null,
    show(html, x, y) {
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.className = 'chart-tip';
        document.body.appendChild(this.el);
      }
      this.el.innerHTML = html;
      const w = this.el.offsetWidth || 160;
      this.el.style.left = Math.min(x + 14, innerWidth - w - 12) + 'px';
      this.el.style.top = (y + 16) + 'px';
      this.el.style.opacity = '1';
    },
    hide() { if (this.el) this.el.style.opacity = '0'; }
  };

  function buildShell() {
    const active = document.body.dataset.ops || '';

    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = `<span><b>구축 구현물 미리보기</b> — 발주·문서 자동처리 파이프라인의 운영 콘솔입니다. 화면의 데이터는 시뮬레이션입니다.</span>
      <a href="../site/build.html">← 구축 서비스로 돌아가기</a>`;
    document.body.prepend(bar);

    const groups = {};
    PAGES.forEach(p => {
      (groups[p.group] = groups[p.group] || []).push(
        `<a${p.key === active ? ' class="on"' : ''} href="${p.href}"><span class="dot"></span>${p.label}</a>`);
    });
    const scopeLinks = SCOPE_ONLY.map(l =>
      `<a href="#" data-demo-scope><span class="dot"></span>${l}</a>`).join('');

    const asideEl = document.createElement('aside');
    asideEl.innerHTML = `
      <div class="brand">${LOGO}<span>Core<b>Nine</b> Ops</span></div>
      <div class="side-label">운영</div><div class="side">${groups['운영'].join('')}</div>
      <div class="side-label">분석</div><div class="side">${groups['분석'].join('')}</div>
      <div class="side-label">설정</div><div class="side">${scopeLinks}</div>
      <div class="side-foot">㈜한올유통 · 구매팀<br>CoreNine AI 구축 · 운영 v2.4</div>`;

    const layout = document.querySelector('.layout');
    layout.prepend(asideEl);

    const mnav = document.createElement('div');
    mnav.className = 'mobile-nav';
    mnav.innerHTML = PAGES.map(p =>
      `<a${p.key === active ? ' class="on"' : ''} href="${p.href}">${p.label}</a>`).join('');
    layout.before(mnav);

    document.querySelectorAll('[data-demo-scope]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      opsToast('이 메뉴는 실제 구축 시 제공됩니다 — 데모는 운영 핵심 화면을 제공합니다');
    }));
  }

  document.addEventListener('DOMContentLoaded', buildShell);
})();
