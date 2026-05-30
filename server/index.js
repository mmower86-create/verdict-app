require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const Stripe = require('stripe');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const supabase = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const promptFiles = {
  lease: fs.readFileSync(path.join(__dirname, 'prompts/lease-decoder-v1.txt'), 'utf8'),
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const FREE_LIMIT = 3;

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
    const isFounder = session.metadata.is_founder === 'true';
    const stripeCustomerId = session.customer;

    const { error } = await supabase
      .from('users')
      .update({ plan: 'pro', is_founder: isFounder, stripe_customer_id: stripeCustomerId })
      .eq('clerk_user_id', clerkUserId);

    if (error) console.error('Webhook activate failed:', error.message);
    else console.log(`Activated pro for ${clerkUserId} (founder=${isFounder})`);
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
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_founder', true)
    .eq('plan', 'pro');

  if (error) throw new Error(`founderCount failed: ${error.message}`);
  return count;
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
    const limit = user.plan === 'pro' ? null : FREE_LIMIT;
    res.json({ plan: user.plan, used, limit });
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

    // Founder slot check: only active pro founders count toward the 100 cap.
    // A cancelled founder has plan='free' and is excluded, so their slot is gone.
    const founders = await founderCount();
    const isFounder = founders < 100;
    const priceId = isFounder
      ? process.env.STRIPE_PRICE_FOUNDER
      : process.env.STRIPE_PRICE_STANDARD;

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
        is_founder: String(isFounder),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
});

// Decode -- Clerk session required, free-tier gate enforced server-side
app.post('/api/decode', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  const { docType, text } = req.body;

  if (!docType || !text) {
    return res.status(400).json({ error: 'docType and text are required.' });
  }

  const systemPrompt = promptFiles[docType];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown docType: ${docType}` });
  }

  try {
    const user = await getOrCreateUser(userId);
    const used = await countDecodesThisMonth(userId);

    if (user.plan === 'free' && used >= FREE_LIMIT) {
      return res.status(402).json({ error: 'limit_reached', used, limit: FREE_LIMIT });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    const result = message.content[0].text;

    await supabase.from('decodes').insert({
      clerk_user_id: userId,
      doc_type: docType,
      result_text: result,
    });

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
      .limit(20);

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
