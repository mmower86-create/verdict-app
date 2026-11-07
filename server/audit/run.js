#!/usr/bin/env node
// Prints the audit number. Run: npm run audit --prefix server
const { INVARIANTS, APPLIED, NOT_YET_APPLIED } = require('./manifest');

const by = (s) => INVARIANTS.filter((i) => i.status === s);
const internal = INVARIANTS.filter((i) => i.status !== 'external');
const held = by('instrumented');

const pad = (s, n) => String(s).padEnd(n);
console.log('\n  VERDICT AUDIT\n  ' + '='.repeat(72));
console.log(`\n  ${held.length} of ${internal.length} internal invariants are held by a test.`);
console.log(`  ${by('checked').length} verified by reading only (nothing stops them regressing).`);
console.log(`  ${by('deferred').length} deferred: known gaps and confirmed defects, NOT fixed.`);
console.log(`  ${by('external').length} external: no test can answer them. See audit/EXTERNAL.md\n`);

for (const status of ['deferred', 'checked', 'instrumented', 'external']) {
  const rows = by(status);
  if (!rows.length) continue;
  console.log(`  ${'-'.repeat(72)}\n  ${status.toUpperCase()} (${rows.length})`);
  for (const r of rows) {
    console.log(`    ${pad(r.id, 5)} ${r.text}`);
    if (r.note) console.log(`          -> ${r.note}`);
  }
  console.log('');
}

console.log(`  ${'-'.repeat(72)}\n  INSTRUMENTS APPLIED (${APPLIED.length})`);
for (const a of APPLIED) console.log(`    ${a.date}  ${a.instrument}\n          found: ${a.found}`);
console.log(`\n  NOT YET APPLIED -- where the next pass starts (${NOT_YET_APPLIED.length})`);
for (const n of NOT_YET_APPLIED) console.log(`    - ${n}`);
console.log('\n  This is a number, not a claim of done.\n');
