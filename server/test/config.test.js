const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Vars the platform injects or that are optional-with-a-safe-default.
const PLATFORM_PROVIDED = new Set(['PORT', 'NODE_ENV', 'NODE_VERSION']);

function serverEnvVarsRead() {
  const src = read('server/index.js') + read('server/db.js');
  return [...new Set([...src.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))]
    .filter((v) => !PLATFORM_PROVIDED.has(v))
    .sort();
}

test('E1: every env var the server reads is documented in an .env.example', () => {
  // Either example file may document it; between them they must cover everything.
  const examples = read('.env.example') + read('server/.env.example');
  const missing = serverEnvVarsRead().filter((v) => !examples.includes(v));
  assert.deepStrictEqual(missing, [],
    `undocumented server env vars (a fresh deploy will silently miss these): ${missing.join(', ')}`);
});

test('E2: every env var the client reads is documented in .env.example', () => {
  const src = fs.readdirSync(path.join(ROOT, 'client/src'))
    .filter((f) => /\.jsx?$/.test(f))
    .map((f) => read(path.join('client/src', f)))
    .join('\n');
  const used = [...new Set([...src.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]))].sort();
  assert.ok(used.length > 0, 'expected the client to read at least one VITE_ var');

  const examples = read('.env.example') + read('client/.env.example');
  const missing = used.filter((v) => !examples.includes(v));
  assert.deepStrictEqual(missing, [],
    `undocumented client env vars: ${missing.join(', ')}. These are baked in at BUILD time, so a missing one needs a rebuild, not just an env edit.`);
});

test('E3: render.yaml declares every env var the server reads', () => {
  const render = read('render.yaml');
  const missing = serverEnvVarsRead().filter((v) => !render.includes(v));
  assert.deepStrictEqual(missing, [],
    `render.yaml is missing: ${missing.join(', ')}. The service would deploy and then fail at runtime.`);
});
