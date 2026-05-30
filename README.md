# Verdict

A web app where a logged-in user pastes a residential lease and gets back a
sharp, tenant-side analysis.

---

## Project structure

```
verdict-app/
  server/        Express API (Node.js)
  client/        React frontend (Vite)
  prompts/       Analysis prompt files (lease-decoder-v1.txt)
```

---

## Local setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Set environment variables

Copy the example files and fill in your real keys:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

**server/.env**
```
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
```

**client/.env**
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Where to get these:
- Clerk keys: https://dashboard.clerk.com -> your app -> API Keys

### 3. Run the app

```bash
npm run dev
```

This starts both servers in one terminal:
- Backend:  http://localhost:3001
- Frontend: http://localhost:5173

---

## Env vars reference

| Variable                       | Used by  | Description                          |
|-------------------------------|----------|--------------------------------------|
| `CLERK_PUBLISHABLE_KEY`        | server   | Clerk publishable key (needed by @clerk/express to validate tokens) |
| `CLERK_SECRET_KEY`             | server   | Clerk secret key (never in browser)  |
| `ANTHROPIC_API_KEY`            | server   | Anthropic API key (never in browser) |
| `PORT`                         | server   | Express port (default: 3001)         |
| `VITE_CLERK_PUBLISHABLE_KEY`   | client   | Clerk publishable key                |

Variables added in later phases:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (server) -- Phase C
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (server) -- Phase D

---

## Verification checklist (Phase A)

1. `npm run dev` starts without errors.
2. Open http://localhost:5173 -- you should see "Backend connected" in green.
3. Click "Sign in" -- Clerk modal opens, you can sign up via magic link.
4. After sign-in, the page shows your email address and a logged-in state.
