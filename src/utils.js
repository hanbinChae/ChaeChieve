// 공용 순수 유틸리티 (escHtml / starsHtml / parseBookDate / debounce)

export function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function starsHtml(r) {
  if (!r) return '<span style="color:var(--border)">—</span>';
  let s = '<span style="white-space:nowrap">';
  for (let i=1;i<=5;i++) s += `<span class="${i<=Math.round(r)?'star-fill':'star-empty'}">★</span>`;
  s += ` <small style="color:var(--muted)">${r}</small></span>`;
  return s;
}

export function parseBookDate(d) {
  if (!d) return 0;
  const m = String(d).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return 0;
  return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
}

export const debounce = (fn, ms) => { let id; return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); }; };
