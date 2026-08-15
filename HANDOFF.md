# HANDOFF

Current snapshot. Exactly one, overwritten rather than appended — history lives in git,
`docs/plans/`, and `docs/decisions/`.

## What this is

phasprint is a task harness for Claude Code. It collapses the up-front approval gates into one
— the plan — and after that stops only on explicit stop conditions.

Two layers:

- **core** — behavioural rules injected by the `SessionStart` hook on every session, in every
  project. No document requirements live here.
- **cycle** — plan → run to completion → adversarial review → report. Loads only on `/plan` or
  when the `sprint` skill triggers.

phasprint neither reads nor writes `CLAUDE.md`. Nothing degrades when that file is absent, and
nothing is inherited when another plugin has rewritten it.

## Done

- Core rules ship through a hook; no installer, no file injection (`7029649`, `a12afc1`).
- Secret-masking rule in core (`4911f58`).
- `Stop` hook fired once per repo instead of once per session — fixed (`90796ad`).
- **Approval is expressed by directory** — `docs/plans/draft/` → `approved/` → `archives/`,
  with `/go` performing the move (`3003197`). Before this, both hooks globbed
  `docs/plans/task_*.md` and pushed a plan toward completion while it was still awaiting
  approval.
- **Hooks fail open without failing silently** — unexpected errors surface through
  `systemMessage`, and marker writes are read back so a write that succeeds without landing is
  caught (`3003197`).
- **Test suite** — `test/hooks.test.mjs`, 20 cases, `node --test`. Half of them fail against
  0.3.0, which is the point; the rest pin behaviour that already worked (`3003197`).
- `activePlans()` lives once, in `hooks/lib/plans.cjs` (`3003197`).
- phasprint no longer defers to `CLAUDE.md` (`f8875bd`).
- **The remaining review findings are closed** (`d6af9a4`): `docs/` is tracked, `HANDOFF.md`
  exists, core is down to seven rules, both skills carry a "when not to use this" section, the
  plan lookup walks up to the repository root, and the suite is 37 tests.
- `${CLAUDE_PLUGIN_ROOT}` **does** expand inside command markdown bodies — confirmed by invoking
  `/plan` against the installed 0.5.0 and reading the cache path in its place.

## In progress

Nothing. `task_001` through `task_003` are in `docs/plans/archives/`; 19 of the 20 review
findings are closed and the twentieth is waiting on a recurrence, not on work.

## Next

- **Finding 2 stays open.** On 2026-08-15 the `Stop` hook blocked while both markers kept a
  three-day-old mtime, with no exception anywhere. Four hypotheses were ruled out by
  experiment (version skew, split TMPDIR, duplicate registration, changed session id) and the
  cause is still **unverified**. The instrumentation added since would now report it; the wait
  is for a recurrence.
- A `PostToolUse` hook would let the Evidence rule rest on observed tool results instead of on
  the model's own claim. fablize and OMC both do this; phasprint does not. Separate task.

## Cautions

- `node --test` takes no directory argument on Node 24 — `node --test test/` tries to load
  `test` as a module. Run bare `node --test` from the repository root.
- Hook tests spawn child processes and use POSIX permission bits. Verified on macOS only;
  Windows behaviour is **unverified**.
- A loose `docs/plans/task_*.md` from before 0.4.0 counts as a *draft*, so upgrading repos go
  quiet rather than gaining unwanted completion pressure. That is deliberate.
- `git commit` in this repo needs an explicit identity (`-c user.name -c user.email`); no
  `user.name`/`user.email` is configured globally or locally.
