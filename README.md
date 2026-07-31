# 짬짬이 그리기

교사가 그림 하나를 고르면, 화면이 완성까지의 선을 한 획씩 차례로 보여 주어
학생들이 각자 종이에 따라 그릴 수 있게 하는 전자칠판용 웹서비스입니다.

> 교사는 시작만 누르고, 화면이 한 획씩 이끈다. 비뚤어도 완성되면 그럴듯하다.

요구사항은 [짬짬이_그리기_PRD.md](짬짬이_그리기_PRD.md)에 있습니다. 이 README는 실행 방법만 적습니다.

## 실행

```bash
npm run dev      # http://localhost:4173
npm test         # 그림 데이터 전수 검증 (PRD 9장)
npm run bundle   # drawings/*/drawing.json → data/drawings.json
```

빌드 단계가 없습니다. `npm run dev`는 확인용 정적 서버이고, 배포는 GitHub Pages입니다.

## 조작

시작을 누른 뒤에는 교사 조작이 없습니다(자동 모드). 필요할 때만 씁니다.

| 키 | 동작 |
|---|---|
| `Space` `→` `PageDown` `Enter` | 다음 획 |
| `←` `PageUp` | 한 획 뒤로 (자동 진행도 함께 멈춤) |
| `R` | 방금 획 다시 보기 (그 단계 타이머도 처음부터) |
| `P` | 자동 진행 멈춤·재개 |
| `1` `2` `3` | 느리게 · 보통 · 빠르게 (지금 단계의 남은 시간에 바로 적용) |
| `C` | 완성본 잠깐 보기 (누르고 있는 동안만) |
| `F` | 전체화면 |
| `Esc` | 나가기 — 화면 안 확인에서 `Enter` 나가기 · `Esc` 계속하기 |

프레젠터 리모컨의 `PageUp`·`PageDown`을 받습니다. 글자 키는 `e.code`로 읽어
한글 입력 상태에서도 동작합니다.

## 그림 추가

1. `tools/author.html`을 열어 획을 긋습니다. `steps[].d` 배열과 멘트 검사가 그 자리에서 나옵니다.
2. 결과를 `drawings/<id>/drawing.json`으로 저장하고 `drawings/list.json`에 id를 넣습니다.
3. `npm run bundle && npm test`
4. `tools/sheet.html`에서 누적 형태를 눈으로 봅니다 — 기계로 판정할 수 없는 마지막 관문입니다.

`drawings/<id>/drawing.json`이 원본입니다. `data/drawings.json`은 파생물이고,
어긋나면 `npm test`가 잡습니다.

## 폴더

```
index.html  css/  js/          앱 (HTML·CSS·바닐라 JS)
drawings/<id>/drawing.json     그림 원본 — 하나가 파일 하나
drawings/list.json             그림 순서
data/drawings.json             통합본 (앱이 읽는 1요청)
scripts/validate.mjs           PRD 9장 전수 검증 (의존성 없음)
scripts/bundle.mjs             통합본 생성
scripts/serve.mjs              확인용 정적 서버
tools/author.html              획 저작 도구        (배포 제외)
tools/sheet.html               단계 검토 시트      (배포 제외)
tools/favicons.html            가족 아이콘 비교    (배포 제외)
sw.js  manifest.webmanifest    오프라인 (PWA)
```

## 배포

`main`에 올리면 `.github/workflows/pages.yml`이 `npm test`를 돌리고 GitHub Pages에 올립니다.
`tools/`와 `drawings/`는 배포에 들어가지 않습니다.

저장소 설정에서 **Pages → Source 를 GitHub Actions** 로 한 번 바꿔 주어야 합니다.

## 오프라인

PWA는 **한 번은 온라인에서 열어야** 캐시가 생깁니다. 캐시가 끝나면 홈의 안내문이
`준비 끝 — 이제 인터넷 없이도 됩니다.`로 바뀝니다. 교실에 들고 가기 전에 한 번 열어 두세요.
