// 장르 레이더 차트 (Reading Spectrum)

import { MUTED, ORANGE, TEAL } from '../constants.js';
import { charts } from '../state.js';

// ── 워드클라우드 ──────────────────────────────────────────────────────────────
export function renderGenreRadar(books) {
  const cntMap = {}, ratingSum = {}, ratingCnt = {};
  books.forEach(b => {
    if (!b.major) return;
    cntMap[b.major]  = (cntMap[b.major]  || 0) + 1;
    if (b.rating) {
      ratingSum[b.major] = (ratingSum[b.major] || 0) + b.rating;
      ratingCnt[b.major] = (ratingCnt[b.major] || 0) + 1;
    }
  });

  // 책이 많은 순으로 최대 10개 장르
  const entries = Object.entries(cntMap).sort((a,b) => b[1]-a[1]).slice(0, 10);
  const labels  = entries.map(([k]) => k);
  const counts  = entries.map(([k,v]) => v);
  const avgRatings = labels.map(k =>
    ratingCnt[k] ? +(ratingSum[k] / ratingCnt[k]).toFixed(2) : 0
  );

  // log1p 스케일링 — 편차가 큰 데이터를 고르게 표시
  const logCounts  = counts.map(v => Math.log1p(v));
  const maxLogCount = Math.max(...logCounts, 1);

  // 평점(0~5)을 log 스케일 기준으로 정규화 — 시각적 오버레이용
  const scaledRatings = avgRatings.map(r => (r / 5) * maxLogCount);

  if (charts['genre-radar']) charts['genre-radar'].destroy();
  charts['genre-radar'] = new Chart(
    document.getElementById('chart-genre-radar').getContext('2d'), {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          label: '권 수',
          data: logCounts,
          backgroundColor: TEAL + '2e',
          borderColor: TEAL,
          borderWidth: 2.5,
          pointBackgroundColor: TEAL,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 9,
        },
        {
          label: '평균 평점',
          data: scaledRatings,
          backgroundColor: ORANGE + '22',
          borderColor: ORANGE,
          borderWidth: 2,
          borderDash: [5, 4],
          pointBackgroundColor: ORANGE,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: maxLogCount,
          ticks: { display: false },
          grid:        { color: '#e5ddd0' },
          angleLines:  { color: '#d9d0c0' },
          pointLabels: {
            font: { size: 12, family: 'Noto Sans KR, sans-serif', weight: '600' },
            color: '#2c2416',
          },
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, font: { size: 11 }, color: MUTED, padding: 14 }
        },
        tooltip: {
          callbacks: {
            // log 역변환해 원래 값으로 툴팁 표시
            label: ctx => {
              if (ctx.datasetIndex === 0) {
                const orig = counts[ctx.dataIndex];
                return ` ${orig}권`;
              }
              const orig = avgRatings[ctx.dataIndex];
              return ` 평점 ${orig > 0 ? orig.toFixed(1) + '점' : '-'}`;
            }
          }
        }
      }
    }
  });
}
