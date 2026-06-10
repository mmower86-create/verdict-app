require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const Stripe = require('stripe');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const supabase = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const promptFiles = {
  lease: fs.readFileSync(path.join(__dirname, 'prompts/lease-decoder-v1.txt'), 'utf8'),
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Monthly decode caps per plan. An account with users.unlimited = true (owner/
// comp only -- NOT a sellable tier) bypasses the cap entirely.
const PLAN_LIMITS = { free: 3, pro: 15, business: 100 };
const FREE_LIMIT = PLAN_LIMITS.free; // kept for any legacy references
function limitForUser(user) {
  if (user.unlimited) return null; // null = uncapped
  return PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free;
}

// Minimum characters before we even attempt analysis. Anything shorter is
// obviously not a document -- rejected for free, no API call, no decode counted.
const MIN_DECODE_CHARS = 150;
// Human description of each supported doc type, used by the document classifier.
const DOC_LABEL = { lease: 'an apartment or residential lease / rental agreement' };

app.use(cors({ origin: CLIENT_URL }));

// Webhook must receive the raw body for signature verification.
// This route is registered before express.json() so the buffer is untouched.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clerkUserId = session.metadata.clerk_user_id;
    // Plan purchased: 'business' or 'pro' (default). Older sessions without the
    // metadata fall back to 'pro' to preserve existing behavior.
    const plan = session.metadata.plan === 'business' ? 'business' : 'pro';
    // Founder flag only applies to Pro; business is never a founder slot.
    const isFounder = plan === 'pro' && session.metadata.is_founder === 'true';
    const stripeCustomerId = session.customer;

    const { error } = await supabase
      .from('users')
      .update({ plan, is_founder: isFounder, stripe_customer_id: stripeCustomerId })
      .eq('clerk_user_id', clerkUserId);

    if (error) console.error('Webhook activate failed:', error.message);
    else console.log(`Activated ${plan} for ${clerkUserId} (founder=${isFounder})`);
  }

  // Plan switch via the billing portal (e.g. Business <-> Pro). Stripe swaps the
  // subscription's price and fires this event; sync the plan back to Supabase so
  // the in-app cap matches what they now pay for. Cancellations come through the
  // separate deleted handler below, so ignore non-active statuses here.
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const stripeCustomerId = subscription.customer;
    const status = subscription.status;

    if (status === 'active' || status === 'trialing') {
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const plan = priceId === process.env.STRIPE_PRICE_BUSINESS ? 'business' : 'pro';

      const { error } = await supabase
        .from('users')
        .update({ plan })
        .eq('stripe_customer_id', stripeCustomerId);

      if (error) console.error('Webhook plan-switch failed:', error.message);
      else console.log(`Switched ${stripeCustomerId} to ${plan} (price ${priceId})`);
    } else if (status === 'unpaid') {
      // Dunning exhausted -- every retry on their card failed. Drop access now
      // instead of waiting for Stripe to (maybe) cancel the subscription.
      // 'past_due' is intentionally NOT handled: retries are still running.
      const { error } = await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('stripe_customer_id', stripeCustomerId);

      if (error) console.error('Webhook unpaid-downgrade failed:', error.message);
      else console.log(`Downgraded ${stripeCustomerId} to free (subscription unpaid)`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const stripeCustomerId = subscription.customer;

    // is_founder is kept as a historical flag but no longer grants anything.
    // The checkout logic re-checks the live founder count on any future resubscribe.
    const { error } = await supabase
      .from('users')
      .update({ plan: 'free' })
      .eq('stripe_customer_id', stripeCustomerId);

    if (error) console.error('Webhook cancel failed:', error.message);
    else console.log(`Cancelled pro for Stripe customer ${stripeCustomerId}`);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '1mb' }));
app.use(clerkMiddleware());

// Per-user rate limit on decode. The monthly cap is count-then-insert, so a
// burst of concurrent requests could all pass the check before any insert
// lands -- this bounds how many Anthropic calls that race can cost.
const decodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getAuth(req)?.userId ?? ipKeyGenerator(req.ip),
  message: { error: 'Too many requests at once. Give it a minute and try again.' },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function getOrCreateUser(clerkUserId) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ clerk_user_id: clerkUserId }, { onConflict: 'clerk_user_id' })
    .select()
    .single();

  if (error) throw new Error(`getOrCreateUser failed: ${error.message}`);
  return data;
}

async function countDecodesThisMonth(clerkUserId) {
  const { count, error } = await supabase
    .from('decodes')
    .select('*', { count: 'exact', head: true })
    .eq('clerk_user_id', clerkUserId)
    .gte('created_at', startOfMonthUTC());

  if (error) throw new Error(`countDecodesThisMonth failed: ${error.message}`);
  return count;
}

async function founderCount() {
  // Count everyone who has EVER claimed a founder slot, regardless of current
  // plan. A founder who later cancels keeps `is_founder = true` (only `plan`
  // flips to 'free'), so their slot stays consumed forever -- the cap is a
  // permanent "first 100 people", not "100 currently-active subscribers".
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_founder', true);

  if (error) throw new Error(`founderCount failed: ${error.message}`);
  return count;
}

// Lightweight gate: does the pasted text actually look like the document type
// the user selected? Uses a cheap, low-token classification call. Fails OPEN
// (returns true) on any error so a classifier hiccup never blocks a real decode.
async function looksLikeDocType(docType, text) {
  const expected = DOC_LABEL[docType];
  if (!expected) return true; // unknown types are handled by the prompt check
  try {
    const probe = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5,
      system:
        `You are a strict document classifier. The user will paste some text. ` +
        `Reply with exactly one word and nothing else: MATCH if the text is ${expected}, ` +
        `or OTHER if it is something else (a spreadsheet, financial record, email, ` +
        `resume, article, a contract of a different kind, or random text). ` +
        `If you are unsure, reply MATCH.`,
      messages: [{ role: 'user', content: text.slice(0, 4000) }],
    });
    const verdict = (probe.content?.[0]?.text || '').toUpperCase();
    return !verdict.includes('OTHER');
  } catch (err) {
    console.error('Doc classify failed, allowing through:', err.message);
    return true; // fail open -- never block a real decode on a classifier error
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/usage', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const user = await getOrCreateUser(userId);
    const used = await countDecodesThisMonth(userId);
    // limit === null means truly uncapped (unlimited accounts only).
    res.json({ plan: user.plan, used, limit: limitForUser(user) });
  } catch (err) {
    console.error('Usage error:', err.message);
    res.status(500).json({ error: 'Could not load usage.' });
  }
});

// Checkout -- creates a Stripe Checkout Session and returns the URL
app.post('/api/checkout', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const user = await getOrCreateUser(userId);

    // Already-subscribed users must go through the billing portal. Creating a
    // second Checkout subscription for an existing subscriber double-charges
    // them (Stripe Checkout does not dedupe subscriptions per customer) -- the
    // portal swaps the price on the existing subscription with proration.
    if (user.plan === 'pro' || user.plan === 'business') {
      if (!user.stripe_customer_id) {
        return res.status(409).json({ error: 'Your plan is already active.' });
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: CLIENT_URL,
      });
      return res.json({ url: portal.url });
    }

    // Which tier is being purchased. Defaults to 'pro' for backward compatibility
    // with the existing single-button checkout.
    const requestedPlan = req.body?.plan === 'business' ? 'business' : 'pro';

    let priceId;
    let isFounder = false;

    if (requestedPlan === 'business') {
      priceId = process.env.STRIPE_PRICE_BUSINESS;
      if (!priceId) {
        return res.status(503).json({ error: 'Business plan is not available yet.' });
      }
    } else {
      // Founder slot check (Pro only): anyone who has ever been a founder counts
      // toward the 100 cap (see founderCount). A cancelled founder keeps their
      // slot, so it is never re-released -- exactly 100 people ever get founder pricing.
      const founders = await founderCount();
      isFounder = founders < 100;
      priceId = isFounder
        ? process.env.STRIPE_PRICE_FOUNDER
        : process.env.STRIPE_PRICE_STANDARD;
    }

    // Reuse existing Stripe customer if we have one
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { clerk_user_id: userId },
      });
      customerId = customer.id;
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('clerk_user_id', userId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${CLIENT_URL}/?upgraded=true`,
      cancel_url: `${CLIENT_URL}/`,
      metadata: {
        clerk_user_id: userId,
        plan: requestedPlan,
        is_founder: String(isFounder),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Billing portal -- lets an existing subscriber upgrade/downgrade/cancel via
// Stripe's hosted portal. Stripe swaps the subscription (with proration) rather
// than creating a second one, so it inherently prevents double-charging and
// blocks "buying" a plan you already have.
app.post('/api/portal', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const user = await getOrCreateUser(userId);
    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription to manage yet.' });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: CLIENT_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal error:', err.message);
    res.status(500).json({ error: 'Could not open billing management. Please try again.' });
  }
});

// Decode -- Clerk session required, free-tier gate enforced server-side
app.post('/api/decode', requireAuth(), decodeLimiter, async (req, res) => {
  const { userId } = getAuth(req);
  const { docType, text } = req.body;

  if (!docType || !text) {
    return res.status(400).json({ error: 'docType and text are required.' });
  }

  const systemPrompt = promptFiles[docType];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown docType: ${docType}` });
  }

  // Reject obviously-too-short input for free, before any API call or decode count.
  if (text.trim().length < MIN_DECODE_CHARS) {
    return res.status(422).json({
      error: "That looks too short to be a lease. Paste the full lease text and try again.",
    });
  }

  try {
    const user = await getOrCreateUser(userId);
    const used = await countDecodesThisMonth(userId);

    // Per-plan monthly cap. limit === null means uncapped (owner/comp accounts).
    const limit = limitForUser(user);
    if (limit !== null && used >= limit) {
      // plan is included so the client can show the right wall (a Pro user at
      // 15/15 is not on the "free" plan and must not be sold a second sub).
      return res.status(402).json({ error: 'limit_reached', used, limit, plan: user.plan });
    }

    // Make sure they actually pasted the supported document type. Runs before the
    // expensive decode and before counting, so non-leases never burn a decode.
    if (!(await looksLikeDocType(docType, text))) {
      return res.status(422).json({
        error: "This doesn't look like a lease. Verdict currently reads apartment and rental leases, so paste the full lease text and try again. More document types are coming soon.",
      });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    if (message.stop_reason === 'max_tokens') {
      // Verdict was cut off mid-sentence. Still delivered, but flag it so a
      // pattern of truncations shows up in the logs.
      console.error(`Decode truncated at max_tokens for ${userId} (input ${text.length} chars)`);
    }

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('Model response contained no text block');
    const result = textBlock.text;

    const { error: insertError } = await supabase.from('decodes').insert({
      clerk_user_id: userId,
      doc_type: docType,
      result_text: result,
    });
    if (insertError) {
      // Result is already in hand, so deliver it -- but this decode is now
      // uncounted and missing from history, which needs investigating.
      console.error(`Decode insert failed for ${userId} (delivered but unrecorded):`, insertError.message);
    }

    res.json({ result });
  } catch (err) {
    console.error('Decode error:', err.message);
    res.status(502).json({ error: 'The analysis failed. Please try again.' });
  }
});

// History -- returns the current user's past decodes, most recent first
app.get('/api/history', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  try {
    const { data, error } = await supabase
      .from('decodes')
      .select('id, created_at, doc_type, result_text')
      .eq('clerk_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
