// The stop-condition list is stated in five places in three different formats -- Node source,
// skill markdown, and prose in two languages -- so it cannot be factored into one literal.
// `skills/sprint/SKILL.md` §4 is the canonical list; these tests fail when a copy drifts from it.
// It has drifted before: an earlier revision called an adversarial-review finding "condition 4"
// when §4 lists it second.

import { test } from 'node:test';
import assert from 'node:assert/strict';
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

function stopConditionSection() {
  const skill = read('skills/sprint/SKILL.md');
  const section = skill.split('## 4. Stop conditions')[1];
  assert.ok(section, 'sprint SKILL.md has no "## 4. Stop conditions" section');
  return section.split('\n## ')[0];
}

test('sprint SKILL.md §4 is the canonical list and holds exactly five conditions', () => {
  const numbered = stopConditionSection().match(/^\d+\. /gm) || [];
  assert.equal(numbered.length, 5, `expected 5 numbered conditions, found ${numbered.length}`);
});

test('the canonical five all appear in the sprint section they come from', () => {
  const section = stopConditionSection();
  for (const { en } of CONDITIONS) {
    assert.match(section, en, `sprint §4 is missing ${en}`);
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

test('core stays the three-item subset -- no plan cycle leaks into it', () => {
  const core = read('hooks/core.cjs');
  const stopBullet = core.split('**Stop**')[1].split("',\n  '- **")[0];
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
  const core = read('hooks/core.cjs');
  const present = [...core.matchAll(/'- \*\*(\w+)\*\*/g)].map((m) => m[1].toLowerCase());
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
// the literal cache path in its place. A fallback for the unexpanded case was carried briefly and
// removed: it printed on every invocation to describe a case that does not happen.
test('every command carries a Korean trigger and points at the skill by plugin root', () => {
  for (const name of ['plan.md', 'go.md', 'report.md']) {
    const src = read(`commands/${name}`);
    assert.match(src, /한국어/, `${name} has no Korean trigger`);
    assert.match(src, /\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/sprint\/SKILL\.md/, `${name} does not point at the skill`);
    assert.doesNotMatch(src, /not a readable path/, `${name} still carries the dead fallback`);
  }
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

test('both skills expose the same top-level sections', () => {
  const required = ['## When to use this', '## When not to use this', '## Checklist'];
  for (const skill of ['skills/sprint/SKILL.md', 'skills/investigate/SKILL.md']) {
    const src = read(skill);
    for (const section of required) {
      assert.ok(src.includes(section), `${skill} is missing "${section}"`);
    }
  }
});
