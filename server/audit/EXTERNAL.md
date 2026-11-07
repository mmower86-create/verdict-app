# The four questions no test answers

Everything in `manifest.js` marked `external` lives here. No amount of internal
testing moves any of these. Once the internal number stops moving, another
internal pass is the *least* informative evidence available, and these are the
cheapest things that could actually prove Verdict wrong.

Each is written so it CAN fail. "Would you use this?" is not a test; people say
yes to be nice. "Walk me through the last lease you signed" is a test, because
the answer can contradict the premise.

---

## X3. Does the live Stripe webhook actually reach the server and activate a real user?

**Cheapest falsifier, and the one to run first.** Everything else about billing
is inference from reading code. This has never been observed end to end with a
real card on the live deployment.

Run it: subscribe with a real card on the deployed app, then check that the
Supabase row flipped to `pro`, `is_founder` is set correctly, and
`stripe_customer_id` is populated. Then cancel from the portal and check it
flipped back to `free`. Refund yourself.

**How it fails:** the row does not change and the Stripe dashboard shows a 200.
That is invariants B2 and B3 firing together, and it means paid-but-not-activated
is happening silently. Watch the server logs during the test, not just the row.

## X1. Is the legal substance of a verdict accurate for the tenant's jurisdiction?

The prompt in `prompts/lease-decoder-v1.txt` produces confident claims about what
a clause means and what to push back with. Nothing verifies any of it. A verdict
that is fluent and wrong is worse than no verdict, because the user acts on it.

Run it: take three real leases from three different states, run them, and have
someone who actually knows landlord-tenant law in those states mark every factual
claim right, wrong, or "depends".

**How it fails:** a confident claim that is state-specific and stated as
universal. Security deposit return windows and notice-to-enter rules vary by
state and are exactly where this breaks.

## X4. Can a renter actually act on it?

The product promises "the exact words to push back with". Untested against a real
landlord.

Run it: find three people who used it and ask what they did next. Not "was it
helpful" but "what did you send, and what came back".

**How it fails:** everyone found it interesting and nobody sent anything. That
means the product is entertainment, and the fix is the ask, not the analysis.

## X2. Will a stranger pay?

Currently unanswerable for a reason that is not about the product: the app is
offline and every CTA on the landing page 404s. Until that is fixed, no traffic
test measures anything.

**How it fails:** real visitors arrive, read for ten minutes, and none subscribe.
The standing hypothesis is that a renter needs a lease review once a year and a
$39/mo subscription is the wrong shape, which is why one-time pricing is the next
build. That hypothesis is itself untested.

---

## Ordering

X3 first: it is free, takes 20 minutes, and a failure there means the billing
system has never worked. X1 second, because shipping confidently wrong legal
claims is the only finding here that can hurt a user. X2 and X4 both need the app
online and strangers using it.
