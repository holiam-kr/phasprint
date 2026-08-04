#!/usr/bin/env node
'use strict';
/**
 * phasprint Stop hook -- asks back once when a turn ends while an approved plan is still open.
 *
 * Design intent: push toward completion without becoming a trap.
 *   - Blocks at most once per session. It passes through every time after that.
 *   - Passes through when stop_hook_active is set (the turn already resumed because of this hook).
 *   - Does nothing at all when there is no active plan.
 * If the model stopped because of a stop condition, it states which one and ends the turn.
 *
 * The once-per-session guard needs two markers. Keying on session_id alone is not enough:
 * when the payload arrives without one, the guard falls back to a different key and fires a
 * second time -- observed in practice, with both a "<uuid>.stop" and a "nosession.stop"
 * marker left behind for a single session.
 *
 * So there is also a per-cwd marker, and it records *which* session last fired. A bare
 * "this cwd has fired" flag would survive in the temp dir after the session ended and
 * silence every later session in that repo -- once per session would quietly become once
 * per repo. Comparing the recorded id instead lets the next session have its one nudge.
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

function sessionMarker(dir, sessionId) {
  if (!sessionId) return null;
  return path.join(dir, String(sessionId).replace(/[^A-Za-z0-9._-]/g, '_') + '.stop');
}

function cwdMarker(dir, cwd) {
  const hash = crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 16);
  return path.join(dir, 'cwd-' + hash + '.stop');
}

function alreadyFired(dir, sessionId, cwd) {
  const session = sessionMarker(dir, sessionId);
  if (session && fs.existsSync(session)) return true;

  let recorded;
  try {
    recorded = fs.readFileSync(cwdMarker(dir, cwd), 'utf8').trim();
  } catch (_) {
    return false; // no marker for this repo yet
  }
  // A payload carrying no session_id cannot prove it belongs to a new session, so the marker
  // alone suppresses it. With an id, only the session that wrote the marker is suppressed --
  // markers left behind by earlier sessions (or by an older version, which wrote them empty)
  // no longer silence anyone.
  if (!sessionId) return true;
  return recorded === String(sessionId);
}

function recordFired(dir, sessionId, cwd) {
  const writes = [[cwdMarker(dir, cwd), sessionId ? String(sessionId) : '']];
  const session = sessionMarker(dir, sessionId);
  if (session) writes.push([session, '']);
  writes.forEach(([file, body]) => {
    try {
      fs.writeFileSync(file, body);
    } catch (_) {
      // ignore
    }
  });
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
  const markerDir = path.join(os.tmpdir(), 'phasprint');
  fs.mkdirSync(markerDir, { recursive: true });

  if (alreadyFired(markerDir, input.session_id, cwd)) process.exit(0);
  recordFired(markerDir, input.session_id, cwd);

  process.stdout.write(
    JSON.stringify({ decision: 'block', reason: reasonText(active.join(', ')) })
  );
} catch (_) {
  // ignore
}
process.exit(0);
