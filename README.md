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
/plugin marketplace add <이 저장소 경로 또는 URL>
/plugin install taskcycle
```

**이게 전부입니다.** 설정 파일을 고치거나 스크립트를 돌릴 필요가 없습니다.

- **core 규칙**(증거·범위·판정·멈춤·디버깅·격리)은 `SessionStart` 훅이 세션마다 주입합니다. 모든 프로젝트에 즉시 적용되고 `CLAUDE.md`를 건드리지 않습니다.
- **계획서 사이클**은 `/plan` 을 부르거나 `taskcycle` 스킬이 걸릴 때만 로드됩니다. 계획서를 쓰지 않는 리포에서는 아무 것도 요구하지 않습니다.

### 두 층으로 나눈 이유

| 층 | 내용 | 언제 로드되나 | 스코프 |
|---|---|---|---|
| **core** | 증거 기반 완료, 범위 고정, 완료 판정 주체, 중단 조건(2회 실패·블로커·파괴적 작업), 디버깅 진입점, 격리 | 세션 시작 시 자동 | 모든 프로젝트 |
| **cycle** | 계획서 → 완주 → 적대 리뷰 → 보고, 문서 경로, `HANDOFF.md` | `/plan` 또는 스킬 호출 시 | 쓰는 리포에만 |

core에는 계획서 요구가 들어 있지 않습니다. 그래서 일회성 스크립트나 탐색용 리포에서 `docs/plans/` 를 만들라고 조르지 않습니다.

### 팀 공유가 필요할 때만 — `setup.ps1`

플러그인을 설치하지 않은 팀원의 세션에도 사이클 규칙을 적용하려면, 프로젝트 `CLAUDE.md` 에 사이클 블록을 커밋해 두면 됩니다.

```powershell
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local

# AGENTS.md에도 함께 (Codex 등)
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local -Agents
```

주입되는 것은 **사이클 블록뿐**입니다(core는 훅이 담당). 멱등이며(마커 사이만 교체) 실행할 때마다 `*.taskcycle-bak.<timestamp>` 백업을 남깁니다.

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
| `SessionStart` | `hooks/core.ps1` | core 규칙을 주입. `source=compact` 에도 다시 주입해 압축으로 밀려난 규칙을 복구 |
| `UserPromptSubmit` | `hooks/gate.ps1` | core 핵심을 한 줄로 매 턴 상기. 활성 계획서가 있으면 함께 올림 |
| `Stop` | `hooks/finish-gate.ps1` | 활성 계획서가 남은 채 끝내려 하면 **세션당 1회만** 되물음 |

`gate.ps1` 과 `finish-gate.ps1` 은 `docs/plans/` 를 실제로 읽어 판단하므로, 계획서가 없는 리포에서는 사이클을 일절 언급하지 않습니다.

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
/plugin marketplace add <path or URL of this repo>
/plugin install taskcycle
```

**That's all.** No config to edit, no script to run.

- The **core rules** (evidence, scope, who decides completion, stop conditions, debugging entry point, isolation) are injected by a `SessionStart` hook on every session. They apply everywhere immediately and never touch `CLAUDE.md`.
- The **plan cycle** loads only when you call `/plan` or the `taskcycle` skill triggers. Repos that don't use plans are never asked for one.

### Why two layers

| Layer | Contents | Loaded when | Scope |
|---|---|---|---|
| **core** | evidence-based completion, scope discipline, completion verdict, stop conditions (two failed attempts / blocker / destructive action), debugging entry point, isolation | automatically at session start | every project |
| **cycle** | plan → run to completion → adversarial review → report, document layout, `HANDOFF.md` | on `/plan` or skill trigger | only repos that use it |

core contains no plan requirement, so throwaway scripts and exploration repos are never nagged to create `docs/plans/`.

### `setup.ps1` — only for sharing with a team

To apply the cycle rules to teammates who haven't installed the plugin, commit the cycle block into the project's `CLAUDE.md`:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local

# also write it into AGENTS.md (Codex and friends)
powershell -ExecutionPolicy Bypass -File "$env:CLAUDE_PLUGIN_ROOT\setup\setup.ps1" local -Agents
```

Only the **cycle block** is injected (core is the hook's job). Injection is idempotent — it replaces only the marked region — and writes a `*.taskcycle-bak.<timestamp>` backup on every run.

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
| `SessionStart` | `hooks/core.ps1` | Injects the core rules. Re-injects on `source=compact` to restore rules pushed out by compaction |
| `UserPromptSubmit` | `hooks/gate.ps1` | Restates the core essentials in one line each turn; surfaces the active plan when there is one |
| `Stop` | `hooks/finish-gate.ps1` | Asks back **once per session** if a turn ends while a plan is still active |

`gate.ps1` and `finish-gate.ps1` read `docs/plans/` directly, so repos without plans never hear about the cycle at all.

The `Stop` hook intervenes at most once per session and passes through afterwards — it nudges toward completion without becoming a trap.
If work stopped because of a stop condition, state which one and end the turn.

### Requirements

- Windows / PowerShell 5.1+ (scripts are PowerShell-only; no Python or bash dependency)
- Claude Code (plugins and hooks), or any tool following the AGENTS.md convention (Codex CLI, opencode, …)

---

## License

MIT
