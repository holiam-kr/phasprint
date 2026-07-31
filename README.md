# taskcycle

**설계는 합의, 구현은 완주.** / **Agree on the design, then run the implementation to completion.**

[한국어](#한국어) · [English](#english)

---

## 한국어

### 왜 만들었나

에이전트 하네스를 여러 개 겹쳐 쓰면 규칙이 충돌합니다. 특히 이 조합에서:

- 단계마다 사용자 승인을 요구하는 프로젝트 규칙 → 진행이 계속 끊김
- 끝까지 밀어붙이는 자동 완주 루프 → 멈춰야 할 때 안 멈춤
- "너무 단순한 작업은 없다"며 한 줄 수정에도 설계·승인을 요구하는 스킬 → 사소한 일이 무거워짐
- 계획서·상태 파일 경로가 도구마다 달라 같은 내용이 여러 트리로 갈라짐

taskcycle은 이 충돌을 한 방향으로 정리한 단일 하네스입니다.
**승인 게이트를 계획서 한 곳으로 모으고, 그 뒤로는 중단 조건에 걸릴 때만 멈춥니다.**

### 핵심 규칙

| 지점 | 동작 |
|---|---|
| 계획서 승인 | **멈춤** — 유일한 사전 승인 게이트 |
| 구현 단계 사이 | **안 멈춤** — 끝까지 이어서 진행 |
| 중단 조건 5가지 | **멈춤** — 범위 이탈 / 적대 리뷰 지적 / 품질 관문 2회 실패 / 블로커 / 파괴적 작업 |
| 완료 판정 | 사용자가 한다. AI는 검증 근거만 제시 |
| 사소한 작업 | 오타·한 줄 변경은 계획서 없이 진행 |

증거 규칙: 완료·통과·수정됨을 주장하려면 **이번 세션에서 실제로 실행한 명령의 출력**을 제시해야 합니다.

### 설치

```powershell
# 1) 마켓플레이스 등록 후 플러그인 설치 (Claude Code)
/plugin marketplace add <이 저장소 경로 또는 URL>
/plugin install taskcycle

# 2) 운영 블록을 CLAUDE.md에 주입
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local

# AGENTS.md에도 함께 넣으려면 (Codex 등)
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local -Agents
```

`local`은 현재 프로젝트의 `CLAUDE.md`, `global`은 `~/.claude/CLAUDE.md`에 주입합니다.
주입은 멱등이며(마커 사이만 교체), 실행할 때마다 `*.taskcycle-bak.<timestamp>` 백업을 남깁니다.

제거:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\uninstall.ps1" local
```

> **주의:** taskcycle은 fablize / superpowers를 **대체하도록** 설계되었습니다.
> 함께 켜 두면 사소한 작업 예외와 문서 경로에서 다시 충돌합니다.
> 두 플러그인을 비활성화하고, `CLAUDE.md`에 남은 `FABLIZE` 블록은 fablize의 uninstall로 제거하세요.

### 사용법

| 명령 | 하는 일 |
|---|---|
| `/plan <작업 설명>` | 목표·범위 합의 → `docs/plans/task_NNN.md` 작성 → 승인 대기 |
| `/go [계획서]` | 승인된 계획서를 끝까지 구현 (중단 조건에만 멈춤) |
| `/report` | 검증 근거 제시 → `HANDOFF.md` 갱신 → 계획서 아카이브 → 커밋 |

스킬은 명시적 호출 없이도 작업 성격에 따라 자동으로 걸립니다:

- `taskcycle` — 다단계 개발 작업
- `taskcycle-investigate` — 버그·테스트 실패·원인 불명 동작

### 문서 경로

| 용도 | 경로 |
|---|---|
| 수행 계획서 | `docs/plans/task_NNN.md` → 완료 시 `docs/plans/archives/` |
| 진행 기록 | `docs/working/` |
| 결정 기록 | `docs/decisions/` |
| 현재 스냅샷 | `HANDOFF.md` (단 하나, 누적하지 않고 덮어씀) |

### 훅

| 이벤트 | 스크립트 | 동작 |
|---|---|---|
| `UserPromptSubmit` | `hooks/gate.ps1` | 활성 계획서를 컨텍스트에 다시 올리고 불변 규칙을 상기 |
| `Stop` | `hooks/finish-gate.ps1` | 활성 계획서가 남은 채 끝내려 하면 **세션당 1회만** 되물음 |

`Stop` 훅은 세션당 한 번만 개입하고 그 뒤로는 항상 통과시킵니다 — 완주를 유도하되 함정이 되지 않게 하기 위함입니다.
중단 조건에 해당해 멈춘 것이라면 사유를 밝히고 그대로 끝내면 됩니다.

### 요구 사항

- Windows / PowerShell 5.1 이상 (스크립트는 PowerShell 전용, Python·bash 의존 없음)
- Claude Code (플러그인·훅) 또는 AGENTS.md 규약을 따르는 도구 (Codex CLI, opencode 등)

---

## English

### Why

Stacking multiple agent harnesses makes their rules collide. In particular:

- Project rules that require user approval at every phase → work stalls constantly
- Auto-completion loops that push through → they don't stop when they should
- Skills insisting "no task is too simple", demanding design + approval for a one-line fix
- Plan and state files scattered across tool-specific paths, splitting the same content across trees

taskcycle resolves these into a single harness.
**It collapses the approval gates into one — the plan — and after that only stops on explicit stop conditions.**

### Core rules

| Point | Behavior |
|---|---|
| Plan approval | **Stops** — the only up-front gate |
| Between implementation steps | **Does not stop** — runs to completion |
| 5 stop conditions | **Stops** — scope departure / adversarial-review finding / quality gate failing twice / blocker / destructive action |
| Completion verdict | The user decides. The AI only presents verification evidence |
| Trivial work | Typos and one-line changes proceed without a plan |

Evidence rule: any claim that something is done, passing, or fixed must be backed by **output from a command actually run in this session**.

### Install

```powershell
# 1) Add the marketplace and install the plugin (Claude Code)
/plugin marketplace add <path or URL of this repo>
/plugin install taskcycle

# 2) Inject the operating block into CLAUDE.md
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local

# To also write it into AGENTS.md (Codex and friends)
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local -Agents
```

`local` targets the current project's `CLAUDE.md`; `global` targets `~/.claude/CLAUDE.md`.
Injection is idempotent (it replaces only the marked region) and writes a `*.taskcycle-bak.<timestamp>` backup on every run.

Uninstall:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\uninstall.ps1" local
```

> **Note:** taskcycle is designed to **replace** fablize / superpowers.
> Running them together reintroduces the conflicts around the trivial-work exception and document paths.
> Disable both plugins, and remove any leftover `FABLIZE` block from `CLAUDE.md` with fablize's own uninstall script.

### Usage

| Command | What it does |
|---|---|
| `/plan <description>` | Agree on goal and scope → write `docs/plans/task_NNN.md` → wait for approval |
| `/go [plan file]` | Implement the approved plan to completion (stops only on stop conditions) |
| `/report` | Present verification evidence → update `HANDOFF.md` → archive the plan → commit |

Skills also trigger on their own, without an explicit call:

- `taskcycle` — multi-step development work
- `taskcycle-investigate` — bugs, test failures, unexplained behavior

### Document layout

| Purpose | Path |
|---|---|
| Plan | `docs/plans/task_NNN.md` → `docs/plans/archives/` when done |
| Progress log | `docs/working/` |
| Decisions | `docs/decisions/` |
| Current snapshot | `HANDOFF.md` (exactly one, overwritten rather than appended) |

### Hooks

| Event | Script | Behavior |
|---|---|---|
| `UserPromptSubmit` | `hooks/gate.ps1` | Re-surfaces the active plan and restates the invariant rules |
| `Stop` | `hooks/finish-gate.ps1` | Asks back **once per session** if a turn ends while a plan is still active |

The `Stop` hook intervenes at most once per session and passes through afterwards — it nudges toward completion without becoming a trap.
If work stopped because of a stop condition, state which one and end the turn.

### Requirements

- Windows / PowerShell 5.1+ (scripts are PowerShell-only; no Python or bash dependency)
- Claude Code (plugins and hooks), or any tool following the AGENTS.md convention (Codex CLI, opencode, …)

---

## License

MIT
