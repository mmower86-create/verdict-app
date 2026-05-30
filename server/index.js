require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const supabase = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Load prompts at startup. To add a new doc type: drop a .txt in /prompts
// and add one line here.
const promptFiles = {
  lease: fs.readFileSync(path.join(__dirname, '../prompts/lease-decoder-v1.txt'), 'utf8'),
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FREE_LIMIT = 3;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(clerkMiddleware());

// ── Helpers ───────────────────────────────────────────────────────────────────

// Returns the start of the current calendar month in UTC as an ISO string.
function startOfMonthUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// Upserts a users row for this clerk_user_id. Safe to call on every request.
async function getOrCreateUser(clerkUserId) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ clerk_user_id: clerkUserId }, { onConflict: 'clerk_user_id', ignoreDuplicates: true })
    .select()
    .single();

  if (error) throw new Error(`getOrCreateUser failed: ${error.message}`);
  return data;
}

// Returns how many decodes this user has made since the 1st of this month.
async function countDecodesThisMonth(clerkUserId) {
  const { count, error } = await supabase
    .from('decodes')
    .select('*', { count: 'exact', head: true })
    .eq('clerk_user_id', clerkUserId)
    .gte('created_at', startOfMonthUTC());

  if (error) throw new Error(`countDecodesThisMonth failed: ${error.message}`);
  return count;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check -- no auth required
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Usage -- returns plan + decode count for the current month
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

    // Free-tier gate -- enforced server-side, never trust the client
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

    // Record the decode
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
