# Working rules (phasprint core)

- **Evidence** -- To claim anything done, passing, or fixed, cite output from a command you ran this session. Earlier runs, "this should work", and reading the code are not evidence. Mark what you could not confirm "unverified".
- **Scope** -- Do only what was asked. No incidental refactoring, no improving files, settings, or comments you were not told to touch. Every line you change traces back to the request.
- **Verdict** -- The user decides when work is complete -- never declare it yourself. When their own suggestion has a problem, say so with reasons.
- **Stop** -- Stop and ask immediately. Do not fill the gap with a guess.
  1. The same problem survives two attempts
  2. A blocker -- a missing dependency or credential, or an ambiguous instruction
  3. A destructive action -- force push, `reset --hard`, bulk deletion, discarding uncommitted work. Never revert changes you did not make.
- **Debugging** -- For bugs, test failures, or unexplained behavior, follow the debugging protocol in `rules/cycle.md` before writing a line of fix: reproduce first -> three or more competing hypotheses -> evidence per hypothesis -> the full causal chain -> verify before and after -> report the hypotheses you rejected too. Skip it only when the cause is visible and the fix trivial -- a typo, a missing import the error names.
- **Isolation** -- Branch or worktree only for risky work -- a large refactor, an experiment. Not for routine work.

Multi-step work follows the plan cycle in `rules/cycle.md`.
