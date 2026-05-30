require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { clerkMiddleware, requireAuth } = require('@clerk/express');

const app = express();
const PORT = process.env.PORT || 3001;

// Load prompts at startup. To add a new doc type: drop a .txt in /prompts
// and add one line here.
const promptFiles = {
  lease: fs.readFileSync(path.join(__dirname, '../prompts/lease-decoder-v1.txt'), 'utf8'),
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(clerkMiddleware());

// Health check -- no auth required
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Decode endpoint -- Clerk session required
app.post('/api/decode', requireAuth(), async (req, res) => {
  const { docType, text } = req.body;

  if (!docType || !text) {
    return res.status(400).json({ error: 'docType and text are required.' });
  }

  const systemPrompt = promptFiles[docType];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown docType: ${docType}` });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }],
    });

    res.json({ result: message.content[0].text });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    res.status(502).json({ error: 'The analysis failed. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
