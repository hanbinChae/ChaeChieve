// data.json 로딩 / 상태 배지

import { DATA_URL } from '../constants.js';

// ── 데이터 로드 (data.json — GitHub Actions 자동 갱신) ───────────────────────
// 원본 loadData()의 fetch / 캐시 정리 / 검증 부분 (UI 갱신은 main.js의 loadData가 담당)
export async function fetchBookData() {
  // 이전 localStorage 캐시 정리
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('reading_dashboard_cache')) localStorage.removeItem(k);
    });
  } catch(_) {}

  const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error('data.json 로드 실패 (HTTP ' + res.status + ')');
  const json = await res.json();
  if (!Array.isArray(json.books)) throw new Error('데이터 형식 오류');
  return json;
}

export function setStatus(cls, msg) {
  const el = document.getElementById('status-badge');
  el.className = cls;
  document.getElementById('status-text').innerHTML = msg;
}
