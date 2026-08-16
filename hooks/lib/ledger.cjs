'use strict';
/**
 * A record of what tools actually did during the current turn.
 *
 * The turn boundary comes from the payload: every hook event carries a `prompt_id`, so when a
 * new one appears the contents are reset in place. Nothing has to be wired into
 * UserPromptSubmit to clear it, and there is no window where a stale turn's observations can
 * be mistaken for this one's.
 *
 * One file per session and working directory -- the same cardinality as the Stop markers,
 * rather than one file per turn.
 *
 * Success is not parsed out of output text. PostToolUse fires only for calls that succeeded;
 * failures arrive as PostToolUseFailure. The event itself is the verdict, so there is no
 * regex to get wrong -- the reference implementation reads "5 passed, 0 failed" as a failure
 * because its failure pattern matches the bare word first.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const MAX_ENTRIES = 40;

const CODE_EXT = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.java', '.js', '.jsx', '.kt', '.mjs', '.cjs',
  '.php', '.py', '.rb', '.rs', '.scss', '.sh', '.sql', '.swift', '.ts', '.tsx', '.vue',
]);
const DOC_EXT = new Set(['.md', '.mdx', '.rst', '.txt', '.adoc']);
const CONFIG_EXT = new Set(['.json', '.jsonc', '.toml', '.yaml', '.yml', '.ini', '.cfg', '.conf', '.lock']);

// Deliberately narrow. Missing a verification command costs one unremarked turn; inventing one
// makes the ledger claim evidence that was never produced, which is the failure that matters.
const VERIFICATION = [
  /\bnode\s+--test\b/, /\bnpm\s+(run\s+)?test\b/, /\b(pnpm|yarn|bun)\s+(run\s+)?test\b/,
  /\bpytest\b/, /\bpython\s+-m\s+(unittest|pytest)\b/, /\bgo\s+test\b/, /\bcargo\s+(test|clippy)\b/,
  /\b(mvn|gradle)\s+test\b/, /\brspec\b/, /\b(vitest|jest|playwright|cypress)\b/,
  /\b(eslint|ruff|flake8|mypy|pyright|tsc|biome|golangci-lint)\b/,
  /\bmake\s+(test|check|lint)\b/, /\bnode\s+--check\b/,
];

function markerDir() {
  return path.join(os.tmpdir(), 'phasprint');
}

function ledgerPath(dir, sessionId, cwd) {
  const key = crypto.createHash('sha1').update(`${sessionId || 'no-session'}|${cwd || ''}`).digest('hex').slice(0, 16);
  return path.join(dir, `ledger-${key}.json`);
}

function blank(promptId) {
  return {
    prompt_id: promptId || null,
    changed: false,
    change_kinds: [],
    verifications: [],
    failures: 0,
    updated_at: null,
  };
}

function classifyPath(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (DOC_EXT.has(ext)) return 'docs';
  if (CODE_EXT.has(ext)) return 'code';
  if (CONFIG_EXT.has(ext)) return 'config';
  return 'other';
}

function isVerification(command) {
  const text = String(command || '');
  return VERIFICATION.some((pattern) => pattern.test(text));
}

function read(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? { ...blank(null), ...parsed } : blank(null);
  } catch (_) {
    return blank(null); // absent or corrupt -- start this turn clean either way
  }
}

/**
 * Applies `mutate` to the ledger for this turn and writes it back. Returns the ledger, or an
 * error string if it could not be persisted -- a write that reports success without landing is
 * the failure this project already met once, so the result is read back before trusting it.
 */
function update(sessionId, cwd, promptId, mutate) {
  const dir = markerDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = ledgerPath(dir, sessionId, cwd);

  let ledger = read(file);
  if (ledger.prompt_id !== promptId) ledger = blank(promptId); // a new turn starts empty
  mutate(ledger);

  ledger.change_kinds = [...new Set(ledger.change_kinds)].slice(0, 8);
  ledger.verifications = ledger.verifications.slice(-MAX_ENTRIES);
  ledger.updated_at = new Date().toISOString();

  const body = JSON.stringify(ledger);
  fs.writeFileSync(file, body);
  const readBack = fs.readFileSync(file, 'utf8');
  if (readBack !== body) return { ledger, error: `ledger did not persist at ${path.basename(file)}` };
  return { ledger, error: null };
}

function load(sessionId, cwd) {
  return read(ledgerPath(markerDir(), sessionId, cwd));
}

module.exports = { update, load, ledgerPath, markerDir, blank, classifyPath, isVerification, MAX_ENTRIES };
