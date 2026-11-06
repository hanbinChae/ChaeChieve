// 앱 전역 상수 (설정 / 색상 팔레트 / 페이지 크기)

// ── 설정 ──────────────────────────────────────────────────────────────────────
export const DATA_URL  = './data.json';   // GitHub Actions 자동 갱신 (hanbinChae/ChaeChieve)

export const PAGE_SIZE = 20;

// ── 색상 팔레트 ───────────────────────────────────────────────────────────────
export const TEAL   = '#4a7c6f';
export const ORANGE = '#c8693a';
export const GOLD   = '#b8962e';
const OLIVE  = '#7a8c4e';
export const MUTED  = '#7a6e5f';
const PALETTE = [TEAL, ORANGE, GOLD, OLIVE, '#8b6914', '#5d8a9e', '#9e6b5d', '#6b7c4a'];

// 10진 분류별 주류 고유 색상 매핑
export const MAJOR_COLORS = {
  '사회과학': '#4a7c6f', '철학': '#b8962e', '문학': '#c8693a',
  '총류': '#7a8c4e', '자연과학': '#5d8a9e', '기술과학': '#8b6e4a',
  '종교': '#9e7a5d', '역사': '#6b7c9e', '예술': '#8e6b9e', '언어': '#6b9e8e'
};
