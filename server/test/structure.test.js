const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SERVER = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(SERVER, 'index.js'), 'utf8');

test('B13: the Stripe webhook route path is /api/stripe/webhook', () => {
  // This is the exact value that must be pasted into the Stripe dashboard.
  // If it moves, live payments stop syncing and nothing else fails loudly.
  assert.match(index, /app\.post\(\s*'\/api\/stripe\/webhook'/,
    'webhook path changed -- the Stripe dashboard endpoint must be updated to match');
});

test('D8: every /api route except health and the webhook requires auth', () => {
  const PUBLIC = new Set(['/api/health', '/api/stripe/webhook']);
  const routes = [...index.matchAll(/app\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']*)'([^\n]*)/g)];
  assert.ok(routes.length >= 5, `expected to find the API routes, found ${routes.length}`);

  for (const [, method, route, rest] of routes) {
    if (PUBLIC.has(route)) continue;
    assert.ok(rest.includes('requireAuth()'),
      `${method.toUpperCase()} ${route} is not behind requireAuth()`);
  }
});

test('A2: the webhook is registered before express.json()', () => {
  const webhookAt = index.indexOf("app.post('/api/stripe/webhook'");
  const jsonAt = index.indexOf('app.use(express.json(');
  assert.ok(webhookAt > -1 && jsonAt > -1, 'could not locate both the webhook route and express.json()');
  assert.ok(webhookAt < jsonAt,
    'express.json() runs before the webhook route, which consumes the raw body and breaks Stripe signature verification');
});

test('A1: no server secret appears anywhere under client/src', () => {
  const clientSrc = path.join(SERVER, '..', 'client', 'src');
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx?|tsx?|css|html)$/.test(e.name)) files.push(p);
    }
  })(clientSrc);
  assert.ok(files.length > 0, 'found no client source files to scan');

  const FORBIDDEN = [
    [/SUPABASE_SERVICE_ROLE/i, 'Supabase service-role key reference'],
    [/\bsk_(live|test)_[A-Za-z0-9]/, 'Stripe secret key'],
    [/\bwhsec_[A-Za-z0-9]/, 'Stripe webhook signing secret'],
    [/\bsk-ant-[A-Za-z0-9]/, 'Anthropic API key'],
    [/\beyJ[A-Za-z0-9_-]{20,}\./, 'a JWT (service-role keys are JWTs)'],
  ];
  for (const file of files) {
    const body = fs.readFileSync(file, 'utf8');
    for (const [re, label] of FORBIDDEN) {
      assert.ok(!re.test(body), `${label} found in ${path.relative(SERVER + '/..', file)}`);
    }
  }
});
