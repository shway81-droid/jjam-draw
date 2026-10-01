// 그림 품질 검증 시안(v2) 생성기 — 고양이·공룡·로켓.
// 지나가는 점만 적으면 부드러운 3차 베지어(C)로 이어 주고(Catmull-Rom → Bezier),
// 열린 획의 양 끝은 앞서 그린 획 위의 가장 가까운 점에 붙입니다(snap).
// 끝점을 손으로 맞추면 반드시 어긋나므로 계산으로 붙입니다.
//
//   node scripts/v2-build.mjs   → refs/*-strokes.svg, drawings/*-v2/drawing.json
// 참조 선화는 refs/*.png(생성 원본)와 refs/*.svg(potrace 벡터화)입니다. 좌표는 원본을 400×500 에 맞춰 놓고 읽었습니다.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './bundle.mjs';
import { sample, nearest, dist } from './path-geom.mjs';

const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (p) => `${r1(p[0])} ${r1(p[1])}`;

// 지나가는 점 → C 구간. tension 1 이 표준 Catmull-Rom 입니다.
function smooth(pts, closed = false, tension = 1) {
  const P = closed ? [...pts, pts[0]] : pts;
  const get = (i) => {
    if (closed) return pts[((i % pts.length) + pts.length) % pts.length];
    return P[Math.max(0, Math.min(P.length - 1, i))];
  };
  let d = `M ${fmt(P[0])}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = get(i - 1);
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = get(i + 2);
    const k = tension / 6;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C ${fmt(c1)}, ${fmt(c2)}, ${fmt(p2)}`;
  }
  return d;
}

// 그림 하나를 짓는 작업대. 획마다 이름을 붙여 두고 뒤 획이 그 위에 끝점을 붙입니다.
function bench() {
  const named = {};
  const all = [];
  const steps = [];
  const snap = (name, p) => nearest(named[name], p).q;
  const add = (name, d) => { const pts = sample(d, 40); named[name] = pts; all.push(pts); return d; };
  // 가까운 앞 획 아무 데나 붙이기
  const snapAny = (p) => all.reduce((b, pts) => { const n = nearest(pts, p); return n.d < b.d ? n : b; }, { d: Infinity }).q;
  return {
    snap,
    snapAny,
    closed: (name, pts, t) => add(name, smooth(pts, true, t)),
    // ends: [시작 붙일 획 이름, 끝 붙일 획 이름]
    open: (name, pts, [a, b], t) => {
      const P = pts.slice();
      P[0] = a ? snap(a, P[0]) : P[0];
      P[P.length - 1] = b ? snap(b, P[P.length - 1]) : P[P.length - 1];
      return add(name, smooth(P, false, t));
    },
    // 앞 획 테두리를 따라가며 바깥으로 혹을 n개 내는 획(등 뿔). 양 끝과 혹 사이가 테두리 위에 놓입니다.
    // wrap: 닫힌 테두리에서 끝을 넘어 처음으로 이어 가는 쪽으로 지나갑니다.
    bumps: (name, on, from, to, n, h, flip = 1, wrap = false) => {
      const base = named[on];
      const idx = (p) => {
        let bi = 0; let bd = Infinity;
        base.forEach((q, i) => { const dd = dist(q, p); if (dd < bd) { bd = dd; bi = i; } });
        return bi;
      };
      const i0 = idx(from); const i1 = idx(to);
      const seg = wrap ? [...base.slice(i0), ...base.slice(1, i1 + 1)]
        : i0 <= i1 ? base.slice(i0, i1 + 1) : base.slice(i1, i0 + 1).reverse();
      // 누적 길이로 n 등분
      const acc = [0];
      for (let i = 1; i < seg.length; i++) acc.push(acc[i - 1] + dist(seg[i - 1], seg[i]));
      const L = acc[acc.length - 1];
      const at = (s) => {
        let i = acc.findIndex((a) => a >= s); if (i <= 0) i = 1;
        const t = (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
        const p = [seg[i - 1][0] + (seg[i][0] - seg[i - 1][0]) * t, seg[i - 1][1] + (seg[i][1] - seg[i - 1][1]) * t];
        const tx = seg[i][0] - seg[i - 1][0]; const ty = seg[i][1] - seg[i - 1][1]; const tl = Math.hypot(tx, ty) || 1;
        return { p, nx: (ty / tl) * flip, ny: (-tx / tl) * flip };
      };
      let d = '';
      for (let k = 0; k < n; k++) {
        const a = at((L * k) / n).p;
        const b = at((L * (k + 1)) / n).p;
        // 혹의 방향은 양 끝을 잇는 선의 수직 — 굽은 테두리에서도 혹이 한쪽으로 기울지 않습니다.
        const cx = b[0] - a[0]; const cy = b[1] - a[1]; const cl = Math.hypot(cx, cy) || 1;
        const nx = (cy / cl) * flip; const ny = (-cx / cl) * flip;
        const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const top = [mid[0] + nx * h, mid[1] + ny * h];
        const s1 = [a[0] + nx * h * 0.75, a[1] + ny * h * 0.75];
        const s2 = [top[0] - cx * 0.3, top[1] - cy * 0.3];
        const s3 = [top[0] + cx * 0.3, top[1] + cy * 0.3];
        const s4 = [b[0] + nx * h * 0.75, b[1] + ny * h * 0.75];
        if (!d) d = `M ${fmt(a)}`;
        d += ` C ${fmt(s1)}, ${fmt(s2)}, ${fmt(top)} C ${fmt(s3)}, ${fmt(s4)}, ${fmt(b)}`;
      }
      return add(name, d);
    },
    step: (label, teacherSay, ...d) => steps.push({ d, label, teacherSay }),
    steps,
  };
}

const ellipse = (cx, cy, rx, ry, n = 8, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  const x = Math.cos(a) * rx; const y = Math.sin(a) * ry;
  const c = Math.cos(rot); const s = Math.sin(rot);
  return [cx + x * c - y * s, cy + x * s + y * c];
});
const star = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
  const rr = i % 2 ? r : R;
  return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
});

// ================================================================ 고양이 — 참조: refs/cat.png (FLUX.1 schnell)
function cat() {
  const b = bench();
  const head = b.closed('head', [
    [66, 176], [63, 152], [68, 134], [60, 104], [57, 74], [64, 70],
    [94, 79], [120, 86], [150, 79], [178, 76], [205, 80], [236, 68],
    [262, 62], [266, 72], [264, 98], [260, 124], [272, 150], [275, 182],
    [262, 212], [230, 234], [180, 243], [130, 240], [95, 226], [72, 202],
  ]);
  b.step('귀 달린 머리', '종이 위쪽에 귀가 쫑긋 올라온 큰 머리를 그려요.', head);

  const earL = b.closed('earL', [[70, 88], [96, 99], [78, 120]], 0.6);
  const earR = b.closed('earR', [[229, 95], [255, 80], [248, 112]], 0.6);
  b.step('귀 안쪽', '귀 안에 작은 세모를 하나씩 넣어요.', earL, earR);

  const eyeL = b.closed('eyeL', ellipse(127, 166, 8, 9));
  const eyeR = b.closed('eyeR', ellipse(207, 160, 8, 9));
  b.step('눈 두 개', '얼굴 가운데에 작고 까만 눈을 두 개 그려요.', eyeL, eyeR);

  const nose = b.closed('nose', [[156, 175], [168, 172], [179, 174], [173, 182], [168, 186], [162, 182]]);
  const mouth = b.open('mouth', [[148, 194], [155, 201], [164, 199], [168, 186], [172, 199], [181, 200], [189, 192]], [null, null]);
  b.step('코와 입', '눈 사이 아래에 작은 코를 그리고 그 밑에 입을 그려요.', nose, mouth);

  const body = b.open('body', [
    [108, 232], [86, 264], [70, 300], [52, 330], [47, 366], [58, 400], [80, 425],
    [110, 437], [165, 438], [220, 437], [246, 425], [268, 396], [276, 360],
    [268, 326], [252, 300], [238, 268], [222, 236],
  ], ['head', 'head']);
  b.step('통통한 몸', '머리 아래에 엉덩이가 넓은 통통한 몸을 그려요.', body);

  const pawL = b.open('pawL', [[104, 437], [100, 418], [112, 404], [140, 403], [156, 415], [158, 437]], ['body', 'body']);
  const pawR = b.open('pawR', [[170, 437], [172, 415], [188, 403], [214, 404], [226, 418], [228, 437]], ['body', 'body']);
  b.step('앞발 두 개', '몸 아래쪽에 동글동글한 앞발을 두 개 그려요.', pawL, pawR);

  const legLo = b.open('legLo', [[72, 300], [80, 348], [92, 386], [106, 410]], ['body', 'pawL']);
  const legRo = b.open('legRo', [[254, 302], [248, 350], [236, 386], [224, 410]], ['body', 'pawR']);
  b.step('앞다리', '몸 옆에서 앞발까지 다리 줄을 하나씩 그어요.', legLo, legRo);

  const tail = b.open('tail', [
    [268, 412], [300, 404], [328, 384], [340, 342], [332, 294], [334, 266],
    [348, 258], [358, 248], [352, 236], [334, 237], [314, 254], [305, 290],
    [312, 332], [304, 368], [286, 384], [271, 390],
  ], ['body', 'body']);
  b.step('꼬리', '몸 옆에서 위로 길게 말려 올라가는 꼬리를 그려요.', tail);

  return {
    id: 'cat-v2', title: '고양이(시안)', theme: 'animal', difficulty: 'easy', grades: ['lower'],
    paper: 'portrait', viewBox: '0 0 400 500',
    setupSay: '종이를 세로로 놓고, 가운데에 손바닥만큼 크게 그릴 거예요.',
    coloringSeconds: 120, steps: b.steps, keywords: ['동물', '고양이', '시안'],
  };
}

// ================================================================ 아기 공룡 — 참조: refs/dino.png (FLUX.1 schnell), 오른쪽을 봅니다
function dino() {
  const b = bench();
  const head = b.closed('head', [
    [162, 170], [170, 128], [190, 100], [220, 84], [260, 80], [300, 84],
    [335, 100], [360, 125], [370, 155], [364, 180], [345, 196], [310, 220],
    [270, 240], [235, 246], [200, 244], [176, 232], [162, 210], [158, 190],
  ]);
  b.step('큰 머리', '종이 위쪽에 옆으로 넓적한 큰 머리를 그려요.', head);

  const eye = b.closed('eye', ellipse(232, 148, 15, 19));
  const shine = b.closed('shine', ellipse(227, 141, 5, 5));
  b.step('큰 눈', '머리 가운데에 큰 눈을 그리고 안에 반짝이를 넣어요.', eye, shine);

  const nL = b.closed('nL', ellipse(318, 120, 4, 5));
  const nR = b.closed('nR', ellipse(336, 109, 4, 5));
  const mouth = b.open('mouth', [[258, 180], [272, 192], [300, 197], [330, 191], [358, 181]], [null, 'head']);
  b.step('코와 입', '코끝에 콧구멍을 두 개 찍고 웃는 입을 그려요.', nL, nR, mouth);

  const body = b.open('body', [
    [168, 236], [146, 262], [120, 290], [104, 318], [110, 360], [126, 394],
    [150, 408], [200, 412], [250, 410], [284, 398], [292, 360], [286, 320],
    [276, 282], [266, 246],
  ], ['head', 'head']);
  b.step('몸', '머리 아래에 배가 볼록한 몸을 그려요.', body);

  const tail = b.open('tail', [
    [106, 316], [80, 318], [56, 312], [38, 304], [32, 318], [42, 342],
    [70, 372], [104, 396], [140, 406],
  ], ['body', 'body']);
  b.step('꼬리', '몸 뒤로 끝이 살짝 말려 올라간 꼬리를 그려요.', tail);

  const thigh = b.open('thigh', [[134, 396], [136, 356], [160, 332], [196, 336], [214, 366], [210, 410]], ['body', 'body']);
  const footB = b.open('footB', [[152, 410], [148, 430], [162, 440], [200, 440], [214, 428], [208, 411]], ['body', 'body']);
  b.step('뒷다리', '몸 아래쪽에 통통한 다리와 발을 그려요.', thigh, footB);

  const footF = b.open('footF', [[258, 410], [258, 426], [276, 432], [310, 428], [326, 410], [316, 388], [290, 384]], ['body', 'body']);
  b.step('앞발', '몸 앞쪽 아래에 앞으로 내민 발을 그려요.', footF);

  const arm = b.open('arm', [[286, 286], [306, 296], [314, 316], [304, 330], [290, 326]], ['body', 'body']);
  b.step('작은 팔', '몸 앞쪽에 쏙 내민 작은 팔을 하나 그려요.', arm);

  const belly = b.open('belly', [[290, 350], [256, 362], [226, 360], [212, 352]], ['body', 'thigh']);
  b.step('배', '팔 아래에서 다리까지 배를 따라 줄을 그어요.', belly);

  const spikesH = b.bumps('spikesH', 'head', [172, 230], [250, 80], 4, 27, 1, true);
  const spikesB = b.bumps('spikesB', 'body', [158, 250], [106, 314], 2, 24, -1);
  b.step('등 뿔', '머리 뒤와 등을 따라 동글동글한 뿔을 그려요.', spikesH, spikesB);

  return {
    id: 'dino-v2', title: '아기 공룡(시안)', theme: 'animal', difficulty: 'normal', grades: ['middle'],
    paper: 'portrait', viewBox: '0 0 400 500',
    setupSay: '종이를 세로로 놓고, 가운데에 손바닥만큼 크게 그릴 거예요.',
    coloringSeconds: 150, steps: b.steps, keywords: ['동물', '공룡', '시안'],
  };
}

// ================================================================ 로켓 — 참조: refs/rocket.png (FLUX.1 schnell)
function rocket() {
  const b = bench();
  const body = b.closed('body', [
    [200, 46], [226, 66], [246, 100], [262, 150], [274, 210], [276, 260],
    [270, 304], [258, 330], [240, 342], [200, 345], [160, 342], [142, 330],
    [130, 304], [124, 260], [126, 210], [138, 150], [154, 100], [174, 66],
  ]);
  b.step('통통한 몸통', '종이 가운데에 위가 뾰족한 통통한 몸통을 그려요.', body);

  const band1 = b.open('band1', [[167, 86], [184, 92], [200, 94], [216, 92], [234, 86]], ['body', 'body']);
  const band2 = b.open('band2', [[156, 104], [178, 111], [200, 113], [222, 111], [244, 104]], ['body', 'body']);
  b.step('머리 줄 두 개', '몸통 위쪽에 아래로 볼록한 줄을 두 개 그어요.', band1, band2);

  const win = b.closed('win', ellipse(201, 186, 31, 31));
  const winIn = b.closed('winIn', ellipse(201, 186, 17, 17));
  b.step('큰 창', '줄 아래 가운데에 동그라미를 두 겹으로 그려요.', win, winIn);

  const w2 = b.closed('w2', ellipse(201, 246, 15, 15));
  const w3 = b.closed('w3', ellipse(201, 300, 15, 15));
  b.step('작은 창 두 개', '큰 창 아래에 작은 동그라미를 두 개 그려요.', w2, w3);

  const finL = b.open('finL', [[125, 245], [96, 262], [78, 292], [75, 332], [82, 367], [102, 344], [124, 328], [141, 322]], ['body', 'body']);
  const finR = b.open('finR', [[275, 245], [304, 262], [322, 292], [325, 332], [318, 367], [298, 344], [276, 328], [259, 322]], ['body', 'body']);
  b.step('날개 두 개', '몸통 양옆 아래에 끝이 뾰족한 날개를 그려요.', finL, finR);

  const finLi = b.open('finLi', [[131, 290], [106, 304], [92, 330], [86, 358]], ['body', 'finL']);
  const finRi = b.open('finRi', [[269, 290], [294, 304], [308, 330], [314, 358]], ['body', 'finR']);
  b.step('날개 안쪽 줄', '날개 안에 몸통에서 끝까지 줄을 하나씩 그어요.', finLi, finRi);

  const nozzle = b.open('nozzle', [[160, 343], [164, 360], [178, 368], [200, 371], [222, 368], [236, 360], [240, 343]], ['body', 'body']);
  b.step('불 나오는 곳', '몸통 바닥에 납작하고 둥근 통을 붙여요.', nozzle);

  const flame = b.open('flame', [[180, 369], [172, 398], [166, 410], [182, 413], [200, 452], [216, 418], [232, 398], [222, 369]], ['nozzle', 'nozzle']);
  const flameIn = b.open('flameIn', [[191, 370], [194, 394], [200, 410], [206, 394], [209, 370]], ['nozzle', 'nozzle']);
  b.step('불꽃', '통 아래로 출렁이는 불꽃을 두 겹으로 그려요.', flame, flameIn);

  return {
    id: 'rocket-v2', title: '로켓(시안)', theme: 'thing', difficulty: 'easy', grades: ['lower'],
    paper: 'portrait', viewBox: '0 0 400 500',
    setupSay: '종이를 세로로 놓고, 가운데에 손바닥만큼 길게 그릴 거예요.',
    coloringSeconds: 120, steps: b.steps, keywords: ['탈것', '로켓', '우주', '시안'],
  };
}

// ================================================================ 내보내기
const refSvg = (dw) => {
  const paths = dw.steps.flatMap((s) => s.d).map((d) => `  <path d="${d}"/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${dw.viewBox}" width="400" height="500">
  <rect width="100%" height="100%" fill="#fff"/>
  <g fill="none" stroke="#111" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
${paths}
  </g>
</svg>
`;
};

const REF_NAME = { 'cat-v2': 'cat', 'dino-v2': 'dino', 'rocket-v2': 'rocket' };
mkdirSync(join(ROOT, 'refs'), { recursive: true });
for (const dw of [cat(), dino(), rocket()]) {
  mkdirSync(join(ROOT, 'drawings', dw.id), { recursive: true });
  writeFileSync(join(ROOT, 'drawings', dw.id, 'drawing.json'), JSON.stringify(dw, null, 2) + '\n');
  writeFileSync(join(ROOT, 'refs', `${REF_NAME[dw.id]}-strokes.svg`), refSvg(dw));
  console.log(`${dw.id} — ${dw.steps.length}단계`);
}
