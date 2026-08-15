# 0001 — Approval is expressed by directory, not by a state file

**Date:** 2026-08-15 · **Task:** `task_002` · **Commit:** `3003197`

## Context

Both hooks decided whether a plan was live by globbing `docs/plans/task_*.md`. Nothing in that
glob distinguishes "written, waiting for the user" from "approved, go finish it", so the
harness treated every plan as approved. The effect was backwards: the moment `/plan` finished
writing, `gate.cjs` began telling the model every turn to "carry the remaining steps through to
completion", and `finish-gate.cjs` blocked the turn end — during the exact window the harness
exists to protect.

This was observed directly, not inferred: `task_001` triggered both hooks while awaiting
approval, and the transcript of that session is the evidence.

## Decision

Approval lives in the file's location.

```
docs/plans/draft/      awaiting the user -- hooks stay silent
docs/plans/approved/   approved -- hooks may push toward completion
docs/plans/archives/   done
```

`/go` performs the `draft/` → `approved/` move, which makes invoking `/go` the approval itself.
A loose `task_*.md` directly under `docs/plans/` counts as a draft.

## Alternatives rejected

**A state machine in `.phasprint/state.json`** (`IDLE`/`PLANNING`/`SPRINTING`/…), proposed in an
external roadmap. Rejected on evidence from OMC (`yeachan-heo/oh-my-claudecode`), which actually
implements this. The cost is visible in its source: `CANCEL_SIGNAL_TTL_MS = 30_000`,
`RALPLAN_STOP_BLOCKER_TTL_MS = 45min`, `TEAM_PIPELINE_STOP_BLOCKER_TTL_MS = 5min`,
`AWAITING_CONFIRMATION_TTL_MS = 2min`, staleness detection, a write lock, and orphan-state
collection — every one of them a defence against the model forgetting to clear state. OMC's own
plan skill warns that without cleanup "the stop hook blocks all subsequent stops … even after
the consensus workflow has finished". A state file written by a non-deterministic agent is not
deterministic; it relocates the problem and adds a failure mode where wrong state *persists*.
By contrast fablize resets its ledger on every prompt and needs no TTL at all.

**An `## Approval: pending|approved` line inside the plan.** Needs parsing and drifts with
wording. A directory needs neither, and the user can see the state by looking at where the file
sits.

**Treating a loose legacy plan as approved.** The safe reading is the opposite: mistaking an
approved plan for a draft costs one missed nudge, while mistaking a draft for approved costs
unwanted work.

## Consequences

- `activePlans()` reads one directory and no longer needs to guess. It now lives once, in
  `hooks/lib/plans.cjs`, instead of as two byte-identical copies.
- Repositories written against 0.3.0 go quiet after upgrading until a plan is moved into
  `approved/`. Deliberate, and documented in both READMEs.
- The `Stop` hook's reason text now names "a plan in `docs/plans/draft/` needs their approval"
  as a legitimate way to end a turn. It previously listed five stop conditions and omitted the
  one gate the harness is built around.

## Follow-ups

- Finding 2 (the 2026-08-15 marker anomaly) is untouched by this and remains **unverified**.
- The once-per-session marker scheme survives. Replacing it with fablize-style per-prompt reset
  was deferred: changing it while finding 2 is unexplained would destroy the evidence.
