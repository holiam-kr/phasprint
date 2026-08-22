# task_005: 규율을 플랫폼 중립 문서로 분리하고 3배 압축한다

## Goal

여러 하네스·플랫폼을 오가며 써야 하는데, 지금 규율은 **Claude Code의 스킬 메커니즘에 종속**돼
있다. `SKILL.md` 프론트매터, `${CLAUDE_PLUGIN_ROOT}` 경로, 그리고 core C6의 "follow the
`investigate` skill" 이라는 참조 — 셋 다 다른 플랫폼에서 해소되지 않는다.

규율 텍스트를 **어디서든 읽히는 md 두 개**로 옮기고, 훅은 그 파일을 읽게 한다. 텍스트 원본이
하나가 되므로 드리프트가 구조적으로 불가능해진다. 동시에 15.1 KB → 5 KB 로 압축한다.

## Scope

**In**

| 대상 | 변경 |
|---|---|
| `rules/core.md` (신규) | C1–C7. 플랫폼 중립. `core.cjs` 가 읽는 **유일한 원본** |
| `rules/cycle.md` (신규) | 계획 사이클 P1–P6 + 정지 조건 5개 + 디버깅 프로토콜 I1–I6 |
| `hooks/core.cjs` | 문자열 리터럴 삭제 → `rules/core.md` 를 읽고 절대경로 안내 1줄 덧붙임 |
| `hooks/lib/essentials.cjs` (신규) | `gate.cjs` 의 ESSENTIALS 를 옮겨, `core.cjs` 의 폴백으로 공유 |
| `skills/*/SKILL.md` | 본문 삭제 → 프론트매터 + `rules/cycle.md` 를 가리키는 2줄 스텁 |
| `commands/*.md` | 참조 대상을 `rules/cycle.md` 로, 단계 번호를 새 번호로 |
| `test/consistency.test.mjs` | 스킬에 묶인 6개 테스트를 새 원본에 재조준 |
| README 2종 · `HANDOFF.md` · `docs/decisions/0003` · 0.7.0 | 문서 |

**Out**

- **훅 제거** — 사용자 판단: Claude Code 에서는 유지. 관측 계층이 Evidence 규율을 부탁이
  아니게 만드는 유일한 장치이고, task_004 에서 방금 고친 것이다
- **규율 삭제** — 압축 대상은 중복과 산문이지 규율이 아니다. C1–C7, S1–S5, I1–I6 전건 보존
- **`AGENTS.md` 생성** — 타 도구가 리라이트하는 파일에 정본을 두지 않는다는 기존 판단과 같다.
  필요하면 `rules/core.md` 를 가리키는 얇은 포인터를 나중에 별도로 둔다
- 지적 2 원인 규명 · 관측 비용 측정 — 여전히 미해결로 남긴다

## Design

**택한 접근** — 텍스트는 파일에, 강제는 훅에. 훅은 텍스트를 **읽을 뿐** 담지 않는다.

```
rules/core.md    ~1.8KB   항상 로드. core.cjs 가 읽어 SessionStart 에 주입
rules/cycle.md   ~3.0KB   필요할 때만. 스킬 스텁·커맨드·core 의 안내줄이 가리킴
```

**스킬 종속성을 어디서 끊는가** — 세 군데 전부다.

| 종속 지점 | 현재 | 이후 |
|---|---|---|
| 참조 | core C6: "follow the `investigate` skill" | "the debugging protocol in `rules/cycle.md`" |
| 경로 | `${CLAUDE_PLUGIN_ROOT}/skills/sprint/SKILL.md` | `core.cjs` 가 `__dirname` 으로 절대경로를 계산해 주입 |
| 형식 | 규율이 `SKILL.md` 본문에 있음 | 규율은 `rules/*.md`. `SKILL.md` 는 지워도 무방한 스텁 |

세 번째가 핵심이다. 다른 플랫폼에서는 `skills/` 와 `commands/` 와 `hooks/` 를 통째로 지우고
`rules/` 만 가져가면 된다.

**왜 `${CLAUDE_PLUGIN_ROOT}` 를 안 쓰는가** — 커맨드 본문에서 확장된다는 건 확인했지만
**`SKILL.md` 본문에서도 확장되는지는 unverified** 다. `core.cjs` 는 `__dirname` 을 알고 있으므로
절대경로를 직접 만들 수 있다. 검증되지 않은 확장에 기대는 대신 이미 확실한 값을 쓴다.

**폴백** — `core.cjs` 가 파일을 못 읽으면 그 세션은 규율이 **하나도** 없다. 지금은 리터럴이라
그 실패 모드가 없었으므로, 파일화는 새 위험을 만든다. `gate.cjs` 의 ESSENTIALS 를
`hooks/lib/essentials.cjs` 로 옮겨 양쪽이 공유하고, 읽기 실패 시 core 는 그 압축본 + 경로를 명시한
`systemMessage` 를 낸다. 리터럴이 두 벌 생기지 않는다.

**기각한 대안**

| 대안 | 기각 이유 |
|---|---|
| 정지 조건 S3–S5 를 "core C4 참조"로 접기 | 5개 목록은 `finish-gate.cjs`·README 2종이 **그대로 복창**하는 정본이고, `consistency.test.mjs` 가 그 5개를 강제한다. 2+3 으로 쪼개면 4곳이 어긋나고, 아끼는 건 5줄뿐 |
| 단일 `AGENTS.md` | 계획 사이클과 디버깅 절차가 매 컴팩션마다 재주입된다. core 를 2.3 KB 로 깎아온 설계 의도와 정면 충돌 |
| `SKILL.md` 완전 삭제 | Claude Code 의 자동 트리거("이거 만들어줘", "왜 실패하지")를 잃는다. 스텁은 2줄이고 타 플랫폼에선 지우면 그만이라, 남기는 비용이 지우는 손해보다 작다 |
| 훅에 텍스트를 남기고 md 를 따로 씀 | 두 벌이 갈라진다. 이 리포가 이미 겪은 실패 모드(지적 16) |

**압축 원천** — 규율을 버리지 않고 15.1 KB → 5 KB 를 만드는 근거:

| 항목 | 현재 | 처리 |
|---|---|---|
| sprint `## Isolation` | 0.3 KB | 삭제 (C7 과 거의 같은 문장) |
| 체크리스트 2벌 15줄 | 1.6 KB | 삭제 — 전부 본문 재진술 |
| "When (not) to use" 4개 절 | 1.4 KB | 각 2줄로 압축 |
| 설명성 산문 (근거·예시) | ~5 KB | 판단이 갈리는 곳만 남기고 명령문화 |
| investigate 서두·중복 경고 | 0.9 KB | cycle.md 한 절로 흡수 |

## Steps

### 1. `rules/core.md` 와 폴백 공유

- 산출물
  - `rules/core.md` — C1–C7. C6 의 스킬 참조를 `rules/cycle.md` 경로 참조로 교체
  - `hooks/lib/essentials.cjs` — `gate.cjs` 에서 옮긴 ESSENTIALS 단일 리터럴
  - `hooks/core.cjs` — 리터럴 삭제, `path.join(__dirname, '..', 'rules', 'core.md')` 읽기,
    끝에 `rules/cycle.md` 절대경로 안내 1줄 추가. 읽기 실패 시 ESSENTIALS + `systemMessage`
- 검증
  - `node hooks/core.cjs < /dev/null` 출력이 현재 주입문과 **규율 7개 모두 일치**
  - `rules/core.md` 를 일시적으로 못 읽게 만들었을 때 ESSENTIALS 와 경로가 나오는지
  - `wc -c rules/core.md` ≤ 2000

### 2. `rules/cycle.md` — 병합과 압축

- 산출물: `rules/cycle.md`. 계획 사이클 P1–P6, 정지 조건 5개(번호 유지),
  디버깅 프로토콜 I1–I6, 문서 레이아웃표, 계획서 템플릿
- 검증
  - `wc -c rules/cycle.md` ≤ 3500
  - 정지 조건 5개·디버깅 6단계가 모두 존재하는지 grep
  - 계획서 템플릿의 `## Design` 조건부 규칙, 디렉토리 승인표가 보존됐는지 육안 대조

### 3. 배선 — 스텁·커맨드·테스트

- 산출물
  - `skills/{sprint,investigate}/SKILL.md` — 프론트매터 + `rules/cycle.md` 를 읽으라는 2줄
  - `commands/{plan,go,report}.md` — 참조 대상과 단계 번호 교체
  - `test/consistency.test.mjs` — 스킬에 묶인 6개 테스트를 `rules/*.md` 로 재조준.
    "both skills expose the same top-level sections" 는 전제가 사라지므로 **스텁이
    본문을 갖지 않는지** 검사하는 테스트로 교체
- 검증
  - `node --test` 전건 통과
  - 뮤테이션: `rules/core.md` 에서 규율 1개를 지웠을 때 테스트가 실패하는지

### 4. 문서 + 적대 리뷰

- 산출물: README 2종(스킬 표 → 규율 파일 표, 이식 안내 절 추가), `HANDOFF.md`,
  `docs/decisions/0003-rules-are-files.md`, 0.7.0
- 검증
  - `node --test` 전건 통과, `wc -c rules/*.md` 합계 ≤ 5000
  - `/reload-plugins` 후 실제 세션에서 core 주입문과 `/plan` 동작 확인 (**세션 왕복 필요**)
  - 적대 리뷰 보고

## Risks / unverified

- **`core.cjs` 의 파일 읽기가 새 실패 모드다.** 리터럴은 절대 실패하지 않았다. 플러그인 캐시가
  부분 설치되면 그 세션은 규율 없이 돈다. 폴백을 넣지만, 폴백은 7개가 아니라 3개짜리 압축본이다.
- **`skills/` 스텁이 실제로 트리거되는지 unverified.** 본문이 2줄로 줄면 Claude Code 가
  스킬을 다르게 취급할 가능성이 있다. 4단계 세션 왕복에서 확인한다.
- **커맨드의 단계 번호가 깨지기 쉽다.** 지금 `plan.md`=1-2, `go.md`=3-5, `report.md`=6 으로
  sprint 의 번호에 직결돼 있다. cycle.md 재번호 시 세 파일이 함께 어긋날 수 있어
  테스트로 고정한다.
- **압축이 규율을 흐릴 수 있다.** 산문을 명령문으로 바꾸면 경계 사례의 판단 근거가 사라진다.
  근거가 실제로 판단을 가르는 곳(계획서 예외, investigate 생략 조건, `## Design` 트리거)은
  **줄이지 않는다.**
- 목표 5 KB 는 상한이지 목표치가 아니다. 규율 보존이 우선이고, 넘으면 넘는다고 보고한다.
