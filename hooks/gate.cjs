#!/usr/bin/env node
'use strict';
/**
 * phasprint UserPromptSubmit hook -- restates the core essentials each turn, and surfaces the
 * approved plan when the cycle is under way.
 *
 * The full text injected by SessionStart (core.cjs) can be pushed out once a conversation grows
 * long, so this compresses the essentials and revives them every turn.
 *
 * Only docs/plans/approved/ counts. A plan still sitting in draft/ is waiting for the user, and
 * telling the model to "carry it to completion" during that wait is precisely the wrong nudge.
 *
 * Repos without plans never hear about the cycle -- writing a plan is not a core requirement,
 * it is asked for only when the /plan command or the sprint skill is invoked.
 */

const fs = require('fs');
const { activePlans } = require('./lib/plans.cjs');
const { ESSENTIALS } = require('./lib/essentials.cjs');

// Fail open, but never silently. Expected conditions (no stdin, no docs/plans) stay quiet;
// anything else reaches failOpen and is reported, because a hook nobody can debug is worse
// than one that occasionally speaks up.
function failOpen(err) {
  try {
    const detail = err && err.stack ? err.stack.split('\n')[0] : String(err);
    process.stdout.write(JSON.stringify({ systemMessage: 'phasprint gate hook failed open: ' + detail }) + '\n');
  } catch (_) {
    // stdout itself is gone -- nothing left to say it with
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return ''; // no stdin (e.g. run by hand) -- expected
  }
}

function main() {
  let cwd = null;
  try {
    cwd = JSON.parse(readStdin()).cwd;
  } catch (_) {
    // malformed or empty payload -- expected; fall through to process.cwd()
  }
  if (!cwd) cwd = process.cwd();

  const lines = [ESSENTIALS];

  // A broken plan lookup must not cost the essentials -- they are the point of this hook and
  // do not depend on the plans directory. Report the failure and inject them anyway.
  let planError = null;
  let active = [];
  try {
    active = activePlans(cwd);
  } catch (err) {
    planError = err;
  }

  if (active.length > 0) {
    lines.push(
      `Approved plan: ${active.join(', ')} (docs/plans/approved/) - carry the remaining ` +
        'steps through to completion unless a stop condition is hit. Do not seek approval ' +
        'again between steps.'
    );
  }

  if (planError) {
    const detail = planError.stack ? planError.stack.split('\n')[0] : String(planError);
    process.stdout.write(
      JSON.stringify({
        systemMessage: 'phasprint gate hook failed open: ' + detail,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: lines.join('\n'),
        },
      }) + '\n'
    );
    return;
  }

  process.stdout.write(lines.join('\n') + '\n');
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
