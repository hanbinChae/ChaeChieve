// 공유 가변 상태 — ES 모듈에서는 import한 let 변수를 재할당할 수 없으므로 객체 속성으로 보관한다.
// (원본 index.html 의 전역 let 변수들과 1:1 대응)
export const state = {
  allBooks: [],
  sortKey: 'date',
  sortAsc: false,
  currentPage: 1,
  activeYear: 'all',
  // 랭킹 섹션 연도 피커
  rankingYear: String(new Date().getFullYear()),
  // 타임라인 컬러 모드 상태 ('medium': 매체별, 'genre': 10진 장르별)
  timelineColorMode: 'genre',
  // 선택된 장르 필터 상태 (null 또는 '사회과학', '문학' 등)
  activeTimelineGenre: null,
  // 서재/목록 뷰 ('shelf' | 'table')
  currentBookView: 'shelf',
};

// Chart.js 인스턴스 보관소 (genre-radar / rating / year)
export const charts = {};
