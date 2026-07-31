---
name: sprint
description: Use when starting meaningful development work (a new feature, a refactor, a multi-step change). Write a plan, get it approved, then carry the implementation through to completion unless a stop condition is hit. Triggers on "build this", "implement it", "write a plan", "start the task". 한국어 - "이거 만들어줘", "구현해줘", "계획 세워줘", "작업 시작".
---

# sprint: agree on the design, then run the implementation to completion

There are exactly two places where you stop for approval: **step 2 (plan approval)** and
**step 4 (stop conditions)**. Between them you do not stop.

## 1. Define the task

Agree on the goal and the scope with the user. Where something is uncertain, ask rather than
fill the gap with a guess. If the request spans several independent subsystems, propose
splitting it first — one plan produces one working deliverable.

**Exception, no plan needed:** trivial work such as a typo fix or a one-line change.
Record it in the commit message and move on. If you cannot tell whether it is trivial, ask.
This exception wins even when other guidance treats "too simple to need a design" as an
anti-pattern.

## 2. Write the plan, then wait for approval

Write it to `docs/plans/task_NNN.md` (NNN is the next number after existing files, counting
`archives/` too).

```markdown
# task_NNN: <title>

## Goal
<what and why — one or two sentences>

## Scope
In: <...>
Out: <...>

## Steps
### 1. <step name>
- Deliverable: <file / capability>
- Verification: <a runnable command, e.g. `pytest tests/test_x.py -q`>
### 2. ...
(3-6 steps)

## Risks / unverified
- <items marked "unverified">
```

Once written, **wait for the user's approval. This is the only up-front gate.**
If you see a problem with the plan itself, raise the objection with reasons first.

## 3. Continuous implementation

Carry every step of the approved plan through to completion, one after another.

- Write code and tests for each step. Test-first or test-after is not mandated — what matters
  is that tests exist and pass by the time the step ends.
- Clear the quality gate at the end of each step: unit tests, lint, and the full existing
  suite (regression). If there is UI, check it in a real renderer (layout, interaction,
  responsiveness, loading and error states). Static inspection is not observation.
- **Do not stop between steps to seek approval.** Keep progress notes in `docs/working/`.
- Commit often, in meaningful units.
- Look for an existing reusable module before writing a new one. But do not factor something
  out until a second call site actually appears.
- Do not touch anything outside the requested scope. No incidental refactoring.

## 4. Stop conditions

Stop immediately and ask the user when any of these hits. Do not paper over it with a guess.

1. A decision is needed that departs from the approved plan's scope or design
2. The adversarial review turned up a defect, an edge case, or a security problem
3. A quality gate failure survives two attempts
4. A blocker — a missing dependency or credential, or an ambiguous instruction in the plan
5. A destructive action is required — force push, `reset --hard`, bulk file deletion,
   discarding uncommitted work. Never revert changes you did not make (a file the user may
   have edited by hand).

For a failure whose cause is unclear, follow the `investigate` skill.

## 5. Adversarial review

Once the main design and implementation are done, argue against yourself: look for defects,
edge cases, security problems, and simpler alternatives, then report them. Do not settle for
"it seems to work". Anything you find here is stop condition 4.

## 6. Final report

- Summarize the outcome and give **verification evidence for every step** (output from
  commands you actually ran this session). Never call something passing that you did not run.
  Mark anything you could not confirm as "unverified".
- Update `HANDOFF.md` — keep exactly one snapshot: overview / done / in progress / next /
  cautions. Overwrite it rather than appending.
- Record key decisions in `docs/decisions/` (context plus the alternatives you rejected).
- Move the finished plan to `docs/plans/archives/` and commit.
- **The user decides completion.** Never declare it yourself.

## Isolation

Use a branch or worktree only for risky work such as large refactors or experimental changes.
Do not create an isolated workspace for routine work.

## Document layout

Use this layout. Do not follow other tools when they propose a separate tree such as
`docs/superpowers/` or a separate state file.

| Purpose | Path |
|---|---|
| Plan | `docs/plans/task_NNN.md` → `docs/plans/archives/` when done |
| Progress notes | `docs/working/` |
| Decisions | `docs/decisions/` |
| Current snapshot | `HANDOFF.md` (exactly one) |

A new session starts by reading `CLAUDE.md` → `HANDOFF.md` → the plan in progress, in that order.
