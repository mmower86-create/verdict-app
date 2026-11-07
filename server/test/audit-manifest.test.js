// The test that stops the manifest flattering itself.
//
// Without this, "instrumented" is a word anyone can type. This asserts that
// every invariant claiming to be instrumented is actually named by a test.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { INVARIANTS, APPLIED, NOT_YET_APPLIED } = require('../audit/manifest');

const TEST_DIR = __dirname;
const VALID_STATUS = new Set(['instrumented', 'checked', 'deferred', 'external']);

const testBodies = fs.readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.js') && f !== 'audit-manifest.test.js')
  .map((f) => fs.readFileSync(path.join(TEST_DIR, f), 'utf8'))
  .join('\n');

test('every invariant is well formed and uniquely identified', () => {
  const seen = new Set();
  for (const inv of INVARIANTS) {
    assert.match(inv.id, /^[A-Z]\d+$/, `bad id: ${inv.id}`);
    assert.ok(!seen.has(inv.id), `duplicate invariant id: ${inv.id}`);
    seen.add(inv.id);
    assert.ok(VALID_STATUS.has(inv.status), `${inv.id} has invalid status "${inv.status}"`);
    assert.ok(inv.text && inv.text.length > 20, `${inv.id} needs a real description`);
  }
});

test('every "instrumented" invariant is actually named by a test', () => {
  const lying = INVARIANTS
    .filter((i) => i.status === 'instrumented')
    .filter((i) => !new RegExp(`\\b${i.id}\\b`).test(testBodies))
    .map((i) => i.id);
  assert.deepStrictEqual(lying, [],
    `these claim "instrumented" but no test mentions them: ${lying.join(', ')}`);
});

test('every deferred invariant explains what is actually wrong', () => {
  const bare = INVARIANTS.filter((i) => i.status === 'deferred' && !i.note).map((i) => i.id);
  assert.deepStrictEqual(bare, [],
    `deferred without a note is just a shrug: ${bare.join(', ')}`);
});

test('the applied-instrument log is non-empty and the next pass has somewhere to start', () => {
  assert.ok(APPLIED.length > 0, 'APPLIED must record which instruments have been used');
  assert.ok(NOT_YET_APPLIED.length > 0,
    'NOT_YET_APPLIED empty means discovery is claimed complete -- say so explicitly instead');
  for (const a of APPLIED) {
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/, `bad date in APPLIED: ${a.date}`);
    assert.ok(a.instrument && a.found, 'each applied instrument records what it found (including "nothing")');
  }
});
