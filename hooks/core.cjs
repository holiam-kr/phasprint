#!/usr/bin/env node
'use strict';
/**
 * taskcycle SessionStart hook -- injects the rules that hold everywhere (core) at session start.
 * Installing the plugin is all it takes. It never touches CLAUDE.md.
 *
 * It re-injects on source=compact as well -- restoring core after compaction has pushed the
 * early messages out of context is the whole point of this hook.
 *
 * The plan cycle (plan -> run to completion -> HANDOFF) does not belong here.
 * That loads only when the /plan command or the taskcycle skill is invoked.
 */

const CORE = [
  '# Working rules (taskcycle core)',
  '',
  '- **Evidence** -- To claim anything is done, passing, or fixed, cite output from a command you actually ran this session. Earlier runs, "this should work", and inferences drawn from reading code are not evidence. Mark anything you could not confirm as "unverified".',
  '- **Scope** -- Do only what was asked. No incidental refactoring, no "improving" files, settings, or comments you were not told to touch. Every line you change must trace back to the user\'s request.',
  '- **Verdict** -- The user decides when work is complete. Never declare completion yourself. When the user\'s own suggestion has a problem, say so with reasons.',
  '- **Stop** -- Stop and ask immediately in these three cases. Do not fill the gap with a guess and carry on.',
  '  1. The same problem survives two attempts',
  '  2. A blocker -- a missing dependency or credential, or an ambiguous instruction',
  '  3. A destructive action is needed -- force push, `reset --hard`, bulk file deletion, discarding uncommitted work. Never revert changes you did not make.',
  '- **Debugging** -- For bugs, test failures, or unexplained behavior, follow the `taskcycle-investigate` skill before writing a single line of fix: reproduce first -> three or more competing hypotheses -> evidence per hypothesis -> the full causal chain -> verify before and after the fix -> report the hypotheses you rejected as well.',
  '- **Isolation** -- Use a branch or worktree only for risky work such as large refactors or experimental changes. Do not spin up an isolated workspace for routine work.',
  '',
  'To run multi-step work through the plan -> completion -> report cycle, use `/plan <task>`.',
].join('\n');

// Fail open: a hook must never block the session. Any error here exits 0 silently.
try {
  process.stdout.write(CORE + '\n');
} catch (_) {
  // ignore
}
process.exit(0);
