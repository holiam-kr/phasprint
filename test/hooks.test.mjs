// phasprint hook tests -- run with `node --test test/`
//
// Every hook is exercised as a child process with a controlled stdin payload, a throwaway
// repository, and an isolated TMPDIR, because that is exactly how Claude Code invokes them.
// Importing the modules instead would test a shape the hooks are never used in.

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `phasprint-test-${prefix}-`));
  trash.push(dir);
  return dir;
}

/**
 * A repository fixture.
 *   approved -- docs/plans/approved/   the only plans the hooks may act on
 *   draft    -- docs/plans/draft/      waiting on the user
 *   legacy   -- docs/plans/            loose files from a pre-0.4.0 layout
 */
function repo({ approved = [], draft = [], legacy = [] } = {}) {
  const dir = scratch('repo');
  const write = (sub, names) => {
    if (names.length === 0) return;
    const target = path.join(dir, 'docs', 'plans', ...sub);
    fs.mkdirSync(target, { recursive: true });
    for (const name of names) fs.writeFileSync(path.join(target, name), '# plan\n');
  };
  write(['approved'], approved);
  write(['draft'], draft);
  write([], legacy);
  return dir;
}

const approvedDir = (cwd) => path.join(cwd, 'docs', 'plans', 'approved');

function run(hook, payload, tmp) {
  const res = spawnSync(process.execPath, [path.join(HOOKS, hook)], {
    input: payload === null ? '' : JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: tmp || scratch('tmp') },
  });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch (_) {
    // plain-text output -- the normal path for core and gate
  }
  return { out: res.stdout, code: res.status, json };
}

/** Mirrors cwdMarker() in finish-gate.cjs so the legacy-marker case can be set up. */
function cwdMarkerPath(tmp, cwd) {
  const hash = crypto.createHash('sha1').update(cwd).digest('hex').slice(0, 16);
  return path.join(tmp, 'phasprint', `cwd-${hash}.stop`);
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

// ---------------------------------------------------------------- core.cjs

test('core: injects every rule and exits 0', () => {
  const { out, code } = run('core.cjs', {});
  assert.equal(code, 0);
  for (const rule of ['Evidence', 'Scope', 'Verdict', 'Stop', 'Secrets', 'Debugging', 'Isolation']) {
    assert.match(out, new RegExp(`\\*\\*${rule}\\*\\*`), `missing rule: ${rule}`);
  }
});

// Not a style check. core is injected on every session and again on every compaction, so a rule
// may only be added by naming the one it replaces -- changing this number should be deliberate.
test('core holds exactly seven rules', () => {
  const { out } = run('core.cjs', {});
  const bullets = out.match(/^- \*\*\w+\*\*/gm) || [];
  assert.equal(bullets.length, 7, `core has ${bullets.length} rules: ${bullets.join(', ')}`);
});

test('core: output stays ASCII-only', () => {
  const { out } = run('core.cjs', {});
  const offenders = [...out].filter((ch) => ch.charCodeAt(0) > 126);
  assert.deepEqual(offenders, [], `non-ASCII characters in core output: ${offenders.join('')}`);
});

// ---------------------------------------------------------------- gate.cjs

test('gate: repo without plans gets the essentials only', () => {
  const { out, code } = run('gate.cjs', { cwd: repo() });
  assert.equal(code, 0);
  assert.match(out, /^phasprint: claims of done/);
  assert.doesNotMatch(out, /Active plan/);
});

test('gate: an approved plan is surfaced by name', () => {
  const { out } = run('gate.cjs', { cwd: repo({ approved: ['task_007.md'] }) });
  assert.match(out, /Approved plan: task_007\.md/);
});

// The whole point of the draft/approved split: no completion pressure before the user has said yes.
test('gate: a draft awaiting approval is not surfaced', () => {
  const { out } = run('gate.cjs', { cwd: repo({ draft: ['task_007.md'] }) });
  assert.doesNotMatch(out, /plan/i);
});

test('gate: a loose pre-0.4.0 plan is treated as a draft, not as approved', () => {
  const { out } = run('gate.cjs', { cwd: repo({ legacy: ['task_001.md'] }) });
  assert.doesNotMatch(out, /plan/i);
});

test('gate: archives/ does not count as approved', () => {
  const dir = repo({ approved: ['task_001.md'] });
  const archives = path.join(dir, 'docs', 'plans', 'archives');
  fs.mkdirSync(archives);
  fs.renameSync(path.join(approvedDir(dir), 'task_001.md'), path.join(archives, 'task_001.md'));
  const { out } = run('gate.cjs', { cwd: dir });
  assert.doesNotMatch(out, /Approved plan/);
});

test('gate: an empty payload still emits the essentials', () => {
  const { out, code } = run('gate.cjs', null);
  assert.equal(code, 0);
  assert.match(out, /^phasprint: claims of done/);
});

test('gate: an unreadable plans directory is reported, and the essentials survive', (t) => {
  const dir = repo({ approved: ['task_001.md'] });
  const plansDir = approvedDir(dir);
  fs.chmodSync(plansDir, 0o000);
  t.after(() => fs.chmodSync(plansDir, 0o755));

  const { json, code } = run('gate.cjs', { cwd: dir });
  assert.equal(code, 0, 'must still fail open');
  assert.ok(json, 'expected a JSON payload carrying the failure');
  assert.match(json.systemMessage, /failed open/);
  assert.match(json.hookSpecificOutput.additionalContext, /^phasprint: claims of done/);
});

// ---------------------------------------------------------------- finish-gate.cjs

test('finish-gate: blocks once, then stays quiet for the same session', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');

  const first = run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(first.json.decision, 'block');
  assert.match(first.json.reason, /task_001\.md/);
  assert.match(first.json.reason, /docs\/plans\/draft\//, 'awaiting approval must count as a legitimate stop');

  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp).out, '');
});

test('finish-gate: a payload with no session_id cannot re-open the nudge', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(run('finish-gate.cjs', { cwd }, tmp).out, '');
});

test('finish-gate: a new session gets its own nudge (once per session, not per repo)', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);

  const other = run('finish-gate.cjs', { session_id: 'BBB', cwd }, tmp);
  assert.equal(other.json.decision, 'block', 'a second session must not inherit the first marker');
  assert.equal(run('finish-gate.cjs', { session_id: 'BBB', cwd }, tmp).out, '');
});

test('finish-gate: stop_hook_active short-circuits', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd, stop_hook_active: true }).out, '');
});

test('finish-gate: a repo without plans is never touched', () => {
  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd: repo() }).out, '');
});

test('finish-gate: a marker left by an older version does not silence a new session', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const marker = cwdMarkerPath(tmp, cwd);
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, ''); // pre-0.2.0 wrote these empty

  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp).json.decision, 'block');
});

// Regression guard for the 2026-08-15 anomaly: the hook blocked, no marker landed, and nothing
// said so. The block is still correct here; what changed is that the failure is now visible.
test('finish-gate: a marker that cannot be written is blocked AND reported', (t) => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const markerDir = path.join(tmp, 'phasprint');
  fs.mkdirSync(markerDir, { recursive: true });
  fs.chmodSync(markerDir, 0o500); // readable, not writable
  t.after(() => fs.chmodSync(markerDir, 0o755));

  const { json, code } = run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(code, 0);
  assert.equal(json.decision, 'block');
  assert.match(json.systemMessage, /marker write failed/);
  assert.match(json.systemMessage, /guard may repeat/);
});

test('finish-gate: an unreadable plans directory is reported instead of swallowed', (t) => {
  const cwd = repo({ approved: ['task_001.md'] });
  const plansDir = approvedDir(cwd);
  fs.chmodSync(plansDir, 0o000);
  t.after(() => fs.chmodSync(plansDir, 0o755));

  const { json, code } = run('finish-gate.cjs', { session_id: 'AAA', cwd });
  assert.equal(code, 0, 'must still fail open');
  assert.match(json.systemMessage, /failed open/);
  assert.equal(json.decision, undefined, 'an unknown plan state must not block');
});

test('finish-gate: a draft awaiting approval is never nudged', () => {
  const cwd = repo({ draft: ['task_001.md'] });
  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd }).out, '');
});

test('finish-gate: a loose pre-0.4.0 plan is treated as a draft', () => {
  const cwd = repo({ legacy: ['task_001.md'] });
  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd }).out, '');
});

// The 2026-08-15 misfire itself: the write raised nothing, yet the marker never landed. A
// symlink to /dev/null reproduces exactly that -- writeFileSync succeeds, the content is gone.
test('finish-gate: a marker that vanishes without an error is still caught', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const marker = cwdMarkerPath(tmp, cwd);
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.symlinkSync('/dev/null', marker);

  const { json, code } = run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(code, 0);
  assert.equal(json.decision, 'block');
  assert.match(json.systemMessage, /did not persist/);
});

test('finish-gate: markers older than a week are swept away, recent ones survive', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const markerDir = path.join(tmp, 'phasprint');
  fs.mkdirSync(markerDir, { recursive: true });

  const stale = path.join(markerDir, 'ancient-session.stop');
  const fresh = path.join(markerDir, 'recent-session.stop');
  fs.writeFileSync(stale, '');
  fs.writeFileSync(fresh, '');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(stale, eightDaysAgo, eightDaysAgo);

  run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(fs.existsSync(stale), false, 'a week-old marker should be gone');
  assert.equal(fs.existsSync(fresh), true, 'a fresh marker must survive');
});

test('finish-gate: the sweep leaves non-marker files alone', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const markerDir = path.join(tmp, 'phasprint');
  fs.mkdirSync(markerDir, { recursive: true });
  const bystander = path.join(markerDir, 'notes.txt');
  fs.writeFileSync(bystander, 'keep me');
  const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  fs.utimesSync(bystander, old, old);

  run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(fs.readFileSync(bystander, 'utf8'), 'keep me');
});

// A session opened in a subpackage of a monorepo used to see no plans at all, so the hooks went
// silent for the wrong reason.
test('gate: an approved plan is found from a subdirectory', () => {
  const root = repo({ approved: ['task_009.md'] });
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const deep = path.join(root, 'packages', 'web', 'src');
  fs.mkdirSync(deep, { recursive: true });

  const { out } = run('gate.cjs', { cwd: deep });
  assert.match(out, /Approved plan: task_009\.md/);
});

// Without a boundary, a session in an unrelated folder could bind itself to a parent's plans.
test('gate: the upward search stops at the repository root', () => {
  const outer = repo({ approved: ['task_009.md'] });
  const inner = path.join(outer, 'vendor', 'other-repo');
  fs.mkdirSync(path.join(inner, '.git'), { recursive: true });
  const deep = path.join(inner, 'src');
  fs.mkdirSync(deep, { recursive: true });

  const { out } = run('gate.cjs', { cwd: deep });
  assert.doesNotMatch(out, /Approved plan/);
});

test('finish-gate: the same boundary applies to the Stop hook', () => {
  const outer = repo({ approved: ['task_009.md'] });
  const inner = path.join(outer, 'vendor', 'other-repo');
  fs.mkdirSync(path.join(inner, '.git'), { recursive: true });

  assert.equal(run('finish-gate.cjs', { session_id: 'AAA', cwd: inner }).out, '');
});

// The Stop nudge used to be generic. It now states what was actually observed, which is the
// point of the observation hook -- but it must not become a second stop condition.
test('finish-gate: the nudge reports what was observed this turn', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const obs = (payload) =>
    spawnSync(process.execPath, [path.join(HOOKS, 'observe.cjs')], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env: { ...process.env, TMPDIR: tmp },
    });

  obs({ hook_event_name: 'PostToolUse', session_id: 'AAA', cwd, prompt_id: 'p1',
        tool_name: 'Write', tool_input: { file_path: '/x/a.ts' } });

  const { json } = run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(json.decision, 'block');
  assert.match(json.reason, /Observed this turn: files changed \(code\); no verification command/);
});

test('finish-gate: with no ledger the nudge still stands', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const { json } = run('finish-gate.cjs', { session_id: 'AAA', cwd });
  assert.equal(json.decision, 'block');
  assert.doesNotMatch(json.reason, /Observed this turn/);
});

test('finish-gate: stale ledgers are swept like markers', () => {
  const cwd = repo({ approved: ['task_001.md'] });
  const tmp = scratch('tmp');
  const markerDir = path.join(tmp, 'phasprint');
  fs.mkdirSync(markerDir, { recursive: true });
  const oldLedger = path.join(markerDir, 'ledger-deadbeefdeadbeef.json');
  fs.writeFileSync(oldLedger, '{}');
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  fs.utimesSync(oldLedger, eightDaysAgo, eightDaysAgo);

  run('finish-gate.cjs', { session_id: 'AAA', cwd }, tmp);
  assert.equal(fs.existsSync(oldLedger), false, 'a week-old ledger should be gone');
});
