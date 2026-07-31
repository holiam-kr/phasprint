#!/usr/bin/env node
'use strict';
/**
 * taskcycle UserPromptSubmit hook -- restates the core essentials each turn, and surfaces the
 * active plan when the cycle is under way.
 *
 * The full text injected by SessionStart (core.cjs) can be pushed out once a conversation grows
 * long, so this compresses the essentials and revives them every turn.
 *
 * Repos without plans never hear about the cycle -- writing a plan is not a core requirement,
 * it is asked for only when the /plan command or the taskcycle skill is invoked.
 */

const fs = require('fs');
const path = require('path');

const ESSENTIALS =
  'taskcycle: claims of done or passing rest on command output from this session only - ' +
  'stay inside the requested scope - stop and ask when blocked twice or when a destructive ' +
  'action is needed.';

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function activePlans(cwd) {
  // archives/ is a directory, so filtering to files excludes archived plans naturally.
  const plansDir = path.join(cwd, 'docs', 'plans');
  try {
    return fs
      .readdirSync(plansDir, { withFileTypes: true })
      .filter((e) => e.isFile() && /^task_.*\.md$/.test(e.name))
      .map((e) => e.name);
  } catch (_) {
    return [];
  }
}

// Fail open: a hook must never block the session. Any error here exits 0 silently.
try {
  let cwd = null;
  try {
    cwd = JSON.parse(readStdin()).cwd;
  } catch (_) {
    // malformed or empty payload -- fall through to process.cwd()
  }
  if (!cwd) cwd = process.cwd();

  const lines = [ESSENTIALS];
  const active = activePlans(cwd);
  if (active.length > 0) {
    lines.push(
      `Active plan: ${active.join(', ')} (docs/plans/) - if it is approved, carry the ` +
        'remaining steps through to completion unless a stop condition is hit. Do not seek ' +
        'approval again between steps.'
    );
  }

  process.stdout.write(lines.join('\n') + '\n');
} catch (_) {
  // ignore
}
process.exit(0);
