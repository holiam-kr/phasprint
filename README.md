# taskcycle

**Agree on the design, then run the implementation to completion.**

A task harness for Claude Code. It collapses the approval gates into one — the plan — and
after that only stops on explicit stop conditions.

English · [한국어](README.ko.md)

## Why

Stacking multiple agent harnesses makes their rules collide. In particular:

- Project rules that require user approval at every phase → work stalls constantly
- Auto-completion loops that push through → they don't stop when they should
- Skills insisting "no task is too simple", demanding design and approval for a one-line fix
- Plan and state files scattered across tool-specific paths, splitting the same content
  across several trees

taskcycle resolves these into a single harness.

## Core rules

| Point | Behavior |
|---|---|
| Plan approval | **Stops** — the only up-front gate |
| Between implementation steps | **Does not stop** — runs to completion |
| 5 stop conditions | **Stops** — scope departure / adversarial-review finding / quality gate failing twice / blocker / destructive action |
| Completion verdict | The user decides. The AI only presents verification evidence |
| Trivial work | Typos and one-line changes proceed without a plan |

Evidence rule: any claim that something is done, passing, or fixed must be backed by
**output from a command actually run in this session**.

## Install

```
/plugin marketplace add holiam-kr/taskcycle
/plugin install taskcycle
```

**That's all.** No config to edit, no script to run.

- The **core rules** (evidence, scope, who decides completion, stop conditions, debugging
  entry point, isolation) are injected by a `SessionStart` hook on every session. They apply
  everywhere immediately and never touch `CLAUDE.md`.
- The **plan cycle** loads only when you call `/plan` or the `taskcycle` skill triggers.
  Repos that don't use plans are never asked for one.

## Why two layers

| Layer | Contents | Loaded when | Scope |
|---|---|---|---|
| **core** | evidence-based completion, scope discipline, completion verdict, stop conditions (two failed attempts / blocker / destructive action), debugging entry point, isolation | automatically at session start | every project |
| **cycle** | plan → run to completion → adversarial review → report, document layout, `HANDOFF.md` | on `/plan` or skill trigger | only repos that use it |

core contains no plan requirement, so throwaway scripts and exploration repos are never
nagged to create `docs/plans/`.

> **Note:** taskcycle is designed to **replace** fablize / superpowers. Running them together
> reintroduces the conflicts around the trivial-work exception and document paths. Disable
> both plugins, and remove any leftover `FABLIZE` block from `CLAUDE.md` with fablize's own
> uninstall script.

## Usage

| Command | What it does |
|---|---|
| `/plan <description>` | Agree on goal and scope → write `docs/plans/task_NNN.md` → wait for approval |
| `/go [plan file]` | Implement the approved plan to completion (stops only on stop conditions) |
| `/report` | Present verification evidence → update `HANDOFF.md` → archive the plan → commit |

Skills also trigger on their own, without an explicit call:

- `taskcycle` — multi-step development work
- `taskcycle-investigate` — bugs, test failures, unexplained behavior

## Document layout

| Purpose | Path |
|---|---|
| Plan | `docs/plans/task_NNN.md` → `docs/plans/archives/` when done |
| Progress log | `docs/working/` |
| Decisions | `docs/decisions/` |
| Current snapshot | `HANDOFF.md` (exactly one, overwritten rather than appended) |

## Hooks

| Event | Script | Behavior |
|---|---|---|
| `SessionStart` | `hooks/core.cjs` | Injects the core rules. Re-injects on `source=compact` to restore rules pushed out by compaction |
| `UserPromptSubmit` | `hooks/gate.cjs` | Restates the core essentials in one line each turn; surfaces the active plan when there is one |
| `Stop` | `hooks/finish-gate.cjs` | Asks back **once per session** if a turn ends while a plan is still active |

`gate.cjs` and `finish-gate.cjs` read `docs/plans/` directly, so repos without plans never
hear about the cycle at all.

All three fail open: any error exits 0 silently, so a hook can never block a session.

The `Stop` hook intervenes at most once per session and passes through afterwards — it nudges
toward completion without becoming a trap. If work stopped because of a stop condition, state
which one and end the turn.

## Requirements

- Claude Code
- Node on `PATH` (the hooks are plain CommonJS with no dependencies). Works on Windows,
  macOS, and Linux alike.

## License

MIT
