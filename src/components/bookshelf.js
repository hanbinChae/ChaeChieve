// 엔들리스 럭셔리 호두나무 북 레일 (서재 뷰) — 가상 스크롤(Windowing) 적용

import { openLibraryCard } from './modals.js';
import { MAJOR_COLORS } from '../constants.js';
import { state } from '../state.js';
import { escHtml } from '../utils.js';

// ── 가상 스크롤 상수 (기존 CSS flex 레이아웃과 동일한 치수 재현) ─────────────
const RAIL_GAP = 6;          // .walnut-rail-viewport gap
const MARKER_W = 80;         // 연도/읽는 중 북엔드 폭
const MARKER_H = 140;        // .brass-year-marker height
const MARKER_MARGIN = 8;     // .brass-year-marker margin 0 8px
const EBOOK_MARGIN = 3;      // .book-spine.is-ebook margin 0 3px
const BUFFER = 7;            // 뷰포트 좌우 버퍼 아이템 수 (6~8)
const DEFAULT_PAD_X = 48;    // .walnut-rail-viewport 좌우 padding

// 이전 렌더에서 등록한 리스너/옵저버/rAF 정리용
let teardownRail = null;

// ── 레일 아이템 좌표 사전 계산 (DOM 생성 없음, 숫자만) ───────────────────────
function buildLayout(books) {
  const items = [];
  let cursor = 0;
  let lastYear = null;
  let unfinishedMarked = false;

  const pushMarker = label => {
    cursor += MARKER_MARGIN;
    items.push({ type: 'marker', label, x: cursor, w: MARKER_W, h: MARKER_H });
    cursor += MARKER_W + MARKER_MARGIN + RAIL_GAP;
  };

  books.forEach((b, idx) => {
    const isDone = b.status === 'O';
    if (!isDone && !unfinishedMarked) {
      unfinishedMarked = true;
      pushMarker('읽는 중');
    }
    const bookYear = b.year || (b.date ? b.date.match(/\d{4}/)?.[0] : null);
    if (isDone && bookYear && bookYear !== lastYear && (state.sortKey === 'date' || !state.sortKey)) {
      lastYear = bookYear;
      pushMarker(bookYear);
    }

    const height = 142 + ((b.title.length * 4) % 24);
    const width = 32 + ((b.author.length * 3) % 10);
    const isEbook = b.medium === '전자책';

    if (isEbook) {
      cursor += EBOOK_MARGIN;
      items.push({ type: 'book', b, idx, isEbook, isDone, x: cursor, w: width - 2, h: height - 10, height, width });
      cursor += width - 2 + EBOOK_MARGIN + RAIL_GAP;
    } else {
      items.push({ type: 'book', b, idx, isEbook, isDone, x: cursor, w: width, h: height, height, width });
      cursor += width + RAIL_GAP;
    }
  });

  const totalWidth = Math.max(0, cursor - RAIL_GAP);
  const maxH = items.reduce((m, it) => Math.max(m, it.h), 0);
  return { items, totalWidth, maxH };
}

// ── 개별 아이템 내부 HTML (기존 마크업/클래스 그대로) ────────────────────────
function itemInnerHtml(item) {
  if (item.type === 'marker') {
    return `
        <div class="brass-year-marker">
          <div class="brass-badge">${escHtml(item.label)}</div>
          <div class="brass-line"></div>
        </div>
      `;
  }

  const { b, idx, isDone, height, width } = item;
  const col = MAJOR_COLORS[b.major] || '#4a7c6f';
  const is5Star = b.rating === 5;
  const kdcNum = b.decimal ? b.decimal : (b.major ? b.major.slice(0, 2) : '');

  if (item.isEbook) {
    // 전자책: 태블릿/e-ink 리더기 형태의 책등
    const progCls = !isDone ? 'reading' : (b.rating >= 4 ? 'gold' : (b.rating >= 3 ? 'teal' : 'gray'));
    return `
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
      `;
  }

  return `
      <div class="book-spine${isDone ? '' : ' is-reading'}" style="background: linear-gradient(135deg, ${col} 0%, #1e1b18 140%); height:${height}px; width:${width}px;" data-book-idx="${idx}" title="${escHtml(b.title)}">
        ${is5Star ? '<div class="spine-ribbon" title="명예의 전당 (5.0★)"></div>' : ''}
        ${isDone ? '' : '<div class="reading-bookmark" title="읽는 중"></div>'}
        <div class="spine-title">${escHtml(b.title)}</div>
        <div class="spine-bottom">
          <span class="spine-kdc">${escHtml(kdcNum)}</span>
          <span class="spine-rating">${b.rating ? '★' + b.rating : ''}</span>
        </div>
      </div>
    `;
}

// 절대 위치 래퍼 DOM 생성 (translate3d로 GPU 배치)
function createItemEl(item, i) {
  const el = document.createElement('div');
  el.className = 'vs-item';
  el.dataset.ph = String(i % 3); // 기존 nth-child(3n+1/3n+2) 골드 펄스 위상 대체
  el.style.width = `${item.w}px`;
  el.style.height = `${item.h}px`;
  el.style.transform = `translate3d(${item.x}px, 0, 0)`;
  el.innerHTML = itemInnerHtml(item);
  return el;
}

// ── 엔들리스 럭셔리 호두나무 북 레일 렌더링 ──────────────────────────────────
export function renderBookshelf(allFilteredData) {
  const wrap = document.getElementById('bookshelf-wrap');
  if (!wrap) return;

  // 이전 렌더의 리스너/옵저버/rAF 정리
  if (teardownRail) {
    teardownRail();
    teardownRail = null;
  }

  if (!allFilteredData.length) {
    wrap.innerHTML = `<div style="text-align:center;padding:48px 0;color:var(--muted);font-size:.85rem;">서가 레일에 진열된 도서가 없습니다.</div>`;
    return;
  }

  // 읽는 중(미완독) 도서를 가장 앞으로 (기존 정렬 순서는 각 그룹 안에서 유지)
  allFilteredData = [
    ...allFilteredData.filter(b => b.status !== 'O'),
    ...allFilteredData.filter(b => b.status === 'O')
  ];

  // 가상 레이아웃 좌표 계산
  const { items, totalWidth, maxH } = buildLayout(allFilteredData);
  const itemCount = items.length;

  wrap.innerHTML = `
    <div class="walnut-stage">
      <div class="rail-edge-arrow left" id="rail-arrow-left"><svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg></div>
      <div class="rail-edge-arrow right" id="rail-arrow-right"><svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
      <div class="rail-fade-left"></div>
      <div class="rail-fade-right"></div>
      
      <div class="walnut-rail-viewport" id="walnut-viewport">
        <div class="vs-track" id="walnut-track" style="width:${totalWidth}px; height:${maxH}px;"></div>
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

  // 플로팅 툴팁 (body 직하위 fixed 요소)
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

  const vp = document.getElementById('walnut-viewport');
  const track = document.getElementById('walnut-track');
  const thumb = document.getElementById('rail-track-thumb');
  const arrowL = document.getElementById('rail-arrow-left');
  const arrowR = document.getElementById('rail-arrow-right');
  if (!vp || !track) return;

  // 필터/검색 변경으로 재렌더 시 스크롤 위치 0으로 초기화
  vp.style.scrollBehavior = 'auto';
  vp.scrollLeft = 0;
  vp.style.scrollBehavior = '';

  const cs = getComputedStyle(vp);
  const padL = parseFloat(cs.paddingLeft) || DEFAULT_PAD_X;
  const padR = parseFloat(cs.paddingRight) || DEFAULT_PAD_X;
  const scrollW = padL + totalWidth + padR; // 캐시된 전체 스크롤 너비 (레이아웃 강제 방지)
  let viewW = vp.clientWidth;

  // ── 가상 스크롤 윈도우 ────────────────────────────────────────────────────
  const rendered = new Map(); // item index → element
  let curStart = -1;
  let curEnd = -2;

  // x + w >= value 를 만족하는 첫 인덱스
  const firstEndingAfter = value => {
    let lo = 0, hi = itemCount;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].x + items[mid].w >= value) hi = mid; else lo = mid + 1;
    }
    return lo;
  };
  // x <= value 를 만족하는 마지막 인덱스
  const lastStartingBefore = value => {
    let lo = 0, hi = itemCount;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (items[mid].x <= value) lo = mid + 1; else hi = mid;
    }
    return lo - 1;
  };

  const updateWindow = () => {
    const viewStart = vp.scrollLeft - padL;
    const viewEnd = viewStart + viewW;
    const start = Math.max(0, firstEndingAfter(viewStart) - BUFFER);
    const end = Math.min(itemCount - 1, lastStartingBefore(viewEnd) + BUFFER);
    if (start === curStart && end === curEnd) return;
    curStart = start;
    curEnd = end;

    // 범위 밖 아이템 제거
    for (const [i, el] of rendered) {
      if (i < start || i > end) {
        el.remove();
        rendered.delete(i);
      }
    }
    // 새로 진입한 아이템만 생성
    const frag = document.createDocumentFragment();
    for (let i = start; i <= end; i++) {
      if (rendered.has(i)) continue;
      const el = createItemEl(items[i], i);
      rendered.set(i, el);
      frag.appendChild(el);
    }
    if (frag.childNodes.length) track.appendChild(frag);
  };

  const updateArrows = () => {
    if (!arrowL || !arrowR) return;
    if (scrollW <= viewW + 5) {
      arrowL.classList.remove('visible', 'active');
      arrowR.classList.remove('visible', 'active');
      return;
    }
    const sl = vp.scrollLeft;
    const maxSl = scrollW - viewW;
    arrowL.classList.toggle('visible', sl > 10);
    if (sl <= 10) arrowL.classList.remove('active');
    arrowR.classList.toggle('visible', sl < maxSl - 10);
    if (sl >= maxSl - 10) arrowR.classList.remove('active');
  };

  // 트랙바 연동
  const updateThumb = () => {
    if (!thumb) return;
    const maxScroll = scrollW - viewW;
    if (maxScroll <= 0) {
      thumb.style.width = '100%';
      thumb.style.left = '0%';
      return;
    }
    const visibleRatio = Math.min(1, viewW / scrollW);
    const thumbWidthPercent = Math.max(12, visibleRatio * 100);
    const scrollPercent = (vp.scrollLeft / maxScroll) * (100 - thumbWidthPercent);
    thumb.style.width = `${thumbWidthPercent}%`;
    thumb.style.left = `${Math.max(0, Math.min(100 - thumbWidthPercent, scrollPercent))}%`;
  };

  // scroll / resize → rAF 플래그 기반 스로틀링 (프레임당 1회만 처리)
  let ticking = false;
  let tickRaf = null;
  const frameUpdate = () => {
    ticking = false;
    tickRaf = null;
    viewW = vp.clientWidth; // 읽기를 먼저, 쓰기는 이후
    updateWindow();
    updateArrows();
    updateThumb();
  };
  const scheduleUpdate = () => {
    if (ticking) return;
    ticking = true;
    tickRaf = requestAnimationFrame(frameUpdate);
  };

  // 최초 렌더: 좌표 즉시 반영 (rAF 대기 없이)
  updateWindow();
  updateArrows();
  updateThumb();

  vp.addEventListener('scroll', hideTip, { passive: true });
  vp.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  // 숨김 탭 → 표시 전환, 컨테이너 폭 변화 등 window resize로 잡히지 않는 경우 대응
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(scheduleUpdate);
    ro.observe(vp);
  }
  setTimeout(scheduleUpdate, 50);

  // ── 이벤트 위임: 책등 클릭 (대출증 팝업) / 툴팁 ──────────────────────────
  track.addEventListener('click', e => {
    const spineEl = e.target.closest('.book-spine');
    if (!spineEl) return;
    const b = allFilteredData[+spineEl.dataset.bookIdx];
    if (b) openLibraryCard(b);
  });

  track.addEventListener('mouseover', e => {
    const spineEl = e.target.closest('.book-spine');
    if (!spineEl || spineEl === tipSpine) return;
    const b = allFilteredData[+spineEl.dataset.bookIdx];
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
  track.addEventListener('mouseout', e => {
    const spineEl = e.target.closest('.book-spine');
    if (!spineEl || spineEl.contains(e.relatedTarget)) return;
    if (spineEl === tipSpine) hideTip();
  });

  // ── 가로 스크롤 & 드래그 인터랙션 ───────────────────────────────────────
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
    if (Math.abs(scrollSpeed) > 0.1 && scrollW > viewW) {
      vp.scrollLeft += scrollSpeed;
      updateArrows();
      autoScrollRaf = requestAnimationFrame(stepAutoScroll);
    } else {
      autoScrollRaf = null;
    }
  };

  vp.addEventListener('mousemove', e => {
    if (isDown || scrollW <= viewW) return;
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

  // 다음 재렌더/해제 시 정리
  teardownRail = () => {
    window.removeEventListener('resize', scheduleUpdate);
    if (ro) ro.disconnect();
    if (tickRaf) cancelAnimationFrame(tickRaf);
    ticking = false;
    stopAutoScroll();
    hideTip();
    rendered.clear();
  };
}
