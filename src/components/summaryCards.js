// 요약 카드 (KPI 앞면 통계 + 뒷면 호버 인사이트)

import { computeKpiBasics } from '../data/statsCalculator.js';

// ── KPI (앞면 통계 및 뒷면 인사이트 렌더링) ──────────────────────────────────
export function renderKPI(books) {
  const { totalCount, ratings, avg, uniqueAuthors, uniqueGenres } = computeKpiBasics(books);

  // 앞면 기본 지표
  const elTotal = document.getElementById('kpi-total');
  const elAuthors = document.getElementById('kpi-authors');
  const elGenres = document.getElementById('kpi-genres');
  const elAvg = document.getElementById('kpi-avg');

  if (elTotal) elTotal.textContent = totalCount || '0';
  if (elAuthors) elAuthors.textContent = uniqueAuthors || '0';
  if (elGenres) elGenres.textContent = uniqueGenres || '0';
  if (elAvg) elAvg.textContent = avg ? avg.toFixed(2) : '—';

  // ── [1. BOOKS READ 인사이트] ──
  const backBooks = document.getElementById('kpi-back-books');
  if (backBooks) {
    if (!totalCount) {
      backBooks.innerHTML = `<div class="insight-empty">데이터 없음</div>`;
    } else {
      // 최고의 달 (월별 카운트)
      const monthCount = {};
      books.forEach(b => {
        if (!b.date) return;
        const m = b.date.match(/\D+(\d{1,2})\D+/);
        if (m) {
          const monthKey = `${parseInt(m[1], 10)}월`;
          monthCount[monthKey] = (monthCount[monthKey] || 0) + 1;
        }
      });
      const topMonthEntry = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0];
      const bestMonthText = topMonthEntry ? `${topMonthEntry[0]} (${topMonthEntry[1]}권)` : '—';

      // 매체 선호도
      const paperCount = books.filter(b => b.medium === '종이책').length;
      const ebookCount = books.filter(b => b.medium === '전자책').length;
      const mediumText = `종이 ${paperCount} · 전자 ${ebookCount}`;

      backBooks.innerHTML = `
        <div class="insight-row">
          <span class="insight-label">최대 독서</span>
          <span class="insight-divider">|</span>
          <span class="insight-val">${bestMonthText}</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">매체 분포</span>
          <span class="insight-divider">|</span>
          <span class="insight-val">${mediumText}</span>
        </div>
      `;
    }
  }

  // ── [2. AUTHORS 인사이트] ──
  const backAuthors = document.getElementById('kpi-back-authors');
  if (backAuthors) {
    if (!totalCount) {
      backAuthors.innerHTML = `<div class="insight-empty">데이터 없음</div>`;
    } else {
      const authorCounts = {};
      books.forEach(b => {
        const a = (b.author || '').trim();
        if (a) authorCounts[a] = (authorCounts[a] || 0) + 1;
      });

      const authorEntries = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
      const topAuthor = authorEntries[0];
      const topAuthorText = topAuthor ? `${topAuthor[0]} (${topAuthor[1]}권)` : '—';
      const loyalCount = authorEntries.filter(e => e[1] >= 2).length;

      backAuthors.innerHTML = `
        <div class="insight-row">
          <span class="insight-label">최다 등장</span>
          <span class="insight-divider">|</span>
          <span class="insight-val" title="${topAuthor ? topAuthor[0] : ''}">${topAuthorText}</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">다독 작가군</span>
          <span class="insight-divider">|</span>
          <span class="insight-val">${loyalCount}명 (${Math.round((loyalCount / (authorEntries.length || 1)) * 100)}%)</span>
        </div>
      `;
    }
  }

  // ── [3. GENRES 인사이트] ──
  const backGenres = document.getElementById('kpi-back-genres');
  if (backGenres) {
    if (!totalCount) {
      backGenres.innerHTML = `<div class="insight-empty">데이터 없음</div>`;
    } else {
      const genreCounts = {};
      books.forEach(b => {
        const g = (b.major || '').trim();
        if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
      });

      const genreEntries = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
      const g1 = genreEntries[0];
      const g2 = genreEntries[1];

      const g1Text = g1 ? `${g1[0]} (${Math.round((g1[1] / totalCount) * 100)}%)` : '—';
      const g2Text = g2 ? `${g2[0]} (${Math.round((g2[1] / totalCount) * 100)}%)` : '—';

      backGenres.innerHTML = `
        <div class="insight-row">
          <span class="insight-label">1위 장르</span>
          <span class="insight-divider">|</span>
          <span class="insight-val">${g1Text}</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">2위 장르</span>
          <span class="insight-divider">|</span>
          <span class="insight-val">${g2Text}</span>
        </div>
      `;
    }
  }

  // ── [4. AVG RATING 인사이트] ──
  const backRating = document.getElementById('kpi-back-rating');
  if (backRating) {
    if (!totalCount) {
      backRating.innerHTML = `<div class="insight-empty">데이터 없음</div>`;
    } else {
      const perfectBooks = books.filter(b => b.rating === 5);
      const perfectCount = perfectBooks.length;

      // date 기준 가장 최근 5점 도서 추출
      let latest5StarTitle = '—';
      if (perfectBooks.length) {
        const sorted5 = [...perfectBooks].sort((a, b) => {
          const parseDate = d => {
            if (!d) return 0;
            const pts = d.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
            return pts ? new Date(+pts[1], +pts[2] - 1, +pts[3]).getTime() : 0;
          };
          return parseDate(b.date) - parseDate(a.date);
        });
        latest5StarTitle = sorted5[0]?.title || '—';
      }

      backRating.innerHTML = `
        <div class="insight-row">
          <span class="insight-label">명예의 전당</span>
          <span class="insight-divider">|</span>
          <span class="insight-val">${perfectCount}권 (${Math.round((perfectCount / (totalCount || 1)) * 100)}%)</span>
        </div>
        <div class="insight-row">
          <span class="insight-label">최근 만점작</span>
          <span class="insight-divider">|</span>
          <span class="insight-val" title="${latest5StarTitle}">『${latest5StarTitle}』</span>
        </div>
      `;
    }
  }
}
