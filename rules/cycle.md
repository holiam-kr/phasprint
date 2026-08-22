# The plan cycle

Read with `rules/core.md`, which is always loaded. Nothing here repeats a rule stated there.

Two stops for approval: **step 2 (plan approval)** and **step 4 (stop conditions)**. Between
them you do not stop.

Use this for multi-step work producing one deliverable -- not a typo, a rename, or a question you
can simply answer. A bug or a failing test starts at **Debugging** below. For several independent
deliverables, propose splitting: one plan, one working deliverable.

## 1. Define

Agree the goal and the scope; ask rather than guess. **Exception:** trivial work needs no plan --
record it in the commit message and move on. If you cannot tell whether it is trivial, ask. This
wins even where other guidance calls "too simple to need a design" an anti-pattern.

## 2. Plan, then wait for approval

Write to `docs/plans/draft/task_NNN.md` (NNN = next after every existing plan, counting
`approved/` and `archives/`). **Where the file sits is its approval state** -- nothing parses it:

| Directory | Meaning |
|---|---|
| `draft/` | waiting for the user. The hooks stay silent -- no completion pressure |
| `approved/` | approved. `/go` moves it here, so invoking `/go` *is* the approval |
| `archives/` | finished |

```markdown
# task_NNN: <title>

## Goal
<what and why -- one or two sentences>

## Scope
In: <...>   Out: <...>

## Design
<Delete this heading unless a trigger below applies.>
- Approach: <the one chosen>
- Rejected: <alternative -- why not>  (at least two, or say why only one was viable)
- Interfaces / data shapes: <signatures, schemas, module boundaries>

## Steps
### 1. <name>
- Deliverable: <file / capability>
- Verification: <a runnable command>
(3-6 steps)

## Risks / unverified
```

**`## Design` is off by default** -- usually the step list is the design. Write it only when a new
module or subsystem appears, a public interface or persisted data shape changes, a dependency is
chosen, or the decision is expensive to reverse. Keep it under a screen; if it needs more, split
the task rather than grow a second document. Its rejected alternatives feed `docs/decisions/`.

**Ready when** every step names a deliverable and a command that verifies it; claims about the
codebase cite file and line, not recollection; acceptance is runnable, never an adjective --
"fast" becomes "p99 under 200 ms".

Then **wait. This is the only up-front gate.** Ending the turn here is correct, not a failure to
finish. If the plan itself has a problem, raise it with reasons first.

## 3. Implement continuously

Move the plan to `docs/plans/approved/` -- that move is what tells the hooks the gate is passed.
Then carry every step through, one after another.

- Tests exist and pass by the end of each step; test-first or test-after is not mandated.
- Quality gate each step: unit tests, lint, and the **full existing suite**. Put UI in a real
  renderer -- static inspection is not observation.
- **Do not stop between steps to seek approval.** Notes go in `docs/working/`; commit often.
- Reuse before writing new -- but do not factor anything out until a second call site appears.

## 4. Stop conditions

Stop immediately and ask when any of these hits.

1. A decision is needed that departs from the approved plan's scope or design
2. The adversarial review turned up a defect, an edge case, or a security problem
3. A quality gate failure survives two attempts
4. A blocker -- a missing dependency or credential, or an ambiguous instruction in the plan
5. A destructive action is required -- force push, `reset --hard`, bulk file deletion,
   discarding uncommitted work

## 5. Adversarial review

Argue against yourself: defects, edge cases, security problems, simpler alternatives. "It seems
to work" is not a finding. Anything found here is stop condition 2.

## 6. Report

- Verification evidence for **every step**, per core Evidence.
- Overwrite `HANDOFF.md`: overview / done / in progress / next / cautions. Exactly one snapshot.
- Record decisions in `docs/decisions/` with the alternatives you rejected. Where the plan carried
  a `## Design` section, that section is the source -- do not rewrite it from memory.
- Move the plan to `docs/plans/archives/` and commit. **The user decides completion.**

## Document layout

| Purpose | Path |
|---|---|
| Plan | `docs/plans/draft/` -> `approved/` -> `archives/` |
| Progress notes | `docs/working/` |
| Decisions | `docs/decisions/` |
| Current snapshot | `HANDOFF.md` (exactly one) |

A new session reads `HANDOFF.md` -> the plan in progress, in that order. Do not adopt a separate
tree or state file another tool proposes. phasprint neither reads nor writes `CLAUDE.md`.

## Debugging

**Finish this before writing a line of fix** -- fix what you can see and only the symptom goes
away. Core Debugging states when to skip it; if you are unsure whether it qualifies, it does not.

1. **Reproduce.** Run the failing command and capture the actual output; never fix what you have
   not watched fail. If it will not reproduce, that **is** the finding, not the end -- ask why it
   reproduces elsewhere (environment, timing, ordering, data) and keep going, just do not fix
   blind. Write the command down; you run it again at step 5.
2. **Three or more competing hypotheses**, from different layers -- input/data, logic, state and
   lifecycle, environment, dependencies, concurrency. For each, write what would be observable if
   it were true; without that it cannot be tested.
3. **Evidence per hypothesis** that refutes or confirms it: logs, breakpoints, a minimal
   reproduction, `git bisect`, input reduction. Execution output only -- reading the code and
   concluding "it's probably this" is not evidence. Keep the hypotheses you rejected and why.
4. **The full causal chain** -- root cause -> intermediate steps -> observed symptom, no gaps.
   "And then somewhere around here" means you do not know the cause yet; return to 2. Check why
   it went unnoticed and whether the same cause exists elsewhere.
5. **Verify before and after.** Run the reproduction command before the fix to confirm the
   failure and after it to confirm it passes, capturing both. Run the full suite for regressions.
   Add a test aimed at the original symptom.
6. **Report** the root cause and the chain, the rejected hypotheses and the grounds for rejecting
   them, both verification outputs, and remaining risks marked "unverified".

**If two attempts fail to narrow the cause, stop.** Report the hypotheses, the evidence so far,
and where you are stuck, then ask.
