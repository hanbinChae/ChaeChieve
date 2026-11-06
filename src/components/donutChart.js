// 장르별 선버스트(도넛) 차트 — 드릴다운 Canvas

import { MAJOR_COLORS, MUTED, ORANGE, TEAL } from '../constants.js';

// ── 아크 다이어그램 ────────────────────────────────────────────────────────────
// ── 선버스트 (드릴다운) ────────────────────────────────────────────────────────
let _sbBooks = [];
let _sbDrilled = null;
let _sbAnimFrame = null;
let _sbHoverFrame = null;
let _sbAnimT = 0;
let _sbAnimTarget = 0;
let _sbSlices = [];
let _sbHovered = null;
let _sbHoverT  = {};
let _sbCanvasRect = null;   // getBoundingClientRect 캐시

export function renderArc(books) {
  _sbBooks = books;
  _sbDrilled = null;
  _sbAnimT = 0;
  _sbAnimTarget = 0;
  _drawSunburst();
  _sbBindEvents();
}

// 호버 애니메이션이 매 프레임 _drawSunburst를 부르므로, 같은 입력이면 트리를 재사용
let _sbTreeSrc = null, _sbTreeCache = null;
function _buildData(books) {
  if (books === _sbTreeSrc && _sbTreeCache) return _sbTreeCache;
  const tree = {};
  books.forEach(b => {
    const med = b.medium || '기타';
    const maj = b.major  || '기타';
    const sub = b.subMajor || b.major || '기타';
    if (!tree[med]) tree[med] = {};
    if (!tree[med][maj]) tree[med][maj] = {};
    tree[med][maj][sub] = (tree[med][maj][sub] || 0) + 1;
  });
  _sbTreeSrc = books; _sbTreeCache = tree;
  return tree;
}

function _drawSunburst() {
  const canvas = document.getElementById('arc-canvas');
  if (!canvas) return;
  const SIZE = 600;
  const dpr  = window.devicePixelRatio || 1;

  // 레티나 대응: 물리 픽셀 크기는 dpr 배, CSS 표시 크기는 고정
  if (canvas.width !== SIZE * dpr || canvas.height !== SIZE * dpr) {
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width  = SIZE + 'px';
    canvas.style.height = SIZE + 'px';
  }

  const ctx = canvas.getContext('2d');
  const CX = (SIZE * dpr) / 2, CY = (SIZE * dpr) / 2;

  ctx.clearRect(0, 0, SIZE * dpr, SIZE * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);          // 이후 모든 좌표는 CSS 픽셀 기준
  ctx.translate(SIZE / 2, SIZE / 2);

  const tree = _buildData(_sbBooks);
  const total = _sbBooks.length;
  _sbSlices = [];

  if (!_sbDrilled) {
    // ── 전체 보기 (2링: 매체 → 주류) ─────────────────────────────
    const R_MED_IN  = 0;
    const R_MED_OUT = 105;
    const R_MAJ_IN  = 114;
    const R_MAJ_OUT = 242;

    let angle = -Math.PI / 2;
    Object.entries(tree).forEach(([med, majObj]) => {
      const medTotal = Object.values(majObj).reduce((s, v) => s + Object.values(v).reduce((a,b)=>a+b,0), 0);
      const medColor = med === '전자책' ? TEAL : ORANGE;

      const medStart = angle;
      const medEnd   = angle + (medTotal / total) * Math.PI * 2;
      _drawSlice(ctx, 0, 0, R_MED_IN, R_MED_OUT, medStart, medEnd, medColor, 0.88);
      const medSpan = medEnd - medStart;
      _drawSliceLabel(ctx, 0, 0, (R_MED_IN+R_MED_OUT)/2, (medStart+medEnd)/2, med, 30, '#2c2416', true, medSpan);

      Object.entries(majObj).forEach(([maj, subObj]) => {
        const majTotal = Object.values(subObj).reduce((a,b)=>a+b,0);
        const majStart = angle;
        const majEnd   = angle + (majTotal / total) * Math.PI * 2;
        const col = MAJOR_COLORS[maj] || MUTED;
        const ht = _sbHoverT[maj] || 0;
        _drawSlice(ctx, 0, 0, R_MAJ_IN, R_MAJ_OUT, majStart, majEnd, col, 0.85, ht);
        const span = majEnd - majStart;
        // 호버된 조각은 레이블도 같이 이동
        const lx = Math.cos((majStart+majEnd)/2) * 14 * ht;
        const ly = Math.sin((majStart+majEnd)/2) * 14 * ht;
        _drawSliceLabel(ctx, lx, ly, (R_MAJ_IN+R_MAJ_OUT)/2, (majStart+majEnd)/2,
          maj, span > 0.5 ? 23 : 18, '#2c2416', span > 0.22, span);
        _sbSlices.push({ type:'major', label:maj, start:majStart, end:majEnd, rin:R_MAJ_IN, rout:R_MAJ_OUT });
        angle = majEnd;
      });
    });

    // 중심원
    ctx.beginPath();
    ctx.arc(0, 0, R_MED_OUT - 3, 0, Math.PI * 2);
    ctx.fillStyle = '#faf7f2';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = MUTED;
    ctx.font = '18px Noto Sans KR, sans-serif';
    ctx.fillText('Total', 0, -12);
    ctx.fillStyle = '#2c2416';
    ctx.font = 'bold 38px Playfair Display, Georgia, serif';
    ctx.fillText(total, 0, 22);

  } else {
    // ── 드릴다운: 선택된 주류 → 강목 ─────────────────────────────
    const R_MAJ_OUT = 130;
    const R_SUB_IN  = 140;
    const R_SUB_OUT = 242;

    const majColor = MAJOR_COLORS[_sbDrilled] || MUTED;

    ctx.beginPath();
    ctx.arc(0, 0, R_MAJ_OUT, 0, Math.PI * 2);
    ctx.fillStyle = majColor;
    ctx.globalAlpha = 0.88;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px Noto Sans KR, sans-serif';
    ctx.fillText(_sbDrilled, 0, -10);
    const subBooks = _sbBooks.filter(b => b.major === _sbDrilled);
    ctx.font = '17px Noto Sans KR, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(subBooks.length + '권', 0, 18);
    ctx.font = '13px Noto Sans KR, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('← 클릭하여 돌아가기', 0, 42);

    const subCounts = {};
    subBooks.forEach(b => { const s = b.subMajor || '기타'; subCounts[s] = (subCounts[s]||0)+1; });
    const subTotal = subBooks.length;
    let angle = -Math.PI / 2;

    Object.entries(subCounts).sort((a,b)=>b[1]-a[1]).forEach(([sub, cnt], i) => {
      const subStart = angle;
      const subEnd   = angle + (cnt / subTotal) * Math.PI * 2;
      const col = _hslVariant(majColor, i);
      const ht = _sbHoverT[sub] || 0;
      _drawSlice(ctx, 0, 0, R_SUB_IN, R_SUB_OUT, subStart, subEnd, col, 0.88, ht);
      const span = subEnd - subStart;
      const lbl = span > 0.45 ? `${sub} ${cnt}권` : sub;
      const lx = Math.cos((subStart+subEnd)/2) * 14 * ht;
      const ly = Math.sin((subStart+subEnd)/2) * 14 * ht;
      _drawSliceLabel(ctx, lx, ly, (R_SUB_IN+R_SUB_OUT)/2, (subStart+subEnd)/2,
        lbl, span > 0.5 ? 20 : 16, '#2c2416', span > 0.2, span);
      _sbSlices.push({ type:'sub', label:sub, cnt, start:subStart, end:subEnd, rin:R_SUB_IN, rout:R_SUB_OUT });
      angle = subEnd;
    });

    ctx.beginPath();
    ctx.arc(0, 0, R_MAJ_OUT, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();

    _sbSlices.push({ type:'back', label:'back', start:0, end:Math.PI*2, rin:0, rout:R_MAJ_OUT });
  }

  ctx.restore();
}

function _drawSlice(ctx, cx, cy, rin, rout, a1, a2, color, alpha=1, hoverT=0) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // 호버 시 중심 방향으로 12px 튀어나옴
  const HOVER_OFFSET = 14;
  if (hoverT > 0) {
    const midA = (a1 + a2) / 2;
    ctx.translate(Math.cos(midA) * HOVER_OFFSET * hoverT, Math.sin(midA) * HOVER_OFFSET * hoverT);
  }

  ctx.beginPath();
  if (rin === 0) {
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rout, a1, a2);
    ctx.closePath();
  } else {
    ctx.arc(0, 0, rout, a1, a2);
    ctx.arc(0, 0, rin, a2, a1, true);
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function _drawSliceLabel(ctx, cx, cy, r, midAngle, text, size, color, show, arcSpan) {
  if (!show) return;
  ctx.save();
  ctx.translate(cx + r * Math.cos(midAngle), cy + r * Math.sin(midAngle));

  // 텍스트가 뒤집히지 않도록 하단 반원 보정
  let rot = midAngle - Math.PI / 2;
  if (midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5) rot += Math.PI;
  ctx.rotate(rot);

  // 섹터 호 길이 기반으로 폰트 크기 상한 — arcSpan 없으면 패스
  let fs = size;
  if (arcSpan != null) {
    const arcLen = arcSpan * r;           // 해당 반경에서의 호 길이(px)
    const maxSz  = Math.max(8, arcLen * 0.30);  // 호 길이의 30% 이하
    fs = Math.min(fs, maxSz);
  }

  // measureText로 실제 너비 확인 후 추가 축소
  ctx.font = `bold ${fs}px Noto Sans KR, sans-serif`;
  ctx.textAlign = 'center';
  if (arcSpan != null) {
    const maxW = arcSpan * r * 0.92;
    const w    = ctx.measureText(text).width;
    if (w > maxW) fs = fs * (maxW / w);
  }

  ctx.font = `bold ${Math.max(8, fs)}px Noto Sans KR, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.shadowBlur = 3;
  ctx.fillText(text, 0, 4);
  ctx.restore();
}

function _hexToHsl(hex) { return hex; }
function _hslVariant(baseColor, idx) {
  const variants = [
    baseColor, baseColor + 'dd', baseColor + 'bb', baseColor + '99',
    '#8bb4a8', '#d4a870', '#d4845a', '#9ab870'
  ];
  return variants[idx % variants.length];
}

function _getSliceAt(canvas, x, y) {
  const rect   = _sbCanvasRect || canvas.getBoundingClientRect();
  const dpr    = window.devicePixelRatio || 1;
  const scaleX = (canvas.width  / dpr) / rect.width;
  const scaleY = (canvas.height / dpr) / rect.height;
  const cx = (x - rect.left) * scaleX - canvas.width  / dpr / 2;
  const cy = (y - rect.top)  * scaleY - canvas.height / dpr / 2;
  const dist = Math.sqrt(cx*cx + cy*cy);
  let angle = Math.atan2(cy, cx);

  return _sbSlices.find(s => {
    if (dist < s.rin || dist > s.rout) return false;
    let a = angle;
    let start = s.start, end = s.end;
    // 정규화
    while (a < start) a += Math.PI * 2;
    return a >= start && a <= end;
  });
}

function _animateTo(target, onDone) {
  if (_sbAnimFrame) cancelAnimationFrame(_sbAnimFrame);
  const start = performance.now();
  const DURATION = 320;
  const from = _sbAnimT;

  function step(now) {
    let p = Math.min((now - start) / DURATION, 1);
    // ease in-out
    p = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
    _sbAnimT = from + (target - from) * p;
    _drawSunburst();
    if (p < 1) _sbAnimFrame = requestAnimationFrame(step);
    else { _sbAnimT = target; if (onDone) onDone(); }
  }
  _sbAnimFrame = requestAnimationFrame(step);
}

function _sbBindEvents() {
  const canvas = document.getElementById('arc-canvas');
  const hint   = document.getElementById('arc-hint');
  if (!canvas) return;

  // rect 캐시 초기화 + resize/scroll 시 갱신
  _sbCanvasRect = canvas.getBoundingClientRect();
  const _refreshRect = () => { _sbCanvasRect = canvas.getBoundingClientRect(); };
  if (window._sbRectHandler) {
    window.removeEventListener('resize', window._sbRectHandler);
    window.removeEventListener('scroll', window._sbRectHandler);
  }
  window._sbRectHandler = _refreshRect;
  window.addEventListener('resize', _refreshRect, { passive: true });
  window.addEventListener('scroll', _refreshRect, { passive: true });

  // 툴팁
  const tip = document.getElementById('arc-tip') || (() => {
    const d = document.createElement('div');
    d.id = 'arc-tip';
    d.style.cssText = 'position:fixed;display:none;background:rgba(44,36,22,.92);color:#faf7f2;font-size:12px;padding:7px 12px;border-radius:8px;pointer-events:none;z-index:99;box-shadow:0 4px 12px rgba(0,0,0,.2)';
    document.body.appendChild(d);
    return d;
  })();

  canvas.onmousemove = e => {
    const s = _getSliceAt(canvas, e.clientX, e.clientY);
    const hovLabel = (s && s.type !== 'back') ? s.label : null;

    if (hovLabel !== _sbHovered) {
      _sbHovered = hovLabel;
      // 호버 애니메이션 루프 시작
      if (_sbHoverFrame) cancelAnimationFrame(_sbHoverFrame);
      const HOVER_DUR = 180;
      const startTime = performance.now();
      // 각 슬라이스의 시작 hoverT 스냅샷
      const fromT = Object.assign({}, _sbHoverT);

      function hoverStep(now) {
        let p = Math.min((now - startTime) / HOVER_DUR, 1);
        p = p < 0.5 ? 2*p*p : -1+(4-2*p)*p; // ease in-out

        // 모든 슬라이스: 호버된 것 → 1, 나머지 → 0 으로 보간
        const allLabels = new Set([...Object.keys(fromT), ...(hovLabel ? [hovLabel] : [])]);
        allLabels.forEach(lbl => {
          const target = lbl === hovLabel ? 1 : 0;
          const from   = fromT[lbl] || 0;
          _sbHoverT[lbl] = from + (target - from) * p;
          if (_sbHoverT[lbl] < 0.001) delete _sbHoverT[lbl]; // 정리
        });

        _drawSunburst();
        if (p < 1) _sbHoverFrame = requestAnimationFrame(hoverStep);
        else _sbHoverFrame = null;
      }
      _sbHoverFrame = requestAnimationFrame(hoverStep);
    }

    if (s && s.type !== 'back') {
      tip.innerHTML = `<strong>${s.label}</strong>`;
      if (s.cnt) tip.innerHTML += ` &nbsp;${s.cnt}권`;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top  = (e.clientY - 32) + 'px';
      canvas.style.cursor = 'pointer';
    } else {
      tip.style.display = 'none';
      canvas.style.cursor = s && s.type === 'back' && _sbDrilled ? 'zoom-out' : 'default';
    }
  };

  canvas.onmouseleave = () => {
    tip.style.display = 'none';
    // 모든 호버 상태 리셋 애니메이션
    if (_sbHovered !== null) {
      _sbHovered = null;
      if (_sbHoverFrame) cancelAnimationFrame(_sbHoverFrame);
      const HOVER_DUR = 180;
      const startTime = performance.now();
      const fromT = Object.assign({}, _sbHoverT);

      function leaveStep(now) {
        let p = Math.min((now - startTime) / HOVER_DUR, 1);
        p = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
        Object.keys(fromT).forEach(lbl => {
          _sbHoverT[lbl] = (fromT[lbl] || 0) * (1 - p);
          if (_sbHoverT[lbl] < 0.001) delete _sbHoverT[lbl];
        });
        _drawSunburst();
        if (p < 1) _sbHoverFrame = requestAnimationFrame(leaveStep);
        else _sbHoverFrame = null;
      }
      _sbHoverFrame = requestAnimationFrame(leaveStep);
    }
  };

  canvas.onclick = e => {
    const s = _getSliceAt(canvas, e.clientX, e.clientY);
    if (!s) return;

    if (!_sbDrilled && s.type === 'major') {
      // 드릴다운 — 호버 상태 초기화
      _sbHovered = null;
      _sbHoverT = {};
      if (_sbHoverFrame) { cancelAnimationFrame(_sbHoverFrame); _sbHoverFrame = null; }
      hint.textContent = '중앙을 클릭하면 전체 보기로 돌아갑니다';
      _sbDrilled = s.label;
      _sbSlices = [];
      _animateTo(1);
    } else if (_sbDrilled && s.type === 'back') {
      // 줌아웃 — 호버 상태 초기화
      _sbHovered = null;
      _sbHoverT = {};
      if (_sbHoverFrame) { cancelAnimationFrame(_sbHoverFrame); _sbHoverFrame = null; }
      hint.textContent = '주류 조각을 클릭하면 강목으로 확대됩니다';
      _sbDrilled = null;
      _sbSlices = [];
      _animateTo(0);
    }
  };
}
