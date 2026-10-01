import { bench, ellipse } from './lib.mjs';

// ================================================================ 김밥과 도시락 — 참조: refs/gimbap-box.png
// 참조의 소용돌이 단면은 김밥으로 보이지 않아 김(바깥 동그라미)·밥 테두리·속 재료로 바꿨습니다.
// 김밥은 서로 겹치지 않게 세 개로 줄였고, 젓가락은 도시락 뒤 테두리에서 솟은 가는 닫힌 모양처럼 그립니다.
// 도시락 앞면에는 작은 얼굴을 넣었습니다.

// 테두리 위 두 점에서 솟아 끝이 둥근 막대(젓가락) — 양 끝이 테두리에 닿습니다.
const stick = (bx, by, dx, dy, L, w0, w1) => {
  const l = Math.hypot(dx, dy); const ux = dx / l; const uy = dy / l;
  const nx = -uy; const ny = ux;
  const at = (t, s) => [bx + ux * L * t + nx * s, by + uy * L * t + ny * s];
  return [
    at(0, w0 / 2), at(0.5, (w0 + w1) / 4), at(1, w1 / 2),
    [bx + ux * (L + w1 * 0.6), by + uy * (L + w1 * 0.6)],
    at(1, -w1 / 2), at(0.5, -(w0 + w1) / 4), at(0, -w0 / 2),
  ];
};

// 좌표는 참조를 놓고 읽은 뒤 그림 전체를 가운데로 옮깁니다.
const DX = -20;
const T = (pts) => pts.map(([x, y]) => [x + DX, y]);

export default function draw() {
  const b = bench();
  const box = b.closed('box', T([
    [100, 218], [280, 216], [460, 218], [474, 224], [476, 236], [464, 246],
    [458, 272], [454, 320], [446, 352], [426, 362], [280, 364], [134, 362],
    [114, 352], [106, 320], [102, 272], [96, 246], [84, 236], [86, 224],
  ]));
  b.step('도시락', '종이 아래쪽에 모서리가 둥근 넓은 도시락을 그려요.', box);

  const rim = b.open('rim', T([[96, 246], [190, 249], [280, 250], [370, 249], [464, 246]]), ['box', 'box']);
  b.step('도시락 테두리', '도시락 위쪽에 옆으로 테두리 줄을 그어요.', rim);

  // 김밥 세 개 — 양옆 김밥은 아래가 도시락에 가려지고, 가운데 김밥은 뒤쪽에 올라앉았습니다.
  const R = 60;
  const C = T([[160, 166], [280, 104], [400, 166]]);
  // 아래가 가려진 원호: 왼쪽 아래(도시락 위)에서 위로 돌아 오른쪽 아래(도시락 위)로
  const sideArc = (cx, cy) => {
    const pts = [];
    for (let deg = 122; deg <= 418.1; deg += 24.67) {
      const t = (deg * Math.PI) / 180;
      pts.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]);
    }
    return pts;
  };
  const gL = b.open('gL', sideArc(...C[0]), ['box', 'box']);
  b.step('왼쪽 김밥', '도시락 왼쪽 위에 주먹만큼 둥근 김밥을 그려요.', gL);
  const gR = b.open('gR', sideArc(...C[2]), ['box', 'box']);
  b.step('오른쪽 김밥', '도시락 오른쪽 위에도 둥근 김밥을 그려요.', gR);
  const gM = b.closed('gM', ellipse(C[1][0], C[1][1], R, R, 12));
  b.step('가운데 김밥', '두 김밥 사이 조금 위에 김밥을 하나 더 그려요.', gM);

  const rimL = b.open('rimL', T([[86, 226], [84, 170], [90, 120], [108, 94], [140, 86], [190, 84], [222, 84]]), ['box', 'gM']);
  const rimR = b.open('rimR', T([[338, 84], [370, 84], [420, 86], [452, 94], [470, 120], [476, 170], [474, 226]]), ['gM', 'box']);
  b.step('뒤쪽 테두리', '김밥 뒤로 도시락 뒤쪽 테두리를 이어 그려요.', rimL, rimR);

  const rice = C.map(([x, y], k) => b.closed(`rice${k}`, ellipse(x, y, 36, 36, 10)));
  b.step('밥 테두리', '김밥마다 안쪽에 동그라미를 하나씩 그려요.', ...rice);

  // 속 재료는 김밥마다 조금씩 돌려 놓아 얼굴처럼 보이지 않게 합니다.
  const ROT = [20, 80, -40];
  const at = (k, deg, r) => {
    const t = ((deg + ROT[k]) * Math.PI) / 180;
    return [C[k][0] + Math.cos(t) * r, C[k][1] + Math.sin(t) * r];
  };
  const radish = C.map((_, k) => {
    const [x, y] = at(k, -90, 16);
    return b.closed(`radish${k}`, [[x - 7, y - 7], [x + 7, y - 7], [x + 7, y + 7], [x - 7, y + 7]], 0.45);
  });
  b.step('단무지', '밥 동그라미 안에 작은 네모를 하나씩 그려요.', ...radish);

  const ham = C.map((_, k) => { const [x, y] = at(k, 30, 16); return b.closed(`ham${k}`, ellipse(x, y, 6.5, 6.5)); });
  b.step('햄', '단무지 옆에 작은 동그라미를 하나씩 그려요.', ...ham);

  const spinach = C.map((_, k) => {
    const [x, y] = at(k, 150, 14);
    return b.closed(`spinach${k}`, ellipse(x, y, 5, 9.5, 8, ((60 + ROT[k]) * Math.PI) / 180));
  });
  b.step('시금치', '남은 자리에 길쭉한 동그라미를 하나씩 그려요.', ...spinach);

  const st1 = b.open('st1', stick(140 + DX, 86, -0.8, -0.6, 90, 16, 12), ['rimL', 'rimL']);
  const st2 = b.open('st2', stick(180 + DX, 84, -0.74, -0.67, 94, 16, 12), ['rimL', 'rimL']);
  b.step('젓가락', '뒤쪽 테두리 왼쪽에 가는 젓가락을 두 개 그려요.', st1, st2);

  const eyeL = b.closed('eyeL', ellipse(248 + DX, 296, 6, 8));
  const eyeR = b.closed('eyeR', ellipse(312 + DX, 296, 6, 8));
  b.step('눈 두 개', '도시락 가운데에 작은 눈을 두 개 그려요.', eyeL, eyeR);

  const mouth = b.closed('mouth', T([[268, 316], [280, 319], [292, 316], [288, 326], [280, 330], [272, 326]]));
  b.step('웃는 입', '눈 사이 아래에 작게 웃는 입을 그려요.', mouth);

  return {
    id: 'gimbap-box', title: '김밥과 도시락', theme: 'food', difficulty: 'hard', grades: ['upper'],
    paper: 'landscape', viewBox: '0 0 500 400',
    setupSay: '종이를 가로로 놓고, 아래쪽에 손바닥만큼 큰 도시락부터 그릴 거예요.',
    coloringSeconds: 180, steps: b.steps, keywords: ['음식', '김밥', '도시락'],
  };
}
