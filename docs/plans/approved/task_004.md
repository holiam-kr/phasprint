# task_004: Evidence 규칙을 관측으로 뒷받침한다 (PostToolUse)

## Goal

core의 **Evidence** 규칙("완료·통과 주장은 이번 세션 실행 출력으로만")은 지금 **프롬프트 부탁**
으로만 존재한다. 모델이 검증을 돌리지 않고 "테스트 통과"라고 말해도 하네스는 알 방법이 없다.

`PostToolUse` 훅으로 실제 도구 결과를 관측해, 그 주장을 **기록과 대조**할 수 있게 한다.

리뷰 대조에서 확인된 유일한 구조적 차이다 — fablize와 OMC 둘 다 `PostToolUse` 를 걸고,
phasprint만 없다. fablize `verify_state.py` 주석: *"The decision is made purely from observed
ledger state — never from the assistant's claim text."*

## Scope

**In**

| 대상 | 변경 |
|---|---|
| `hooks/observe.cjs` (신규) | `PostToolUse` — 도구 결과를 원장에 적립. **출력 없음** |
| `hooks/lib/ledger.cjs` (신규) | 턴 단위 원장 읽기·쓰기·리셋 |
| `hooks/gate.cjs` | 매 턴 원장 리셋 (이미 `UserPromptSubmit` 에서 돈다) |
| `hooks/finish-gate.cjs` | 되물음 문구에 **관측된 사실**을 넣는다 |
| `hooks/hooks.json` | `PostToolUse` 등록 |
| `test/` | 원장·파서 표 기반 테스트 |
| README 2종 · `HANDOFF.md` · 0.6.0 | 문서 |

**Out**

- **작업 분류(quick/normal/deep)** — fablize는 `classify_task.py` 67줄로 프롬프트를 정규식
  분류한다. phasprint는 그게 필요 없다. 아래 Design 참조
- **차단 조건 신설** — `Stop` 훅의 "세션당 1회"를 깨지 않는다. 기존 되물음을 **풍부하게** 할 뿐
- 시크릿 자동 탐지·차단 — 원장에 적히는 값은 마스킹하되, 사용자 파일 쓰기는 건드리지 않는다
- 지적 2의 원인 규명 — 여전히 재발 대기

## Design

**택한 접근** — 관측은 항상, 판정은 계획서가 있을 때만.

`observe.cjs` 는 아무것도 출력하지 않고 원장에만 적는다. 판정은 `finish-gate.cjs` 가 하되,
**승인된 계획서가 있을 때만** 한다.

**왜 계획서를 신호로 쓰는가** — fablize는 "이 작업이 검증을 강제할 만큼 무거운가"를 알아내려고
프롬프트를 `quick`/`normal`/`deep` 으로 정규식 분류한다. 그리고 그 판정이 빗나가 규칙 하나를
지웠다 — `verify_state.py` 주석: *"the old 'add observable proof' nag was a false-positive on
~1/3 of deep firings"*.

**phasprint에는 더 나은 신호가 이미 있다.** `docs/plans/approved/` 에 계획서가 있다는 것은
사용자가 "이건 여러 단계짜리 진짜 작업"이라고 이미 판정했다는 뜻이다. 정규식으로 추측할 필요가
없다. 그리고 계획서를 쓰지 않는 리포에서는 아무 말도 하지 않는다는 phasprint의 약속도 지켜진다.

**기각한 대안**

| 대안 | 기각 이유 |
|---|---|
| fablize식 프롬프트 분류 도입 | 67줄 정규식 + 유지보수. 승인된 계획서라는 더 정확한 신호가 이미 있다 |
| 관측 결과로 **새 차단 조건**을 만든다 | `Stop` 훅이 세션당 2회 개입하게 된다. "완주를 유도하되 함정이 되지 않는다"는 설계 의도와 충돌 |
| `PostToolUse` 에서 즉시 경고를 띄운다 | 매 도구 호출마다 출력이 붙는다. fablize도 실패가 **반복될 때만** 말한다 |
| 원장을 리포 안(`.phasprint/`)에 둔다 | 사용자 리포를 오염시킨다. 턴 단위라 영속성이 필요 없다 |
| 텍스트 정규식으로 성패 판정 | 아래 참조 — 참조 구현에 실제 결함이 있다 |

**베끼지 말아야 할 것 — fablize의 성패 판정 결함**

`parse_tool_result.py` 의 `exit_success()` 는 구조화된 종료 코드가 없을 때 정규식으로 넘어간다:

```python
FAILURE_RE = r"(?i)(... |failed|failure|...)"      # 먼저 검사
SUCCESS_RE = r"(?i)\b(passed|success|...|0 failed|...)\b"
```

`FAILURE_RE` 를 먼저 보므로 **`"5 passed, 0 failed"` 가 실패로 기록된다** — 통과한 테스트
출력이 실패로 잡힌다. 우리는 반대로 간다: **구조화된 종료 코드만 신뢰하고, 없으면 "모름"으로
남긴다.** 모르는 것을 추측으로 채우지 않는 게 이 하네스의 규칙이다.

**원장 스키마** (턴 단위, `UserPromptSubmit` 마다 리셋)

```json
{
  "changed": false,
  "change_kinds": ["code"],
  "verifications": [{ "command": "node --test", "ok": true }],
  "failures": [{ "tool": "Bash", "detail": "exit 1" }],
  "updated_at": "..."
}
```

**입력 필드** — 참조 구현이 읽는 이름들: `tool_name`, `tool_input.command`(Bash),
`tool_input.file_path`(Edit/Write), `tool_response` 아래의 `exit_code`/`exitCode`/`returncode`/
`status`/`success`/`ok`. **이 목록은 fablize 소스에서 온 것이지 실측이 아니다.** 그래서 1단계가
실제 페이로드 확보다.

## Steps

### 1. 실제 페이로드를 먼저 확보한다

- 산출물: `hooks/observe.cjs` 초판 — `PHASPRINT_RECORD=1` 일 때 받은 페이로드 원문을
  원장 디렉토리에 덤프한다(시크릿 마스킹 적용). 그 외에는 아무것도 하지 않는다.
  `hooks/hooks.json` 에 `PostToolUse` 등록
- 검증: `/reload-plugins` 후 Bash·Edit 를 한 번씩 실행하고 덤프를 열어
  **`tool_name` · 종료 코드 필드명 · 성공 여부 표현**을 확인한다.
  → **이 단계는 세션 왕복이 필요하다.** 확인 전까지 파서는 쓰지 않는다

### 2. 원장과 파서

- 산출물
  - `hooks/lib/ledger.cjs` — 턴 단위 읽기·쓰기·리셋. `sha1(session_id|cwd)` 키
  - `hooks/observe.cjs` — 1단계에서 확인한 필드로 변경 파일·검증 명령·실패를 적립.
    **성패는 구조화된 종료 코드로만 판정**하고, 없으면 `ok: null`
  - 시크릿 마스킹: 원장에 들어가는 명령·출력은 앞뒤 4자만
- 검증
  - 표 기반 테스트: 종료 코드 0/1/없음, Edit/Write/Bash, 마스킹, 잘못된 JSON
  - `PHASPRINT_RECORD` 없이 실행했을 때 **표준출력이 완전히 비는지** 확인

### 3. 배선 — 리셋과 활용

- 산출물
  - `hooks/gate.cjs` — 매 턴 원장 리셋 (승인 계획서 유무와 무관하게)
  - `hooks/finish-gate.cjs` — 승인된 계획서가 있을 때, 되물음 문구에 관측 사실을 덧붙인다:
    이번 턴에 파일이 바뀌었는지, 성공한 검증 명령이 관측됐는지. **차단 조건은 늘리지 않는다**
- 검증
  - 원장에 검증 성공이 있을 때와 없을 때 되물음 문구가 달라지는지 테스트
  - 계획서가 없으면 원장이 쌓여도 `finish-gate` 가 침묵하는지 테스트
  - `Stop` 훅이 여전히 **세션당 1회**인지 기존 테스트 전건 통과

### 4. 문서 + 적대 리뷰

- 산출물: README 2종의 훅 표에 `PostToolUse` 추가, `HANDOFF.md` 갱신,
  `docs/decisions/` 에 "관측은 항상, 판정은 계획서가 있을 때만" 기록, 0.6.0
- 검증: `node --test` 전건 통과, `plugin.json` 타입 검사 통과, 적대 리뷰 보고

## Risks / unverified

- **1단계가 통과하지 못하면 나머지가 무의미하다.** 페이로드 필드명은 현재 **unverified** —
  fablize 소스에서 유추했을 뿐 실측이 아니다. 확인 전에 파서를 쓰면 지적 16(매니페스트를
  스키마 확인 없이 고쳐 플러그인을 내린 것)을 그대로 반복한다.
- **원장을 `os.tmpdir()` 에 두는데, 지적 2가 바로 그 디렉토리에서 난 미해결 이상 현상이다.**
  마커가 쓰였는데 반영되지 않은 원인을 아직 모른다. 같은 저장소에 원장을 얹으면 같은 증상이
  재현될 수 있다. 되읽기 검증을 원장에도 적용하고, 실패 시 `systemMessage` 로 알린다.
- **관측 자체가 비용이다.** `PostToolUse` 는 Bash·Edit·Write 매 호출마다 프로세스를 하나 띄운다.
  fablize `docs/MEASUREMENT_PROTOCOL.md` §1의 "하네스 역설" — 게이트가 오히려 마이너스일 수
  있다는 경고가 여기에도 적용된다. 이번 범위에 측정은 없으므로 **효과는 unverified 로 남는다.**
- 검증 명령 판별(무엇이 "검증"인가)은 결국 휴리스틱이다. 1단계 실측 후 목록을 좁게 시작하고,
  놓치는 쪽(false negative)을 택한다 — 잘못 걸리는 것보다 낫다.
- 턴 경계는 `UserPromptSubmit` 이다. 서브에이전트가 도는 동안의 도구 호출이 어느 턴에 적립되는지
  **unverified** — 1단계에서 같이 확인한다.
