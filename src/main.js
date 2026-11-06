// 진입점: 데이터 로드 → 컴포넌트 렌더 → 이벤트 바인딩

import { populateFilters, renderTable, sortTable } from './components/bookTable.js';
import { renderArc } from './components/donutChart.js';
import { renderYearBar } from './components/lineChart.js';
import { renderGenreRadar } from './components/radarChart.js';
import { renderRatingDonut } from './components/ratingChart.js';
import { buildRankingYearFilter, setRankingYear } from './components/ratingCompare.js';
import { renderKPI } from './components/summaryCards.js';
import { bindTimelineToggle, renderTimeline, updateTimelineLegend } from './components/timelineChart.js';
import { fetchBookData, setStatus } from './data/dataFetcher.js';
import { getCompleted } from './data/statsCalculator.js';
import { state } from './state.js';
import { debounce } from './utils.js';
import { initAurora } from './components/auroraHeader.js';
import { renderOnThisDay } from './components/onThisDay.js';

// ── 데이터 로드 (data.json — GitHub Actions 자동 갱신) ───────────────────────
async function loadData() {
  setStatus('loading', '데이터를 불러오는 중…');
  try {
    const json = await fetchBookData();

    state.allBooks = json.books;
    const updatedAt = json.updated_at || '';

    setStatus('ok', `${state.allBooks.filter(b=>b.status==='O').length}권 · 최종 갱신 ${updatedAt} · <a href="#" onclick="event.preventDefault();loadData()" style="color:var(--teal)">새로고침</a>`);
    document.getElementById('loading-overlay').style.display = 'none';
    bindTimelineToggle();
    updateTimelineLegend();
    buildYearFilters(); renderAll();
    renderOnThisDay(); // 연도 필터와 무관 — 최초 로드 시 1회만 렌더
  } catch(e) {
    setStatus('error', '로드 실패: ' + e.message);
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

// ── 연도 필터 ─────────────────────────────────────────────────────────────────
function buildYearFilters() {
  const row = document.querySelector('.year-filter');
  row.querySelectorAll('.ybtn:not([data-year="all"])').forEach(b => b.remove());
  const years = [...new Set(state.allBooks.filter(b=>b.status==='O').map(b=>b.year))].filter(Boolean).sort();
  years.forEach(y => {
    const btn = document.createElement('button');
    btn.className = 'ybtn'; btn.dataset.year = y; btn.textContent = y;
    btn.onclick = () => setYear(y);
    row.appendChild(btn);
  });
}
function setYear(y) {
  state.activeYear = y;
  document.querySelectorAll('.ybtn').forEach(b => b.classList.toggle('active', b.dataset.year === y));
  state.currentPage = 1; renderAll();
}
document.querySelector('.ybtn[data-year="all"]').onclick = () => setYear('all');

// ── 전체 렌더 ─────────────────────────────────────────────────────────────────
function renderAll() {
  const books = getCompleted(state.activeYear);
  renderKPI(books);
  renderTimeline(books);
  renderArc(books);
  renderGenreRadar(books);
  renderRatingDonut(books);
  renderYearBar();
  buildRankingYearFilter();
  renderTable();
  populateFilters();
}

// ── 이벤트 ────────────────────────────────────────────────────────────────────

document.getElementById('search-input').addEventListener('input',  debounce(()=>{state.currentPage=1;renderTable();}, 150));
document.getElementById('filter-major').addEventListener('change', ()=>{state.currentPage=1;renderTable();});
document.getElementById('filter-medium').addEventListener('change',()=>{state.currentPage=1;renderTable();});
document.getElementById('filter-status').addEventListener('change',()=>{state.currentPage=1;renderAll();});
window.addEventListener('resize', debounce(()=>{ const b=getCompleted(state.activeYear); renderTimeline(b); renderArc(b); }, 200));

// ── 시작 ──────────────────────────────────────────────────────────────────────
// 마크업의 인라인 onclick(sortTable / loadData / setRankingYear) 호환을 위해 전역 노출
window.sortTable = sortTable;
window.loadData = loadData;
window.setRankingYear = setRankingYear;

loadData();

// Aurora 헤더 배경
initAurora();
