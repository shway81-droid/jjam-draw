// 그림 품질 검증 시안(v2) 생성기 — 고양이·공룡·로켓.
// 지나가는 점만 적으면 부드러운 3차 베지어(C)로 이어 주고(Catmull-Rom → Bezier),
// 열린 획의 양 끝은 앞서 그린 획 위의 가장 가까운 점에 붙입니다(snap).
// 끝점을 손으로 맞추면 반드시 어긋나므로 계산으로 붙입니다.
//
//   node scripts/v2-build.mjs   → refs/*.svg, drawings/*-v2/drawing.json
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
    bumps: (name, on, from, to, n, h, flip = 1) => {
      const base = named[on];
      const idx = (p) => {
        let bi = 0; let bd = Infinity;
        base.forEach((q, i) => { const dd = dist(q, p); if (dd < bd) { bd = dd; bi = i; } });
        return bi;
      };
      const i0 = idx(from); const i1 = idx(to);
      const seg = i0 <= i1 ? base.slice(i0, i1 + 1) : base.slice(i1, i0 + 1).reverse();
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
        const m = at((L * (k + 0.5)) / n);
        const b = at((L * (k + 1)) / n).p;
        const top = [m.p[0] + m.nx * h, m.p[1] + m.ny * h];
        // 둥근 혹: 시작 → 꼭대기 → 끝을 두 C 로
        const s1 = [a[0] + m.nx * h * 0.9, a[1] + m.ny * h * 0.9];
        const s2 = [top[0] - (b[0] - a[0]) * 0.28, top[1] - (b[1] - a[1]) * 0.28];
        const s3 = [top[0] + (b[0] - a[0]) * 0.28, top[1] + (b[1] - a[1]) * 0.28];
        const s4 = [b[0] + m.nx * h * 0.9, b[1] + m.ny * h * 0.9];
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

// ================================================================ 고양이
function cat() {
  const b = bench();
  const head = b.closed('head', [
    [72, 200], [80, 148], [96, 110], [90, 58], [104, 48], [154, 84],
    [200, 80], [246, 84], [296, 48], [310, 58], [304, 110], [320, 148],
    [328, 200], [306, 248], [256, 272], [200, 278], [144, 272], [94, 248],
  ]);
  b.step('귀 달린 머리', '종이 위쪽 가운데에 귀가 쏙 올라온 큰 머리를 그려요.', head);

  const earL = b.closed('earL', [[106, 100], [104, 68], [134, 86]], 0.7);
  const earR = b.closed('earR', [[294, 100], [296, 68], [266, 86]], 0.7);
  b.step('귀 안쪽', '귀 안에 작은 세모를 하나씩 넣어요.', earL, earR);

  const eyeL = b.closed('eyeL', ellipse(146, 178, 19, 23));
  const eyeR = b.closed('eyeR', ellipse(254, 178, 19, 23));
  const hiL = b.closed('hiL', ellipse(152, 170, 6, 6));
  const hiR = b.closed('hiR', ellipse(260, 170, 6, 6));
  b.step('눈 두 개', '얼굴 가운데에 큰 눈을 두 개 그리고 반짝이를 넣어요.', eyeL, eyeR, hiL, hiR);

  const nose = b.closed('nose', [[186, 206], [200, 203], [214, 206], [207, 216], [200, 220], [193, 216]]);
  const mouth = b.open('mouth', [[200, 220], [182, 224], [186, 234], [200, 238], [214, 234], [218, 224], [200, 220]], ['nose', 'nose']);
  b.step('코와 입', '눈 사이 아래에 작은 코를 그리고 그 밑에 입을 달아요.', nose, mouth);

  const body = b.open('body', [
    [146, 272], [128, 312], [118, 368], [126, 414], [160, 432], [200, 435],
    [240, 432], [274, 414], [282, 368], [272, 312], [254, 272],
  ], ['head', 'head']);
  b.step('통통한 몸', '머리 아래에 엉덩이가 넓은 통통한 몸을 그려요.', body);

  const pawL = b.open('pawL', [[150, 434], [148, 408], [170, 394], [192, 406], [194, 434]], ['body', 'body']);
  const pawR = b.open('pawR', [[206, 434], [208, 406], [230, 394], [252, 408], [250, 434]], ['body', 'body']);
  b.step('앞발 두 개', '몸 아래쪽에 동글동글한 앞발을 두 개 그려요.', pawL, pawR);

  const tail = b.open('tail', [
    [276, 410], [316, 414], [346, 392], [360, 352], [356, 316], [344, 300],
    [330, 306], [332, 336], [324, 370], [302, 388], [281, 386],
  ], ['body', 'body']);
  b.step('꼬리', '몸 옆에서 위로 휘어 올라가는 꼬리를 그려요.', tail);

  const collar = b.open('collar', [[132, 300], [166, 318], [200, 322], [234, 318], [268, 300]], ['body', 'body']);
  const bell = b.closed('bell', ellipse(200, 335, 13, 13));
  b.step('목걸이', '머리 밑에 목걸이를 걸고 가운데에 방울을 달아요.', collar, bell);

  return {
    id: 'cat-v2', title: '고양이(시안)', theme: 'animal', difficulty: 'easy', grades: ['lower'],
    paper: 'portrait', viewBox: '0 0 400 500',
    setupSay: '종이를 세로로 놓고, 위쪽 가운데에 주먹만큼 크게 그릴 거예요.',
    coloringSeconds: 120, steps: b.steps, keywords: ['동물', '고양이', '시안'],
  };
}

// ================================================================ 아기 공룡 (오른쪽을 봅니다)
function dino() {
  const b = bench();
  const head = b.closed('head', [
    [128, 150], [142, 98], [190, 64], [254, 58], [312, 80], [350, 122],
    [362, 168], [346, 210], [302, 234], [240, 242], [180, 234], [140, 200],
  ]);
  b.step('큰 머리', '종이 위쪽에 옆으로 넓적한 큰 머리를 그려요.', head);

  const eye = b.closed('eye', ellipse(280, 138, 19, 22));
  const pupil = b.closed('pupil', ellipse(286, 142, 8, 10));
  b.step('큰 눈', '머리 앞쪽에 큰 눈을 그리고 안에 눈동자를 넣어요.', eye, pupil);

  const body = b.open('body', [
    [180, 234], [146, 270], [128, 322], [134, 380], [166, 410], [220, 416],
    [266, 404], [292, 368], [294, 318], [282, 268], [270, 240],
  ], ['head', 'head']);
  b.step('몸', '머리 아래에 배가 볼록한 몸을 그려요.', body);

  const tail = b.open('tail', [
    [140, 392], [100, 396], [64, 382], [38, 352], [36, 336], [52, 340],
    [86, 350], [116, 340], [129, 322],
  ], ['body', 'body']);
  b.step('꼬리', '몸 옆에서 끝이 살짝 올라간 꼬리를 그려요.', tail);

  const legB = b.open('legB', [[164, 410], [160, 444], [176, 456], [204, 456], [212, 442], [210, 416]], ['body', 'body']);
  const legF = b.open('legF', [[236, 414], [234, 444], [250, 456], [278, 456], [286, 442], [280, 392]], ['body', 'body']);
  b.step('다리 두 개', '몸 아래에 짧고 통통한 다리를 두 개 그려요.', legB, legF);

  const arm = b.open('arm', [[292, 296], [314, 300], [326, 316], [316, 328], [294, 330]], ['body', 'body']);
  b.step('작은 팔', '몸 앞쪽에 쏙 내민 작은 팔을 하나 그려요.', arm);

  const spikesH = b.bumps('spikesH', 'head', [196, 62], [132, 132], 3, 19, -1);
  const spikesB = b.bumps('spikesB', 'body', [158, 256], [130, 318], 2, 18, -1);
  b.step('등 뿔', '머리 뒤와 등을 따라 동글동글한 뿔을 그려요.', spikesH, spikesB);

  const nostril = b.closed('nostril', ellipse(340, 150, 4, 6));
  const mouth = b.open('mouth', [[358, 184], [326, 188], [296, 192], [306, 210], [330, 210], [346, 202]], ['head', 'head']);
  b.step('코와 입', '코끝에 콧구멍을 찍고 그 아래에 웃는 입을 그려요.', nostril, mouth);

  const belly = b.open('belly', [[292, 282], [256, 302], [242, 350], [252, 392], [266, 404]], ['body', 'body']);
  b.step('배', '팔 아래에서 몸 끝까지 배를 따라 줄을 그어요.', belly);

  const spots = [b.closed('s1', ellipse(186, 300, 11, 9)), b.closed('s2', ellipse(204, 352, 9, 8)), b.closed('s3', ellipse(166, 356, 8, 7))];
  b.step('점 무늬', '몸 위에 크고 작은 동그라미 무늬를 그려요.', ...spots);

  return {
    id: 'dino-v2', title: '아기 공룡(시안)', theme: 'animal', difficulty: 'normal', grades: ['middle'],
    paper: 'portrait', viewBox: '0 0 400 500',
    setupSay: '종이를 세로로 놓고, 위쪽 가운데에 주먹만큼 크게 그릴 거예요.',
    coloringSeconds: 150, steps: b.steps, keywords: ['동물', '공룡', '시안'],
  };
}

// ================================================================ 로켓
function rocket() {
  const b = bench();
  const body = b.closed('body', [
    [200, 46], [242, 78], [274, 140], [286, 224], [280, 304], [260, 350],
    [200, 364], [140, 350], [120, 304], [114, 224], [126, 140], [158, 78],
  ]);
  b.step('통통한 몸통', '종이 가운데에 위가 뾰족한 통통한 몸통을 그려요.', body);

  const tip = b.open('tip', [[146, 106], [174, 122], [200, 126], [226, 122], [254, 106]], ['body', 'body']);
  b.step('머리 띠', '몸통 위쪽에 아래로 볼록한 줄을 가로로 그어요.', tip);

  const win = b.closed('win', ellipse(200, 204, 44, 44));
  b.step('동그란 창', '줄 아래 가운데에 큰 동그란 창을 그려요.', win);

  const winIn = b.closed('winIn', ellipse(200, 204, 30, 30));
  b.step('창 안쪽', '창 안에 조금 작은 동그라미를 하나 더 그려요.', winIn);

  const finL = b.open('finL', [[122, 262], [92, 282], [68, 326], [66, 382], [82, 390], [104, 364], [138, 344]], ['body', 'body']);
  const finR = b.open('finR', [[278, 262], [308, 282], [332, 326], [334, 382], [318, 390], [296, 364], [262, 344]], ['body', 'body']);
  b.step('날개 두 개', '몸통 양옆 아래에 둥근 날개를 하나씩 그려요.', finL, finR);

  const band = b.open('band', [[118, 290], [158, 306], [200, 310], [242, 306], [282, 290]], ['body', 'body']);
  b.step('아래 띠', '날개 사이에 아래로 볼록한 줄을 하나 더 그어요.', band);

  const nozzle = b.open('nozzle', [[172, 358], [170, 380], [184, 388], [216, 388], [230, 380], [228, 358]], ['body', 'body']);
  b.step('불 나오는 곳', '몸통 바닥에 작고 둥근 통을 붙여요.', nozzle);

  const flame = b.open('flame', [
    [180, 388], [160, 420], [168, 432], [184, 422], [200, 470], [216, 422], [232, 432], [240, 420], [220, 388],
  ], ['nozzle', 'nozzle']);
  const flameIn = b.open('flameIn', [[192, 388], [194, 412], [200, 428], [206, 412], [208, 388]], ['nozzle', 'nozzle']);
  b.step('불꽃', '통 아래로 출렁이는 불꽃을 두 겹으로 그려요.', flame, flameIn);

  const st1 = b.closed('st1', star(66, 132, 24, 11));
  const st2 = b.closed('st2', star(340, 200, 18, 8));
  b.step('별 두 개', '로켓 양옆 빈 곳에 반짝이는 별을 두 개 그려요.', st1, st2);

  return {
    id: 'rocket-v2', title: '로켓(시안)', theme: 'thing', difficulty: 'normal', grades: ['middle'],
    paper: 'portrait', viewBox: '0 0 400 500',
    setupSay: '종이를 세로로 놓고, 가운데에 손바닥만큼 길게 그릴 거예요.',
    coloringSeconds: 150, steps: b.steps, keywords: ['탈것', '로켓', '우주', '시안'],
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
  writeFileSync(join(ROOT, 'refs', `${REF_NAME[dw.id]}.svg`), refSvg(dw));
  console.log(`${dw.id} — ${dw.steps.length}단계`);
}
