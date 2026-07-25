# Verdict — Traffic Strategy (source of truth)
Updated 2026-07-25. Budget: $0 (paid ads on hold). Goal: clients by EOY.

## ⚠️ CURRENT BLOCKER: the app is offline
- getverdict.net (Netlify landing): LIVE
- app.getverdict.net + Railway API: **404, "Application not found"**
- Cause: Railway trial credit ran out (~$5 left as of Jun 11), services removed.
- Plausible also dead (trial expired ~Jul 5). No analytics since.
- FIX IS FREE, NOT A CARD. See Phase 0. Nothing else matters until this is done.

## The honest baseline
When people landed, they stayed ~10 min and read 3 pages. The page converts.
Traffic volume was the problem, and now the app being down is a bigger one.

## The strategic point nobody named until now
A renter needs a lease review ONCE a year. Asking them to start a $39/mo
subscription for that is a brutal ask and explains near-zero conversion better
than traffic does. A one-time price is the single highest-leverage change
available, and it costs nothing to build.

## Economics of paid (why it's on hold, and why that's fine)
At $19-29 one-time, Meta CPC ~$0.50-1.50 means $200 buys 150-400 visitors. Even
2% conversion is 3-8 sales, roughly break-even. Paid ads are worth running for
INFORMATION later, never as the scaling channel. Not a loss to defer them.

═══════════════════════════════════════════════════════════
## PHASE 0 — this week: back online, $0
═══════════════════════════════════════════════════════════
1. **Frontend -> Netlify** (already paying for Personal, so free). Static Vite
   build, netlify.toml already in repo. Point app.getverdict.net at it.
2. **Backend -> Render free tier.** Express server, needs env vars re-entered.
   Tradeoff: free tier sleeps after 15 min idle, first request waits 30-60s.
   Invisible at current traffic.
3. **Analytics -> Cloudflare Web Analytics** (free, no trial to expire).
   Replaces dead Plausible. Restores the one metric.
4. **Add one-time pricing** (~$19-29 per lease review) alongside subscriptions.
   New Stripe price + one-time checkout path + third pricing card.

═══════════════════════════════════════════════════════════
## PHASE 1 — August: lease season, free channels
═══════════════════════════════════════════════════════════
August is the highest concentration of lease signings all year; window closes
mid-September. Use it or lose it for another year.
- **University off-campus housing Facebook groups.** Peak season, exact buyer,
  free, concentrated. Value-first, no link drops. See facebook-groups.md.
- **Reddit: comment-only.** Account is still karma-filtered (posts auto-removed).
  Spend August earning posting rights with genuine no-link comments.
- **X: 1-2 posts/week**, not daily. Keeps the account from looking dead. It is
  brand presence, not a traffic engine. Do not give it hours.

═══════════════════════════════════════════════════════════
## PHASE 2 — Sept/Oct: SEO + B2B outreach (both free)
═══════════════════════════════════════════════════════════
- **SEO, 1 article/week.** Five months is exactly the SEO payoff window and it
  lines up with the Dec-Jan money wall. Target what renters actually Google:
  "can my landlord enter without notice", "how long to return security deposit",
  "is my non-compete enforceable", "what is a reasonable late fee".
- **B2B outreach, 10 emails/week.** This is where "clients" actually comes from.
  Targets with RECURRING lease-review need:
  - Relocation management companies (corporate relo, real budgets)
  - Rental agents / small brokerages (differentiator for their renters)
  - University off-campus housing offices (advise thousands of students)
  - Employee-benefit platforms (Verdict as a perk)
  Ten a week for eight weeks is 80 shots. You need two or three yeses.

═══════════════════════════════════════════════════════════
## PHASE 3 — Nov/Dec: close and concentrate
═══════════════════════════════════════════════════════════
Sept articles start ranking. Work the outreach pipeline. Pour everything into
whichever of SEO or outreach showed a pulse. Do not split effort in December.

## What to STOP
- The daily X post + Reddit karma grind as a primary activity. Two weeks of it
  produced ~6 visitors. Batched, not life-eating.
- Treating "did my 15 minutes" as the goal. The goal is visitors and replies.

## The one metric
Unique visitors (Cloudflare Web Analytics once restored), then replies to B2B
outreach. Not X impressions.

## Honest expectation
At $0 with wholesaling correctly taking priority, December's realistic outcome is
a few B2B conversations and SEO starting to rank. Not a windfall. It compounds
into next year. Failure mode to avoid: Verdict marketing feeling productive
enough to justify not making wholesaling calls.
