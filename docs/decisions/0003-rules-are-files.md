# 0003 — The rules are files; the hooks only read them

**Date:** 2026-08-22 · **Task:** `task_005`

## Context

The rules were spread across three formats that only Claude Code understands: a JavaScript
string literal in `hooks/core.cjs`, and two `SKILL.md` bodies reached through the skill
mechanism. Moving the harness to another runner meant hand-copying the text, and a hand copy
drifts — this repo has already shipped a manifest change that silently unloaded every hook and
skill, and a masker that silently disabled half its patterns. Both were single copies going bad.
Two copies would be worse.

Core rule **Debugging** made the coupling explicit: *"follow the `investigate` skill"*. On a
runner without skills that sentence names nothing.

## Decision

`rules/core.md` and `rules/cycle.md` hold every rule, as plain markdown with no Claude Code
syntax. Everything else points at them:

- `hooks/core.cjs` reads `rules/core.md` at session start instead of holding a copy
- `skills/{sprint,investigate}/SKILL.md` are three-line pointers
- `commands/{plan,go,report}.md` address `rules/cycle.md` by step number
- core **Debugging** now names *"the debugging protocol in `rules/cycle.md`"*

`hooks/`, `skills/`, `commands/` and `test/` can all be deleted and `rules/` still stands.

**The path comes from `__dirname`, not `${CLAUDE_PLUGIN_ROOT}`.** That variable is confirmed to
expand in command bodies; whether it expands in a `SKILL.md` body is **unverified**. The hook
already knows where it lives, so it computes the absolute path and injects it. The stubs read it
from there and never touch the variable.

## What it cost

Reading a file is a failure mode a string literal did not have. A half-installed plugin cache
would leave a session with no rules at all, silently. So `gate.cjs`'s one-line `ESSENTIALS` moved
to `hooks/lib/essentials.cjs` and `core.cjs` falls back to it, announcing on the same plain-text
channel that the seven full rules are **not** loaded. The degraded notice goes into the context
rather than a `systemMessage`, so the model is told its own rules are reduced — and nothing
depends on a JSON output shape this hook has never exercised.

The fallback is three rules, not seven. That is a real reduction, not a transparent one.

## Alternatives rejected

| Alternative | Why not |
|---|---|
| A single `AGENTS.md` | The cycle and the debugging protocol would be re-injected on every compaction. core was cut to 2 KB precisely to avoid that |
| Delete the `SKILL.md` files outright | Loses auto-triggering on "이거 만들어줘" / "왜 실패하지". A three-line stub costs less than that |
| Keep the text in the hooks and write the markdown separately | Two copies. The exact failure this decision exists to prevent |
| Collapse stop conditions 3-5 into a reference to core | The five are canonical and restated verbatim by `finish-gate.cjs` and both READMEs, with a test enforcing it. Splitting them 2+3 desynchronises four places to save five lines |

## Consequences

- 15,197 bytes of rules became 8,556 — a 44% cut with every rule preserved. The plan's target
  was 5,000, and it was **missed**: what remains is the plan template, four tables, the five stop
  conditions and the six debugging steps. See `docs/plans/archives/task_005.md`.
- Whether a three-line stub still triggers the way a full `SKILL.md` did is **unverified** until
  a live reload.
- The commands cite cycle steps by number, so a renumbering breaks them silently. A test now pins
  the numbers each command claims against the headings in `rules/cycle.md`.
