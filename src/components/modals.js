// 도서관 대출증 모달 / 메모 모달

import { state } from '../state.js';

// ── 도서관 대출증 모달 (Library Checkout Slip) ──────────────────────────────
export function openLibraryCard(b) {
  if (!b) return;
  document.getElementById('lib-title').textContent = b.title ? `『${b.title}』` : '—';
  document.getElementById('lib-author').textContent = b.author ? `${b.author} 저` : '작자 미상';
  document.getElementById('lib-medium').textContent = b.medium || '종이책';
  document.getElementById('lib-rating').textContent = b.rating ? `★ ${b.rating.toFixed(1)}` : '평점 없음';
  document.getElementById('lib-date').textContent = b.date || '—';
  document.getElementById('lib-kdc').textContent = `KDC ${b.decimal || ''} · ${b.major || '기타'}`;
  
  const memoEl = document.getElementById('lib-memo');
  if (b.memo && b.memo.trim()) {
    memoEl.textContent = `“${b.memo.trim()}”`;
    memoEl.className = 'lib-memo-body';
  } else {
    memoEl.textContent = '“기록된 독서 메모가 없습니다.”';
    memoEl.className = 'lib-memo-body lib-memo-empty';
  }

  const pathParts = [b.major, b.subMajor, b.minor].filter(Boolean);
  document.getElementById('lib-kdc-path').textContent = pathParts.length ? pathParts.join(' > ') : 'CHAECHIEVE ARCHIVE';

  document.getElementById('library-slip-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLibraryCard() {
  document.getElementById('library-slip-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// ── 메모 모달 (호환) ─────────────────────────────────────────────────────────
export function openMemo(title, author, memo) {
  const b = state.allBooks.find(item => item.title === title && item.author === author) || { title, author, memo };
  openLibraryCard(b);
}
function closeMemo() {
  closeLibraryCard();
  document.getElementById('memo-modal').classList.remove('open');
  document.body.style.overflow = '';
}

// 모달 이벤트 바인딩
document.addEventListener('DOMContentLoaded', () => {
  const libClose = document.getElementById('lib-close-btn');
  const libModal = document.getElementById('library-slip-modal');
  if (libClose) libClose.addEventListener('click', closeLibraryCard);
  if (libModal) {
    libModal.addEventListener('click', e => {
      if (e.target === libModal) closeLibraryCard();
    });
  }

  const memoClose = document.getElementById('memo-close-btn');
  const memoModal = document.getElementById('memo-modal');
  if (memoClose) memoClose.addEventListener('click', closeMemo);
  if (memoModal) {
    memoModal.addEventListener('click', e => {
      if (e.target === memoModal) closeMemo();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeLibraryCard();
      closeMemo();
    }
  });

});
