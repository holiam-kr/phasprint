// The observation hook and its ledger. Payload shapes here are the ones measured on
// 2026-08-16 by recording real hook invocations -- Bash carries no exit code, and a command
// that exits non-zero produces no PostToolUse event at all. Which event arrives is the verdict.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks');
const trash = [];

function scratch(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `phasprint-obs-${prefix}-`));
  trash.push(dir);
  return dir;
}

process.on('exit', () => {
  for (const dir of trash) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (_) {
      // a leftover temp dir is not worth failing the run over
    }
  }
});

const CWD = '/repo';
const SESSION = 'S-obs';

function observe(payload, tmp) {
  const res = spawnSync(process.execPath, [path.join(HOOKS, 'observe.cjs')], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: tmp, PHASPRINT_RECORD: '' },
  });
  return { out: res.stdout, code: res.status };
}

function ledgerOf(tmp) {
  const key = crypto.createHash('sha1').update(`${SESSION}|${CWD}`).digest('hex').slice(0, 16);
  const file = path.join(tmp, 'phasprint', `ledger-${key}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const bash = (command, event = 'PostToolUse', prompt_id = 'p1') => ({
  hook_event_name: event,
  session_id: SESSION,
  cwd: CWD,
  prompt_id,
  tool_name: 'Bash',
  tool_input: { command },
  tool_response: { stdout: '', stderr: '', interrupted: false },
});

const write = (file_path, prompt_id = 'p1') => ({
  hook_event_name: 'PostToolUse',
  session_id: SESSION,
  cwd: CWD,
  prompt_id,
  tool_name: 'Write',
  tool_input: { file_path, content: 'x' },
  tool_response: { type: 'create', filePath: file_path },
});

test('the hook stays silent and exits 0 on the normal path', () => {
  const tmp = scratch('quiet');
  const { out, code } = observe(bash('echo hi'), tmp);
  assert.equal(out, '');
  assert.equal(code, 0);
});

test('a successful verification command is recorded as passing', () => {
  const tmp = scratch('verify');
  observe(bash('node --test'), tmp);
  const ledger = ledgerOf(tmp);
  assert.deepEqual(ledger.verifications, [{ command: 'node --test', ok: true }]);
});

// The distinction the ledger exists for: a verification that ran and failed is not the same
// fact as one that never ran.
test('a failed verification is recorded as failing, not merely absent', () => {
  const tmp = scratch('verifyfail');
  observe(bash('npm test', 'PostToolUseFailure'), tmp);
  const ledger = ledgerOf(tmp);
  assert.deepEqual(ledger.verifications, [{ command: 'npm test', ok: false }]);
  assert.equal(ledger.failures, 1);
});

test('an ordinary command is not mistaken for a verification', () => {
  const tmp = scratch('plain');
  observe(bash('git status'), tmp);
  observe(bash('ls -la'), tmp);
  assert.deepEqual(ledgerOf(tmp).verifications, []);
});

test('file writes are recorded with their kind', () => {
  const tmp = scratch('changed');
  observe(write('/repo/src/app.ts'), tmp);
  observe(write('/repo/README.md'), tmp);
  const ledger = ledgerOf(tmp);
  assert.equal(ledger.changed, true);
  assert.deepEqual(ledger.change_kinds.sort(), ['code', 'docs']);
});

test('a failed write does not count as a change', () => {
  const tmp = scratch('failedwrite');
  observe({ ...write('/repo/src/app.ts'), hook_event_name: 'PostToolUseFailure' }, tmp);
  const ledger = ledgerOf(tmp);
  assert.equal(ledger.changed, false);
  assert.equal(ledger.failures, 1);
});

// The turn boundary comes from the payload, so nothing has to reset the ledger explicitly.
test('a new prompt_id starts the ledger over', () => {
  const tmp = scratch('turn');
  observe(bash('node --test'), tmp);
  observe(write('/repo/src/app.ts'), tmp);
  assert.equal(ledgerOf(tmp).verifications.length, 1);

  observe(bash('git status', 'PostToolUse', 'p2'), tmp);
  const next = ledgerOf(tmp);
  assert.equal(next.prompt_id, 'p2');
  assert.deepEqual(next.verifications, []);
  assert.equal(next.changed, false);
});

test('secrets in a verification command are masked before they are stored', () => {
  const tmp = scratch('secret');
  observe(bash('npm test -- --token=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'), tmp);
  const stored = JSON.stringify(ledgerOf(tmp));
  assert.ok(!stored.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'), 'token leaked into the ledger');
  assert.match(stored, /ghp_\.\.\.0123/);
});

test('a malformed payload is ignored rather than reported', () => {
  const tmp = scratch('junk');
  const res = spawnSync(process.execPath, [path.join(HOOKS, 'observe.cjs')], {
    input: 'not json at all',
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: tmp },
  });
  assert.equal(res.stdout, '');
  assert.equal(res.status, 0);
});

test('recording is off unless it is switched on', () => {
  const tmp = scratch('rec');
  observe(bash('echo hi'), tmp);
  assert.equal(fs.existsSync(path.join(tmp, 'phasprint', 'record.jsonl')), false);

  fs.mkdirSync(path.join(tmp, 'phasprint'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'phasprint', 'record.on'), '');
  observe(bash('echo hi'), tmp);
  assert.equal(fs.existsSync(path.join(tmp, 'phasprint', 'record.jsonl')), true);
});
