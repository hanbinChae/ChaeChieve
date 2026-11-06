// 타임라인 차트 (Diverging 레이아웃 SVG, 범례/장르 필터, 툴팁, 자동 스크롤)

import { openMemo } from './modals.js';
import { MAJOR_COLORS, MUTED, ORANGE, TEAL } from '../constants.js';
import { getCompleted } from '../data/statsCalculator.js';
import { state } from '../state.js';

export function updateTimelineLegend() {
  const legendEl = document.getElementById('timeline-legend');
  if (!legendEl) return;
  if (state.timelineColorMode === 'medium') {
    legendEl.innerHTML = `
      <span class="tl-leg-item"><span class="tl-leg-dot teal"></span>전자책 <span class="tl-leg-arr">▴ 상단</span></span>
      <span class="tl-leg-item"><span class="tl-leg-dot orange"></span>종이책 <span class="tl-leg-arr">▾ 하단</span></span>
    `;
  } else {
    const chips = Object.entries(MAJOR_COLORS).map(([name, col]) => {
      const isActive = state.activeTimelineGenre === name;
      const isDimmed = state.activeTimelineGenre !== null && !isActive;
      const chipClass = `tl-genre-chip ${isActive ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`;
      const activeStyle = isActive ? `style="background:${col}18; border-color:${col};"` : '';
      return `
        <span class="${chipClass}" data-genre="${name}" ${activeStyle} title="클릭하여 '${name}' 도서만 강조">
          <span class="tl-genre-dot" style="background:${col};"></span>${name}
        </span>
      `;
    }).join('');
    legendEl.innerHTML = `<div class="tl-genre-legend-list">${chips}</div>`;

    // 장르 칩 클릭 이벤트 (토글 필터링)
    legendEl.querySelectorAll('.tl-genre-chip').forEach(chip => {
      chip.onclick = () => {
        const genre = chip.dataset.genre;
        if (state.activeTimelineGenre === genre) {
          state.activeTimelineGenre = null; // 재클릭 시 필터 해제
        } else {
          state.activeTimelineGenre = genre; // 해당 장르 선택
        }
        updateTimelineLegend();
        applyTimelineGenreFilter();
      };
    });
  }
}

function applyTimelineGenreFilter() {
  const svg = document.getElementById('timeline-svg');
  if (!svg) return;
  if (state.timelineColorMode !== 'genre' || !state.activeTimelineGenre) {
    svg.classList.remove('has-genre-filter');
    svg.querySelectorAll('.tl-dot').forEach(d => d.classList.remove('genre-matched'));
  } else {
    svg.classList.add('has-genre-filter');
    svg.querySelectorAll('.tl-dot').forEach(d => {
      if (d.dataset.major === state.activeTimelineGenre) {
        d.classList.add('genre-matched');
      } else {
        d.classList.remove('genre-matched');
      }
    });
  }
}

export function bindTimelineToggle() {
  document.querySelectorAll('.tl-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tl-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.timelineColorMode = btn.dataset.mode;
      state.activeTimelineGenre = null; // 모드 전환 시 장르 필터 초기화
      updateTimelineLegend();
      renderTimeline(getCompleted(state.activeYear));
    };
  });
}

// ── 타임라인 (SVG) ────────────────────────────────────────────────────────────
export function renderTimeline(books) {
  const svg = document.getElementById('timeline-svg');
  const wrap = svg.parentElement;
  const card = wrap.closest('.card') || wrap;
  card.style.position = 'relative';

  const withDate = books.filter(b => b.year && b.date).map(b => {
    const parts = b.date.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!parts) return null;
    return { ...b, ts: new Date(+parts[1], +parts[2]-1, +parts[3]).getTime() };
  }).filter(Boolean).sort((a,b) => a.ts - b.ts);

  if (!withDate.length) { svg.innerHTML = ''; return; }

  const minTs = withDate[0].ts, maxTs = withDate[withDate.length-1].ts;
  const startYear = new Date(minTs).getFullYear();
  const endYear   = new Date(maxTs).getFullYear();
  const yearSpan  = Math.max(1, endYear - startYear + 1);

  // 화면 밀도를 높인 컴팩트 가로 너비(W) 및 높이 설정
  const pad = 58, H = 310;
  const W = Math.max(wrap.clientWidth || 860, yearSpan * 265, withDate.length * 7.5 + pad * 2);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  const centerY = H / 2; // 중앙축(Spine) Y 좌표 (155px)
  const laneColors = { '전자책': TEAL, '종이책': ORANGE };
  const tsRange = maxTs - minTs || 1;
  const toX = ts => pad + (ts - minTs) / tsRange * (W - pad * 2);

  let html = '';

  // ① [요구사항 4] 중앙축(Spine) 단일 실선 배치 (굵직하고 은은한 실선)
  html += `<line x1="${pad - 12}" y1="${centerY}" x2="${W - pad + 12}" y2="${centerY}"
    stroke="#d8d0be" stroke-width="2.5" stroke-linecap="round"/>`;

  // ② 연도 및 월 눈금/라벨 배치
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      const ts = new Date(y, m, 1).getTime();
      if (ts < minTs || ts > maxTs) continue;
      const x = toX(ts);
      const isMajor = m === 0;

      if (isMajor) {
        // 연도 시작 가이드 세로 점선
        html += `<line x1="${x.toFixed(1)}" y1="24" x2="${x.toFixed(1)}" y2="${H - 24}"
          stroke="#d5ccba" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.6"/>`;
        // 중앙 Spine 위의 연도 배지 (배경 박스 + 텍스트)
        html += `<rect x="${(x - 20).toFixed(1)}" y="${centerY - 10}" width="40" height="20" rx="4"
          fill="var(--card)" stroke="#d5ccba" stroke-width="1"/>`;
        html += `<text x="${x.toFixed(1)}" y="${centerY + 4}" text-anchor="middle"
          font-size="10.5" fill="${MUTED}" font-weight="700">${y}</text>`;
      } else if (m % 3 === 0) {
        // 분기 눈금 틱(Tick) 및 월 텍스트
        html += `<line x1="${x.toFixed(1)}" y1="${centerY - 4}" x2="${x.toFixed(1)}" y2="${centerY + 4}"
          stroke="#c8bfaa" stroke-width="1.2" stroke-opacity="0.8"/>`;
        html += `<text x="${x.toFixed(1)}" y="${centerY + 15}" text-anchor="middle"
          font-size="9" fill="${MUTED}" opacity="0.6">${m + 1}월</text>`;
      }
    }
  }

  // ③ [요구사항 4] Diverging 레인 레이블 (중앙 Spine 기준 위/아래)
  html += `<text x="${pad - 16}" y="${centerY - 18}" text-anchor="end"
    font-size="11.5" font-weight="700" fill="${TEAL}">전자책 ▴</text>`;
  html += `<text x="${pad - 16}" y="${centerY + 26}" text-anchor="end"
    font-size="11.5" font-weight="700" fill="${ORANGE}">종이책 ▾</text>`;

  // ④ 정밀 Beeswarm 충돌 회피 알고리즘 & Boundary 방어 (개별 노드 식별 및 클릭 용이성 극대화)
  const placed = { '전자책': [], '종이책': [] };
  const CENTER_GAP = 20;  // 중앙 Spine 및 텍스트 안전 마진 (상하 20px)
  const TOP_PAD = 20;     // 최상단 경계 한계선
  const BOT_PAD = H - 20; // 최하단 경계 한계선

  withDate.forEach(b => {
    const med = (b.medium === '전자책' || b.medium === '종이책') ? b.medium : '전자책';
    // 모드에 따른 색상 결정 (매체별 2색 vs 10진 주류별 10색)
    const col = state.timelineColorMode === 'genre'
      ? (MAJOR_COLORS[b.major] || (med === '전자책' ? TEAL : ORANGE))
      : laneColors[med];
    let x     = toX(b.ts);
    // 점 크기 확대 (기존 대비 약 25~30% 확대하여 시인성 및 클릭 편의성 향상)
    const r   = b.rating >= 4.5 ? 9.2 : b.rating >= 3.5 ? 7.2 : 5.6;

    let cy;
    if (med === '전자책') {
      // [전자책]: 중앙축(centerY) 위쪽(-Y)으로 차곡차곡 쌓아올리는 정밀 스택
      const baseLaneY = centerY - CENTER_GAP;
      cy = baseLaneY - r;

      let attempts = 0;
      while (attempts < 20) {
        const collisions = placed['전자책'].filter(p => {
          const dx = p.x - x;
          const dy = p.cy - cy;
          return Math.sqrt(dx * dx + dy * dy) < (r + p.r + 2.0);
        });

        if (!collisions.length) break;

        const topMost = Math.min(...collisions.map(p => p.cy));
        cy = topMost - (r + 7.0);

        if (cy < TOP_PAD + r) {
          x += (attempts % 2 === 0 ? 1 : -1) * (r * 1.5);
          cy = baseLaneY - r;
        }
        attempts++;
      }
      cy = Math.max(TOP_PAD + r, Math.min(centerY - CENTER_GAP - r, cy));
    } else {
      // [종이책]: 중앙축(centerY) 아래쪽(+Y)으로 차곡차곡 쌓아올리는 정밀 스택
      const baseLaneY = centerY + CENTER_GAP;
      cy = baseLaneY + r;

      let attempts = 0;
      while (attempts < 20) {
        const collisions = placed['종이책'].filter(p => {
          const dx = p.x - x;
          const dy = p.cy - cy;
          return Math.sqrt(dx * dx + dy * dy) < (r + p.r + 2.0);
        });

        if (!collisions.length) break;

        const bottomMost = Math.max(...collisions.map(p => p.cy));
        cy = bottomMost + (r + 7.0);

        if (cy > BOT_PAD - r) {
          x += (attempts % 2 === 0 ? 1 : -1) * (r * 1.5);
          cy = baseLaneY + r;
        }
        attempts++;
      }
      cy = Math.max(centerY + CENTER_GAP + r, Math.min(BOT_PAD - r, cy));
    }

    placed[med].push({ x, cy, r });

    // data 속성으로 툴팁 정보 저장
    const stars = '★'.repeat(Math.round(b.rating || 0)) + '☆'.repeat(5 - Math.round(b.rating || 0));
    html += `<circle
      cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"
      fill="${col}" stroke="white" stroke-width="1.5"
      class="tl-dot"
      data-title="${b.title.replace(/"/g,'&quot;')}"
      data-author="${(b.author||'').replace(/"/g,'&quot;')}"
      data-major="${(b.major||'').replace(/"/g,'&quot;')}"
      data-date="${b.date}"
      data-rating="${b.rating}"
      data-stars="${stars}"
      data-medium="${med}"
      data-color="${col}"
      data-memo="${(b.memo||'').replace(/"/g,'&quot;').replace(/\n/g,'&#10;')}"/>`;
  });

  svg.innerHTML = html;
  applyTimelineGenreFilter();

  // ⑤ 커스텀 툴팁 엘리먼트 (card에 부착하여 마스크 페이드아웃의 영향 배제)
  let tip = card.querySelector('.tl-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tl-tooltip';
    tip.style.cssText = `
      position:absolute; display:none; pointer-events:none;
      background:var(--card); color:var(--text);
      border:1px solid var(--border);
      font-size:12px; line-height:1.6; padding:10px 14px;
      border-radius:10px; min-width:160px; max-width:220px;
      box-shadow:0 6px 20px rgba(44,36,22,.14); z-index:50;
      transition: opacity .12s ease;`;
    card.appendChild(tip);
  }

  // 좌표 계산용 rect 캐싱
  let _tlRect = svg.getBoundingClientRect();
  let _cardRect = card.getBoundingClientRect();
  const _refreshTlRect = () => {
    _tlRect   = svg.getBoundingClientRect();
    _cardRect = card.getBoundingClientRect();
  };
  if (window._tlRectHandler) {
    window.removeEventListener('resize', window._tlRectHandler);
    window.removeEventListener('scroll', window._tlRectHandler);
  }
  window._tlRectHandler = _refreshTlRect;
  window.addEventListener('resize',  _refreshTlRect, { passive: true });
  window.addEventListener('scroll', _refreshTlRect, { passive: true });

  const allDots = svg.querySelectorAll('.tl-dot');
  let lockedDot = null;   // 클릭으로 고정된 dot

  function showDotTip(dot) {
    _refreshTlRect();
    const origR  = parseFloat(dot.getAttribute('r'));
    const cx     = parseFloat(dot.getAttribute('cx'));
    const cy     = parseFloat(dot.getAttribute('cy'));
    const scaleX = _tlRect.width  / parseFloat(svg.getAttribute('width')  || W);
    const scaleY = _tlRect.height / parseFloat(svg.getAttribute('height') || H);
    let left = (_tlRect.left - _cardRect.left) + cx * scaleX + origR + 10;
    let top  = (_tlRect.top  - _cardRect.top)  + cy * scaleY - 70;
    if (left + 230 > _cardRect.width) left -= 240;
    top = Math.max(8, top);

    const d = dot.dataset;
    const hasMemo = d.memo && d.memo.trim();
    tip.innerHTML = `
      <div style="font-weight:700;font-size:.82rem;margin-bottom:2px;
                  color:${d.color};font-family:'Noto Serif KR',serif;">
        ${d.title}
      </div>
      <div style="font-size:.74rem;color:var(--muted);margin-bottom:6px;">${d.author}</div>
      <div style="font-size:.78rem;color:var(--muted);">📅 ${d.date}</div>
      <div style="margin-top:4px;font-size:.82rem;letter-spacing:.05em;color:${d.color};">
        ${d.stars}
        <span style="font-size:.72rem;color:var(--muted);margin-left:4px;">${d.rating ? d.rating + '점' : '—'}</span>
      </div>
      <div style="margin-top:4px;font-size:.7rem;
                  padding:2px 7px;border-radius:999px;display:inline-block;
                  background:${d.color}22;color:${d.color};font-weight:600;">
        ${d.medium}
      </div>
      ${hasMemo ? `
      <div style="margin-top:8px;padding-top:7px;border-top:1px solid var(--border);
                  font-size:.7rem;color:var(--teal);font-weight:600;cursor:pointer;">
        📝 클릭하여 메모 보기
      </div>` : ''}`;
    tip.style.display = 'block';
    tip.style.left = left + 'px';
    tip.style.top  = top  + 'px';
  }

  // ⑥ [요구사항 2] Focus & Dim 인터랙션 제어 함수
  function setFocus(targetDot) {
    if (!targetDot) {
      svg.classList.remove('has-focus');
      allDots.forEach(d => d.classList.remove('is-focused', 'is-locked'));
      return;
    }
    svg.classList.add('has-focus');
    allDots.forEach(d => {
      if (d === targetDot) {
        d.classList.add('is-focused');
        if (d === lockedDot) d.classList.add('is-locked');
      } else {
        d.classList.remove('is-focused', 'is-locked');
      }
    });
  }

  // ⑦ 이벤트 리스너 등록
  allDots.forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      if (lockedDot && lockedDot !== dot) return; // 고정된 노드가 있으면 호버 변경 방지
      setFocus(dot);
      showDotTip(dot);
    });

    dot.addEventListener('mouseleave', () => {
      if (lockedDot) {
        setFocus(lockedDot);
        showDotTip(lockedDot);
        return;
      }
      setFocus(null);
      tip.style.display = 'none';
    });

    dot.addEventListener('click', e => {
      e.stopPropagation();
      const d = dot.dataset;
      const hasMemo = d.memo && d.memo.trim();

      // 동일 dot 재클릭 시 고정 해제
      if (lockedDot === dot) {
        lockedDot = null;
        setFocus(null);
        tip.style.display = 'none';
        return;
      }

      // 새로운 dot 고정
      lockedDot = dot;
      setFocus(dot);
      showDotTip(dot);

      // 메모 모달 열기
      if (hasMemo) {
        openMemo(d.title, d.author, d.memo.replace(/&#10;/g, '\n'));
      }
    });
  });

  // 차트 바깥 영역 클릭 시 고정 해제 (재렌더 시 이전 리스너 해제)
  if (window._tlDocClick) document.removeEventListener('click', window._tlDocClick);
  window._tlDocClick = () => {
    if (!lockedDot) return;
    lockedDot = null;
    setFocus(null);
    tip.style.display = 'none';
  };
  document.addEventListener('click', window._tlDocClick);

  // ⑧ 가로 휠 스크롤 지원 (마우스 휠로 타임라인을 좌우로 편리하게 탐색)
  if (!wrap._wheelBound) {
    wrap._wheelBound = true;
    wrap.addEventListener('wheel', e => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && wrap.scrollWidth > wrap.clientWidth) {
        e.preventDefault();
        wrap.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // ⑨ [Edge Auto-Scroll] 화살표 인디케이터 생성 및 마우스 위치 자동 스크롤 인터랙션
  let arrowLeft = card.querySelector('.tl-edge-arrow.left');
  let arrowRight = card.querySelector('.tl-edge-arrow.right');
  if (!arrowLeft) {
    arrowLeft = document.createElement('div');
    arrowLeft.className = 'tl-edge-arrow left';
    arrowLeft.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
    card.appendChild(arrowLeft);
  }
  if (!arrowRight) {
    arrowRight = document.createElement('div');
    arrowRight.className = 'tl-edge-arrow right';
    arrowRight.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    card.appendChild(arrowRight);
  }

  const updateArrows = () => {
    if (wrap.scrollWidth <= wrap.clientWidth + 5) {
      arrowLeft.classList.remove('visible', 'active');
      arrowRight.classList.remove('visible', 'active');
      return;
    }
    const sl = wrap.scrollLeft;
    const maxSl = wrap.scrollWidth - wrap.clientWidth;
    if (sl > 10) arrowLeft.classList.add('visible');
    else arrowLeft.classList.remove('visible', 'active');

    if (sl < maxSl - 10) arrowRight.classList.add('visible');
    else arrowRight.classList.remove('visible', 'active');
  };

  if (wrap._updArrows) wrap.removeEventListener('scroll', wrap._updArrows);
  wrap._updArrows = updateArrows;
  wrap.addEventListener('scroll', updateArrows, { passive: true });

  // ⑩ [Default Position] 기본 스크롤 위치를 가장 최신 독서 기록(오른쪽 끝)으로 설정
  requestAnimationFrame(() => {
    wrap.scrollLeft = wrap.scrollWidth - wrap.clientWidth;
    updateArrows();
  });
  updateArrows();

  // 화살표 클릭 시 좌우 스크롤 지원
  arrowLeft.onclick = (e) => { e.stopPropagation(); wrap.scrollBy({ left: -320, behavior: 'smooth' }); };
  arrowRight.onclick = (e) => { e.stopPropagation(); wrap.scrollBy({ left: 320, behavior: 'smooth' }); };

  if (!wrap._edgeScrollBound) {
    wrap._edgeScrollBound = true;
    let autoScrollRaf = null;
    let scrollSpeed = 0;

    const stepAutoScroll = () => {
      if (Math.abs(scrollSpeed) > 0.1 && wrap.scrollWidth > wrap.clientWidth) {
        wrap.scrollLeft += scrollSpeed;
        _refreshTlRect();
        updateArrows();
        if (lockedDot) showDotTip(lockedDot);
        autoScrollRaf = requestAnimationFrame(stepAutoScroll);
      } else {
        autoScrollRaf = null;
      }
    };

    // 타임라인 영역 마우스 호버 위치에 따른 좌우 반응형 가속 스크롤
    wrap.addEventListener('mousemove', e => {
      if (wrap.scrollWidth <= wrap.clientWidth) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const centerX = rect.width / 2;
      const deadZone = rect.width * 0.14; // 중앙 14% 정지 영역

      if (x < centerX - deadZone) {
        // 왼쪽 영역 호버: 마우스가 왼쪽으로 갈수록 점진적 가속
        const intensity = (centerX - deadZone - x) / (centerX - deadZone);
        scrollSpeed = -Math.pow(intensity, 1.2) * 14;
        arrowLeft.classList.add('active');
        arrowRight.classList.remove('active');
        if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(stepAutoScroll);
      } else if (x > centerX + deadZone) {
        // 오른쪽 영역 호버: 마우스가 오른쪽으로 갈수록 점진적 가속
        const intensity = (x - (centerX + deadZone)) / (centerX - deadZone);
        scrollSpeed = Math.pow(intensity, 1.2) * 14;
        arrowRight.classList.add('active');
        arrowLeft.classList.remove('active');
        if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(stepAutoScroll);
      } else {
        // 중앙 정지 영역
        scrollSpeed = 0;
        arrowLeft.classList.remove('active');
        arrowRight.classList.remove('active');
        if (autoScrollRaf) {
          cancelAnimationFrame(autoScrollRaf);
          autoScrollRaf = null;
        }
      }
    });

    wrap.addEventListener('mouseleave', () => {
      scrollSpeed = 0;
      arrowLeft.classList.remove('active');
      arrowRight.classList.remove('active');
      if (autoScrollRaf) {
        cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      }
    });

    // 드래그(Grab & Drag) 인터랙션도 완벽 지원
    let isDown = false, startX = 0, initialScroll = 0;
    wrap.addEventListener('mousedown', e => {
      isDown = true;
      startX = e.pageX - wrap.offsetLeft;
      initialScroll = wrap.scrollLeft;
    });
    window.addEventListener('mouseup', () => { isDown = false; });
    wrap.addEventListener('mousemove', e => {
      if (!isDown) return;
      const x = e.pageX - wrap.offsetLeft;
      const walk = (x - startX) * 1.5;
      wrap.scrollLeft = initialScroll - walk;
    });
  }
}
