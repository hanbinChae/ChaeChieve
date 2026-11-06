// 연도별 추이 라인/영역 차트 (Drawing 애니메이션 · 크로스헤어 · 에디토리얼 툴팁)

import { GOLD, MUTED, TEAL } from '../constants.js';
import { getCompleted } from '../data/statsCalculator.js';
import { charts, state } from '../state.js';

// ── 연도별 라인/영역 (Drawing 애니메이션 · 크로스헤어 · 에디토리얼 툴팁) ──────────
let _yearDrawn = false;   // 최초 1회만 Drawing 애니메이션 재생 (연도 필터 변경 시 재생 안 함)

export function renderYearBar() {
  const all = getCompleted('all');
  const byYear = {};
  all.forEach(b => { byYear[b.year]=(byYear[b.year]||0)+1; });
  const years  = Object.keys(byYear).sort();
  const values = years.map(y => byYear[y]);
  const last   = years.length - 1;           // 진행 중(올해) 인덱스

  if (charts['year']) charts['year'].destroy();

  const canvas = document.getElementById('chart-year');
  const wrap   = canvas.parentElement;
  wrap.querySelectorAll('.yr-tip, .yr-pulse').forEach(el => el.remove());

  const tip = document.createElement('div');
  tip.className = 'yr-tip';
  const pulse = document.createElement('div');
  pulse.className = 'yr-pulse';
  wrap.append(tip, pulse);

  // ── 인터랙션/애니메이션 상태 ──
  const S = {
    lineP: _yearDrawn ? 1 : 0,   // 라인 드로잉 진행도 0→1
    fillP: _yearDrawn ? 1 : 0,   // 영역 페이드인 진행도 0→1 (라인 완료 후)
    t0: null, started: _yearDrawn,
    hov: values.map(() => 0),    // 포인트별 현재 스케일(0~1)
    tgt: values.map(() => 0),    // 포인트별 목표 스케일
    mx: null, ca: 0, cat: 0,     // 크로스헤어 x / 현재·목표 알파
    raf: null, io: null,
  };
  const LINE_DELAY = 150, LINE_DUR = 1500, FILL_DUR = 800;
  const easeInOut = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;

  const tick = now => {
    S.raf = null;
    const chart = charts['year'];
    if (!chart) return;
    let busy = false;

    if (S.started && (S.lineP < 1 || S.fillP < 1)) {
      if (S.t0 === null) S.t0 = now;
      const el = now - S.t0 - LINE_DELAY;
      S.lineP = Math.min(Math.max(el / LINE_DUR, 0), 1);
      S.fillP = Math.min(Math.max((el - LINE_DUR) / FILL_DUR, 0), 1);
      if (S.lineP >= 1 && S.fillP >= 1) _yearDrawn = true;
      busy = true;
    }
    S.hov.forEach((v, i) => {                    // 마그네틱 스케일 보간
      const d = S.tgt[i] - v;
      if (Math.abs(d) > .002) { S.hov[i] = v + d * .22; busy = true; } else S.hov[i] = S.tgt[i];
    });
    const da = S.cat - S.ca;                     // 크로스헤어 페이드
    if (Math.abs(da) > .01) { S.ca += da * .25; busy = true; } else S.ca = S.cat;

    chart.update('none');                        // 스크립터블 옵션 재평가
    if (busy) S.raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!S.raf) S.raf = requestAnimationFrame(tick); };

  // ── 플러그인: 드로잉 클립 + 크로스헤어 + 펄스 위치 ──
  const yearPlugin = {
    id: 'yearEditorial',
    beforeDatasetsDraw(chart) {
      const a = chart.chartArea;
      chart.ctx.save();
      chart.ctx.beginPath();
      const w = S.lineP >= 1 ? chart.width : (a.left - 8) + (a.right - a.left + 8) * easeInOut(S.lineP);
      chart.ctx.rect(0, 0, w, chart.height);
      chart.ctx.clip();
    },
    afterDatasetsDraw(chart) {
      chart.ctx.restore();
      const a = chart.chartArea;
      if (S.ca > .01 && S.mx !== null) {          // 크로스헤어
        const x = Math.min(Math.max(S.mx, a.left), a.right);
        const c = chart.ctx;
        c.save();
        c.globalAlpha = S.ca;
        c.strokeStyle = 'rgba(74,124,111,.28)';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(Math.round(x) + .5, a.top); c.lineTo(Math.round(x) + .5, a.bottom); c.stroke();
        c.restore();
      }
      // 2026(진행 중) 포인트 위 CSS 펄스
      const pt = chart.getDatasetMeta(0).data[last];
      if (pt) {
        pulse.style.left = pt.x + 'px';
        pulse.style.top  = pt.y + 'px';
        pulse.style.visibility = S.lineP >= 1 ? 'visible' : 'hidden';
      }
    },
    afterDestroy() {
      if (S.raf) cancelAnimationFrame(S.raf);
      if (S.io) S.io.disconnect();
    }
  };

  charts['year'] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        data: values,
        fill: true,
        // 라인 완료 후 틸 그라데이션이 페이드인
        backgroundColor: ctx => {
          const a = ctx.chart.chartArea;
          if (!a) return 'rgba(0,0,0,0)';
          const g = ctx.chart.ctx.createLinearGradient(0, a.top, 0, a.bottom);
          g.addColorStop(0, `rgba(74,124,111,${(.38 * S.fillP).toFixed(3)})`);
          g.addColorStop(1, `rgba(74,124,111,${(.02 * S.fillP).toFixed(3)})`);
          return g;
        },
        borderColor: TEAL,
        borderWidth: 2.25,
        borderCapStyle: 'round',
        // 마지막 구간(→ 올해)은 점선
        segment: { borderDash: ctx => ctx.p1DataIndex === last ? [5, 6] : undefined },
        pointBackgroundColor: years.map((y, i) => {
          if (i === last) return GOLD;                       // 진행 중 — 머스터드
          if (state.activeYear === 'all' || y === state.activeYear) return TEAL;
          return '#b0a090';
        }),
        pointBorderColor: '#faf5e9',
        pointBorderWidth: ctx => 1 + S.hov[ctx.dataIndex],
        // 평소엔 아주 작게, 가까워질수록 스케일업
        pointRadius: ctx => {
          const base = ctx.dataIndex === last ? 4 : 2;
          return base + (7.5 - base) * S.hov[ctx.dataIndex];
        },
        pointHoverRadius: 0,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,           // 드로잉은 플러그인이 직접 제어
      events: [],                 // 기본 hover/tooltip 이벤트 비활성 (커스텀 처리)
      layout: { padding: { top: 8, right: 10 } },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grace: '8%',
          ticks: { stepSize: 1, color: MUTED, padding: 8 },
          border: { display: false, dash: [2, 6] },
          grid: { color: 'rgba(122,110,95,.14)', drawTicks: false }   // 아주 옅은 점선
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: MUTED, font: { size: 10 } }
        }
      }
    },
    plugins: [yearPlugin]
  });

  // ── 마우스: 크로스헤어 · 마그네틱 · 커스텀 툴팁 ──
  const chart = charts['year'];
  const showTip = i => {
    const prev = i > 0 ? values[i] - values[i-1] : null;
    const delta = prev === null ? '첫 기록'
      : prev === 0 ? '전년과 동일'
      : `전년 대비 ${prev > 0 ? '▲ +' : '▼ '}${prev}권`;
    const cls = prev > 0 ? 'up' : prev < 0 ? 'down' : '';
    tip.innerHTML =
      `<div class="yr-tip-year"><span>${years[i]}</span>${i === last ? '<em>ONGOING</em>' : ''}</div>` +
      `<div class="yr-tip-count"><b>${values[i]}</b>권 완독</div>` +
      `<div class="yr-tip-delta ${cls}">${delta}</div>`;
    const pt = chart.getDatasetMeta(0).data[i];
    const half = tip.offsetWidth / 2 + 4;
    const fresh = !tip.classList.contains('on');
    if (fresh) tip.style.transition = 'opacity .18s ease';   // 첫 등장 시 위치 이동 애니메이션 생략
    tip.style.left = Math.min(Math.max(pt.x, half), wrap.clientWidth - half) + 'px';
    tip.style.top  = pt.y + 'px';
    if (fresh) { tip.offsetWidth; tip.style.transition = ''; }
    tip.classList.add('on');
  };

  canvas.onmousemove = e => {
    if (S.lineP < 1) return;
    const a = chart.chartArea;
    const mx = e.offsetX, my = e.offsetY;
    if (mx < a.left - 10 || mx > a.right + 10 || my < a.top - 10 || my > a.bottom + 10) return canvas.onmouseleave();
    S.mx = mx; S.cat = 1;
    const xs = chart.getDatasetMeta(0).data.map(p => p.x);
    const spacing = xs.length > 1 ? (xs[xs.length-1] - xs[0]) / (xs.length - 1) : 80;
    const R = Math.max(28, Math.min(72, spacing * .55));          // 자석 반경
    let near = 0;
    xs.forEach((x, i) => {
      const w = Math.max(0, 1 - Math.abs(x - mx) / R);
      S.tgt[i] = w * w * (3 - 2 * w);                              // smoothstep
      if (Math.abs(x - mx) < Math.abs(xs[near] - mx)) near = i;
    });
    showTip(near);
    kick();
  };
  canvas.onmouseleave = () => {
    S.cat = 0; S.tgt.fill(0);
    tip.classList.remove('on');
    kick();
  };

  kick();   // chartArea 확정 후 그라데이션/펄스 위치 1회 동기화

  // ── 최초 진입: 화면에 보일 때 Drawing 시작 ──
  if (!S.started) {
    const go = () => { S.started = true; kick(); };
    if ('IntersectionObserver' in window) {
      S.io = new IntersectionObserver(es => {
        if (es.some(en => en.isIntersecting)) { S.io.disconnect(); go(); }
      }, { threshold: .35 });
      S.io.observe(canvas);
    } else go();
  }
}
