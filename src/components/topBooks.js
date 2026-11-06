// Top Books 랭킹 리스트

import { escHtml } from '../utils.js';

// ── Top Books ─────────────────────────────────────────────────────────────────
export function renderTopBooks(books) {
  const top = [...books].filter(b=>b.rating>0).sort((a,b)=>b.rating-a.rating).slice(0,10);
  document.getElementById('top-books').innerHTML = top.map((b,i) => `
    <li class="top-item">
      <span class="top-rank ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${i+1}</span>
      <div>
        <div class="top-title">${escHtml(b.title)}</div>
        <div class="top-author">${escHtml(b.author)}</div>
      </div>
      <span class="top-rating">★ ${b.rating}</span>
    </li>`).join('');
}
