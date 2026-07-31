#!/usr/bin/env node
'use strict';
/**
 * taskcycle Stop hook -- asks back once when a turn ends while an approved plan is still open.
 *
 * Design intent: push toward completion without becoming a trap.
 *   - Blocks at most once per session. It passes through every time after that.
 *   - Passes through when stop_hook_active is set (the turn already resumed because of this hook).
 *   - Does nothing at all when there is no active plan.
 * If the model stopped because of a stop condition, it states which one and ends the turn.
 *
 * The once-per-session guard keys on session_id AND a hash of cwd, writing and checking both.
 * Keying on session_id alone is not enough: when the payload arrives without one, the guard
 * falls back to a different key and fires a second time -- observed in practice, with both a
 * "<uuid>.stop" and a "nosession.stop" marker left behind for a single session.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

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

function markerKeys(sessionId, cwd) {
  const keys = [];
  if (sessionId) keys.push(String(sessionId).replace(/[^A-Za-z0-9._-]/g, '_'));
  keys.push('cwd-' + crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 16));
  return keys;
}

function reasonText(names) {
  return [
    `An active plan is still open: ${names}`,
    '',
    'If the plan has steps left, continue without seeking approval again.',
    'If it is finished, give the final report: present verification evidence for each step ->',
    'update HANDOFF.md -> move the plan to docs/plans/archives/ -> commit. The user decides completion.',
    '',
    'If you stopped because of a stop condition (scope departure / adversarial-review finding /',
    'quality gate failing twice / blocker / destructive action), say which one and end the turn.',
    '(This check appears only once per session.)',
  ].join('\n');
}

// Fail open: a hook must never block the session. Any error here exits 0 silently.
try {
  let input = {};
  try {
    input = JSON.parse(readStdin()) || {};
  } catch (_) {
    input = {};
  }

  if (input.stop_hook_active === true) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const active = activePlans(cwd);
  if (active.length === 0) process.exit(0);

  // Once per session -- keep the marker in the temp dir so the repository stays clean.
  const markerDir = path.join(os.tmpdir(), 'taskcycle');
  fs.mkdirSync(markerDir, { recursive: true });

  const keys = markerKeys(input.session_id, cwd);
  const markers = keys.map((k) => path.join(markerDir, k + '.stop'));
  if (markers.some((m) => fs.existsSync(m))) process.exit(0);
  markers.forEach((m) => {
    try {
      fs.writeFileSync(m, '');
    } catch (_) {
      // ignore
    }
  });

  process.stdout.write(
    JSON.stringify({ decision: 'block', reason: reasonText(active.join(', ')) })
  );
} catch (_) {
  // ignore
}
process.exit(0);
