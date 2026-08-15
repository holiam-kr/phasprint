'use strict';
/**
 * Secret masking for anything phasprint records about itself.
 *
 * Scope is deliberately narrow: this masks values on their way into phasprint's own ledger and
 * recordings. It never rewrites what the user writes to their own files -- silently editing a
 * Write payload would corrupt test fixtures and documentation that legitimately contain
 * key-shaped strings.
 *
 * The shape follows the core Secrets rule: first four and last four characters, and nothing at
 * all below twelve, where there is too little left to be worth showing.
 */

const MIN_REVEALABLE = 12;

// Patterns with a capture group mask only the captured value; the rest mask the whole match.
const PATTERNS = [
  /(?:api[_-]?key|apikey|token|secret|password|passwd|pwd|authorization|bearer)["'\s]*[:=]["'\s]*([^\s"',;}]+)/gi,
  /(?:https?:\/\/)[^\s/:@]+:([^\s/@]+)@/gi,
  /\bsk-[A-Za-z0-9_-]{12,}/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

function maskValue(value) {
  const text = String(value);
  if (text.length < MIN_REVEALABLE) return '[redacted]';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function mask(input) {
  if (input === null || input === undefined) return '';
  let text = String(input);
  for (const pattern of PATTERNS) {
    text = text.replace(pattern, (whole, captured) =>
      // A pattern with no capture group gets the match offset as the second argument -- a
      // number, not undefined. Testing for undefined silently disabled every group-less
      // pattern here, which is to say every raw key format, while the ones that "worked"
      // gave the appearance of a functioning masker.
      typeof captured === 'string' ? whole.replace(captured, maskValue(captured)) : maskValue(whole)
    );
  }
  return text;
}

/** Masks every string inside a structure, leaving its shape intact. */
function maskDeep(value, depth = 0) {
  if (depth > 12) return '[too deep]';
  if (typeof value === 'string') return mask(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => maskDeep(item, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) out[key] = maskDeep(child, depth + 1);
    return out;
  }
  return value;
}

module.exports = { mask, maskDeep, maskValue, MIN_REVEALABLE };
