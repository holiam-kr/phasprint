#!/usr/bin/env node
'use strict';
/**
 * phasprint SessionStart hook -- injects the rules that hold everywhere (core) at session start.
 * Installing the plugin is all it takes. It never touches CLAUDE.md.
 *
 * It re-injects on source=compact as well -- restoring core after compaction has pushed the
 * early messages out of context is the whole point of this hook.
 *
 * The plan cycle (plan -> run to completion -> HANDOFF) does not belong here.
 * That loads only when the /plan command or the sprint skill is invoked.
 *
 * What earns a place in CORE: a behavioural rule that holds in every project, whose absence
 * would let real damage through. Not document requirements, not per-situation procedure --
 * those belong to the cycle or to a skill, which load only when they apply.
 *
 * Every line here is paid for on every session and again on every compaction, so adding a rule
 * means naming the one it replaces. Seven sharp rules outrank nine diluted ones: an "Abbreviations"
 * rule was removed for exactly this reason -- its trigger ("has the user used the short form?")
 * lived only in conversation history, so compaction erased the very thing it depended on, while
 * it fired more often than any other rule and guarded the least.
 */

const CORE = [
  '# Working rules (phasprint core)',
  '',
  '- **Evidence** -- To claim anything is done, passing, or fixed, cite output from a command you actually ran this session. Earlier runs, "this should work", and inferences drawn from reading code are not evidence. Mark anything you could not confirm as "unverified".',
  '- **Scope** -- Do only what was asked. No incidental refactoring, no "improving" files, settings, or comments you were not told to touch. Every line you change must trace back to the user\'s request.',
  '- **Verdict** -- The user decides when work is complete. Never declare completion yourself. When the user\'s own suggestion has a problem, say so with reasons.',
  '- **Stop** -- Stop and ask immediately in these three cases. Do not fill the gap with a guess and carry on.',
  '  1. The same problem survives two attempts',
  '  2. A blocker -- a missing dependency or credential, or an ambiguous instruction',
  '  3. A destructive action is needed -- force push, `reset --hard`, bulk file deletion, discarding uncommitted work. Never revert changes you did not make.',
  '- **Secrets** -- The moment a secret value lands in context -- an API key, token, password, private key, credential-bearing URL, `.env` value -- mask it from that point on. Reproduce it only as its first 4 and last 4 characters (`sk-ab...3f9k`), and not at all when it is shorter than 12. That holds everywhere the value can travel: replies, files, commit messages, shell commands, logs, and subagent prompts. Prefer commands that never print it in the first place -- list key names, not values -- and never write a real secret into a plan, `HANDOFF.md`, a document, or anything git tracks.',
  '- **Debugging** -- For bugs, test failures, or unexplained behavior, follow the `investigate` skill before writing a single line of fix: reproduce first -> three or more competing hypotheses -> evidence per hypothesis -> the full causal chain -> verify before and after the fix -> report the hypotheses you rejected as well. Skip it only when the cause is already visible and the fix is trivial -- a typo, a missing import the error names outright.',
  '- **Isolation** -- Use a branch or worktree only for risky work such as large refactors or experimental changes. Do not spin up an isolated workspace for routine work.',
  '',
  'To run multi-step work through the plan -> completion -> report cycle, use `/plan <task>`.',
].join('\n');

// Fail open, but never silently: the hook still exits 0 on any error, and says why.
// A silent fail-open buys "the session never blocks" at the price of "nobody can tell it broke".
// The only thing that can fail here is the write itself, so the report may not land either --
// it costs nothing and keeps the three hooks consistent.
function failOpen(err) {
  try {
    const detail = err && err.stack ? err.stack.split('\n')[0] : String(err);
    process.stdout.write(JSON.stringify({ systemMessage: 'phasprint core hook failed open: ' + detail }) + '\n');
  } catch (_) {
    // stdout itself is gone -- nothing left to say it with
  }
}

try {
  process.stdout.write(CORE + '\n');
} catch (err) {
  failOpen(err);
}
process.exit(0);
