// 이날의 책 (On This Day) — 접속한 날짜와 같은 월/일에 과거 완독한 책을 보여주는 일력 카드
//  · 모드 토글: 'recent'(기본, 가장 최근 완독서) / 'otd'(이날의 책)
//  · 정확히 같은 날 → 없으면 ±3일 → 없으면 ±14일 순으로 fallback
//  · 연도 스크러버(드래그/클릭) · 일 단위 이동(◀ ▶, ←/→, 날짜 선택) · 메모 타이핑 연출
//  · 연도 필터(state.activeYear)와 무관하게 전체 완독 데이터를 사용한다.

import { MAJOR_COLORS } from '../constants.js';
import { state } from '../state.js';
import { escHtml } from '../utils.js';
import { openLibraryCard } from './modals.js';

const NEAR_DAYS = 3;
const WIDE_DAYS = 14;
const DAY_MS = 86400000;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

const pad = n => String(n).padStart(2, '0');
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let root = null;
let bound = false;
let mode = 'recent';         // 'recent' | 'otd'
let recentBooks = [];        // 가장 최근 완독일의 책들 (같은 날 여러 권 가능)
let records = [];            // { book, y, m, d, ts }
let thisYear = 0;
let today = { m: 1, d: 1 };
let cur = { m: 1, d: 1 };    // 현재 보고 있는 월/일
let entries = [];            // [{ year, minAbs, books: [{...record, diff}] }]
let selYear = null;
let selIdx = 0;
let typeTimer = null;
let dragging = false;

// ── 데이터 ───────────────────────────────────────────────────────────────────
function buildRecords() {
  records = [];
  for (const book of state.allBooks) {
    if (book.status !== 'O') continue;
    const m = String(book.date || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!m) continue;
    const y = +m[1], mo = +m[2], d = +m[3];
    records.push({ book, y, m: mo, d, ts: new Date(y, mo - 1, d).getTime() });
  }
  const latest = records.reduce((mx, r) => Math.max(mx, r.ts), 0);
  recentBooks = records.filter(r => r.ts === latest);
}

// 현재 모드에서 보여줄 책 목록 (페이저 대상)
function currentList() {
  if (mode === 'recent') return recentBooks;
  const en = entries.find(e => e.year === selYear);
  return en ? en.books : [];
}

// 책 완독일과 (m, d) 사이의 일수 차이. 연말/연초 경계를 위해 전·당·후년 기준 중 가장 가까운 값 사용.
function dayDiff(r, m, d) {
  const t = Date.UTC(r.y, r.m - 1, r.d);
  let best = Infinity;
  for (const k of [-1, 0, 1]) {
    const diff = Math.round((t - Date.UTC(r.y + k, m - 1, d)) / DAY_MS);
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

// 연도별로 (m, d)에서 win일 이내 책을 모은다. 연도 안에서는 가장 가까운 날짜의 책만 남긴다.
function compute(m, d, win) {
  const byYear = new Map();
  for (const r of records) {
    if (r.y >= thisYear) continue;
    const diff = dayDiff(r, m, d);
    if (Math.abs(diff) > win) continue;
    if (!byYear.has(r.y)) byYear.set(r.y, []);
    byYear.get(r.y).push({ ...r, diff });
  }
  return [...byYear].map(([year, arr]) => {
    const minAbs = Math.min(...arr.map(x => Math.abs(x.diff)));
    const books = arr.filter(x => Math.abs(x.diff) === minAbs).sort((a, b) => a.ts - b.ts);
    return { year, minAbs, books };
  }).sort((a, b) => a.year - b.year);
}

function findNearestRecordedDay() {
  for (let k = 1; k <= 183; k++) {
    for (const s of [k, -k]) {
      const dt = new Date(2000, cur.m - 1, cur.d + s);
      if (compute(dt.getMonth() + 1, dt.getDate(), 0).length) return { m: dt.getMonth() + 1, d: dt.getDate() };
    }
  }
  return null;
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────
const $ = sel => root.querySelector(sel);
const isToday = () => cur.m === today.m && cur.d === today.d;
const fmtDate = r => `${r.y}. ${pad(r.m)}. ${pad(r.d)}`;
const hasMemo = b => !!(b.memo && b.memo.trim() && b.memo.trim() !== '-');

function retrigger(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function typeText(el, text) {
  clearTimeout(typeTimer);
  if (reduceMotion()) { el.textContent = text; return; }
  const chars = [...text];
  const step = Math.max(1, Math.ceil(chars.length / 70));
  let i = 0;
  el.textContent = '';
  el.classList.add('typing');
  const tick = () => {
    i = Math.min(chars.length, i + step);
    el.textContent = chars.slice(0, i).join('');
    if (i < chars.length) typeTimer = setTimeout(tick, 34);
    else el.classList.remove('typing');
  };
  typeTimer = setTimeout(tick, 380);
}

function starsMarkup(rating) {
  if (!rating) return '<span class="otd-nostar">평점 없음</span>';
  let s = '';
  for (let i = 0; i < 5; i++) {
    const pct = Math.round(Math.min(1, Math.max(0, rating - i)) * 100);
    s += `<span class="otd-star" style="--p:${pct}%;--i:${i}">★</span>`;
  }
  return `<span class="otd-stars" aria-label="평점 ${rating}">${s}</span><small class="otd-score">${rating.toFixed(1)}</small>`;
}

// ── 렌더: 뼈대 ───────────────────────────────────────────────────────────────
function renderShell() {
  root.innerHTML = `
    <div class="otd-card" tabindex="0" data-mode="${mode}" aria-label="독서 기록 카드 — 이날의 책 모드에서는 좌우 방향키로 날짜 이동">
      <aside class="otd-cal">
        <div class="otd-cal-rings" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="otd-cal-sheet" id="otd-sheet">
          <div class="otd-cal-month" id="otd-month"></div>
          <div class="otd-cal-day" id="otd-day"></div>
          <div class="otd-cal-week" id="otd-week"></div>
        </div>
        <div class="otd-cal-nav">
          <button type="button" class="otd-nav-btn" data-act="prev" aria-label="하루 전">◀</button>
          <input type="date" class="otd-date" id="otd-date" aria-label="날짜 선택">
          <button type="button" class="otd-nav-btn" data-act="next" aria-label="하루 후">▶</button>
        </div>
        <button type="button" class="otd-today-btn" data-act="today" id="otd-today-btn">오늘로 돌아가기</button>
        <div class="otd-cal-foot" id="otd-foot"></div>
      </aside>
      <div class="otd-main">
        <div class="otd-main-body" id="otd-main-body"></div>
        <div class="otd-rail-wrap" id="otd-rail-wrap"></div>
      </div>
    </div>`;
}

// ── 렌더: 일력 ───────────────────────────────────────────────────────────────
function renderCalendar() {
  if (mode === 'recent') {
    const r = recentBooks[selIdx] || recentBooks[0];
    $('#otd-month').textContent = MONTHS[r.m - 1];
    $('#otd-day').textContent = pad(r.d);
    $('#otd-week').textContent = `${WEEK[new Date(r.y, r.m - 1, r.d).getDay()]}요일`;
    $('#otd-foot').textContent = `${r.y}년 · 가장 최근 완독`;
    retrigger($('#otd-sheet'), 'flip');
    return;
  }
  $('#otd-month').textContent = MONTHS[cur.m - 1];
  $('#otd-day').textContent = pad(cur.d);
  const dt = new Date(thisYear, cur.m - 1, cur.d);
  const valid = dt.getMonth() === cur.m - 1;           // 2/29 가 평년이면 무효
  $('#otd-week').textContent = valid ? `${WEEK[dt.getDay()]}요일` : '윤일';
  const inp = $('#otd-date');
  inp.min = `${thisYear}-01-01`;
  inp.max = `${thisYear}-12-31`;
  inp.value = `${thisYear}-${pad(cur.m)}-${pad(valid ? cur.d : 28)}`;
  $('#otd-today-btn').classList.toggle('is-hidden', isToday());
  const total = entries.reduce((n, e) => n + e.books.length, 0);
  $('#otd-foot').textContent = total ? `${total}권의 기억이 잠들어 있어요` : '아직 기록이 없는 날';
  retrigger($('#otd-sheet'), 'flip');
}

// ── 렌더: 본문 ───────────────────────────────────────────────────────────────
function renderMain() {
  clearTimeout(typeTimer);
  const body = $('#otd-main-body');

  if (mode === 'otd' && !entries.length) {
    const near = findNearestRecordedDay();
    body.innerHTML = `
      <div class="otd-empty">
        <p class="otd-kicker">이 날 즈음의 기록은 아직 없어요</p>
        <p class="otd-empty-sub">앞뒤 2주 안에 완독한 책이 없습니다.<br>오늘의 한 권이 내년의 “이날의 책”이 될지도 몰라요.</p>
        ${near ? `<button type="button" class="otd-jump" data-act="jump" data-m="${near.m}" data-d="${near.d}">기록이 있는 가장 가까운 날로 (${near.m}월 ${near.d}일)</button>` : ''}
      </div>`;
    return;
  }

  const list = currentList();
  const r = list[selIdx];
  const b = r.book;
  const color = MAJOR_COLORS[b.major] || '#4a7c6f';
  let kicker, note = '', badge = '';
  if (mode === 'recent') {
    const days = Math.max(0, Math.round((new Date(thisYear, today.m - 1, today.d).getTime() - r.ts) / DAY_MS));
    kicker = `<b class="otd-ago">${days === 0 ? '오늘' : `${days}일 전`}</b> ${days === 0 ? '이 책을 완독했어요' : '마지막으로 완독한 책이에요'}`;
  } else {
    const ago = thisYear - r.y;
    const exact = r.diff === 0;
    const when = exact ? (isToday() ? '오늘' : `${cur.m}월 ${cur.d}일`) : '이맘때';
    kicker = `<b class="otd-ago">${ago}년 전</b> ${when} 이 책을 읽었어요`;
    note = exact ? '' : `<span class="otd-note">${Math.abs(r.diff)}일 ${r.diff < 0 ? '전' : '후'} · ${fmtDate(r)} 완독</span>`;
    const sameDayYears = entries.filter(e => e.minAbs === 0).length;
    badge = sameDayYears >= 2 ? `<span class="otd-badge">${sameDayYears}년째 같은 날, 책과 함께했어요</span>` : '';
  }
  const t = b.title || '제목 없음';
  const titleSize = t.length > 22 ? '.8rem' : t.length > 12 ? '.92rem' : '1.08rem';
  const meta = [b.major, b.medium].filter(Boolean).map(escHtml).join(' · ');
  const isEbook = b.medium === '전자책';
  const pager = list.length > 1
    ? `<div class="otd-pager"><button type="button" data-act="bprev" aria-label="이전 책">‹</button><span>${selIdx + 1} / ${list.length}</span><button type="button" data-act="bnext" aria-label="다음 책">›</button></div>`
    : '';

  body.innerHTML = `
    <div class="otd-kicker-row">
      <p class="otd-kicker">${kicker}</p>
      ${note}${badge}
    </div>
    <div class="otd-stage">
      <button type="button" class="otd-cover${isEbook ? ' is-ebook' : ''}" data-act="open" style="--c:${color};--ts:${titleSize}" aria-label="${escHtml(t)} 도서 정보 열기">
        ${isEbook ? '' : '<span class="otd-cover-spine"></span>'}
        <span class="otd-cover-face">
          <span class="otd-cover-title">${escHtml(t)}</span>
          <span class="otd-cover-author">${escHtml(b.author || '')}</span>
          <span class="otd-cover-mark">CHAECHIEVE</span>
        </span>
      </button>
      <div class="otd-info">
        <h3 class="otd-title">${escHtml(t)}</h3>
        <div class="otd-author">${escHtml(b.author || '작자 미상')}${meta ? ` <span class="otd-meta">· ${meta}</span>` : ''}</div>
        <div class="otd-rating">${starsMarkup(b.rating)}</div>
        <blockquote class="otd-memo${hasMemo(b) ? '' : ' empty'}" id="otd-memo"><span class="otd-memo-text"></span></blockquote>
        <div class="otd-info-foot">
          <div class="otd-stamp"><span>READ ON</span><b>${fmtDate(r)}</b></div>
          <div class="otd-actions">
            ${pager}
            <button type="button" class="otd-open" data-act="open">도서 정보 열기</button>
          </div>
        </div>
      </div>
    </div>`;

  retrigger(body.querySelector('.otd-stage'), 'enter');
  const memoBox = $('#otd-memo');
  const memoEl = memoBox.querySelector('.otd-memo-text');
  if (hasMemo(b)) {
    const full = `“${b.memo.trim()}”`;
    memoBox.title = full;               // 말줄임 처리된 경우 전체 내용 확인용
    typeText(memoEl, full);
  } else {
    memoEl.textContent = '“기록된 메모가 없습니다.”';
  }
}

// ── 렌더: 연도 스크러버 ──────────────────────────────────────────────────────
function railYears() {
  const minY = Math.min(...records.map(r => r.y));
  const years = [];
  for (let y = minY; y <= thisYear; y++) years.push(y);
  return years;
}

function renderRail() {
  const wrap = $('#otd-rail-wrap');
  const years = railYears();
  const n = years.length;
  const has = new Map(entries.map(e => [e.year, e]));
  const pts = years.map((y, i) => {
    const left = n > 1 ? (i / (n - 1)) * 100 : 50;
    if (y === thisYear) {
      return `<span class="otd-pt now" style="left:${left}%"><i></i><span>올해</span></span>`;
    }
    const en = has.get(y);
    const cnt = en ? `<em>${en.books.length}</em>` : '';
    return `<button type="button" class="otd-pt${en ? ' has' : ''}" style="left:${left}%" data-act="year" data-year="${y}" ${en ? '' : 'disabled'} aria-label="${y}년${en ? ` (${en.books.length}권)` : ' (기록 없음)'}"><i></i><span>${y}</span>${cnt}</button>`;
  }).join('');
  wrap.innerHTML = `<div class="otd-rail" id="otd-rail"><div class="otd-rail-line"></div>${pts}<div class="otd-thumb" id="otd-thumb"></div></div>`;
  syncRail(false);
}

function syncRail(animate = true) {
  const rail = $('#otd-rail');
  if (!rail) return;
  const years = railYears();
  const n = years.length;
  const thumb = $('#otd-thumb');
  const i = years.indexOf(selYear);
  thumb.classList.toggle('is-hidden', i < 0 || !entries.length);
  thumb.style.transition = animate && !reduceMotion() ? '' : 'none';
  thumb.style.left = `${n > 1 ? (i / (n - 1)) * 100 : 50}%`;
  rail.querySelectorAll('.otd-pt[data-year]').forEach(p => p.classList.toggle('on', +p.dataset.year === selYear));
}

// ── 상태 변경 ────────────────────────────────────────────────────────────────
function setDate(m, d) {
  cur = { m, d };
  entries = compute(m, d, NEAR_DAYS);
  if (!entries.length) entries = compute(m, d, WIDE_DAYS);
  const def = [...entries].sort((a, b) => a.minAbs - b.minAbs || b.year - a.year)[0];
  selYear = def ? def.year : null;
  selIdx = 0;
  renderCalendar();
  renderMain();
  renderRail();
}

function shiftDay(n) {
  const dt = new Date(2000, cur.m - 1, cur.d + n);   // 윤년 기준으로 이동해야 2/29 가 포함된다
  setDate(dt.getMonth() + 1, dt.getDate());
}

function selectYear(y) {
  if (y === selYear || !entries.some(e => e.year === y)) return;
  selYear = y;
  selIdx = 0;
  renderMain();
  syncRail();
}

function shiftBook(n) {
  const list = currentList();
  if (list.length < 2) return;
  selIdx = (selIdx + n + list.length) % list.length;
  renderMain();
}

// 'recent' ↔ 'otd' 전환. 이날의 책은 항상 오늘 날짜에서 시작한다.
function setMode(next) {
  if (next === mode) return;
  mode = next;
  selIdx = 0;
  $('.otd-card').dataset.mode = mode;
  syncToggle();
  if (mode === 'otd') {
    setDate(today.m, today.d);
  } else {
    renderCalendar();
    renderMain();
  }
}

function syncToggle() {
  document.querySelectorAll('#onthisday-section .otd-toggle-btn').forEach(btn => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on);
  });
  const title = document.getElementById('otd-section-title');
  if (title) title.textContent = mode === 'recent' ? 'Latest Read' : 'On This Day';
}

function pickFromPointer(clientX) {
  const rail = $('#otd-rail');
  if (!rail || !entries.length) return;
  const rect = rail.getBoundingClientRect();
  const years = railYears();
  const n = years.length;
  const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  let best = null, bestDist = Infinity;
  years.forEach((y, i) => {
    if (!entries.some(e => e.year === y)) return;
    const dist = Math.abs((n > 1 ? i / (n - 1) : 0.5) - frac);
    if (dist < bestDist) { bestDist = dist; best = y; }
  });
  if (best != null) selectYear(best);
}

// ── 이벤트 ───────────────────────────────────────────────────────────────────
function bindEvents() {
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    switch (t.dataset.act) {
      case 'prev': shiftDay(-1); break;
      case 'next': shiftDay(1); break;
      case 'today': setDate(today.m, today.d); break;
      case 'jump': setDate(+t.dataset.m, +t.dataset.d); break;
      case 'year': selectYear(+t.dataset.year); break;
      case 'bprev': shiftBook(-1); break;
      case 'bnext': shiftBook(1); break;
      case 'open': {
        const r = currentList()[selIdx];
        if (r) openLibraryCard(r.book);
        break;
      }
    }
  });

  root.addEventListener('change', e => {
    if (e.target.id !== 'otd-date' || !e.target.value) return;
    const [, m, d] = e.target.value.split('-').map(Number);
    setDate(m, d);
  });

  root.addEventListener('keydown', e => {
    if (mode !== 'otd') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); shiftDay(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); shiftDay(1); }
  });

  // 모드 토글 (루트 바깥, 섹션 헤더에 위치)
  document.querySelector('#onthisday-section .otd-toggle')?.addEventListener('click', e => {
    const btn = e.target.closest('.otd-toggle-btn');
    if (btn) setMode(btn.dataset.mode);
  });

  // 연도 스크러버 드래그
  root.addEventListener('pointerdown', e => {
    const rail = e.target.closest('.otd-rail');
    if (!rail) return;
    dragging = true;
    rail.setPointerCapture?.(e.pointerId);
    pickFromPointer(e.clientX);
  });
  root.addEventListener('pointermove', e => { if (dragging) pickFromPointer(e.clientX); });
  const stop = () => { dragging = false; };
  root.addEventListener('pointerup', stop);
  root.addEventListener('pointercancel', stop);
}

// ── 진입점 ───────────────────────────────────────────────────────────────────
export function renderOnThisDay() {
  root = document.getElementById('onthisday-root');
  const section = document.getElementById('onthisday-section');
  if (!root || !section) return;

  const now = new Date();
  thisYear = now.getFullYear();
  today = { m: now.getMonth() + 1, d: now.getDate() };
  buildRecords();

  // 완독 기록이 하나도 없으면 섹션 자체를 숨긴다
  if (!records.length) { section.style.display = 'none'; return; }
  section.style.display = '';

  renderShell();
  if (!bound) { bindEvents(); bound = true; }
  syncToggle();
  selIdx = 0;
  if (mode === 'otd') {
    setDate(today.m, today.d);
  } else {
    entries = [];
    renderCalendar();
    renderMain();
  }
}
