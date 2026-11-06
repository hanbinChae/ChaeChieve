// Aurora 헤더 배경 (바닐라 WebGL 구현 — React Bits <Aurora /> 파라미터 호환)
export function initAurora() {
  const canvas = document.getElementById('aurora-canvas');
  const header = document.getElementById('dash-header');
  if (!canvas || !header) return;

  // 요청하신 props 값 그대로
  const P = {
    colorStops: ['#eab308', '#ffffff', '#10b981'],
    amplitude: 1, blend: 0.5, height: 0.45, speed: 0.4, glow: 0.6, scale: 0.5,
    brightness: 1, layers: 1, direction: 'top', opacity: 1,
    mouseInteraction: true, intro: true
  };

  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
  if (!gl) { canvas.style.display = 'none'; return; }

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2;
uniform float uAmp, uBlend, uHeight, uSpeed, uGlow, uScale, uBright, uLayers, uOpacity, uDir, uIntro, uMouseOn;
uniform vec2 uMouse;

vec3 permute(vec3 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// 3-스톱 컬러 램프 (0 / 0.5 / 1)
vec3 ramp(float x){
  return x < 0.5 ? mix(uC0, uC1, x * 2.0) : mix(uC1, uC2, (x - 0.5) * 2.0);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float x = uv.x;
  float edge = uDir > 0.5 ? uv.y : 1.0 - uv.y;       // 1.0 = 오로라가 매달린 가장자리

  // height: 오로라가 차지하는 세로 범위 (0.45 = 기본)
  float y = 1.0 - (1.0 - edge) * (0.45 / max(uHeight, 0.05));
  y -= (1.0 - uIntro) * 0.7;                         // 인트로: 가장자리에서 흘러내려옴

  float t = uTime * uSpeed;
  vec3 acc = vec3(0.0);
  float accA = 0.0;

  for (int L = 0; L < 3; L++) {
    if (float(L) >= uLayers) break;
    float fl = float(L);
    float xs = x * uScale;
    // 색 램프 좌표에 느린 저주파 노이즈를 더해 금색·흰색·에메랄드가 경계 없이 번지듯 섞이게 함
    float cm = x + fl * 0.12 + snoise(vec2(xs * 1.2 + fl * 4.7, t * 0.06 + fl * 2.3)) * 0.22;
    vec3 rc = ramp(clamp(cm, 0.0, 1.0));

    float h = snoise(vec2(xs * 2.0 + t * 0.1 + fl * 7.3, t * 0.25 + fl * 3.1)) * 0.5 * uAmp;
    float dm = x - uMouse.x;
    h += uMouseOn * 0.4 * exp(-dm * dm / 0.025);     // 마우스 근처가 부풀어 오름
    h = exp(h);

    float intensity = 0.6 * (y * 2.0 - h + 0.2);
    float mid = 0.20;
    float a = smoothstep(mid - uBlend * 0.5, mid + uBlend * 0.5, intensity);

    float ray  = 0.86 + 0.14 * snoise(vec2(xs * 26.0 + fl * 5.0, t * 0.35));   // 수직 광선 결
    float halo = uGlow * 0.3 * smoothstep(-0.3, 0.6, intensity);

    float lw = 1.0 / (1.0 + 0.55 * fl);
    vec3 col = rc * clamp(intensity * 1.15, 0.0, 1.0) * ray * uBright;
    acc  += (col * a + rc * halo * 0.5) * lw;
    accA += (a + halo * 0.5) * lw;
  }

  accA = clamp(accA, 0.0, 1.0);
  acc  = min(clamp(acc, 0.0, 1.0), vec3(accA));
  gl_FragColor = vec4(acc, accA) * uOpacity * uIntro;   // 프리멀티플라이드 알파
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[Aurora]', gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.style.display = 'none'; return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes','uTime','uC0','uC1','uC2','uAmp','uBlend','uHeight','uSpeed','uGlow','uScale','uBright',
   'uLayers','uOpacity','uDir','uIntro','uMouse','uMouseOn'].forEach(n => U[n] = gl.getUniformLocation(prog, n));

  const hex = h => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  gl.uniform3fv(U.uC0, hex(P.colorStops[0]));
  gl.uniform3fv(U.uC1, hex(P.colorStops[1]));
  gl.uniform3fv(U.uC2, hex(P.colorStops[2]));
  gl.uniform1f(U.uAmp, P.amplitude);   gl.uniform1f(U.uBlend, P.blend);
  gl.uniform1f(U.uHeight, P.height);   gl.uniform1f(U.uSpeed, P.speed);
  gl.uniform1f(U.uGlow, P.glow);       gl.uniform1f(U.uScale, P.scale);
  gl.uniform1f(U.uBright, P.brightness); gl.uniform1f(U.uLayers, P.layers);
  gl.uniform1f(U.uOpacity, P.opacity); gl.uniform1f(U.uDir, P.direction === 'bottom' ? 0 : 1);
  gl.clearColor(0, 0, 0, 0);

  // 상태
  let timeAcc = 5, last = 0, raf = 0, visible = true, started = 0;
  let mx = 0.5, tmx = 0.5, mOn = 0, tOn = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = Math.max(1, Math.round(header.clientWidth * dpr));
    const h = Math.max(1, Math.round(header.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
  }

  function draw(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    timeAcc += dt;
    mx += (tmx - mx) * 0.08;
    mOn += (tOn - mOn) * 0.06;
    const k = P.intro && !reduced ? Math.min(1, (now - started) / 2600) : 1;
    gl.uniform1f(U.uTime, timeAcc);
    gl.uniform2f(U.uMouse, mx, 0.5);
    gl.uniform1f(U.uMouseOn, mOn);
    gl.uniform1f(U.uIntro, k * k * (3 - 2 * k));
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) { draw(now); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && !reduced) { last = 0; raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  resize();
  new ResizeObserver(() => { resize(); if (reduced) draw(performance.now()); }).observe(header);
  started = performance.now();
  if (reduced) { draw(started + 5000); return; }   // 모션 감소 설정: 정지 프레임 1장만

  // 화면 밖/탭 비활성 시 렌더링 중지
  new IntersectionObserver(es => { visible = es[0].isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(header);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : (visible && start()); });

  if (P.mouseInteraction) {
    header.addEventListener('pointermove', e => {
      const r = header.getBoundingClientRect();
      tmx = (e.clientX - r.left) / r.width; tOn = 1;
    });
    header.addEventListener('pointerleave', () => { tOn = 0; });
  }
  start();
}
