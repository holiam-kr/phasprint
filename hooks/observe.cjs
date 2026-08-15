#!/usr/bin/env node
'use strict';
/**
 * phasprint PostToolUse hook -- observation only.
 *
 * The core Evidence rule ("cite output from a command you actually ran") currently exists as a
 * request to the model and nothing more. This hook is the first half of making it checkable:
 * it watches what tools actually did, so a claim can be compared against a record instead of
 * being taken at face value.
 *
 * It writes nothing to stdout on the normal path. A hook that speaks after every tool call
 * would cost more attention than the rule it protects.
 *
 * Right now it only records raw payloads, and only when recording is switched on. The field
 * names a parser would need -- where the exit code lives, how success is expressed -- are not
 * documented anywhere we can rely on, and guessing a schema is exactly how the plugin manifest
 * was broken. So: capture first, parse second.
 *
 * Recording is on when either is true:
 *   - PHASPRINT_RECORD is set in the environment
 *   - a file named `record.on` exists in the marker directory
 * The flag file exists because hook environments are set by Claude Code, not by whoever wants
 * the recording -- a file is something you can actually switch on from a shell.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { maskDeep } = require('./lib/mask.cjs');

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

function markerDir() {
  return path.join(os.tmpdir(), 'phasprint');
}

function recordingEnabled(dir) {
  if (process.env.PHASPRINT_RECORD) return true;
  try {
    return fs.existsSync(path.join(dir, 'record.on'));
  } catch (_) {
    return false;
  }
}

function main() {
  const raw = readStdin(); // always drain stdin, even when idle, so the writer never blocks
  const dir = markerDir();
  if (!recordingEnabled(dir)) return;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    payload = { _unparsed: raw.slice(0, 2000) };
  }

  fs.mkdirSync(dir, { recursive: true });
  const line = JSON.stringify({ at: new Date().toISOString(), payload: maskDeep(payload) });
  fs.appendFileSync(path.join(dir, 'record.jsonl'), line + '\n');
}

try {
  main();
} catch (err) {
  failOpen(err);
}
process.exit(0);
