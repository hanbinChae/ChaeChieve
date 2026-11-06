// 엔들리스 럭셔리 호두나무 북 레일 (서재 뷰)

import { openLibraryCard } from './modals.js';
import { MAJOR_COLORS } from '../constants.js';
import { state } from '../state.js';
import { escHtml } from '../utils.js';

// ── 엔들리스 럭셔리 호두나무 북 레일 렌더링 ──────────────────────────────────
export function renderBookshelf(allFilteredData) {
  const wrap = document.getElementById('bookshelf-wrap');
  if (!wrap) return;

  if (!allFilteredData.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--muted);font-size:.85rem;">서가 레일에 진열된 도서가 없습니다.</div>`;
    return;
  }

  // 읽는 중(미완독) 도서를 가장 앞으로 (기존 정렬 순서는 각 그룹 안에서 유지)
  allFilteredData = [
    ...allFilteredData.filter(b => b.status !== 'O'),
    ...allFilteredData.filter(b => b.status === 'O')
  ];

  // 연도별 타임마커를 삽입하며 레일 아이템 생성
  let lastYear = null;
  let unfinishedMarked = false;
  const railItems = [];

  allFilteredData.forEach((b, idx) => {
    const isDone = b.status === 'O';
    if (!isDone) {
      if (!unfinishedMarked) {
        unfinishedMarked = true;
        railItems.push(`
        <div class="brass-year-marker">
          <div class="brass-badge">읽는 중</div>
          <div class="brass-line"></div>
        </div>
      `);
      }
    }
    const bookYear = b.year || (b.date ? b.date.match(/\d{4}/)?.[0] : null);
    if (isDone && bookYear && bookYear !== lastYear && (state.sortKey === 'date' || !state.sortKey)) {
      lastYear = bookYear;
      railItems.push(`
        <div class="brass-year-marker">
          <div class="brass-badge">${escHtml(bookYear)}</div>
          <div class="brass-line"></div>
        </div>
      `);
    }

    const col = MAJOR_COLORS[b.major] || '#4a7c6f';
    const is5Star = b.rating === 5;
    const height = 142 + ((b.title.length * 4) % 24);
    const width = 32 + ((b.author.length * 3) % 10);
    const kdcNum = b.decimal ? b.decimal : (b.major ? b.major.slice(0, 2) : '');

    if (b.medium === '전자책') {
      // 전자책: 태블릿/e-ink 리더기 형태의 책등
      const progCls = !isDone ? 'reading' : (b.rating >= 4 ? 'gold' : (b.rating >= 3 ? 'teal' : 'gray'));
      railItems.push(`
      <div class="book-spine is-ebook${isDone ? '' : ' is-reading'}" style="--ec:${col}; height:${height - 10}px; width:${width - 2}px;" data-book-idx="${idx}">
        ${is5Star ? '<div class="spine-ribbon" title="명예의 전당 (5.0★)"></div>' : ''}
        ${isDone ? '' : '<div class="reading-bookmark" title="읽는 중"></div>'}
        <div class="eb-screen">
          <div class="spine-title">${escHtml(b.title)}</div>
          <div class="spine-bottom">
            <span class="spine-kdc">${escHtml(kdcNum)}</span>
            <span class="spine-rating">${b.rating ? '★' + b.rating : ''}</span>
          </div>
        </div>
        <div class="eb-progress ${progCls}"><i></i></div>
      </div>
      `);
      return;
    }

    railItems.push(`
      <div class="book-spine${isDone ? '' : ' is-reading'}" style="background: linear-gradient(135deg, ${col} 0%, #1e1b18 140%); height:${height}px; width:${width}px;" data-book-idx="${idx}" title="${escHtml(b.title)}">
        ${is5Star ? '<div class="spine-ribbon" title="명예의 전당 (5.0★)"></div>' : ''}
        ${isDone ? '' : '<div class="reading-bookmark" title="읽는 중"></div>'}
        <div class="spine-title">${escHtml(b.title)}</div>
        <div class="spine-bottom">
          <span class="spine-kdc">${escHtml(kdcNum)}</span>
          <span class="spine-rating">${b.rating ? '★' + b.rating : ''}</span>
        </div>
      </div>
    `);
  });

  wrap.innerHTML = `
    <div class="walnut-stage">
      <div class="rail-edge-arrow left" id="rail-arrow-left"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
      <div class="rail-edge-arrow right" id="rail-arrow-right"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
      <div class="rail-fade-left"></div>
      <div class="rail-fade-right"></div>
      
      <div class="walnut-rail-viewport" id="walnut-viewport">
        ${railItems.join('')}
      </div>
      
      <div class="walnut-wood-plank"></div>
    </div>

    <div class="rail-footer-bar">
      <span>채카이브 서가 레일 · <strong>총 ${allFilteredData.length}권</strong> 전권 진열</span>
      <div class="rail-track-wrap">
        <div class="rail-track-thumb" id="rail-track-thumb"></div>
      </div>
      <span>마우스 휠 / 드래그로 탐색</span>
    </div>
  `;

  // 플로팅 툴팁 (body 직하위 fixed 요소) + 책등 클릭 이벤트 바인딩 (대출증 팝업)
  let tip = document.getElementById('spine-float-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'spine-float-tip';
    document.body.appendChild(tip);
  }
  let tipSpine = null;
  const placeTip = () => {
    if (!tipSpine) return;
    const r = tipSpine.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    // 호버 시 책이 위로 떠오르는 높이(약 26px)를 고려해 위쪽에 배치
    let top = r.top - th - 30;
    if (top < 4) top = r.bottom + 8;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(6, Math.min(window.innerWidth - tw - 6, left));
    tip.style.transform = `translate(${left}px, ${top}px)`;
  };
  const hideTip = () => { tipSpine = null; tip.classList.remove('show'); };
  hideTip(); // 재렌더 시 남아있는 툴팁 제거

  wrap.querySelectorAll('.book-spine').forEach(spineEl => {
    const b = allFilteredData[+spineEl.dataset.bookIdx];
    spineEl.addEventListener('click', () => {
      if (b) openLibraryCard(b);
    });
    spineEl.addEventListener('mouseenter', () => {
      if (!b) return;
      const isEb = b.medium === '전자책';
      const isReading = b.status !== 'O';
      tip.classList.toggle('ebook', isEb);
      tip.classList.toggle('reading', isReading);
      const badges = (isEb ? `<span class="st-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>E-BOOK</span>` : '')
        + (isReading ? `<span class="st-badge reading"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18l-5-4-5 4z"/></svg>읽는 중</span>` : '');
      tip.innerHTML = (badges ? `<span class="st-badges">${badges}</span>` : '')
        + `<span class="st-title">${escHtml(b.title)}</span><span class="st-meta">${escHtml(b.author)} · ${escHtml(b.major || '')} · ★${b.rating || '—'}</span>`;
      tipSpine = spineEl;
      placeTip();
      tip.classList.add('show');
    });
    spineEl.addEventListener('mouseleave', hideTip);
  });

  // 가로 스크롤 & 드래그 인터랙션 바인딩
  const vp = document.getElementById('walnut-viewport');
  const thumb = document.getElementById('rail-track-thumb');
  const arrowL = document.getElementById('rail-arrow-left');
  const arrowR = document.getElementById('rail-arrow-right');

  if (vp) {
    // 1. 마우스 휠 가로 스크롤
    vp.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        vp.scrollLeft += e.deltaY * 1.2;
      }
    }, { passive: false });

    // 2. 마우스 드래그 (Grab & Drag)
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    vp.addEventListener('mousedown', e => {
      isDown = true;
      vp.classList.add('is-dragging');
      startX = e.pageX - vp.offsetLeft;
      scrollLeft = vp.scrollLeft;
    });
    if (window._railMouseUp) window.removeEventListener('mouseup', window._railMouseUp);
    window._railMouseUp = () => {
      if (isDown) {
        isDown = false;
        vp.classList.remove('is-dragging');
      }
    };
    window.addEventListener('mouseup', window._railMouseUp);
    vp.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - vp.offsetLeft;
      const walk = (x - startX) * 1.5;
      vp.scrollLeft = scrollLeft - walk;
    });

    // 3. 가장자리 호버 자동 스크롤 (Reading Timeline과 동일 방식)
    let autoScrollRaf = null;
    let scrollSpeed = 0;

    const updateArrows = () => {
      if (!arrowL || !arrowR) return;
      if (vp.scrollWidth <= vp.clientWidth + 5) {
        arrowL.classList.remove('visible', 'active');
        arrowR.classList.remove('visible', 'active');
        return;
      }
      const maxSl = vp.scrollWidth - vp.clientWidth;
      arrowL.classList.toggle('visible', vp.scrollLeft > 10);
      if (vp.scrollLeft <= 10) arrowL.classList.remove('active');
      arrowR.classList.toggle('visible', vp.scrollLeft < maxSl - 10);
      if (vp.scrollLeft >= maxSl - 10) arrowR.classList.remove('active');
    };

    const stopAutoScroll = () => {
      scrollSpeed = 0;
      if (arrowL) arrowL.classList.remove('active');
      if (arrowR) arrowR.classList.remove('active');
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      }
      vp.style.scrollBehavior = '';
    };

    const stepAutoScroll = () => {
      if (Math.abs(scrollSpeed) > 0.1 && vp.scrollWidth > vp.clientWidth) {
        vp.scrollLeft += scrollSpeed;
        updateArrows();
        autoScrollRaf = requestAnimationFrame(stepAutoScroll);
      } else {
        autoScrollRaf = null;
      }
    };

    vp.addEventListener('mousemove', e => {
      if (isDown || vp.scrollWidth <= vp.clientWidth) return;
      const rect = vp.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const centerX = rect.width / 2;
      const deadZone = rect.width * 0.14; // 중앙 14% 정지 영역
      if (x < centerX - deadZone) {
        const intensity = (centerX - deadZone - x) / (centerX - deadZone);
        scrollSpeed = -Math.pow(intensity, 1.2) * 14;
        if (arrowL) arrowL.classList.add('active');
        if (arrowR) arrowR.classList.remove('active');
      } else if (x > centerX + deadZone) {
        const intensity = (x - (centerX + deadZone)) / (centerX - deadZone);
        scrollSpeed = Math.pow(intensity, 1.2) * 14;
        if (arrowR) arrowR.classList.add('active');
        if (arrowL) arrowL.classList.remove('active');
      } else {
        stopAutoScroll();
        return;
      }
      vp.style.scrollBehavior = 'auto';
      if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(stepAutoScroll);
    });
    vp.addEventListener('mouseleave', stopAutoScroll);
    vp.addEventListener('mousedown', stopAutoScroll);
    vp.addEventListener('scroll', updateArrows, { passive: true });
    vp.addEventListener('scroll', hideTip, { passive: true });
    setTimeout(updateArrows, 50);

    // 4. 트랙바 연동
    const updateThumb = () => {
      if (!thumb) return;
      const maxScroll = vp.scrollWidth - vp.clientWidth;
      if (maxScroll <= 0) {
        thumb.style.width = '100%';
        thumb.style.left = '0%';
        return;
      }
      const visibleRatio = Math.min(1, vp.clientWidth / vp.scrollWidth);
      const thumbWidthPercent = Math.max(12, visibleRatio * 100);
      const scrollPercent = (vp.scrollLeft / maxScroll) * (100 - thumbWidthPercent);
      thumb.style.width = `${thumbWidthPercent}%`;
      thumb.style.left = `${Math.max(0, Math.min(100 - thumbWidthPercent, scrollPercent))}%`;
    };

    vp.addEventListener('scroll', updateThumb);
    setTimeout(updateThumb, 50);
  }
}
