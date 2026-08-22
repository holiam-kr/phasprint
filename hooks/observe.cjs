#!/usr/bin/env node
'use strict';
/**
 * phasprint PostToolUse / PostToolUseFailure hook -- observation only.
 *
 * The core Evidence rule ("cite output from a command you actually ran") existed only as a
 * request to the model. This records what the tools actually did, so the claim can be checked
 * against something.
 *
 * It writes nothing to stdout on the normal path. A hook that speaks after every tool call
 * would cost more attention than the rule it protects.
 *
 * Which event arrives is the verdict: Claude Code raises PostToolUse only for calls that
 * succeeded, and PostToolUseFailure for the rest. Nothing is inferred from output text --
 * measured on 2026-08-16, `tool_response` for Bash is {stdout, stderr, interrupted, isImage,
 * noOutputExpected} with no exit code anywhere, and a command exiting non-zero produces no
 * PostToolUse event at all.
 *
 * Recording of raw payloads (for working out shapes like the above) stays available behind
 * PHASPRINT_RECORD or a `record.on` file in the marker directory. Hook environments are set by
 * Claude Code, so the file is the switch you can actually reach from a shell.
 */

const fs = require('fs');
const path = require('path');
const { maskDeep, mask } = require('./lib/mask.cjs');
const { update, markerDir, classifyPath, isVerification } = require('./lib/ledger.cjs');

const MUTATING_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);

function failOpen(err) {
  try {
    const detail = err && err.stack ? err.stack.split('\n')[0] : String(err);
    process.stdout.write(
      JSON.stringify({ systemMessage: 'phasprint observe hook failed open: ' + detail }) + '\n'
    );
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

function recordingEnabled(dir) {
  if (process.env.PHASPRINT_RECORD) return true;
  try {
    return fs.existsSync(path.join(dir, 'record.on'));
  } catch (_) {
    return false;
  }
}

function recordRaw(dir, payload) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), payload: maskDeep(payload) });
    fs.appendFileSync(path.join(dir, 'record.jsonl'), line + '\n');
  } catch (_) {
    // recording is a debugging aid; never let it disturb the turn
  }
}

function main() {
  const raw = readStdin(); // always drain stdin so the writer never blocks
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return; // nothing observable in a payload we cannot read
  }
  if (!payload || typeof payload !== 'object') return;

  const dir = markerDir();
  if (recordingEnabled(dir)) recordRaw(dir, payload);

  // A user interrupt arrives as PostToolUseFailure too -- measured 2026-08-22, the failure
  // payload carries `is_interrupt` (and an `error` string, and no `tool_response`). A cancelled
  // command reached no verdict, so recording it as a failed verification would make the ledger
  // claim evidence that was never produced -- inverted, but the same fault the event-based
  // design exists to avoid. Observe nothing.
  if (payload.is_interrupt === true) return;

  const succeeded = payload.hook_event_name !== 'PostToolUseFailure';
  const tool = String(payload.tool_name || '');
  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};

  const verification =
    tool === 'Bash' && isVerification(input.command)
      ? mask(String(input.command)).slice(0, 200)
      : null;

  const { error } = update(payload.session_id, payload.cwd, payload.prompt_id, (ledger) => {
    // A verification that ran and failed is a different fact from one that never ran, and the
    // difference is the whole point of the ledger -- record both outcomes.
    if (verification) ledger.verifications.push({ command: verification, ok: succeeded });
    if (!succeeded) {
      ledger.failures += 1;
      return; // a failed call changed nothing
    }
    if (MUTATING_TOOLS.has(tool) && input.file_path) {
      ledger.changed = true;
      ledger.change_kinds.push(classifyPath(input.file_path));
    }
  });

  if (error) {
    process.stdout.write(JSON.stringify({ systemMessage: 'phasprint observe: ' + error }) + '\n');
  }
}

try {
  main();
} catch (err) {
  failOpen(err);
}
process.exit(0);
