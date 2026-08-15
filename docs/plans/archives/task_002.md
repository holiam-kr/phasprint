# task_002: P0 — 관측 가능하게 만들고, 승인 상태를 표현한다

## Goal

리뷰 20건 중 **높음 3건 전부**(지적 1·2·3)와 지적 11·14·17을 닫는다. 나머지 지적을 손대기
전에 이것이 먼저인 이유는 하나다 — **지금은 훅이 왜 그렇게 동작했는지 알 방법이 없고
(지적 2 원인 미확정), 회귀를 잡을 테스트도 없다(지적 3).** 그 위에 다른 변경을 쌓으면 버그를
그대로 안고 가면서 여전히 모른다.

## Scope

**In**

| 대상 | 변경 |
|---|---|
| `hooks/core.cjs` · `gate.cjs` · `finish-gate.cjs` | 예상 못 한 예외를 `systemMessage` 로 노출 (fail open 유지) |
| `hooks/lib/plans.cjs` (신규) | `activePlans()` 단일 구현 |
| `test/` (신규) | `node --test` 표 기반 테스트 |
| `docs/plans/{draft,approved,archives}/` | 승인 상태를 디렉토리로 표현 |
| `skills/sprint/SKILL.md` | 계획서 경로·승인 절차, 중단 사유에 "승인 대기" 추가 |
| `commands/plan.md` · `go.md` · `report.md` | 위 경로 반영, `/go` 의 계획서 0건 경로 정의 |
| `README.md` · `README.ko.md` · `plugin.json` | 정합 + 0.4.0 |

**Out** — 지적 4·5·6·7·8·9·10·12·13·15·16·18·19·20. 특히:

- **마커 스킴은 걷어내지 않는다.** 지적 2의 원인이 미확정인 상태에서 구조를 바꾸면 원인 규명이
  영영 불가능해진다. 이번엔 **관측 가능하게만** 만들고, 다음 발생 시 증거로 판단한다.
- `PostToolUse` 훅 신설(Evidence 규칙의 관측 뒷받침) — 별도 타스크.
- core 항목 삭제·계층화 — 별도 타스크.

## Design

**택한 접근** — 두 축을 동시에 건다. ① 훅이 자기 고장을 말하게 하고 테스트로 고정한다.
② 승인 상태를 **디렉토리 위치**로 표현해 훅이 추측하지 않게 한다.

**기각한 대안**

| 대안 | 기각 이유 |
|---|---|
| `.phasprint/state.json` 상태 머신 (외부 로드맵 제안) | OMC가 실제로 구현했고 그 대가가 코드에 남아 있다 — `CANCEL_SIGNAL_TTL_MS=30초`, `RALPLAN_STOP_BLOCKER_TTL_MS=45분`, `TEAM_PIPELINE_..._TTL_MS=5분`, `AWAITING_CONFIRMATION_TTL_MS=2분`, 쓰기 락, 고아 상태 수거. 전부 "LLM이 상태를 안 지웠을 때" 방어 장치다. OMC plan 스킬 자신이 그 실패를 경고한다(`SKILL.md:92`). 15파일 플러그인이 감당할 비용이 아니다 |
| 계획서 본문에 `## Approval: pending/approved` 줄 | 파싱이 필요하고 문구 표류에 취약하다. 디렉토리는 파싱이 없고 사용자가 파일 위치만 봐도 상태를 안다 |
| `PHASPRINT_DEBUG=1` 진단 로그 | 디버그 플래그는 정작 문제가 터졌을 때 꺼져 있다. 지적 2가 그 증거다. fablize는 항상 `systemMessage` 로 노출한다 |
| 마커 스킴을 fablize식 매 프롬프트 리셋으로 교체 | 방향은 옳지만 지적 2 원인 미확정 상태에서 하면 증거가 사라진다. 관측성 확보 후 판단 |
| 승인 없이 지적 4~20을 함께 처리 | 범위 폭증. 관측성·테스트 없이 20건을 건드리면 회귀를 못 잡는다 |

**승인 상태 = 디렉토리**

```
docs/plans/
  draft/     task_NNN.md   승인 대기 — 훅은 "완주하라"고 말하지 않는다
  approved/  task_NNN.md   승인됨   — 훅이 완주를 유도한다
  archives/  task_NNN.md   완료
  task_NNN.md              레거시(직속) → draft 로 간주
```

`activePlans()` 는 `approved/` 만 읽는다. 전이는 사용자 승인 → `/go` 의 첫 동작이 이동,
`/report` 의 마지막 동작이 `archives/` 로 이동. 파일시스템 연산 한 번이라 검증이 쉽고
사용자 눈에 보인다.

**마이그레이션** — `docs/plans/` 직속의 기존 `task_*.md` 는 **draft 로 간주**한다. 기존 사용자의
계획서가 갑자기 "승인됨"이 되어 완주 압력을 받는 것보다, 조용해지는 쪽이 안전하다.

**예외 노출 범위** — 모든 예외를 떠들면 안 된다. `docs/plans/` 부재(ENOENT)는 정상 경로다.
**예상된 실패는 그대로 침묵, 예상 못 한 예외만 `systemMessage`.**

## Steps

### 1. 훅이 자기 고장을 말하게 한다

- 산출물
  - `hooks/core.cjs` · `gate.cjs` · `finish-gate.cjs` — 최상위 catch에서
    `{"systemMessage": "phasprint <hook> failed open: <err>"}` 출력. 종료 코드는 0 유지
  - 내부 catch는 **예상/예상 밖**을 구분. `readdir` 의 ENOENT·ENOTDIR 은 침묵,
    그 외는 상위로 전파
- 검증
  - `node --check` 3파일
  - 정상 입력에서 기존 출력이 **바이트 단위로 동일**한지 확인 (회귀 없음)
  - 고의 오류 주입(읽기 권한 없는 마커 디렉토리)에서 `systemMessage` 가 나오는지 확인

### 2. 테스트 하네스 구축 — 현재 동작을 고정한다

- 산출물
  - `test/hooks.test.mjs` — `node --test` 표 기반. 훅을 자식 프로세스로 실행하고
    stdin JSON → stdout 을 검증
  - 최소 케이스: core 주입 내용 / gate 의 계획서 유무별 출력 / finish-gate 8종
    (세션 1회차 차단, 2회차 침묵, id 없음, 새 세션 차단, `stop_hook_active`, 계획서 0건,
    레거시 빈 마커, 동시 세션)
  - **지적 2 재현 케이스를 명시적 테스트로 포함** — 마커 존재 시 침묵이 보장되는지
- 검증
  - `node --test test/` 전건 통과 출력
  - 1단계 변경 **이전** 커밋에서도 통과하는지 확인(테스트가 기존 동작을 고정함을 입증)

### 3. 승인 상태를 디렉토리로 표현한다

- 산출물
  - `hooks/lib/plans.cjs` — `activePlans(cwd)` 단일 구현. `approved/` 만 읽는다.
    두 훅이 이걸 `require` (지적 11 해소)
  - `finish-gate.cjs` 의 되물음 문구에 **"계획서 승인 대기"를 정당한 중단 사유로 추가**
    (지적 1의 직접 원인)
  - `gate.cjs` — `approved/` 에만 반응. draft 는 언급하지 않는다
  - `skills/sprint/SKILL.md` — §2는 `draft/` 에 쓰고 대기, `/go` 가 `approved/` 로 이동,
    §4 중단 조건에 승인 대기 추가
  - `commands/go.md` — `approved/` 0건일 때: `draft/` 에 있으면 "승인이 필요하다"고 보고,
    아무것도 없으면 `/plan` 을 안내 (지적 14 해소)
  - `commands/plan.md` · `report.md` — 경로 반영
  - 마이그레이션: `docs/plans/` 직속 `task_*.md` 는 draft 취급
- 검증
  - 2단계 테스트에 승인 상태 케이스 추가 후 `node --test test/` 전건 통과
  - `draft/` 에만 계획서가 있을 때 두 훅이 **침묵**하는지 실행 확인
  - `approved/` 로 옮기면 gate 가 반응하고 finish-gate 가 차단하는지 실행 확인
  - 레거시 직속 파일이 draft 로 취급되는지 실행 확인

### 4. 정합성 · 지적 17 확인 · 적대 리뷰

- 산출물
  - `README.md` · `README.ko.md` — 문서 레이아웃 표, 훅 설명, 중단 조건
  - `.claude-plugin/plugin.json` 0.4.0
  - 지적 17 확인 결과 기록
- 검증
  - `node -e` 로 `plugin.json` 파싱, 두 README 항목 수 일치
  - `grep` 스윕 — `docs/plans/` 경로 언급이 전 파일에서 일치하는지
  - **지적 17**: 갱신 설치 후 `/plan` 을 실제 실행해 스킬 본문이 로드되는지 관찰.
    이 단계는 사용자 실행이 필요하므로, 그 전까지는 **unverified** 로 표기
  - `node --test test/` 최종 전건 통과 + 적대 리뷰 보고

## Risks / unverified

- **지적 2는 이번 타스크로 닫히지 않는다.** 원인은 여전히 미확정이고, 이번 변경은 *다음
  발생 시 원인을 알 수 있게* 만드는 것이 목적이다. 계획서 완료 시점에도 **unverified** 로 남는다.
- **지적 17은 사용자 실행 없이 확인 불가.** 4단계 검증 항목 중 이것만 세션 안에서 못 닫는다.
- **기존 사용자 영향** — `docs/plans/` 직속 계획서를 쓰던 리포는 훅이 조용해진다. 의도한
  동작이지만(승인 여부를 모르므로 안전한 쪽), 사용자가 "훅이 안 뜬다"고 느낄 수 있다.
  README에 마이그레이션 한 줄을 넣는다.
- `docs/` 가 `.gitignore` 되어 이 계획서와 리뷰 문서는 커밋되지 않는다(지적 7, 이번 범위 밖).
- 훅 테스트가 자식 프로세스 실행에 의존하므로 Windows 경로 처리에서 다르게 동작할 수 있다.
  이번 검증은 macOS 에서만 이루어진다 — 타 플랫폼은 **unverified**.
