# Verdict — Marketing HQ
*Start here. This is the source of truth for what's done, what's next, and where everything lives.*

Last updated: 2026-06-18

═══════════════════════════════════════════════════════════
## 🟢 PRODUCT STATUS: DONE & LIVE — ready to market
═══════════════════════════════════════════════════════════
- Landing: https://getverdict.net (live)
- App: https://app.getverdict.net (live)
- Payments: LIVE and tested with real charges + refunds
- 3 tiers (Free / Pro $39, $19 founder / Business $79), founder cap, plan mgmt,
  markdown rendering, history, billing hardening — all shipped.
- Nothing on the build side blocks marketing.

### Known-but-not-a-blocker (watch, don't fix):
These are code-complete but never done by a REAL paying user. They fail safe.
Just confirm in Supabase/Stripe when your FIRST real customer hits them:
- [ ] First real Business ($79) checkout -> does their Supabase row flip to 'business'?
- [ ] First real plan switch (Pro<->Business via portal) -> does the plan sync?
- [ ] Dead-card downgrade -> drops to free after failed retries?
(No action needed now. These get proven by real usage.)

═══════════════════════════════════════════════════════════
## 🎯 THE MARKETING SITUATION (honest)
═══════════════════════════════════════════════════════════
- Traffic so far: ~6 visitors/2 weeks from organic. Too slow to prove anything.
- BUT: people who DO land stay ~10 min, view 3 pages. Product/page is NOT the
  problem. The ONLY problem is traffic volume.
- Conclusion: organic (X/Reddit/FB) is a slow background burn. The decisive move
  is a small PAID test to learn if strangers convert.

## ⭐ PRIORITY #1 (locked): PAID AD TEST
- Status: ON HOLD until $100-200 available. Jump on it the moment funds free up.
- Everything prepped in -> PAID-TEST-PLAN.md (platform, targeting, ad copy, steps)
- Answers the real question in ~48h: do people who see Verdict sign up?

## 🔁 UNTIL THEN: light organic upkeep (don't over-invest)
- X: ~1 post/day (Claude posts for you). Brand presence, not a traffic engine.
- Reddit: comment-only to build karma (links got auto-filtered). ~2-3 weeks to
  earn posting ability. See reddit-posts.md + STRATEGY.md.
- Facebook groups: best free near-term channel. Join renter/housing groups,
  comment helpfully. See facebook-groups.md.

═══════════════════════════════════════════════════════════
## 📁 FILE INDEX (what each file is for)
═══════════════════════════════════════════════════════════
- README.md .............. this file — the map. Start here.
- PAID-TEST-PLAN.md ...... ⭐ priority #1. The Meta ad test, ready to launch.
- STRATEGY.md ............ the big-picture traffic strategy + weekly agenda + Reddit rules.
- daily-brief.md ......... the current day's tasks (X done + Reddit/FB to-dos).
- facebook-groups.md ..... FB groups playbook + ready-to-post value post.
- reddit-posts.md ........ 2 Reddit drafts + the karma-building rules.
- generate.js ............ the content engine. Run: node generate.js --platform=x --count=3
                           (enforces 280 char limit + strips em-dashes automatically)
- voice.txt ............. brand voice, fed to generate.js. (in this folder)
- banner.html / verdict-banner.png ... the X profile banner (1500x500, live on @GetVerdictApp)
- output/ ............... generated post drafts (gitignored, disposable)

═══════════════════════════════════════════════════════════
## 📊 WHAT WE'VE ACTUALLY DONE (log)
═══════════════════════════════════════════════════════════
- Built content engine (generate.js) — X/LinkedIn/TikTok/Reddit drafts in Verdict voice.
- Made X account @GetVerdictApp: profile, bio, banner, first posts, pinned post.
- Posted ~5 X posts + several genuine replies to renters. Result: ~2 followers, trickle traffic.
- Tried Reddit (r/SideProject + r/renters) -> both auto-filtered (account too new/low karma).
- Mapped Facebook groups as the better free channel (not yet executed).
- Set up Plausible analytics (getverdict.net) — the scoreboard for all of this.
- Killed the auto-drip scheduled task (redundant; Claude generates fresh in-session now).
- LOCKED the plan: paid test = #1 when funded; organic = light upkeep until then.

═══════════════════════════════════════════════════════════
## ✅ NEXT ACTION (single next step)
═══════════════════════════════════════════════════════════
When funds allow: open PAID-TEST-PLAN.md and run it (make a Verdict FB Page first,
~5 min). Until then: 1 X post/day + occasional Reddit/FB comments. Check Plausible weekly.
Don't grind organic expecting a spike — it's maintenance, not the needle-mover.
