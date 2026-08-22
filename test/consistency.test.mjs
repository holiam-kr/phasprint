// The rules live in `rules/*.md` -- plain markdown a harness without hooks or skills can read.
// Everything else in this repo (hooks, skill stubs, commands, both READMEs) is a *copy* or a
// *pointer*, and copies drift. These tests fail when one does.
//
// The stop-condition list is restated in four places in three formats -- markdown, Node source,
// and prose in two languages -- so it cannot be factored into one literal. `rules/cycle.md` §4
// is canonical. It has drifted before: an earlier revision called an adversarial-review finding
// "condition 4" when §4 lists it second.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** The canonical five, as the shortest phrase that identifies each. */
const CONDITIONS = [
  { en: /scope/i, ko: /범위/ },
  { en: /adversarial/i, ko: /적대/ },
  { en: /quality gate/i, ko: /품질 관문/ },
  { en: /blocker/i, ko: /블로커/ },
  { en: /destructive/i, ko: /파괴적/ },
];

/** core is intentionally a subset -- it carries no plan cycle, so it lists only these three. */
const CORE_SUBSET = [/two attempts/i, /blocker/i, /destructive/i];

/** The rules core ships, in order. */
const CORE_RULES = ['Evidence', 'Scope', 'Verdict', 'Stop', 'Debugging', 'Isolation'];

function stopConditionSection() {
  const cycle = read('rules/cycle.md');
  const section = cycle.split('## 4. Stop conditions')[1];
  assert.ok(section, 'rules/cycle.md has no "## 4. Stop conditions" section');
  return section.split('\n## ')[0];
}

test('rules/cycle.md §4 is the canonical list and holds exactly five conditions', () => {
  const numbered = stopConditionSection().match(/^\d+\. /gm) || [];
  assert.equal(numbered.length, 5, `expected 5 numbered conditions, found ${numbered.length}`);
});

test('the canonical five all appear in the cycle section they come from', () => {
  const section = stopConditionSection();
  for (const { en } of CONDITIONS) {
    assert.match(section, en, `cycle §4 is missing ${en}`);
  }
});

test('the Stop hook restates all five', () => {
  const source = read('hooks/finish-gate.cjs');
  for (const { en } of CONDITIONS) {
    assert.match(source, en, `finish-gate.cjs is missing ${en}`);
  }
});

test('README.md restates all five', () => {
  const readme = read('README.md');
  for (const { en } of CONDITIONS) {
    assert.match(readme, en, `README.md is missing ${en}`);
  }
});

test('README.ko.md restates all five', () => {
  const readme = read('README.ko.md');
  for (const { ko } of CONDITIONS) {
    assert.match(readme, ko, `README.ko.md is missing ${ko}`);
  }
});

test('rules/cycle.md carries the debugging protocol, all six steps', () => {
  const section = read('rules/cycle.md').split('## Debugging')[1];
  assert.ok(section, 'rules/cycle.md has no "## Debugging" section');
  const numbered = section.match(/^\d+\. /gm) || [];
  assert.equal(numbered.length, 6, `expected 6 numbered steps, found ${numbered.length}`);
});

test('rules/core.md holds exactly the seven rules, in order', () => {
  const names = [...read('rules/core.md').matchAll(/^- \*\*(\w+)\*\*/gm)].map((m) => m[1]);
  assert.deepEqual(names, CORE_RULES);
});

test('core stays the three-item subset -- no plan cycle leaks into it', () => {
  const stopBullet = read('rules/core.md').split('**Stop**')[1].split('\n- **')[0];
  for (const rule of CORE_SUBSET) {
    assert.match(stopBullet, rule, `core Stop bullet is missing ${rule}`);
  }
  assert.doesNotMatch(stopBullet, /adversarial/i, 'core must not mention the plan cycle');
  assert.doesNotMatch(stopBullet, /quality gate/i, 'core must not mention the plan cycle');
});

// Both READMEs list the core rules in prose, in two languages, so they cannot be compared to the
// source literally. What can be checked is the failure that actually happens: a rule is removed
// from core and the READMEs keep advertising it.
test('neither README advertises a rule core no longer has', () => {
  const present = [...read('rules/core.md').matchAll(/^- \*\*(\w+)\*\*/gm)].map((m) =>
    m[1].toLowerCase()
  );
  assert.ok(present.length >= 6, `expected the core bullets, parsed ${present.length}`);

  // Rules that have lived in core at some point, with the wording each README uses for them.
  const everShipped = [
    { rule: 'abbreviations', en: /abbreviation/i, ko: /축약어/ },
    { rule: 'secrets', en: /secret/i, ko: /시크릿/ },
    { rule: 'isolation', en: /isolation/i, ko: /격리/ },
    { rule: 'debugging', en: /debugging/i, ko: /디버깅/ },
  ];
  const en = read('README.md');
  const ko = read('README.ko.md');

  for (const { rule, en: enPattern, ko: koPattern } of everShipped) {
    const inCore = present.includes(rule);
    assert.equal(enPattern.test(en), inCore, `README.md and core disagree about "${rule}"`);
    assert.equal(koPattern.test(ko), inCore, `README.ko.md and core disagree about "${rule}"`);
  }
});

// The whole point of moving the rules into rules/*.md is that there is one copy. A stub that
// starts restating the cycle recreates the drift this layout exists to prevent.
test('the skill stubs are pointers, not a second copy of the rules', () => {
  for (const stub of ['skills/sprint/SKILL.md', 'skills/investigate/SKILL.md']) {
    const src = read(stub);
    const body = src.split('---')[2] || '';
    assert.ok(body.length < 500, `${stub} is ${body.length} bytes -- it is holding rules again`);
    assert.match(body, /rules\/cycle\.md/, `${stub} does not point at rules/cycle.md`);
    assert.doesNotMatch(body, /^\d+\. /m, `${stub} has a numbered procedure of its own`);
  }
});

// A Korean trigger list written with double quotes inside an already-quoted YAML scalar breaks
// the frontmatter silently -- the command simply stops describing itself. Caught in review once.
test('command frontmatter descriptions stay parseable', () => {
  for (const name of ['plan.md', 'go.md', 'report.md']) {
    const fm = read(`commands/${name}`).split('---')[1];
    const line = (fm.split('\n').find((l) => l.startsWith('description:')) || '');
    assert.ok(line, `${name} has no description`);
    const quotes = (line.match(/"/g) || []).length;
    assert.equal(quotes, 2, `${name}: description must be one quoted scalar, found ${quotes} quotes`);
  }
});

// ${CLAUDE_PLUGIN_ROOT} is expanded in command bodies -- confirmed by invoking /plan and seeing
// the literal cache path in its place. Whether it expands in a SKILL.md body is unverified, which
// is why the stubs do not use it and core.cjs computes the path from __dirname instead.
test('every command carries a Korean trigger and points at the rules by plugin root', () => {
  for (const name of ['plan.md', 'go.md', 'report.md']) {
    const src = read(`commands/${name}`);
    assert.match(src, /한국어/, `${name} has no Korean trigger`);
    assert.match(src, /\$\{CLAUDE_PLUGIN_ROOT\}\/rules\/cycle\.md/, `${name} does not point at the rules`);
    assert.doesNotMatch(src, /skills\/sprint/, `${name} still points at the retired skill body`);
  }
});

// The commands address the cycle by step number, so a renumbering in rules/cycle.md silently
// sends /go at the wrong section. Pin the numbers each command claims against the headings.
test('the step numbers the commands cite exist in rules/cycle.md', () => {
  const cycle = read('rules/cycle.md');
  for (const n of [1, 2, 3, 4, 5, 6]) {
    assert.match(cycle, new RegExp(`^## ${n}\\. `, 'm'), `rules/cycle.md has no step ${n}`);
  }
  assert.match(read('commands/plan.md'), /steps 1-2 of/);
  assert.match(read('commands/go.md'), /steps 3-5 of/);
  assert.match(read('commands/report.md'), /step 6 of/);
});

// core.cjs no longer holds the rules; it reads them. The injection must carry all seven and the
// absolute path of the cycle document, since the stubs rely on that line to locate it.
test('the SessionStart hook injects every rule plus the cycle locator', () => {
  const res = spawnSync(process.execPath, [path.join(ROOT, 'hooks', 'core.cjs')], {
    input: '',
    encoding: 'utf8',
  });
  assert.equal(res.status, 0);
  for (const rule of CORE_RULES) {
    assert.match(res.stdout, new RegExp(`\\*\\*${rule}\\*\\*`), `injection is missing ${rule}`);
  }
  // Anchored on the locator line -- core.md's own prose mentions `rules/cycle.md` relatively,
  // and a bare match picks that up instead of the absolute path the stubs need.
  const locator = res.stdout.match(/are at (\S+rules\/cycle\.md)/);
  assert.ok(locator, 'injection does not locate the cycle document');
  assert.ok(path.isAbsolute(locator[1]), `locator is not absolute: ${locator[1]}`);
});

// Reading a file is a failure mode the old string literal did not have. A half-installed plugin
// must not leave a session silently ruleless.
test('an unreadable rules file degrades loudly instead of going silent', () => {
  const res = spawnSync(process.execPath, ['-e', `
    const fs = require('fs');
    const real = fs.readFileSync;
    fs.readFileSync = (f, ...rest) =>
      String(f).endsWith('core.md') ? (() => { throw new Error('ENOENT: injected'); })() : real(f, ...rest);
    require(${JSON.stringify(path.join(ROOT, 'hooks', 'core.cjs'))});
  `], { encoding: 'utf8' });
  assert.match(res.stdout, /could not be read/, 'the failure is not announced');
  assert.match(res.stdout, /NOT loaded/, 'the session is not told its rules are reduced');
  assert.match(res.stdout, /claims of done or passing/, 'the compressed essentials are missing');
});

// Types, not just presence. `repository` was once written as {type, url} -- npm's shape, not
// this one -- and Claude Code rejected the whole manifest, so no hook and no skill loaded at
// all. Presence alone would have passed that. The reference shape is the official cwc-makers
// plugin: every field a string except author (object) and keywords (array).
test('the plugin manifest declares its provenance with the right types', () => {
  const manifest = JSON.parse(read('.claude-plugin/plugin.json'));
  const expected = {
    name: 'string',
    version: 'string',
    description: 'string',
    license: 'string',
    homepage: 'string',
    repository: 'string',
  };
  for (const [field, type] of Object.entries(expected)) {
    assert.equal(typeof manifest[field], type, `plugin.json: ${field} must be a ${type}`);
    assert.ok(manifest[field].length > 0, `plugin.json: ${field} is empty`);
  }
  assert.equal(typeof manifest.author, 'object', 'plugin.json: author must be an object');
  assert.ok(Array.isArray(manifest.keywords), 'plugin.json: keywords must be an array');
  assert.match(manifest.license, /MIT/);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
});

// The failure the ENOENT path does not cover: the file exists and reads clean, but holds nothing.
// readFileSync succeeds, so without a content check the session gets the locator and no rules at
// all, with no warning -- quieter, and therefore worse, than a missing file.
test('an empty rules file degrades as loudly as a missing one', () => {
  const res = spawnSync(process.execPath, ['-e', `
    const fs = require('fs');
    const real = fs.readFileSync;
    fs.readFileSync = (f, ...rest) => (String(f).endsWith('core.md') ? '   \\n\\n  ' : real(f, ...rest));
    require(${JSON.stringify(path.join(ROOT, 'hooks', 'core.cjs'))});
  `], { encoding: 'utf8' });
  assert.match(res.stdout, /no rules found/, 'an empty rules file passes silently');
  assert.match(res.stdout, /NOT loaded/, 'the session is not told its rules are reduced');
  assert.match(res.stdout, /claims of done or passing/, 'the compressed essentials are missing');
});
