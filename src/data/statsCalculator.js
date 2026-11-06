// 통계 계산 / 필터링 헬퍼 (완독 도서 필터, 테이블 필터, KPI 기본 지표)

import { state } from '../state.js';

// ── 데이터 헬퍼 ──────────────────────────────────────────────────────────────
export function getCompleted(year = 'all') {
  return state.allBooks.filter(b => b.status === 'O' && (year === 'all' || b.year === year));
}
export function getFiltered() {
  const sf = document.getElementById('filter-status').value;
  const mf = document.getElementById('filter-major').value;
  const ef = document.getElementById('filter-medium').value;
  const q  = document.getElementById('search-input').value.toLowerCase();
  return state.allBooks.filter(b => {
    if (sf && b.status !== sf) return false;
    if (mf && b.major !== mf)  return false;
    if (ef && b.medium !== ef) return false;
    if (state.activeYear !== 'all' && b.year !== state.activeYear) return false;
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false;
    return true;
  });
}

// KPI 앞면 기본 지표 계산 (renderKPI 원본 2337~2341 로직 그대로)
export function computeKpiBasics(books) {
  const totalCount = books.length;
  const ratings = books.map(b => b.rating).filter(r => r > 0);
  const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
  const uniqueAuthors = new Set(books.map(b => b.author).filter(Boolean)).size;
  const uniqueGenres = new Set(books.map(b => b.major).filter(Boolean)).size;
  return { totalCount, ratings, avg, uniqueAuthors, uniqueGenres };
}
