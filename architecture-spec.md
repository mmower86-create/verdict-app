# VERDICT — ARCHITECTURE SPEC & BUILD PLAN (v1)
Last updated: 2026-05-30
Owner: Matthew Mower / Aevon Group LLC
Status: pre-build. This is the source of truth for the Claude Code session.

---

## 0. WHAT WE ARE BUILDING

A web app where a logged-in user pastes a document, picks the type
(v1: lease only), and gets back the Verdict-format analysis in under
~15 seconds. Free users get 3 decodes/month. Pro users ($29/mo, or
$9/mo founder for first 100) get unlimited.

The moat is the prompt, already validated and saved at
verdict-build/lease-decoder-v1.txt. The app is the delivery vehicle
around it. Do not let the app engineering dilute the prompt quality.

MVP SCOPE LINE (do not cross pre-launch):
  IN  -> lease decode, signup/login, decode counter, free gate,
         Stripe checkout, Pro unlimited, basic history list
  OUT -> multi-doc-type UI, PDF upload/parsing, team accounts,
         email-the-result, API access, dashboards, analytics beyond
         Plausible. All are v1.1+ and noted at the bottom.

---

## 1. STACK

- Runtime: Node.js (LTS) + Express  (matches Matthew's existing Vett build)
- Frontend: keep it simple. Server-rendered or a light React front.
  Recommend plain React (Vite) talking to the Express API. No Next.js
  for v1 unless Matthew already prefers it.
- Auth: Clerk (magic link). Clerk handles sessions; we read the userId.
- DB: Postgres via Supabase (free tier) OR SQLite for local-first dev
  then migrate. Recommend Supabase Postgres so it's production-ready
  from day one.
- Payments: Stripe (Checkout + Billing + webhooks)
- LLM: Anthropic API, model claude-sonnet (current), server-side only.
  NEVER expose the API key to the browser.
- Host: backend on Render or Railway; frontend on Netlify (Matthew
  already knows Netlify). Or host both on one platform to reduce moving
  parts. Recommend Railway for the full app to keep it in one place.

---

## 2. CORE DATA MODEL (minimum)

users           (managed by Clerk; we store a mirror row keyed by clerk_user_id)
  - clerk_user_id   (pk)
  - plan            ('free' | 'pro')
  - is_founder      (bool)
  - stripe_customer_id
  - created_at

decodes
  - id              (pk)
  - clerk_user_id   (fk)
  - doc_type        ('lease' for v1)
  - created_at
  - (optional) result_text   -- store so users can see history
  - (do NOT store the raw pasted document long-term unless Matthew
     decides to; privacy policy currently says minimal retention)

usage_counter (derived, not a table): count decodes WHERE
  clerk_user_id = ? AND created_at >= start_of_current_month.

founder_count (derived): count users WHERE is_founder = true.

---

## 3. THE DECODE FLOW (the heart)

1. User logs in (Clerk). Frontend has a session token.
2. User pastes document text, selects type (locked to 'lease' in v1).
3. Frontend POSTs to /api/decode  with { docType, text }.
4. Server:
   a. Verify Clerk session -> get clerk_user_id. Reject if not authed.
   b. Look up user plan.
   c. If plan = 'free': count this month's decodes. If >= 3, return
      402-style "limit reached, upgrade" payload. Do NOT call the LLM.
   d. If allowed: load the prompt file for docType
      (promptFiles['lease'] = contents of lease-decoder-v1.txt).
   e. Call Anthropic API: system/user message = prompt + pasted text.
   f. Return the model output to the frontend.
   g. Insert a row into decodes (increment usage).
5. Frontend renders the Verdict output in the same editorial style as
   the landing page (Fraunces headings, clean sections).

NARRATED LOADER (required in Phase B, not optional polish):
  A long document can take 20-40 seconds through the LLM. A blank
  spinner reads as "broken" and users bounce. While /api/decode runs,
  the frontend shows a step loader with text that advances on a timer:
    "Reading the document..."
    "Scanning the clauses..."
    "Checking what could cost you..."
    "Formulating the verdict..."
  The steps are front-end timed (they do not need to reflect real
  backend stages in v1); they exist to make the wait feel deliberate
  and premium. Keep copy in the brand voice, no em-dashes. When the
  real response lands, replace the loader with the verdict.

PROMPT LOADING (the all-types hook):
  const promptFiles = {
    lease: fs.readFileSync('./prompts/lease-decoder-v1.txt','utf8'),
    // offer: ..., msa: ..., tos: ...  <- add files later, zero refactor
  };
  Adding a document type = drop a new .txt in /prompts + add one line
  here + add the option to the frontend dropdown. That's the whole job.

API KEY SAFETY: Anthropic key in server env var only. The browser
never sees it. All LLM calls go through /api/decode.

---

## 4. FREE-TIER GATE

- Enforced server-side in step 4c above. Never trust the client.
- Reset logic: "3 per calendar month" = count rows since the 1st of
  the current month. Simplest correct version. No cron needed.
- When blocked, return a clean payload the frontend turns into an
  upgrade prompt ("You've used your 3 free decodes this month.
  Upgrade to Pro for unlimited.") with a Stripe checkout button.

---

## 5. STRIPE / FOUNDER PRICING

Stripe objects:
  - Product: "Verdict Pro"
  - Price A: $9/mo  (founder)   -- metadata: tier=founder
  - Price B: $29/mo (standard)  -- metadata: tier=standard

Checkout logic:
  - On "Upgrade" click, server checks founder_count.
    - If founder_count < 100  -> create Checkout Session with Price A,
      mark intended is_founder = true.
    - Else                    -> Price B, is_founder = false.
  - Stripe webhook (checkout.session.completed):
    - set user.plan = 'pro'
    - set user.is_founder per the price used
    - store stripe_customer_id

No-rejoin lock (the rule Matthew specifically wanted):
  - When a founder cancels (webhook customer.subscription.deleted):
    set plan = 'free'. Keep is_founder = true as a HISTORICAL flag but
    it no longer grants anything.
  - If a former founder re-subscribes, the checkout logic above runs
    fresh: founder_count is now likely full OR their slot is gone, so
    they get Price B ($29). The $9 is not offered to returning users.
  - Net effect: founder price is locked only while continuously
    subscribed. Cancel = lose it. Exactly the retention mechanism
    Matthew designed.

Webhooks must be verified with the Stripe signing secret. Standard.

---

## 6. BUILD SEQUENCE (the order Claude Code should work in)

Phase A — skeleton that runs locally
  1. Express server boots, /api/health returns ok
  2. React frontend boots, talks to /api/health
  3. Clerk wired: can sign up via magic link, see logged-in state

Phase B — the decode (core value, no payments yet)
  4. /prompts/lease-decoder-v1.txt in place, loaded server-side
  5. /api/decode calls Anthropic with prompt + text, returns output
  6. Frontend: paste box -> calls /api/decode -> renders Verdict output
  6b. Narrated step loader shown while /api/decode is in flight (see
      "NARRATED LOADER" in section 3). Build this alongside step 6.
  7. Confirm output matches the validated quality. THIS IS THE GATE.
     If the app output is worse than the manual test, stop and fix
     before going further.

Phase C — accounts + gating
  8. users mirror row created on first login
  9. decodes table + insert on each decode
  10. free gate: block at 3/month, return upgrade payload

Phase D — payments
  11. Stripe products/prices created
  12. /api/checkout with founder-count logic
  13. webhook handler: activate pro, set founder flag, handle cancel
  14. Pro users bypass the gate (unlimited)

Phase E — ship
  15. history list (user sees past decodes)
  16. deploy backend + frontend, env vars set, webhook live
  17. smoke test the full loop with a real card in Stripe test mode
  18. flip Stripe to live, soft launch to the waitlist

---

## 7. V1.1+ BACKLOG (after launch, from real usage)
  - prompt v1.1: optional state field for habitability/eviction
  - additional doc types: offer letter, MSA, ToS, vendor contract
  - PDF upload + text extraction (so users don't paste raw text)
  - email-the-result
  - save/share a decode via link
  - the two prompt refinements noted in lease-decoder-v1.txt header

---

## 8. NON-NEGOTIABLES
  - Anthropic API key server-side only, never in the browser
  - Free gate enforced server-side, never trust the client
  - Stripe webhooks signature-verified
  - Match the landing page's editorial design language in the app
  - No em-dashes anywhere in user-facing copy (brand rule)
  - Output quality is the product. If the app ever produces worse
    output than the validated manual test, that is a P0 bug.
