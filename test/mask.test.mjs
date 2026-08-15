// Masking guards what phasprint records about itself. A masker that quietly does nothing is
// worse than none, because the recording looks safe -- so these tests check the raw key formats
// individually rather than trusting one combined case to cover them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { mask, maskDeep, maskValue } = require(path.join(ROOT, 'hooks/lib/mask.cjs'));

const SECRETS = [
  ['OpenAI-style key', 'sk-abcdefghijklmnop3f9k'],
  ['GitHub token', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'],
  ['Slack token', 'xoxb-1234567890-abcdefghij'],
  ['AWS access key', 'AKIAIOSFODNN7EXAMPLE'],
  ['JWT', 'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSM'],
];

// The bug this file was written for: String.replace hands a group-less pattern the match offset
// as its second argument, not undefined. Branching on undefined disabled every pattern without a
// capture group -- which was all of the raw key formats -- while the key=value patterns still
// worked, so the masker looked healthy.
for (const [label, secret] of SECRETS) {
  test(`${label} never survives masking`, () => {
    for (const context of [secret, `prefix ${secret} suffix`, `"${secret}"`, `run --key=${secret}`]) {
      const masked = mask(context);
      assert.ok(!masked.includes(secret), `${label} leaked from: ${context}`);
    }
  });
}

test('a masked value keeps four characters at each end', () => {
  assert.equal(mask('sk-abcdefghijklmnop3f9k'), 'sk-a...3f9k');
});

test('anything shorter than twelve characters is hidden outright', () => {
  assert.equal(maskValue('short1'), '[redacted]');
  assert.match(mask('token=short1'), /\[redacted\]/);
});

test('credentials inside a URL are masked, the host is not', () => {
  const masked = mask('https://user:hunter2password@example.com/x');
  assert.ok(!masked.includes('hunter2password'));
  assert.match(masked, /example\.com/);
});

test('key=value pairs are masked whatever the separator', () => {
  for (const line of ['API_KEY=abcdefghijklmnopqrstuvwx', 'api_key: abcdefghijklmnopqrstuvwx', '"token":"abcdefghijklmnopqrstuvwx"']) {
    assert.ok(!mask(line).includes('abcdefghijklmnopqrstuvwx'), `leaked from: ${line}`);
  }
});

test('private key blocks are removed whole', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
  assert.ok(!mask(pem).includes('MIIEowIBAAKCAQEA'));
});

test('ordinary output is left alone', () => {
  for (const line of ['5 passed, 0 failed in 1.2s', 'node --test', 'Error: ENOENT: no such file']) {
    assert.equal(mask(line), line);
  }
});

test('maskDeep masks nested strings and keeps the shape', () => {
  const payload = {
    tool_name: 'Bash',
    tool_input: { command: 'curl -H "Authorization: Bearer sk-abcdefghijklmnop3f9k"' },
    tool_response: { exit_code: 0, stdout: ['ok', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'] },
  };
  const masked = maskDeep(payload);
  assert.equal(masked.tool_name, 'Bash');
  assert.equal(masked.tool_response.exit_code, 0);
  assert.ok(!JSON.stringify(masked).includes('sk-abcdefghijklmnop3f9k'));
  assert.ok(!JSON.stringify(masked).includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123'));
  assert.ok(Array.isArray(masked.tool_response.stdout));
});

test('maskDeep does not recurse forever on a cyclic structure', () => {
  const a = { name: 'a' };
  a.self = a;
  assert.doesNotThrow(() => maskDeep(a));
});
