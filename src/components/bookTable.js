// 도서 목록 표 / 페이지네이션 / 필터 / 서재·목록 뷰 전환

import { renderBookshelf } from './bookshelf.js';
import { openLibraryCard } from './modals.js';
import { PAGE_SIZE } from '../constants.js';
import { getFiltered } from '../data/statsCalculator.js';
import { state } from '../state.js';
import { escHtml, parseBookDate, starsHtml } from '../utils.js';

// ── 테이블 ────────────────────────────────────────────────────────────────────
const majorBadgeMap = { '사회과학':'teal','철학':'gold','문학':'orange','총류':'muted','자연과학':'olive','기술과학':'olive','종교':'muted','역사':'gold' };

document.addEventListener('DOMContentLoaded', () => {

  // 서재/목록 뷰 토글 스위처 바인딩
  const btnShelf = document.getElementById('btn-view-shelf');
  const btnTable = document.getElementById('btn-view-table');
  if (btnShelf && btnTable) {
    btnShelf.addEventListener('click', () => switchBookView('shelf'));
    btnTable.addEventListener('click', () => switchBookView('table'));
  }
});

function switchBookView(view) {
  state.currentBookView = view;
  const btnShelf = document.getElementById('btn-view-shelf');
  const btnTable = document.getElementById('btn-view-table');
  const shelfWrap = document.getElementById('bookshelf-wrap');
  const tableWrap = document.getElementById('table-wrap-el');

  if (view === 'shelf') {
    if (btnShelf) btnShelf.classList.add('active');
    if (btnTable) btnTable.classList.remove('active');
    if (shelfWrap) shelfWrap.style.display = 'flex';
    if (tableWrap) tableWrap.style.display = 'none';
  } else {
    if (btnTable) btnTable.classList.add('active');
    if (btnShelf) btnShelf.classList.remove('active');
    if (shelfWrap) shelfWrap.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'block';
  }
  renderTable();
}

export function sortTable(key) {
  if (state.sortKey === key) state.sortAsc = !state.sortAsc; else { state.sortKey = key; state.sortAsc = key!=='rating'; }
  ['date','title','rating'].forEach(k => { const el=document.getElementById('sort-'+k); if(el) el.textContent = k===state.sortKey?(state.sortAsc?'↑':'↓'):'↕'; });
  state.currentPage = 1; renderTable();
}

export function renderTable() {
  let data = getFiltered();
  data.sort((a,b)=>{
    if (state.sortKey==='rating') return state.sortAsc ? a.rating-b.rating : b.rating-a.rating;
    if (state.sortKey==='date') {
      const at = parseBookDate(a.date), bt = parseBookDate(b.date);
      if (at !== bt) return state.sortAsc ? at - bt : bt - at;
    }
    const av=String(a[state.sortKey]||''), bv=String(b[state.sortKey]||'');
    return state.sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  const total = data.length;

  // 1. 엔들리스 서재 뷰 렌더링 (보이는 뷰만 그림 — 뷰 전환 시 switchBookView가 다시 호출)
  if (state.currentBookView === 'shelf') renderBookshelf(data);

  // 2. 표 목록 뷰 렌더링 (기존 20권 페이징)
  const totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  const start = (state.currentPage-1)*PAGE_SIZE;
  const page = data.slice(start, start+PAGE_SIZE);

  const pageInfoEl = document.getElementById('page-info');
  const pagEl = document.getElementById('pagination');

  if (state.currentBookView === 'shelf') {
    if (pageInfoEl) pageInfoEl.style.display = 'none';
    if (pagEl) pagEl.style.display = 'none';
  } else {
    if (pageInfoEl) pageInfoEl.style.display = 'block';
    if (pagEl) pagEl.style.display = 'flex';
  }

  if (total === 0) {
    if (pageInfoEl) pageInfoEl.textContent = '';
    const bookTbody = document.getElementById('book-table-body');
    if (bookTbody) {
      bookTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px 0;color:var(--muted);font-size:.85rem;">검색 결과가 없습니다.</td></tr>`;
    }
    if (pagEl) pagEl.innerHTML = '';
    return;
  }

  if (pageInfoEl) pageInfoEl.textContent = `${total}권 중 ${start+1}–${Math.min(start+PAGE_SIZE,total)} 표시`;
  window._memoPage = page;

  const bookTbody = document.getElementById('book-table-body');
  if (bookTbody && state.currentBookView === 'table') {
    bookTbody.innerHTML = page.map((b, i) => {
      const bc  = majorBadgeMap[b.major] || 'muted';
      const med = b.medium === '전자책'
        ? `<span class="badge badge-teal">전자책</span>`
        : `<span class="badge badge-muted">종이책</span>`;
      const hasMemo = b.memo && b.memo.trim();
      const memoCell = hasMemo
        ? `<td style="text-align:center">
             <button class="memo-btn" data-idx="${i}" title="대출증 & 메모 보기"
                     aria-label="${escHtml(b.title)} 대출증 보기">📝</button>
           </td>`
        : `<td></td>`;
      return `<tr>
        <td style="color:var(--muted);white-space:nowrap;font-size:.74rem">${escHtml(b.date)}</td>
        <td><strong style="cursor:pointer;" class="table-book-title" data-idx="${i}">${escHtml(b.title)}</strong></td>
        <td style="color:var(--muted)">${escHtml(b.author)}</td>
        <td><span class="badge badge-${bc}">${escHtml(b.major)}</span></td>
        <td>${med}</td>
        <td>${starsHtml(b.rating)}</td>
        ${memoCell}
      </tr>`;
    }).join('');

    // 테이블 내 버튼 및 제목 클릭 이벤트 바인딩
    bookTbody.querySelectorAll('.memo-btn, .table-book-title').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = window._memoPage[+btn.dataset.idx];
        if (b) openLibraryCard(b);
      });
    });
  }

  if (state.currentBookView === 'table') renderPagination(totalPages);
}

function scrollToTableTop() {
  const tableEl = document.querySelector('.table-wrap');
  if (tableEl) {
    const headerOffset = 80;
    const elementPosition = tableEl.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }
}

function changePage(page) {
  state.currentPage = page;
  renderTable();
  scrollToTableTop();
}

function renderPagination(totalPages) {
  const pag = document.getElementById('pagination');
  pag.innerHTML = '';
  if (totalPages <= 1) return;

  const addBtn = (label, page, active=false, disabled=false, title='') => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    if (title) btn.title = title;
    if (disabled) {
      btn.disabled = true;
    } else {
      btn.onclick = () => changePage(page);
    }
    pag.appendChild(btn);
  };

  const addEllipsis = () => {
    const span = document.createElement('span');
    span.className = 'page-ellipsis';
    span.textContent = '…';
    pag.appendChild(span);
  };

  // 이전/처음 버튼
  addBtn('«', 1, false, state.currentPage === 1, '첫 페이지');
  addBtn('‹', state.currentPage - 1, false, state.currentPage === 1, '이전 페이지');

  // 페이지 번호 리스트 계산
  let pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let start = Math.max(2, state.currentPage - 2);
    let end = Math.min(totalPages - 1, state.currentPage + 2);

    if (state.currentPage <= 3) {
      start = 2;
      end = 5;
    } else if (state.currentPage >= totalPages - 2) {
      start = totalPages - 4;
      end = totalPages - 1;
    }

    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') {
      addEllipsis();
    } else {
      addBtn(p, p, p === state.currentPage);
    }
  });

  // 다음/마지막 버튼
  addBtn('›', state.currentPage + 1, false, state.currentPage === totalPages, '다음 페이지');

  addBtn('»', totalPages, false, state.currentPage === totalPages, '마지막 페이지');
}

export function populateFilters() {
  const ms = document.getElementById('filter-major');
  const es = document.getElementById('filter-medium');
  if (ms.options.length<=1) [...new Set(state.allBooks.map(b=>b.major).filter(Boolean))].sort().forEach(m=>ms.add(new Option(m,m)));
  if (es.options.length<=1) [...new Set(state.allBooks.map(b=>b.medium).filter(Boolean))].sort().forEach(m=>es.add(new Option(m,m)));
}
