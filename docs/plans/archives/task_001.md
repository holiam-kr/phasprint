# task_001: 설계를 승인 대상에 포함시킨다

## Goal

phasprint의 태그라인은 "Agree on the design, then run the implementation to completion" 인데
정작 승인받는 문서(`docs/plans/task_NNN.md`)에는 설계 항목이 없다. 사용자가 승인하는 것은
"무엇을, 어떤 순서로"(Goal / Scope / Steps)이지 "어떻게"가 아니다. 그 결과 (1) 밑에 깔린
구조가 틀린 계획서도 게이트를 통과하고, (2) 설계 근거는 구현이 끝난 뒤에야
`docs/decisions/` 에 기록된다(`skills/sprint/SKILL.md:93`, `commands/report.md:11` — 둘 다
step 6).

승인 게이트는 **1개로 유지**한 채, 그 1개가 승인하는 내용에 설계를 포함시킨다.

## Scope

**In**

- `hooks/core.cjs` — 설계 관련 **행동** 규칙 1개 추가 (문서 요구가 아님)
- `skills/sprint/SKILL.md` — 계획서 템플릿에 조건부 `## Design` 절 + 작성 트리거 규칙
- `commands/plan.md` — 스킬과 문구 정합
- `README.md` / `README.ko.md` — core 규칙 나열 및 계획서 설명 갱신
- `.claude-plugin/plugin.json` — 0.3.0 → 0.4.0

**Out**

- 새 디렉토리(`docs/design/`) 신설 — 문서 트리를 늘리지 않는다
- 두 번째 승인 게이트 / `/design` · `/decide` 커맨드 신설
- 미처리 리뷰 지적 사항(훅 테스트 부재, `.gitignore` 의 `docs/` 제외, `HANDOFF.md` 경로 충돌 등)
- `hooks/gate.cjs`, `hooks/finish-gate.cjs`, `skills/investigate/SKILL.md`

## Design

- **택한 접근** — 설계를 계획서 안의 조건부 절로 넣는다. 기본값은 "쓰지 않음"이고, 명시된
  트리거에 걸릴 때만 작성한다. 층은 둘로 나눈다: **core** 에는 행동 규칙(대안을 제시하고
  사용자가 고르게 한다), **cycle** 에는 문서(계획서의 `## Design`).

- **기각한 대안**

  | 대안 | 기각 이유 |
  |---|---|
  | `/design` 별도 게이트 (Kiro·spec-kit 방식) | 승인 게이트가 2개가 되어 README가 내세운 "게이트는 계획서 한 곳"이 깨진다. `README.md:16` 이 비판한 "한 줄 수정에도 설계·승인을 요구하는 스킬"이 자기 자신에게 적용된다 |
  | `docs/design/task_NNN.md` 별도 트리 | 문서 트리가 4개로 늘고 `docs/decisions/` 와 역할이 겹친다. 설계가 한 화면을 넘길 만큼 길다면 그건 문서를 쪼갤 신호가 아니라 **타스크를 쪼갤 신호**로 처리한다 |
  | core 에 "설계 문서를 써라" 추가 | core는 모든 프로젝트·모든 세션에 주입된다. 문서 요구를 넣으면 README가 명시한 "core에는 계획서 요구가 없다"는 두 층 분리가 무너진다. 행동 규칙만 넣으면 이 원칙을 지킨다 |
  | 변경 없음 | 승인 대상에 "어떻게"가 없다는 문제가 그대로 남는다 |

- **트리거 (넷 중 하나라도 해당할 때만 작성)** — 새 모듈/서브시스템 / 공개 인터페이스 또는
  영속 자료 구조의 정의·변경 / 의존성 선택 / 되돌리기 비싼 결정. 그 외에는 절 자체를 지운다.

- **기존 참조와의 연결** — 중단 조건 1번은 이미 "departs from the approved plan's scope or
  **design**"(`skills/sprint/SKILL.md:70`) 이라고 설계를 참조하는데, 현재는 가리킬 대상이
  없다. 이 변경으로 그 참조가 실체를 얻는다. 또 `## Design` 의 "기각한 대안"이 step 6에서
  `docs/decisions/` 로 흘러가는 입력이 되어, 사후 기록이 아니라 사전 합의의 산출물이 된다.

- **문체 제약** — `hooks/core.cjs` 는 ASCII 전용(`--`, `->`). 기존 항목과 동일 형식을 따른다.

## Steps

### 1. core 에 Design 행동 규칙 추가

- 산출물: `hooks/core.cjs` 의 `CORE` 배열에 `**Design**` 항목 1개. **Verdict** 바로 뒤에
  배치한다(두 항목 모두 "판단 주체는 사용자"라는 같은 축이다).
- 검증: `node --check hooks/core.cjs` / `node hooks/core.cjs` 출력에 항목이 나오는지 grep /
  `LC_ALL=C grep -n '[^ -~]' hooks/core.cjs` 로 비ASCII 0건 확인

### 2. 계획서 템플릿에 조건부 `## Design` 절 추가

- 산출물: `skills/sprint/SKILL.md` — 템플릿의 `## Scope` 와 `## Steps` 사이에 `## Design`,
  그 아래에 "기본값은 미작성" 트리거 규칙, step 1 문구 정합, step 6에 `docs/decisions/`
  연결 한 줄
- 검증: 템플릿 절 순서와 트리거 4개 항목을 grep 으로 확인. 계획서를 쓰지 않는 경로(core,
  `investigate`)에 설계 요구가 새지 않았는지 grep 으로 확인

### 3. 커맨드·README·버전 정합

- 산출물: `commands/plan.md` 에 Design 절 언급, `README.md` / `README.ko.md` 의 core 규칙
  나열 2곳씩 + 계획서 설명, `.claude-plugin/plugin.json` 0.4.0
- 검증: `node -e` 로 `plugin.json` 파싱, 두 README 의 core 나열 항목 수 일치 확인,
  README 줄바꿈 폭(약 95칸) 유지 확인

### 4. 정합성 점검 + 적대 리뷰

- 산출물: 전 파일 grep 스윕 — core/cycle 층 분리가 지켜졌는지, 게이트가 여전히 1개인지,
  트리거 문구가 세 파일에서 어긋나지 않는지
- 검증: `node hooks/core.cjs` 최종 출력 전문 확인, `git diff --stat`, 적대 리뷰 보고

## Risks / unverified

- **실사용 동작은 이번 세션에서 검증 불가** — 이 변경의 본질은 프롬프트 문구다. "트리거가
  실제로 작동하는가"(사소한 작업에 Design 절이 안 생기는가)는 다음 세션에서 `/plan` 을
  돌려봐야 확인된다. **unverified** 로 남긴다.
- **트리거가 느슨하면 역효과** — Design 절이 매번 생기면 phasprint가 대체하려던 그
  의례주의가 된다. 기본값을 "지운다"로 명시하는 것이 유일한 방어선이다.
- `docs/` 는 `.gitignore` 로 제외되어 이 계획서는 커밋되지 않는다(기존 설계 유지, 이번 범위 밖).
- 훅 단위 테스트가 없다는 기존 지적은 이번 범위 밖이다. 1단계 검증은 실행 출력 grep 으로만 한다.
