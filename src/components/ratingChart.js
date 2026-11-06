// 평점 폴라 에어리어 차트 (Star Distribution)

import { GOLD, ORANGE, TEAL } from '../constants.js';
import { charts } from '../state.js';

// ── 평점 폴라 에어리어 (스태거 드로잉 · 마그네틱 확장 · 에디토리얼 툴팁) ───────────
let _ratingDrawn = false;   // 최초 1회만 풀 스태거 애니메이션 (필터 변경 시엔 짧게)

export function renderRatingDonut(books) {
  const buckets = [0,0,0,0,0];
  books.forEach(b => {
    const r = b.rating;
    if (!r) return;
    const i = Math.min(4, Math.floor(r) - 1);
    if (i >= 0) buckets[i]++;
  });
  const BG    = [ORANGE, '#c4884a', GOLD, TEAL, '#2d5e53'];
  const STARS = ['★', '★★', '★★★', '★★★★', '★★★★★'];
  const total = buckets.reduce((s, v) => s + v, 0);
  const peak  = total ? buckets.indexOf(Math.max(...buckets)) : -1;   // 가장 많은 점수대
  const hexA  = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  };

  if (charts['rating']) charts['rating'].destroy();

  const canvas = document.getElementById('chart-rating');
  const wrap   = canvas.parentElement;
  wrap.querySelectorAll('.yr-tip, .yr-pulse').forEach(el => el.remove());
  const tip = document.createElement('div');
  tip.className = 'yr-tip';
  const pulse = document.createElement('div');
  pulse.className = 'yr-pulse dot';
  if (peak >= 0) pulse.style.setProperty('--pc', BG[peak]);
  wrap.append(tip, pulse);

  const firstDraw = !_ratingDrawn;
  const S = {
    ready: false,
    hov: buckets.map(() => 0),   // 섹터별 현재 확장도(0~1)
    tgt: buckets.map(() => 0),   // 목표 확장도
    raf: null,
  };

  const tick = () => {
    S.raf = null;
    const chart = charts['rating'];
    if (!chart || !S.ready) return;
    let busy = false;
    S.hov.forEach((v, i) => {
      const d = S.tgt[i] - v;
      if (Math.abs(d) > .002) { S.hov[i] = v + d * .22; busy = true; } else S.hov[i] = S.tgt[i];
    });
    chart.update('none');
    if (busy) S.raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (S.ready && !S.raf) S.raf = requestAnimationFrame(tick); };
  const setTarget = idx => { S.tgt = S.tgt.map((_, i) => i === idx ? 1 : 0); kick(); };

  // ── 플러그인: 호버 섹터 확장 오버레이 + 피크 맥박 위치 ──
  const ratingPlugin = {
    id: 'ratingEditorial',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      const maxR = Math.min(chartArea.width, chartArea.height) / 2;

      S.hov.forEach((h, i) => {
        if (h < .01) return;
        const el = meta.data[i];
        if (!el) return;
        const r = Math.min(maxR, el.outerRadius + 14 * h);      // 부드럽게 스케일업
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(el.x + el.innerRadius * Math.cos(el.startAngle), el.y + el.innerRadius * Math.sin(el.startAngle));
        ctx.arc(el.x, el.y, r, el.startAngle, el.endAngle);
        ctx.arc(el.x, el.y, el.innerRadius, el.endAngle, el.startAngle, true);
        ctx.closePath();
        ctx.shadowColor = hexA(BG[i], .45 * h);
        ctx.shadowBlur  = 14 * h;
        ctx.fillStyle   = hexA(BG[i], .96);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#fffaf0';
        ctx.lineWidth   = 2;
        ctx.stroke();
        ctx.restore();
      });

      // 가장 많은 점수대 끝에 CSS 맥박
      const pk = peak >= 0 ? meta.data[peak] : null;
      if (pk && S.ready) {
        const mid = (pk.startAngle + pk.endAngle) / 2;
        pulse.style.left = (pk.x + pk.outerRadius * Math.cos(mid)) + 'px';
        pulse.style.top  = (pk.y + pk.outerRadius * Math.sin(mid)) + 'px';
        pulse.style.visibility = 'visible';
      } else {
        pulse.style.visibility = 'hidden';
      }
    },
    afterDestroy() { if (S.raf) cancelAnimationFrame(S.raf); }
  };

  charts['rating'] = new Chart(canvas.getContext('2d'), {
    type: 'polarArea',
    data: {
      labels: ['★ 1점대', '★★ 2점대', '★★★ 3점대', '★★★★ 4점대', '★★★★★ 5점대'],
      datasets: [{
        data: buckets,
        // 호버 중이면 나머지 섹터는 살짝 흐려짐
        backgroundColor: ctx => {
          const i = ctx.dataIndex, any = Math.max(...S.hov);
          return hexA(BG[i], .82 - .5 * any * (1 - S.hov[i]));
        },
        borderColor: '#fffaf0',
        borderWidth: 1.5,
        hoverBackgroundColor: ctx => hexA(BG[ctx.dataIndex], .82),
        hoverBorderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      events: [],            // 기본 이벤트 비활성 (커스텀 처리)
      layout: { padding: 6 },
      animation: {
        duration: firstDraw ? 1300 : 400,
        easing: 'easeOutQuart',
        animateRotate: true,
        animateScale: true,
        // 섹터가 시계 방향으로 하나씩 차례로 펼쳐짐
        delay: ctx => (firstDraw && ctx.type === 'data' && ctx.mode === 'default') ? ctx.dataIndex * 130 : 0,
        onComplete: () => {
          if (S.ready) return;
          S.ready = true;
          _ratingDrawn = true;
          charts['rating'] && charts['rating'].update('none');   // 맥박 위치 동기화
        }
      },
      scales: {
        r: {
          ticks: { display: false, backdropColor: 'transparent' },
          grid: { color: 'rgba(122,110,95,.18)', circular: true },
          angleLines: { display: false },
          border: { display: false, dash: [2, 6] },
          suggestedMin: 0,
        }
      },
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 10, boxHeight: 10,
            font: { size: 12, weight: '700' }, color: '#4a3f30', padding: 12
          },
          // 범례에 올려도 해당 섹터가 확장됨
          onHover: (e, item) => setTarget(item.index),
          onLeave: () => setTarget(-1),
        },
        tooltip: { enabled: false }
      }
    },
    plugins: [ratingPlugin]
  });

  // ── 마우스: 각도 기반 섹터 판정(가장자리 깜빡임 없음) + 커스텀 툴팁 ──
  const chart = charts['rating'];
  const hit = (mx, my) => {
    const meta = chart.getDatasetMeta(0);
    const c = meta.data[0];
    if (!c) return -1;
    const dx = mx - c.x, dy = my - c.y;
    const maxR = Math.min(chart.chartArea.width, chart.chartArea.height) / 2;
    if (Math.hypot(dx, dy) > maxR + 8) return -1;
    const span = Math.PI * 2 / buckets.length;
    let rel = Math.atan2(dy, dx) - c.startAngle;
    rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return Math.min(buckets.length - 1, Math.floor(rel / span));
  };

  const showTip = (i, mx, my) => {
    const pct = total ? Math.round(buckets[i] / total * 100) : 0;
    tip.innerHTML =
      `<div class="yr-tip-year"><span>${STARS[i]}</span>${i === peak ? '<em>MOST</em>' : ''}</div>` +
      `<div class="yr-tip-count"><b>${buckets[i]}</b>권 · ${i + 1}점대</div>` +
      `<div class="yr-tip-delta">전체의 ${pct}%</div>`;
    const half = tip.offsetWidth / 2 + 4;
    const fresh = !tip.classList.contains('on');
    if (fresh) tip.style.transition = 'opacity .18s ease';
    tip.style.left = Math.min(Math.max(mx, half), wrap.clientWidth - half) + 'px';
    tip.style.top  = my + 'px';
    if (fresh) { tip.offsetWidth; tip.style.transition = ''; }
    tip.classList.add('on');
  };

  canvas.onpointermove = e => {
    if (!S.ready) return;
    const i = hit(e.offsetX, e.offsetY);
    if (i < 0) return canvas.onpointerleave();
    setTarget(i);
    showTip(i, e.offsetX, e.offsetY);
  };
  canvas.onpointerleave = () => {
    setTarget(-1);
    tip.classList.remove('on');
  };
}
