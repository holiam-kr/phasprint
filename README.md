# Phasprint

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

Phasprint resolves these into a single harness.

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

Secret rule: once a key, token, password, or `.env` value is read, it is **masked from that
point on** — reproduced only as its first 4 and last 4 characters, never in full, in replies,
files, commits, commands, logs, or subagent prompts.

## Install

```
/plugin marketplace add holiam-kr/phasprint
/plugin install phasprint
```

**That's all.** No config to edit, no script to run.

- The **core rules** (evidence, scope, who decides completion, stop conditions, secret
  masking, debugging entry point, isolation) are injected by a
  `SessionStart` hook on every session. They apply everywhere immediately and never touch
  `CLAUDE.md` — phasprint does not read that file either, so the harness is whole on its own
  and inherits nothing from a plugin that has rewritten it.
- The **plan cycle** loads only when you call `/plan` or the `sprint` skill triggers.
  Repos that don't use plans are never asked for one.

## Why two layers

| Layer | Contents | Loaded when | Scope |
|---|---|---|---|
| **core** | evidence-based completion, scope discipline, completion verdict, stop conditions (two failed attempts / blocker / destructive action), secret masking, debugging entry point, isolation | automatically at session start | every project |
| **cycle** | plan → run to completion → adversarial review → report, document layout, `HANDOFF.md` | on `/plan` or skill trigger | only repos that use it |

core contains no plan requirement, so throwaway scripts and exploration repos are never
nagged to create `docs/plans/`.

**What earns a place in core:** a behavioural rule that holds in every project and whose absence
lets real damage through. Not document requirements, not per-situation procedure — those belong
to the cycle or to a skill, which load only when they apply. Every line is paid for on every
session and again on every compaction, so adding a rule means naming the one it replaces.

> **Note:** Phasprint is designed to **replace** fablize / superpowers. Running them together
> reintroduces the conflicts around the trivial-work exception and document paths. Disable
> both plugins, and remove any leftover `FABLIZE` block from `CLAUDE.md` with fablize's own
> uninstall script.

## Usage

| Command | What it does |
|---|---|
| `/plan <description>` | Agree on goal and scope → write `docs/plans/draft/task_NNN.md` → wait for approval |
| `/go [plan file]` | Approve (move `draft/` → `approved/`) and implement to completion — stops only on stop conditions |
| `/report` | Present verification evidence → update `HANDOFF.md` → archive the plan → commit |

Skills also trigger on their own, without an explicit call:

- `sprint` — multi-step development work
- `investigate` — bugs, test failures, unexplained behavior

## Document layout

| Purpose | Path |
|---|---|
| Plan | `docs/plans/draft/` → `approved/` on approval → `archives/` when done |
| Progress log | `docs/working/` |
| Decisions | `docs/decisions/` |
| Current snapshot | `HANDOFF.md` (exactly one, overwritten rather than appended) |

## Hooks

| Event | Script | Behavior |
|---|---|---|
| `SessionStart` | `hooks/core.cjs` | Injects the core rules. Re-injects on `source=compact` to restore rules pushed out by compaction |
| `UserPromptSubmit` | `hooks/gate.cjs` | Restates the core essentials in one line each turn; surfaces the active plan when there is one |
| `PostToolUse` · `PostToolUseFailure` | `hooks/observe.cjs` | Records what tools actually did this turn. Writes nothing to the conversation |
| `Stop` | `hooks/finish-gate.cjs` | Asks back **once per session** if a turn ends while an approved plan is still open |

`gate.cjs` and `finish-gate.cjs` read `docs/plans/approved/` directly, so repos without plans
never hear about the cycle at all. **Approval is expressed by location** — a plan waiting in
`draft/` is invisible to both hooks, so nothing pushes toward completion before you have said
yes. A loose `docs/plans/task_*.md` from an earlier version counts as a draft.

`observe.cjs` makes the Evidence rule checkable rather than merely requested: which event
arrives *is* the verdict, since Claude Code raises `PostToolUse` only for calls that succeeded.
Nothing is parsed out of output text, so "0 failed" can never be read as a failure. The Stop
nudge then states what was observed — files changed, verification run or not — instead of
guessing. It adds no stop condition; the gate still intervenes at most once per session.

All of them fail open: any error still exits 0, so a hook can never block a session — but it now
says what went wrong via `systemMessage` instead of failing silently.

The `Stop` hook intervenes at most once per session and passes through afterwards — it nudges
toward completion without becoming a trap. If work stopped because of a stop condition, state
which one and end the turn.

## Requirements

- Claude Code
- Node on `PATH` (the hooks are plain CommonJS with no dependencies). Works on Windows,
  macOS, and Linux alike.

## License

MIT
