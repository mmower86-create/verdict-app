// Pure plan/cap logic, extracted from index.js so it can be tested without a
// database, a Clerk session, or any env vars. index.js requires this module.
//
// One deliberate behavior change vs the original inline version: limitForUser
// used `PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.free`, which returns a FUNCTION
// for prototype keys like 'constructor' instead of falling back to free. Not
// reachable today (the users_plan_check constraint restricts plan), so this is
// defense in depth, not a live bug fix. See audit invariant C4.

// Monthly decode caps per plan. An account with users.unlimited = true (owner/
// comp only -- NOT a sellable tier) bypasses the cap entirely.
const PLAN_LIMITS = { free: 3, pro: 15, business: 100 };

// Plans that may be stored on a user row. Mirrors the users_plan_check CHECK
// constraint in Supabase; kept here so a drift between the two is testable.
const VALID_PLANS = ['free', 'pro', 'business'];

function limitForUser(user) {
  if (user.unlimited) return null; // null = uncapped
  // Object.hasOwn, not `??`: PLAN_LIMITS['constructor'] is an inherited
  // function, which is truthy and would slip past a nullish check and make
  // `used >= limit` always false (i.e. silently uncapped).
  return Object.hasOwn(PLAN_LIMITS, user.plan) ? PLAN_LIMITS[user.plan] : PLAN_LIMITS.free;
}

// First instant of the current month, UTC. Decode counts are month-to-date
// against this, so the reset moment is the same for every user worldwide.
function startOfMonthUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

module.exports = { PLAN_LIMITS, VALID_PLANS, limitForUser, startOfMonthUTC };
