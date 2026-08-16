# 0002 — The event is the verdict: observing tool results without parsing them

**Date:** 2026-08-16 · **Task:** `task_004`

## Context

The core Evidence rule — "to claim anything is done, passing, or fixed, cite output from a
command you actually ran" — was a request to the model and nothing more. A model that reports
"tests pass" without running them produced exactly the same harness state as one that ran them.

fablize and OMC both close this with a `PostToolUse` hook that records observed tool results;
phasprint had no such hook. `verify_state.py` states the principle plainly: *"The decision is
made purely from observed ledger state — never from the assistant's claim text."*

## Decision

`hooks/observe.cjs` runs on `PostToolUse` **and** `PostToolUseFailure`, records what happened
into a per-turn ledger, and writes nothing to the conversation. `finish-gate.cjs` reads that
ledger and states the observed facts in its existing nudge.

**Which event arrives is the verdict.** Claude Code raises `PostToolUse` only for calls that
succeeded; a non-zero exit produces no event at all, and failures arrive as
`PostToolUseFailure`. No output text is parsed, so there is no heuristic to get wrong.

**The turn boundary comes from `prompt_id`,** which every payload carries. The ledger file is
one per session and working directory; when a new `prompt_id` appears its contents reset in
place. Nothing has to be wired into `UserPromptSubmit` to clear it.

**No new stop condition.** The Stop gate still intervenes at most once per session. The
observation makes that one nudge specific rather than generic.

## What measurement changed

The plan was approved with a different design: judge success from a structured exit code, and
key the ledger on `sha1(session_id|cwd)` with an explicit per-turn reset. Step 1 existed to
capture a real payload before writing any parser, and it invalidated both assumptions.

Measured on 2026-08-16 by recording live hook invocations:

```
session_id · transcript_path · cwd · prompt_id · permission_mode · effort
hook_event_name · tool_name · tool_input · tool_response · tool_use_id · duration_ms

Bash  tool_response = {stdout, stderr, interrupted, isImage, noOutputExpected}
Write tool_response = {type:"create", filePath, content, structuredPatch, originalFile, userModified}
```

- There is **no exit code, no `success`, no `status`** anywhere in the payload.
- `stderr` is present but empty; its content is merged into `stdout`.
- Commands exiting 127 and 1 produced **no `PostToolUse` event at all**.

Under the approved design every verification would have been recorded as `ok: null` and the
ledger would have been useless. The measurement replaced a worse design with a better one.

## Alternatives rejected

**Regex over output text**, as the reference implementation falls back to. Its `FAILURE_RE`
matches the bare word `failed` and is tested before `SUCCESS_RE`, so `"5 passed, 0 failed"` is
recorded as a failure — reproduced directly. Event-based judgement has no such failure mode.

**Prompt classification** (`quick`/`normal`/`deep`), which fablize needs to decide when a task
is heavy enough to demand verification, and whose misfires cost it a rule: *"the old 'add
observable proof' nag was a false-positive on ~1/3 of deep firings"*. phasprint has a better
signal already — an approved plan in `docs/plans/approved/` means the user has judged the work
non-trivial. No regex required, and repos that do not use plans stay silent.

**A new blocking condition when files changed without verification.** That would make the Stop
gate intervene twice per session and turn a nudge into a trap.

**Speaking on every tool call.** More attention spent than the rule protects. fablize itself
only speaks when a failure class repeats.

## Consequences

- One extra process per `Bash`/`Edit`/`Write`/`NotebookEdit`/`MultiEdit` call. The cost is real
  and unmeasured — fablize's own measurement protocol warns that a gate can be net negative by
  filling context with noise. **Unverified** here.
- Verification detection is a narrow allowlist of test runners, linters and typecheckers. It
  errs toward missing a command rather than inventing one: an unremarked turn is cheaper than a
  ledger claiming evidence that was never produced.
- Ledger files are swept on the same seven-day schedule as the Stop markers.
- Secrets are masked before anything reaches the ledger — and that masker shipped broken:
  `String.replace` hands a group-less pattern the match offset, not `undefined`, so branching on
  `undefined` silently disabled every raw key format while the `key=value` patterns kept
  working. See `hooks/lib/mask.cjs`.
