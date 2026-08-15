#!/usr/bin/env node
'use strict';
/**
 * phasprint Stop hook -- asks back once when a turn ends while an approved plan is still open.
 *
 * Design intent: push toward completion without becoming a trap.
 *   - Blocks at most once per session. It passes through every time after that.
 *   - Passes through when stop_hook_active is set (the turn already resumed because of this hook).
 *   - Does nothing at all when there is no approved plan. A plan in docs/plans/draft/ is waiting
 *     on the user, and nudging during that wait is the opposite of what the harness wants.
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
const { activePlans, expectedMissing } = require('./lib/plans.cjs');

// Fail open, but never silently. Expected conditions (no stdin, no docs/plans, no marker yet)
// stay quiet; anything else is reported. This hook fired once with no marker written and the
// cause could not be reconstructed afterwards -- eleven empty catch blocks was why.
function failOpen(err) {
  try {
    const detail = err && err.stack ? err.stack.split('\n')[0] : String(err);
    process.stdout.write(JSON.stringify({ systemMessage: 'phasprint finish-gate hook failed open: ' + detail }) + '\n');
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
  } catch (err) {
    if (expectedMissing(err)) return false; // no marker for this repo yet
    throw err; // an unreadable marker is why the guard would misfire -- report it
  }
  // A payload carrying no session_id cannot prove it belongs to a new session, so the marker
  // alone suppresses it. With an id, only the session that wrote the marker is suppressed --
  // markers left behind by earlier sessions (or by an older version, which wrote them empty)
  // no longer silence anyone.
  if (!sessionId) return true;
  return recorded === String(sessionId);
}

// Writes each marker and reads it straight back, returning a description of the first problem
// instead of swallowing it. A marker that did not land means the once-per-session guard will
// repeat, so the caller reports it alongside the nudge rather than letting the two disagree.
//
// The read-back is not paranoia. On 2026-08-15 this hook emitted a block while both markers
// kept a three-day-old mtime and no exception was raised anywhere -- a write that reports
// success without landing is invisible unless something checks. Two small reads per firing.
function recordFired(dir, sessionId, cwd) {
  const writes = [[cwdMarker(dir, cwd), sessionId ? String(sessionId) : '']];
  const session = sessionMarker(dir, sessionId);
  if (session) writes.push([session, '']);

  let failure = null;
  const note = (message) => {
    if (!failure) failure = message;
  };
  const detail = (err) => (err && err.message) || String(err);

  writes.forEach(([file, body]) => {
    const name = path.basename(file);
    try {
      fs.writeFileSync(file, body);
    } catch (err) {
      note(`marker write failed for ${name}: ${detail(err)}`);
      return;
    }
    let readBack;
    try {
      readBack = fs.readFileSync(file, 'utf8');
    } catch (err) {
      note(`marker unreadable right after writing ${name}: ${detail(err)}`);
      return;
    }
    if (readBack.trim() !== body.trim()) {
      note(`marker did not persist for ${name}: wrote "${body}", read back "${readBack.trim()}"`);
    }
  });

  return failure;
}

function reasonText(names) {
  return [
    `An approved plan is still open: ${names} (docs/plans/approved/)`,
    '',
    'If the plan has steps left, continue without seeking approval again.',
    'If it is finished, give the final report: present verification evidence for each step ->',
    'update HANDOFF.md -> move the plan to docs/plans/archives/ -> commit. The user decides completion.',
    '',
    'Ending the turn is right when you are waiting on the user: a plan in docs/plans/draft/ needs',
    'their approval, or a stop condition applies (scope departure / adversarial-review finding /',
    'quality gate failing twice / blocker / destructive action). Say which one and end the turn.',
    '(This check appears only once per session.)',
  ].join('\n');
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readStdin()) || {};
  } catch (_) {
    input = {}; // malformed or empty payload -- expected
  }

  if (input.stop_hook_active === true) return;

  const cwd = input.cwd || process.cwd();
  const active = activePlans(cwd);
  if (active.length === 0) return;

  // Once per session -- keep the marker in the temp dir so the repository stays clean.
  const markerDir = path.join(os.tmpdir(), 'phasprint');
  fs.mkdirSync(markerDir, { recursive: true });

  if (alreadyFired(markerDir, input.session_id, cwd)) return;
  const markerFailure = recordFired(markerDir, input.session_id, cwd);

  const payload = { decision: 'block', reason: reasonText(active.join(', ')) };
  if (markerFailure) {
    payload.systemMessage =
      'phasprint finish-gate: ' + markerFailure + ' -- the once-per-session guard may repeat.';
  }
  process.stdout.write(JSON.stringify(payload));
}

try {
  main();
} catch (err) {
  failOpen(err);
}
process.exit(0);
