import { bench, ellipse } from './lib.mjs';

// ================================================================ 거북이 — 참조: refs/turtle.png, 왼쪽을 봅니다
// 첫 획은 둥근 지붕 같은 등딱지 전체이고, 머리·다리·꼬리는 모두 등딱지(또는 머리)에서 나와 돌아옵니다.
// 등 무늬는 닫힌 동그라미 둘과, 양 끝이 등딱지 테두리에 붙는 가장자리 조각 둘로 줄였습니다.
// 발가락 혹과 등딱지 안쪽 겹줄은 굵은 선에서 뭉쳐 뺐습니다.

export default function draw() {
  const b = bench();
  const shell = b.closed('shell', [
    [152, 160], [172, 122], [204, 92], [248, 68], [296, 60], [344, 70], [384, 100],
    [408, 146], [418, 196], [420, 226], [404, 252], [360, 270], [300, 278],
    [240, 274], [196, 262], [164, 240], [150, 200],
  ]);
  b.step('등딱지', '종이 가운데에 둥근 지붕 같은 등딱지를 크게 그려요.', shell);

  const head = b.open('head', [
    [154, 166], [128, 148], [96, 142], [68, 152], [55, 172], [50, 194], [56, 214],
    [70, 232], [96, 244], [128, 246], [154, 240], [168, 248],
  ], ['shell', 'shell']);
  b.step('동그란 머리', '등딱지 앞쪽에 동그란 머리를 그려요.', head);

  const eye = b.closed('eye', ellipse(100, 188, 7, 9));
  const mouth = b.open('mouth', [[56, 216], [80, 222], [100, 214], [98, 226], [80, 232], [62, 228]], ['head', 'head'], 0.8);
  b.step('눈과 입', '머리 가운데에 까만 눈을 그리고 아래에 웃는 입을 그려요.', eye, mouth);

  const rim = b.open('rim', [[156, 222], [196, 244], [250, 254], [304, 256], [360, 248], [418, 222]], ['shell', 'shell']);
  b.step('등딱지 아랫단', '등딱지 아래쪽을 따라 줄을 하나 그어 아랫단을 만들어요.', rim);

  // 모서리가 둥근 네모 같은 동그라미 — 동전처럼 보이지 않게 조금 각을 줍니다.
  const blob = (x0, y0, x1, y1) => {
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const rx = (x1 - x0) / 2; const ry = (y1 - y0) / 2;
    return Array.from({ length: 16 }, (_, i) => {
      const t = (i / 16) * Math.PI * 2;
      const c = Math.cos(t); const sn = Math.sin(t);
      return [cx + rx * Math.sign(c) * Math.abs(c) ** 0.8, cy + ry * Math.sign(sn) * Math.abs(sn) ** 0.8];
    });
  };
  const patA = b.closed('patA', blob(186, 132, 284, 234));
  const patB = b.closed('patB', blob(300, 138, 392, 236));
  b.step('큰 무늬 두 개', '등딱지 가운데에 둥근 무늬를 두 개 나란히 그려요.', patA, patB);

  const patTop = b.open('patTop', [[240, 72], [246, 92], [270, 102], [304, 102], [330, 92], [338, 72]], ['shell', 'shell']);
  const patL = b.open('patL', [[168, 130], [184, 132], [200, 120], [208, 96]], ['shell', 'shell']);
  const patR = b.open('patR', [[384, 100], [372, 118], [376, 138], [396, 146], [410, 152]], ['shell', 'shell']);
  b.step('가장자리 무늬', '큰 무늬 위로 등딱지 가장자리에 작은 무늬를 그려요.', patTop, patL, patR);

  const legFL = b.open('legFL', [[118, 246], [114, 280], [118, 310], [140, 318], [166, 314], [176, 290], [178, 256]], ['head', 'shell']);
  const legFR = b.open('legFR', [[200, 264], [196, 300], [204, 334], [234, 342], [266, 336], [272, 304], [268, 276]], ['shell', 'shell']);
  const legBL = b.open('legBL', [[296, 278], [294, 296], [306, 306], [330, 306], [342, 296], [340, 276]], ['shell', 'shell']);
  const legBR = b.open('legBR', [[372, 266], [372, 296], [380, 322], [410, 328], [432, 316], [426, 286], [408, 252]], ['shell', 'shell']);
  b.step('다리 네 개', '등딱지 아래에 짧고 통통한 다리를 네 개 그려요.', legFL, legFR, legBL, legBR);

  const tail = b.open('tail', [[416, 204], [434, 208], [450, 206], [440, 220], [420, 232]], ['shell', 'shell'], 0.8);
  b.step('꼬리', '등딱지 뒤쪽에 뾰족한 작은 꼬리를 그려요.', tail);

  return {
    id: 'turtle', title: '거북이', theme: 'animal', difficulty: 'easy', grades: ['lower'],
    paper: 'landscape', viewBox: '0 0 500 400',
    setupSay: '종이를 가로로 놓고, 가운데에 손바닥만큼 크게 그릴 거예요.',
    coloringSeconds: 150, steps: b.steps, keywords: ['동물', '거북이', '바다'],
  };
}
