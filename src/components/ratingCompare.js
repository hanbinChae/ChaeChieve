// 랭킹 연도 피커 + My Best & Worst (Diverging Bar / Inspector)

import { openMemo } from './modals.js';
import { renderTopBooks } from './topBooks.js';
import { getCompleted } from '../data/statsCalculator.js';
import { state } from '../state.js';
import { escHtml } from '../utils.js';

// ── 랭킹 연도 피커 빌드 & 렌더 ────────────────────────────────────────────────

export function buildRankingYearFilter() {
  const row = document.getElementById('ranking-year-filter');
  if (!row) return;

  // 사용 가능한 연도 목록 (완독 기준)
  const years = [...new Set(
    state.allBooks.filter(b => b.status === 'O').map(b => b.year)
  )].filter(Boolean).sort();

  // 현재 rankingYear 가 목록에 없으면 가장 최근 연도로 초기화
  if (!years.includes(state.rankingYear)) state.rankingYear = years[years.length - 1] || state.rankingYear;

  row.innerHTML =
    `<span class="flabel">Ranking Year</span>` +
    years.map(y =>
      `<button class="ybtn${y === state.rankingYear ? ' active' : ''}"
               onclick="setRankingYear('${y}')">${y}</button>`
    ).join('');

  renderRankingSections();
}

export function setRankingYear(y) {
  state.rankingYear = y;
  document.querySelectorAll('#ranking-year-filter .ybtn')
    .forEach(b => b.classList.toggle('active', b.textContent === y));
  renderRankingSections();
}

function renderRankingSections() {
  const books = getCompleted(state.rankingYear);
  document.getElementById('best-worst-title').textContent  = `${state.rankingYear} My Best and Worst Books`;
  document.getElementById('best-books-title').textContent  = `${state.rankingYear} Hanbin's Books Ranking`;
  renderRatingCompare(books);
  renderTopBooks(books);
}

// ── 평점 vs 평균 비교 ─────────────────────────────────────────────────────────
function renderRatingCompare(books) {
  const rated = books.filter(b => b.rating > 0);
  if (!rated.length) { document.getElementById('rating-compare').innerHTML = ''; return; }

  const avg = rated.reduce((s, b) => s + b.rating, 0) / rated.length;

  // 편차 기준 정렬 후 Top 5 + Bottom 5 추출
  const byDiff = [...rated].sort((a, b) => (b.rating - avg) - (a.rating - avg));
  const top5   = byDiff.slice(0, 5);                 // 편차 큰 순 (Best)
  const bot5   = byDiff.slice(-5);                   // 편차 작은 순 (Worst, 가장 싫어한 것이 위)
  const items  = [...top5, ...bot5];

  const maxDiff = Math.max(...items.map(b => Math.abs(b.rating - avg)), 0.1);

  // 툴팁 엘리먼트 (없으면 생성)
  let tip = document.getElementById('dv-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'dv-tip';
    document.body.appendChild(tip);
  }

  // inspector 엘리먼트 참조
  const hintLayer   = document.querySelector('.insp-hint-layer');
  const detailLayer = document.querySelector('.insp-detail');
  const elTitle       = document.getElementById('insp-title');
  const elAuthor      = document.getElementById('insp-author');
  const elDate        = document.getElementById('insp-date');
  const elAvg         = document.getElementById('insp-avg');
  const elMine        = document.getElementById('insp-mine');
  const elDiff        = document.getElementById('insp-diff');
  const elMemoPreview = document.getElementById('insp-memo-preview');

  function inspShow(b, diff, sign, pos) {
    elTitle.textContent  = b.title;
    elAuthor.textContent = b.author || '';
    elDate.textContent   = b.date ? `완독 ${b.date}` : '';
    elAvg.textContent    = `평균 ${avg.toFixed(1)}점`;
    elMine.textContent   = `내 평점 ${b.rating}점`;
    elMine.className     = `insp-mine ${pos ? 'pos' : 'neg'}`;
    elDiff.textContent   = `${sign}${diff.toFixed(1)}점`;
    elDiff.className     = `insp-diff ${pos ? 'pos' : 'neg'}`;

    // 메모 미리보기 — 첫 2줄 + 클릭 시 전체 모달
    const memo = b.memo ? b.memo.trim() : '';
    if (memo) {
      // 첫 줄만 미리보기 텍스트로 (CSS line-clamp가 2줄로 자름)
      elMemoPreview.textContent = memo;
      elMemoPreview.className   = 'insp-memo-preview';
      elMemoPreview.title       = '클릭하여 전체 메모 보기';
      elMemoPreview.onclick     = () => openMemo(b.title, b.author, memo);
      elMemoPreview.style.pointerEvents = 'all';
    } else {
      elMemoPreview.textContent = '메모 없음';
      elMemoPreview.className   = 'insp-memo-preview empty';
      elMemoPreview.onclick     = null;
      elMemoPreview.style.pointerEvents = 'none';
    }

    hintLayer.style.opacity        = '0';
    detailLayer.style.opacity      = '1';
    detailLayer.style.pointerEvents = 'all';   // 메모 클릭 활성화
  }

  function inspReset() {
    hintLayer.style.opacity        = '1';
    detailLayer.style.opacity      = '0';
    detailLayer.style.pointerEvents = 'none';
    tip.style.display = 'none';
  }

  const list = document.getElementById('rating-compare');
  list.innerHTML = items.map(b => {
    const diff  = b.rating - avg;
    const pct   = (Math.abs(diff) / maxDiff * 45).toFixed(1); // 최대 45% (셀 너비의 90%)
    const pos   = diff >= 0;
    const sign  = pos ? '+' : '';

    // inspector용 data 속성
    const insp = encodeURIComponent(JSON.stringify({
      title: b.title, author: b.author || '',
      date: b.date || '', memo: b.memo || '',
      rating: b.rating, diff: diff.toFixed(2), pos
    }));

    if (pos) {
      return `<li class="dv-item" data-insp="${insp}">
        <div class="dv-left">
          <span class="dv-title" title="${escHtml(b.title)}">${escHtml(b.title)}</span>
        </div>
        <div class="dv-right">
          <div class="dv-bar pos" style="--dv-w:${pct}%"></div>
          <span class="dv-val pos">${sign}${diff.toFixed(1)}</span>
        </div>
      </li>`;
    } else {
      return `<li class="dv-item" data-insp="${insp}">
        <div class="dv-left neg-cell">
          <div class="dv-bar neg" style="--dv-w:${pct}%"></div>
          <span class="dv-val neg">${sign}${diff.toFixed(1)}</span>
        </div>
        <div class="dv-right">
          <span class="dv-title" title="${escHtml(b.title)}">${escHtml(b.title)}</span>
        </div>
      </li>`;
    }
  }).join('');

  // ── 고정(lock) 상태 ──
  let lockedLi = null;

  function lockItem(li) {
    // 이전 고정 해제
    if (lockedLi) lockedLi.classList.remove('locked');
    // 같은 항목 재클릭 시 잠금 해제
    if (lockedLi === li) { lockedLi = null; inspReset(); return; }
    lockedLi = li;
    li.classList.add('locked');
    const d = JSON.parse(decodeURIComponent(li.dataset.insp || '{}'));
    if (d.title) inspShow(d, parseFloat(d.diff), parseFloat(d.diff) >= 0 ? '+' : '', d.pos);
  }

  list.querySelectorAll('.dv-item').forEach(li => {
    // 클릭 → 고정
    li.addEventListener('click', () => lockItem(li));

    // hover → 고정 없을 때만 미리보기
    li.addEventListener('mouseenter', () => {
      if (lockedLi) return;
      const d = JSON.parse(decodeURIComponent(li.dataset.insp || '{}'));
      if (d.title) inspShow(d, parseFloat(d.diff), parseFloat(d.diff) >= 0 ? '+' : '', d.pos);
    });
    li.addEventListener('mouseleave', () => {
      if (lockedLi) return;   // 고정 상태면 mouseleave 무시
      inspReset();
    });
  });

  // 목록 바깥 클릭 시 고정 해제 (재렌더 시 이전 리스너 해제)
  if (window._dvDocClick) document.removeEventListener('click', window._dvDocClick, { capture: true });
  window._dvDocClick = e => {
    if (lockedLi && !list.contains(e.target) && !document.getElementById('memo-modal').contains(e.target)) {
      lockedLi.classList.remove('locked');
      lockedLi = null;
      inspReset();
    }
  };
  document.addEventListener('click', window._dvDocClick, { capture: true });

  // 초기 상태 보장
  inspReset();
}
