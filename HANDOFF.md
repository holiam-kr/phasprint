# HANDOFF

Current snapshot. Exactly one, overwritten rather than appended — history lives in git,
`docs/plans/`, and `docs/decisions/`.

## What this is

phasprint is a task harness for Claude Code. It collapses the up-front approval gates into one
— the plan — and after that stops only on explicit stop conditions.

Two layers:

- **core** — behavioural rules injected by the `SessionStart` hook on every session, in every
  project. No document requirements live here.
- **cycle** — plan → run to completion → adversarial review → report. Loads only on `/draft` or
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
- **Tool results are observed** (`observe.cjs`, `PostToolUse` + `PostToolUseFailure`). Which
  event arrives is the verdict — Claude Code raises `PostToolUse` only for calls that succeeded,
  so nothing is parsed out of output text. The Stop nudge now states what was observed.
- **Both envelopes are measured, not assumed** (2026-08-22). `PostToolUseFailure` drops
  `tool_response` and adds `error` and `is_interrupt`; every field the hook reads is on both
  events, so the parser was correct. `is_interrupt` exposed a real defect — **a user interrupt
  arrives on the same event as a genuine failure**, so cancelling `node --test` was recorded as
  a failed verification. `observe.cjs` now observes nothing when `is_interrupt` is true.
  Suite is 66 tests; removing that guard fails two of them.
- **The rules are files, not code** (`rules/core.md`, `rules/cycle.md`). `hooks/core.cjs` reads
  them instead of holding a copy; the two `SKILL.md` files are ~700-byte pointers; the commands
  address `rules/cycle.md` by step number. `hooks/`, `skills/`, `commands/` and `test/` can be
  deleted and `rules/` still stands, which is what makes the harness portable to a runner without
  hooks. 15,197 bytes of rules became 8,097 (47% down); the `Secrets` rule was removed from core
  at the user's direction, so core is six rules.
- **The command is `/draft`, not `/plan`.** `/plan` reaches Claude Code's built-in plan mode;
  plugin commands are namespaced, so the bare name never reached phasprint — while core
  advertised it on every session and every compaction. `/draft` matches the directory it writes
  to. A test now anchors every advertised slash command to a file in `commands/`.
- **Hooks no longer truncate their own output.** `process.exit(0)` tore the process down before
  Node flushed an asynchronous pipe write: a 1,741-byte injection arrived as 512 bytes, one chunk,
  deterministically. Pre-existing since at least `0642c4d`, and it affected `core.cjs` and
  `finish-gate.cjs` (687 -> 512). All four hooks now set `process.exitCode` instead. `spawnSync`
  does not reproduce it, so the regression test builds a real shell pipe.
- `${CLAUDE_PLUGIN_ROOT}` **does** expand inside command markdown bodies — confirmed by invoking
  `/plan` against the installed 0.5.0 and reading the cache path in its place.

## In progress

Nothing open. `task_005` (rules as files) is reported and archived to `docs/plans/archives/`;
the completion verdict is the user's.

## Next

- **Finding 2 stays open.** On 2026-08-15 the `Stop` hook blocked while both markers kept a
  three-day-old mtime, with no exception anywhere. Four hypotheses were ruled out by
  experiment (version skew, split TMPDIR, duplicate registration, changed session id) and the
  cause is still **unverified**. The instrumentation added since would now report it; the wait
  is for a recurrence.
- **Whether a ~700-byte `SKILL.md` stub still auto-triggers is unverified.** Verified at 0.7.0:
  both stubs register and resolve their pointer. Firing on a natural prompt was not exercised.
- **Whether `/go` and `/report` resolve unqualified is unmeasured.** `/plan` did not — the
  built-in won — which is why the command is now `/draft`. Neither of the other two has an
  obvious built-in twin, but that is inference, not measurement.
- **Further compression is undecided.** Rules stand at 8,097 bytes against a 5,000 target.
  `rules/cycle.md` is 55% two sections: `## Debugging` (1,880) and `## 2. Plan` (1,734, of which
  496 is the plan template itself). Cutting to ~4,800 is possible but reaches the reasoning the
  plan named as not-to-be-cut: the trivial-work exception, the debugging skip condition, and the
  `## Design` triggers.
- **Why Claude Code never saw the truncation is unverified.** The shell pipe loses bytes every
  time, yet this session's SessionStart injection and Stop nudge both arrived whole.
- Whether observing is worth its cost is **unmeasured**. One extra process per Bash/Edit/Write
  call, and fablize's measurement protocol warns a gate can be net negative by filling context
  with noise.

## Cautions

- `node --test` takes no directory argument on Node 24 — `node --test test/` tries to load
  `test` as a module. Run bare `node --test` from the repository root.
- Hook tests spawn child processes and use POSIX permission bits. Verified on macOS only;
  Windows behaviour is **unverified**.
- A loose `docs/plans/task_*.md` from before 0.4.0 counts as a *draft*, so upgrading repos go
  quiet rather than gaining unwanted completion pressure. That is deliberate.
- **Bump `version` in `.claude-plugin/plugin.json` on every content change.** Claude Code caches
  a plugin under `~/.claude/plugins/cache/<mp>/<plugin>/<version>/` and loads from there, not from
  the marketplace clone. `/plugin update` pulls the clone but compares version strings, so an
  unchanged version prints "already at the latest version" and leaves a stale cache behind:
  `b3539e0` renamed `commands/plan.md` to `draft.md` without a bump and `/draft` simply did not
  exist afterwards, while the clone showed the rename correctly.
- **Verify against the cache, not the clone.** Running `node <clone>/hooks/core.cjs` proves what
  the repository holds, not what Claude Code executes. The cache path carries the version.
- `git commit` in this repo needs an explicit identity (`-c user.name -c user.email`); no
  `user.name`/`user.email` is configured globally or locally.
