# HypeData

A Nigerian-market airtime & data top-up platform built on Lovable's TanStack Start stack with Lovable Cloud (Supabase) for the backend.

## Features

- 🔐 Email/password + Google sign-in
- 💳 Wallet balance with funding via **Paystack**
- 📱 Airtime purchase across **MTN, Glo, Airtel, 9mobile**
- 📶 Data plans with dynamic loading from **VTpass**
- 🔢 4-digit transaction PIN (PBKDF2-hashed, with lockout)
- 📜 Transaction history
- 👤 Profile management
- 🛡️ Admin role + `has_role()` RBAC (promote via SQL helper)
- 🧱 Server-side VTpass integration module
- 🔁 Atomic wallet credit/debit RPCs + automatic refund on provider failure
- 🪝 Paystack webhook for idempotent wallet credit

## Tech Stack

- **Frontend**: React 19, TanStack Start (Router + Query), Tailwind CSS v4
- **Backend**: TanStack server functions on Cloudflare Workers runtime
- **Database/Auth**: Supabase (PostgreSQL + RLS)
- **Payments**: Paystack
- **Telco**: VTpass

## Required environment variables

Copy `.env.example` to `.env` and fill in:

```bash
# Supabase (auto-provided by Lovable Cloud)
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...

# Paystack (https://dashboard.paystack.com/#/settings/developer)
PAYSTACK_SECRET_KEY=sk_test_xxx

# VTpass (https://vtpass.com/documentation)
VTPASS_API_KEY=xxx
VTPASS_SECRET_KEY=xxx
VTPASS_PUBLIC_KEY=xxx
VTPASS_BASE_URL=https://sandbox.vtpass.com/api   # use https://vtpass.com/api in production
```

When VTpass/Paystack are not configured, the app falls back to safe stubs (mock data plans, mock airtime success) so the UI flow works for development.

## Local PC setup

Requires **Node 20+** and **bun** (or **npm**).

```bash
git clone <your-repo-url>
cd hypedata
bun install        # or: npm install
cp .env.example .env
# fill in values
bun run dev        # or: npm run dev
```

Open http://localhost:3000

## Termux (Android) setup

```bash
pkg update && pkg upgrade
pkg install nodejs git
npm install -g bun

git clone <your-repo-url>
cd hypedata
bun install
cp .env.example .env
nano .env          # edit env vars
bun run dev --host 0.0.0.0
```

Then open `http://<your-device-ip>:3000` from another device on the same network.

## Database

The schema lives in `supabase/migrations/`. Tables:

- `profiles` — user profile (name, phone, email, avatar)
- `wallets` — per-user NGN balance
- `transactions` — airtime/data/funding ledger (with `status`, `reference`, `provider_ref`)
- `user_pins` — PBKDF2-hashed 4-digit PIN with failed-attempt lockout
- `user_roles` + `app_role` enum — RBAC via `has_role(uuid, app_role)`
- `vtpass_logs` — raw request/response audit for admin debugging
- `funding_intents` — Paystack reference tracking (idempotent webhook target)

RPCs:
- `credit_wallet(user_id, amount)` / `debit_wallet(user_id, amount)` — atomic balance ops
- `has_role(user_id, role)` — security-definer role check used in RLS
- `promote_to_admin(email)` — admin bootstrap helper

### Promoting an admin

After your first user signs up, run in the Lovable Cloud SQL editor:

```sql
SELECT public.promote_to_admin('you@example.com');
```

## Project structure

```
src/
├── components/
│   ├── app-shell.tsx          # Header + mobile bottom nav
│   ├── wallet-card.tsx        # Animated wallet balance card
│   ├── pin-dialog.tsx         # 4-digit PIN confirmation modal
│   └── ui/                    # shadcn/ui primitives
├── integrations/
│   ├── lovable/index.ts       # OAuth broker (auto-generated)
│   └── supabase/              # Supabase clients (auto-generated)
├── lib/
│   ├── format.ts              # NGN formatter, refs, dates
│   ├── networks.ts            # MTN/Glo/Airtel/9mobile mapping
│   ├── fonts.ts               # Self-hosted fonts
│   ├── pin.server.ts          # PBKDF2 hashing (Web Crypto)
│   ├── vtpass.server.ts       # VTpass HTTP client + sandbox fallback
│   ├── paystack.server.ts     # Paystack init/verify + webhook signature
│   ├── wallet.functions.ts    # Server fns: getWallet, getTransactions
│   ├── profile.functions.ts   # Server fns: getProfile, updateProfile, isAdmin
│   ├── pin.functions.ts       # Server fns: hasPin, setPin, changePin, verifyUserPinServer
│   ├── airtime.functions.ts   # Server fn: buyAirtime
│   ├── data.functions.ts      # Server fns: getDataPlans, buyData
│   └── funding.functions.ts   # Server fns: initFunding, verifyFunding
├── routes/
│   ├── __root.tsx
│   ├── index.tsx              # Landing
│   ├── auth.tsx               # Sign in / sign up
│   ├── _authenticated/
│   │   ├── route.tsx          # Auth gate (ssr:false, redirect to /auth)
│   │   ├── dashboard.tsx
│   │   ├── airtime.tsx
│   │   ├── data.tsx
│   │   ├── history.tsx
│   │   ├── profile.tsx
│   │   ├── pin.tsx
│   │   └── fund.tsx
│   └── api/public/webhooks/paystack.ts   # Paystack webhook (signature-verified)
├── styles.css                 # Tailwind v4 design system (Neon Violet)
└── start.ts                   # Server middleware registration
supabase/
├── config.toml
└── migrations/                # SQL schema migrations
```

## Paystack webhook setup

1. In your Paystack dashboard → Settings → API Keys & Webhooks
2. Set the webhook URL to:
   ```
   https://<your-domain>/api/public/webhooks/paystack
   ```
3. The handler verifies the `x-paystack-signature` header (HMAC SHA-512 over the raw body) before crediting any wallet.

## VTpass

- Sandbox base URL: `https://sandbox.vtpass.com/api`
- Production base URL: `https://vtpass.com/api`
- Get keys: https://vtpass.com/profile/api-keys

Without credentials, `getDataPlans` returns a curated fallback plan list and `buyAirtime`/`buyData` simulate success for development.

## Security highlights

- Row-Level Security enabled on every public table; policies scope rows to `auth.uid()`
- `SECURITY DEFINER` functions revoke EXECUTE from `PUBLIC`/`anon` where appropriate
- Service-role key is never imported into client-reachable modules (loaded inside `.handler()` via `await import()`)
- Transaction PIN: PBKDF2-SHA256, 100k iterations, per-PIN salt, constant-time compare
- 5 failed PIN attempts → 15-minute lockout
- Paystack webhook: HMAC SHA-512 signature verified with timing-safe compare
- Wallet debits are atomic via Postgres RPCs (refund on VTpass failure)

## Exporting the code

Use the **GitHub** button in Lovable's top-right toolbar to push the full repo to your own GitHub account. From there you can `git clone` and follow the local setup above. Alternatively, use **Dev Mode** to browse and download individual files.

## License

MIT
