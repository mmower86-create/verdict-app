#!/usr/bin/env node
/**
 * Verdict content engine.
 * Generates platform-ready marketing posts in Verdict's voice using the same
 * Anthropic setup the app uses. Standalone -- never imported by the server.
 *
 * Usage:
 *   node generate.js                      # 1 post, X (twitter), random angle
 *   node generate.js --platform=linkedin  # platform: x | linkedin | tiktok | reddit
 *   node generate.js --count=5            # generate 5 posts
 *   node generate.js --topic="non-compete clauses in job offers"
 *   node generate.js --platform=tiktok --count=3 --topic="security deposit traps"
 *
 * Output prints to console AND saves a timestamped .md file in ./output/.
 * Reads ANTHROPIC_API_KEY from ../server/.env (no separate setup needed).
 */
const fs = require('fs');
const path = require('path');
require(path.join(__dirname, '..', 'server', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', 'server', '.env'),
});
const Anthropic = require(path.join(__dirname, '..', 'server', 'node_modules', '@anthropic-ai', 'sdk'));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-4-6';
const voice = fs.readFileSync(path.join(__dirname, 'voice.txt'), 'utf8');

// ── Args ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  })
);
const platform = (args.platform || 'x').toLowerCase();
const count = Math.max(1, Math.min(10, parseInt(args.count, 10) || 1));
const topic = args.topic || null;

// ── Platform-specific format guidance ───────────────────────────────────────
const PLATFORMS = {
  x: {
    label: 'X / Twitter',
    // singlePost mode: the whole thing must fit one tweet (free accounts have no
    // long-post / thread compose). HARD LIMIT enforced after generation.
    maxChars: 280,
    format:
      'A SINGLE post that MUST be 275 characters or fewer INCLUDING the url and ' +
      'all line breaks (free X accounts cannot post longer). Lead with the most ' +
      'specific scary clause as a hook. End with getverdict.net on its own line. ' +
      'Use short line breaks for rhythm. No hashtags. Count your characters and ' +
      'stay under 275 -- if it is too long, cut words until it fits. Brevity is ' +
      'mandatory, not optional.',
  },
  linkedin: {
    label: 'LinkedIn',
    format:
      'A professional but punchy post for job-seekers / freelancers. Hook in the ' +
      'first line (it gets truncated, so front-load it). Short paragraphs, lots of ' +
      'white space. Angle toward job offers, non-competes, vendor contracts. End ' +
      'with a question or a soft mention of verdict.',
  },
  tiktok: {
    label: 'TikTok / Reels script',
    format:
      'A 20-40 second video script. Format as: HOOK (first 3 seconds, must stop ' +
      'the scroll), then the reveal, then the payoff. Write spoken-word lines plus ' +
      '[on-screen text] and [b-roll] cues. Conversational, fast, no fluff.',
  },
  reddit: {
    label: 'Reddit',
    format:
      'A genuinely helpful comment/post for subreddits like r/Renters, r/jobs, ' +
      'r/freelance. NOT an ad. Lead with real value (explain a clause, answer the ' +
      'implied question). Mention verdict only if it fits naturally, once, softly. ' +
      'Reddit punishes promotion -- be a helpful human first.',
  },
};

const TOPIC_BANK = [
  'an early-termination fee buried in a lease',
  'a security deposit clause that contradicts itself',
  'a non-compete clause in a job offer that is wider than enforceable',
  'a vendor contract auto-renewal trap',
  'a repair-cost clause with no cap',
  'a late-fee clause that compounds daily',
  'a "modifications need approval" clause that bans hanging a shelf',
  'an arbitration clause that waives your right to sue',
  'a job offer equity grant with no acceleration on layoff',
  'a ToS that claims rights to everything you upload',
  'a "landlord may enter for any reason" clause',
  'a deposit that is non-refundable in ways they did not tell you',
];

function pickTopic(i) {
  if (topic) return topic;
  return TOPIC_BANK[(Date.now() / 1000 + i * 7) % TOPIC_BANK.length | 0];
}

async function generateOne(i) {
  const p = PLATFORMS[platform] || PLATFORMS.x;
  const thisTopic = pickTopic(i);
  const system =
    voice +
    `\n\nYou are Verdict's content writer. Write ONE piece of ${p.label} content.\n` +
    `FORMAT: ${p.format}\n\n` +
    `Rules: lead with the specific clause, make the reader feel the jolt, earn ` +
    `the click. The product is the payoff not the pitch. Output ONLY the post ` +
    `content, ready to copy-paste. No preamble, no "here's a post:", no meta commentary.\n\n` +
    `CRITICAL: The ONLY url is getverdict.net (the app is app.getverdict.net). ` +
    `NEVER invent any other domain, handle, or link. If you reference the site, ` +
    `use exactly "getverdict.net" and nothing else. Do not make up @handles, ` +
    `prices other than Free / Pro $39 / $19 founder / Business $79, or features ` +
    `beyond reading leases (job offers, vendor contracts, ToS are "coming soon", ` +
    `not live).`;

  let text = '';
  // For length-capped platforms (X), regenerate up to a few times if the model
  // overshoots, asking progressively harder to cut. Guarantees a postable draft.
  const limit = p.maxChars || null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const nudge =
      attempt === 0
        ? ''
        : `\n\nYour previous attempt was ${text.length} characters, which is OVER ` +
          `the ${limit} limit. Rewrite it SHORTER. Cut whole sentences if needed. ` +
          `It MUST be ${limit} characters or fewer including the url.`;
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: `Write a ${p.label} post about: ${thisTopic}${nudge}` }],
    });
    text = msg.content[0].text.trim();
    if (!limit || text.length <= limit) break;
  }

  const over = limit && text.length > limit;
  return { topic: thisTopic, text, chars: text.length, over };
}

(async () => {
  const p = PLATFORMS[platform] || PLATFORMS.x;
  console.log(`\nGenerating ${count} ${p.label} post(s)...\n`);

  const posts = [];
  for (let i = 0; i < count; i++) {
    try {
      const post = await generateOne(i);
      posts.push(post);
      console.log('─'.repeat(60));
      const charNote = post.chars != null ? `  ·  ${post.chars} chars${post.over ? ' ⚠️ OVER LIMIT — trim before posting' : ' ✅'}` : '';
      console.log(`POST ${i + 1}  ·  topic: ${post.topic}${charNote}`);
      console.log('─'.repeat(60));
      console.log(post.text);
      console.log('');
    } catch (e) {
      console.error(`Post ${i + 1} failed:`, e.message);
    }
  }

  if (posts.length) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(__dirname, 'output', `${platform}-${stamp}.md`);
    const md =
      `# Verdict content · ${p.label} · ${stamp}\n\n` +
      posts.map((x, i) => `## Post ${i + 1}\n*Topic: ${x.topic}*\n\n${x.text}\n`).join('\n---\n\n');
    fs.writeFileSync(file, md);
    console.log(`\nSaved ${posts.length} post(s) to: ${path.relative(process.cwd(), file)}\n`);
  }
})();
