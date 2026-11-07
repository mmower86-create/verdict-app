const { test } = require('node:test');
const assert = require('node:assert');
const { PLAN_LIMITS, limitForUser, startOfMonthUTC } = require('../limits');

test('C1: caps are free=3, pro=15, business=100', () => {
  assert.strictEqual(limitForUser({ plan: 'free' }), 3);
  assert.strictEqual(limitForUser({ plan: 'pro' }), 15);
  assert.strictEqual(limitForUser({ plan: 'business' }), 100);
  assert.deepStrictEqual(PLAN_LIMITS, { free: 3, pro: 15, business: 100 });
});

test('C2: unlimited bypasses the cap regardless of plan', () => {
  for (const plan of ['free', 'pro', 'business', 'nonsense', undefined]) {
    assert.strictEqual(limitForUser({ plan, unlimited: true }), null,
      `unlimited must win for plan=${plan}`);
  }
});

test('C3: an unrecognized plan falls back to free, never uncapped', () => {
  for (const plan of ['enterprise', '', null, undefined, 0, 'PRO', 'Business']) {
    assert.strictEqual(limitForUser({ plan }), 3, `plan=${JSON.stringify(plan)} must cap at 3`);
  }
});

test('C4: a prototype key as plan cannot yield a non-numeric limit', () => {
  for (const plan of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    const limit = limitForUser({ plan });
    assert.strictEqual(typeof limit, 'number',
      `plan=${plan} produced ${typeof limit} -- a non-number makes "used >= limit" false, i.e. silently uncapped`);
    assert.strictEqual(limit, 3);
  }
});

test('C6: the month boundary is the first instant of the month in UTC', () => {
  // A moment that is a different calendar month either side of UTC.
  const newYearInTokyo = new Date('2026-12-31T16:00:00Z'); // 2027-01-01 01:00 JST
  assert.strictEqual(startOfMonthUTC(newYearInTokyo), '2026-12-01T00:00:00.000Z');

  // First instant of a month is already the boundary, not the month before.
  assert.strictEqual(startOfMonthUTC(new Date('2026-03-01T00:00:00Z')), '2026-03-01T00:00:00.000Z');
  // Last instant of a month still belongs to that month.
  assert.strictEqual(startOfMonthUTC(new Date('2026-03-31T23:59:59.999Z')), '2026-03-01T00:00:00.000Z');
  // Leap-year February.
  assert.strictEqual(startOfMonthUTC(new Date('2028-02-29T12:00:00Z')), '2028-02-01T00:00:00.000Z');
});
