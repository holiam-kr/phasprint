#!/usr/bin/env node
'use strict';
/**
 * phasprint SessionStart hook -- injects the rules that hold everywhere (core) at session start.
 * Installing the plugin is all it takes. It never touches CLAUDE.md.
 *
 * It re-injects on source=compact as well -- restoring core after compaction has pushed the
 * early messages out of context is the whole point of this hook.
 *
 * The rules themselves live in `rules/core.md`, not in this file. That file is plain markdown
 * with no Claude Code syntax in it, so another harness reads the same text and there is no
 * second copy to drift. This hook only decides *when* it is injected, and appends the one thing
 * that is Claude-Code-specific: where the cycle document actually sits on disk.
 *
 * The path is computed from __dirname rather than ${CLAUDE_PLUGIN_ROOT}. That variable expands
 * in command bodies -- verified -- but whether it expands in a SKILL.md body is unverified, and
 * this hook does not need to find out.
 *
 * What earns a place in rules/core.md: a behavioural rule that holds in every project, whose
 * absence would let real damage through. Not document requirements, not per-situation procedure
 * -- those belong to the cycle, which loads only when it applies. Every line is paid for on
 * every session and again on every compaction, so adding a rule means naming the one it
 * replaces. Seven sharp rules outrank nine diluted ones.
 */

const fs = require('fs');
const path = require('path');
const { ESSENTIALS } = require('./lib/essentials.cjs');

const CORE_FILE = path.join(__dirname, '..', 'rules', 'core.md');
const CYCLE_FILE = path.join(__dirname, '..', 'rules', 'cycle.md');

// Fail open, but never silently: the hook still exits 0 on any error, and says why.
// A silent fail-open buys "the session never blocks" at the price of "nobody can tell it broke".
function failOpen(err) {
  try {
    const detail = err && err.stack ? err.stack.split('\n')[0] : String(err);
    process.stdout.write(JSON.stringify({ systemMessage: 'phasprint core hook failed open: ' + detail }) + '\n');
  } catch (_) {
    // stdout itself is gone -- nothing left to say it with
  }
}

// Reading a file is a failure mode the old string literal did not have: a half-installed plugin
// cache would leave a session with no rules at all. The degraded notice goes into the context
// itself rather than a systemMessage, on the same plain-text channel the normal path already
// uses -- so the model is told its own rules are reduced, and nothing depends on a JSON output
// shape this hook has never exercised.
function degraded(err) {
  const detail = (err && err.message) || String(err);
  return [
    `phasprint: ${CORE_FILE} could not be read (${detail}).`,
    'Running on the compressed essentials only -- the seven full rules are NOT loaded.',
    '',
    ESSENTIALS,
  ].join('\n');
}

function main() {
  let core;
  try {
    core = fs.readFileSync(CORE_FILE, 'utf8').trim();
    // A readable but empty file is the worse failure: readFileSync succeeds, so the catch below
    // never fires and the session receives the locator line and no rules at all, silently.
    // Truncation to a *partial* file still passes this check -- accepted, and unverified.
    if (!/^- \*\*/m.test(core)) throw new Error(`no rules found in ${CORE_FILE}`);
  } catch (err) {
    process.stdout.write(degraded(err) + '\n');
    return;
  }
  const locator = `The plan cycle and the debugging protocol are at ${CYCLE_FILE} -- read it before multi-step work or before debugging. In Claude Code, \`/draft <task>\` starts the cycle.`;
  process.stdout.write(core + '\n\n' + locator + '\n');
}

try {
  main();
} catch (err) {
  failOpen(err);
}
// Not process.exit(0). When stdout is a pipe -- which is how a hook's output is collected --
// Node's writes are asynchronous, and process.exit() tears the process down before the queued
// bytes are flushed. Measured on 2026-08-22: this file's 1,741-byte injection arrived as 512
// bytes, one chunk, deterministically over five runs. Setting the code instead lets the event
// loop drain the write and exit on its own; there is nothing else holding it open.
process.exitCode = 0;
