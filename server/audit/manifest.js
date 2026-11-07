// ─────────────────────────────────────────────────────────────────────────────
// VERDICT AUDIT MANIFEST -- the denominator.
//
// The point of this file is that an audit can report a NUMBER instead of "I
// found more things". Every invariant that could be wrong gets a line here,
// whether or not it is currently held by a test.
//
// status:
//   instrumented -- a test in server/test enforces it. Recurrence is guarded.
//   checked      -- verified by reading the code on the date shown. Nothing
//                   stops it regressing tomorrow.
//   deferred     -- known gap or confirmed defect. NOT held, NOT fixed.
//   external     -- no test can answer this. It needs the world. See EXTERNAL.md
//
// RULE: when an audit finds something, it gets a line here even if it is also
// fixed. A finding that is fixed silently leaves the denominator wrong and
// makes the next audit feel like the last one.
// ─────────────────────────────────────────────────────────────────────────────

const INVARIANTS = [
  // ── Billing / Stripe webhook ───────────────────────────────────────────────
  { id: 'B1',  area: 'billing', status: 'checked',
    text: 'Webhook rejects payloads whose Stripe signature does not verify (400, no DB write).' },
  { id: 'B2',  area: 'billing', status: 'deferred',
    text: 'A webhook DB update that matches ZERO rows must not be reported as success.',
    note: 'CONFIRMED DEFECT. supabase-js returns {data:null,error:null} for a 0-row UPDATE, so all four handlers take the else branch and log success. Verified against a stubbed PostgREST 204.' },
  { id: 'B3',  area: 'billing', status: 'deferred',
    text: 'Webhook must not return 200 when the Supabase write failed.',
    note: 'CONFIRMED DEFECT. index.js logs the error then falls through to res.json({received:true}). Stripe sees 200 and never retries, so a paid-but-not-activated user is unrecoverable and invisible outside logs.' },
  { id: 'B4',  area: 'billing', status: 'checked',
    text: 'An existing pro/business subscriber hitting /api/checkout is routed to the billing portal, never issued a second subscription.' },
  { id: 'B5',  area: 'billing', status: 'checked',
    text: 'A user with a paid plan but no stripe_customer_id gets 409, not a duplicate charge.' },
  { id: 'B6',  area: 'billing', status: 'deferred',
    text: 'customer.subscription.updated must not silently downgrade a Business subscriber to Pro.',
    note: 'CONFIRMED DEFECT. index.js: `priceId === process.env.STRIPE_PRICE_BUSINESS ? business : pro`. If STRIPE_PRICE_BUSINESS is unset or wrong, EVERY plan switch resolves to pro. STRIPE_PRICE_BUSINESS is absent from server/.env today, so a $79 customer touching the portal drops to the 15/mo cap while still paying $79.' },
  { id: 'B7',  area: 'billing', status: 'checked',
    text: 'Subscription status unpaid (dunning exhausted) downgrades the user to free.' },
  { id: 'B8',  area: 'billing', status: 'checked',
    text: 'Status past_due deliberately does NOT downgrade -- Stripe retries are still running.' },
  { id: 'B9',  area: 'billing', status: 'checked',
    text: 'customer.subscription.deleted downgrades to free and leaves is_founder intact.' },
  { id: 'B10', area: 'billing', status: 'checked',
    text: 'The founder flag is only ever set on pro; business is never a founder slot.' },
  { id: 'B11', area: 'billing', status: 'deferred',
    text: 'At most 100 founder slots are ever issued.',
    note: 'founderCount() is read-then-write with no lock. Concurrent checkouts at 99 can both read 99 and both become founders. Bounded, low impact, unfixed.' },
  { id: 'B12', area: 'billing', status: 'checked',
    text: 'A missing STRIPE_PRICE_BUSINESS makes /api/checkout return 503 rather than creating a broken session.' },
  { id: 'B13', area: 'billing', status: 'instrumented',
    text: 'The Stripe webhook route path is /api/stripe/webhook (the value that must be configured in the Stripe dashboard).' },

  // ── Plan caps ──────────────────────────────────────────────────────────────
  { id: 'C1',  area: 'caps', status: 'instrumented',
    text: 'Caps are free=3, pro=15, business=100.' },
  { id: 'C2',  area: 'caps', status: 'instrumented',
    text: 'users.unlimited bypasses the cap entirely (limitForUser returns null).' },
  { id: 'C3',  area: 'caps', status: 'instrumented',
    text: 'An unrecognized plan string falls back to the free cap, never to uncapped.' },
  { id: 'C4',  area: 'caps', status: 'instrumented',
    text: 'A prototype key as plan (constructor, __proto__, toString) cannot yield a non-numeric limit.',
    note: 'Was reachable in principle via `??`; hardened to Object.hasOwn during this audit. Not reachable in practice (users_plan_check).' },
  { id: 'C5',  area: 'caps', status: 'deferred',
    text: 'A user cannot exceed their monthly cap by racing concurrent decodes.',
    note: 'Count-then-insert with no transaction. decodeLimiter caps the burst at 5/min, but the free cap is 3, so a free user can land 5 decodes on a 3 cap. Acknowledged in code comments; unfixed.' },
  { id: 'C6',  area: 'caps', status: 'instrumented',
    text: 'The monthly reset boundary is the first instant of the month in UTC, identical for every user.' },
  { id: 'C7',  area: 'caps', status: 'deferred',
    text: 'Cap numbers shown in client pricing copy match the server PLAN_LIMITS.',
    note: 'CONFIRMED DRIFT RISK. DecodeWorkspace.jsx hardcodes the strings "3 lease decodes per month", "15 decodes per month", "100 decodes per month". Nothing ties them to the server. Changing a cap silently makes the in-app pricing card lie.' },

  // ── Decode input handling ──────────────────────────────────────────────────
  { id: 'D1',  area: 'decode', status: 'deferred',
    text: 'A malformed /api/decode body must not take the server process down.',
    note: 'CONFIRMED DEFECT, SEVERITY 1. `text.trim()` sits outside the try block. A JSON non-string (number/bool/object) throws TypeError in an async express-4 handler; express 4 does not catch async rejections and Node 22 exits on unhandled rejection. Reproduced: process exits code 1. Any signed-in user can kill the server with one request.' },
  { id: 'D2',  area: 'decode', status: 'checked',
    text: 'Input under 150 chars is rejected before any Anthropic call and without counting a decode.' },
  { id: 'D3',  area: 'decode', status: 'checked',
    text: 'An unknown docType is rejected with 400 before any billing or model work.' },
  { id: 'D4',  area: 'decode', status: 'deferred',
    text: 'Input above the model context window is rejected with a useful message.',
    note: 'There is a lower bound (150 chars) but NO upper bound. express.json caps the body at 1mb; ~1mb of lease text exceeds the model context, so the Anthropic call errors and the user sees the generic "The analysis failed. Please try again." with no hint that the document was too long.' },
  { id: 'D5',  area: 'decode', status: 'checked',
    text: 'The doc-type classifier fails OPEN, so a classifier outage never blocks a real decode.' },
  { id: 'D6',  area: 'decode', status: 'checked',
    text: 'A max_tokens truncation is logged but the partial verdict is still delivered.' },
  { id: 'D7',  area: 'decode', status: 'checked',
    text: 'A failed decodes insert still delivers the result; the decode goes uncounted and is logged.' },
  { id: 'D8',  area: 'decode', status: 'instrumented',
    text: 'Every /api route except health and the Stripe webhook is behind requireAuth().' },

  // ── Secrets / transport ────────────────────────────────────────────────────
  { id: 'A1',  area: 'secrets', status: 'instrumented',
    text: 'No server secret (service-role key, Stripe secret key, webhook secret, Anthropic key) appears anywhere under client/src.' },
  { id: 'A2',  area: 'secrets', status: 'instrumented',
    text: 'The Stripe webhook route is registered BEFORE express.json(), so the raw body survives for signature verification.' },
  { id: 'A3',  area: 'transport', status: 'deferred',
    text: 'CORS accepts the deployed client origin.',
    note: 'cors({origin: CLIENT_URL}) is an exact string match. A trailing slash, a scheme mismatch, or an unset CLIENT_URL (defaults to http://localhost:5173) silently blocks every browser call in production. No test, no startup assertion.' },

  // ── Deploy configuration ───────────────────────────────────────────────────
  { id: 'E1',  area: 'deploy', status: 'instrumented',
    text: 'Every process.env var the server reads is documented in an .env.example.' },
  { id: 'E2',  area: 'deploy', status: 'instrumented',
    text: 'Every import.meta.env var the client reads is documented in .env.example.' },
  { id: 'E3',  area: 'deploy', status: 'instrumented',
    text: 'render.yaml declares every process.env var the server reads.' },
  { id: 'E4',  area: 'deploy', status: 'deferred',
    text: 'A missing VITE_API_URL fails loudly rather than silently pointing the client at itself.',
    note: 'App.jsx: `import.meta.env.VITE_API_URL || \'\'`. Unset on a split deploy means every API call goes to the static host and 404s, with no console warning. It is a build-time var, so setting it later needs a rebuild, not just an env edit.' },

  // ── History / rendering ────────────────────────────────────────────────────
  { id: 'H1',  area: 'render', status: 'deferred',
    text: 'History must not silently hide decodes.',
    note: 'CONFIRMED. /api/history is .limit(100) with no pagination, and HistorySection renders `Past verdicts {items.length}` -- which caps at 100. A business user (100/mo) stops seeing older verdicts in month 2 with no indication any exist.' },
  { id: 'H2',  area: 'render', status: 'checked',
    text: 'ALL-CAPS verdict section labels are promoted to headings and render as styled labels, not raw markdown.' },

  // ── External: no test can answer these ─────────────────────────────────────
  { id: 'X1',  area: 'external', status: 'external',
    text: 'The legal substance of a verdict is accurate for the tenant\'s jurisdiction.' },
  { id: 'X2',  area: 'external', status: 'external',
    text: 'A stranger who reads the landing page will pay for this.' },
  { id: 'X3',  area: 'external', status: 'external',
    text: 'The live Stripe webhook actually reaches the deployed server and activates a real paying user.' },
  { id: 'X4',  area: 'external', status: 'external',
    text: 'A renter can act on the verdict -- that the "words to push back with" survive contact with a real landlord.' },
];

// Instruments applied, so the next pass starts below this line instead of
// rediscovering the same strip. Append, never rewrite.
const APPLIED = [
  { date: '2026-09-06', instrument: 'Denominator built (this manifest + tests + npm run audit).',
    found: 'No manifest and zero tests existed across 2171 LOC of money-handling code.' },
  { date: '2026-09-06', instrument: 'Degenerate / boundary input on the HTTP surface.',
    found: 'D1: non-string `text` crashes the process (reproduced, exit 1). D4: no upper bound on input length.' },
  { date: '2026-09-06', instrument: 'Failure-path behavior of the data layer (stubbed PostgREST).',
    found: 'B2: 0-row updates report success. B3: webhook returns 200 after a failed write, so Stripe never retries.' },
  { date: '2026-09-06', instrument: 'Reachability: what the UI can CREATE vs what the server CHECKS.',
    found: 'Clean on docType -- the client only ever sends "lease" and the server only accepts "lease". No dead branches.' },
  { date: '2026-09-06', instrument: 'Numbers a human typed that the code could compute.',
    found: 'C7: caps 3/15/100 hardcoded in client pricing copy, unlinked to PLAN_LIMITS.' },
  { date: '2026-09-06', instrument: 'Silent truncation at scale.',
    found: 'H1: history hard-capped at 100 with a count display that cannot exceed it.' },
  { date: '2026-09-06', instrument: 'Config completeness (env vars read vs env vars documented).',
    found: 'E1/E2/E4: STRIPE_* and CLIENT_URL missing from server/.env.example; VITE_API_URL undocumented everywhere. B6 is the live consequence.' },
];

// Instruments NOT yet applied. The next pass starts here.
const NOT_YET_APPLIED = [
  'Verify the lease prompt\'s legal claims against primary sources (statutes, not memory).',
  'Profile a decode at 10x and 25x the reference lease length.',
  'Render every configuration: mobile widths, dark mode, empty states, a 40-page verdict.',
  'Contrast and legibility measurement on the verdict output.',
  'Read the Supabase schema directly and diff it against what the code assumes (users_plan_check, decodes FK, indexes on the columns actually filtered).',
];

module.exports = { INVARIANTS, APPLIED, NOT_YET_APPLIED };
