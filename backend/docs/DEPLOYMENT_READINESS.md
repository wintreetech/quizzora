# Deployment readiness

Updated 23 November 2026. The local product is suitable for client UX review and functional acceptance testing. It is **not approved for production purchases**. Customer-facing payment simulations have been removed per the owner's latest instruction.

The chosen hosting target is **Render for both services, with Atlas**. Use [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for exact settings. The two-service Blueprint is `backend/render.yaml`; Render's `RENDER_EXTERNAL_URL` supplies the callback-origin fallback and an explicit `API_PUBLIC_URL` overrides it. No Render deployment or actual Atlas connection has been executed here.

The current store uses purchase amounts from 10–500 in USD/EUR. New retail pricing defaults to 20 coins per USD, with EUR allocations based on a dated ECB reference and rounded down to whole coins. Admin → Store pricing changes the versioned rate. New purchases cannot use the previous cheaper curve. Existing order amounts, currencies and coin allocations remain unchanged.

## Runtime and installation

Use Node.js 22+ and install locked dependencies separately in `frontend` and `backend` with `npm.cmd ci`. No root package is needed. Local verification used the installed Node 24 runtime and Chromium/Chrome through Playwright.

For an existing environment, preserve `backend/.env`. For a new environment, create it from `.env.example` and configure the values below; never put provider secrets in `VITE_*` variables.

## Required server configuration

- `NODE_ENV=production`.
- `DATABASE_URL`: authenticated Atlas or another MongoDB replica set; standalone MongoDB is rejected with the coin economy enabled.
- `DATABASE_NAME`: the intended live database name. Never use the isolated `quizora_review_*` database for live users.
- `APP_ORIGIN`: the exact public HTTPS frontend origin.
- `API_PUBLIC_URL`: the public HTTPS backend origin for signed provider return and notification routes.
- `COOKIE_SAME_SITE`: default `lax`; `none` requires production HTTPS and a deployment that needs cross-site cookies. Confirm cookies on the actual selected frontend/backend domains.
- `SUPPORT_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`: configure and deliver real verification/recovery emails before relying on mail flows.
- Review registration, organizer registration and email-verification flags for the client's policy.
- Keep `BILLING_ENABLED=false`; recurring hosting subscriptions are not implemented.

The development embedded replica persists under `backend/.data/mongo`, port 57017. It is a local development convenience, not the production database. Keep `.env`, `.data`, `.cache` and generated test artifacts out of source control and public hosting.

## Payment activation gates

1. Obtain real environment-matched `MEMBER_ID` and `WORKING_KEY` from TransactWorld and store them only in backend secret configuration.
2. Obtain the actual merchant API login and assigned Partner ID. Connect them through Admin → Payments → Connect merchant, or set `TW_MERCHANT_USERNAME` / `TW_PARTNER_ID`. A valid supported `TW_AUTH_TOKEN` can be supplied in backend secrets, but expiring manual tokens need an operating refresh strategy. The normal integration exchanges credentials for a token and caches it only in memory.
3. Set the correct `TW_ENVIRONMENT` and only merchant-approved `TW_SUPPORTED_CURRENCIES`. Verify merchant approval for the actual business model and payment methods.
4. Run actual provider authentication and a provider-supported sandbox payment with real sandbox credentials. This has **not** been executed in this delivery. Automated tests simulate transport only.
5. Deploy and validate public HTTPS return and notification endpoints under `/api/payments/transactworld/`. Check signatures, amount, currency, merchant reference, independent Inquiry and exactly-once wallet credit. Validate failed/cancelled payments, duplicate callbacks, lost browser returns, refunds/chargebacks and reconciliation against genuine provider records.
6. Review the versioned coins-per-USD retail rate, 10-500 amount limits, dated EUR reference, legal terms and eligible refund policy with the client. The previous cheap quantity curve and fixed-package endpoints cannot create new orders. Existing confirmed orders retain their snapshots.
7. Enable `PAYMENTS_ENABLED=true` only when the required merchant setup and actual acceptance tests succeed. The application must continue to reject unavailable/failed authentication.
8. Coin-entry live events additionally need both `PAID_COMPETITIONS_ENABLED=true` and `PAID_EVENTS_MERCHANT_APPROVED=true`; keep them off until approved.

No real payment, live settlement, production callback delivery or real provider reversal was verified. Existing local member/key configuration does not satisfy the missing login/Partner ID requirement. Removing customer demo UI does not change these activation gates.

Provider contract references: [merchant API identity](https://docs.transactworld.com/merchant-api/api-specifications.php), [transaction AuthToken](https://docs.transactworld.com/integration/transaction-AuthToken.php), [integration API reference](https://docs.transactworld.com/integration/rest-api-specifications.php). Merchant credentials must come from provider onboarding/account management; no undocumented portal menu is assumed.

## Data and migrations

Back up the intended database and test a restore before deploying. Startup inserts missing library quizzes by stable seed key using `$setOnInsert`; it does not overwrite client edits or delete quizzes. The new library adds 30 quizzes/120 questions to the original eight/40, and uses explicit Free/Paid pricing (12 free and 26 paid across the complete platform library).

The guarded quiz-access migration repairs only known untouched platform seeds; preserves explicit customer/Admin prices and purchased attempts; audits repairs once; and flags ambiguous customer prices for review rather than inventing Free.

The economy migration creates missing zero wallets and inactive/unpriced initial price points where necessary, preserves existing active prices, and never rewrites historical purchases. Do not run `launch:products` as an automatic migration: it is an explicit owner-approved initial pricing operation. Its scope is now restricted to the original eight seed identifiers so future library additions cannot accidentally become paid.

Startup initializes model indexes. In a large production database, schedule and inspect index creation rather than assuming development timings. Use the existing replica-set transaction guarantees for wallet and ledger operations. Public competition listings omit the stored example event; existing event records are preserved.

## Build and run

```powershell
cd backend
npm.cmd test
npm.cmd run build
npm.cmd start
```

```powershell
cd frontend
npm.cmd run lint
npm.cmd run build
```

The frontend output is `frontend/dist`; serve it through a host with SPA fallback to `index.html`. Backend output is `backend/dist`; start it with `npm.cmd start` using the server environment. Set `VITE_API_URL` to the correct backend origin at frontend build time, or use a same-origin reverse proxy. Information, Admin and Organizer routes have separate chunks; do not omit them from static deployment.

Existing [deployment reference](DEPLOYMENT.md), Netlify configuration, Render configuration and backend Dockerfile remain available. They have not been deployed or container-tested during this audit. No hosting account or domain has been selected.

## Release checks

- Run backend tests, frontend/browser tests, both builds, lint and dependency audits against the release artifacts.
- Provision the first administrator privately with the existing `npm.cmd run admin` mechanism; no public/default admin password exists.
- Confirm real HTTPS/CORS/cookies, callback reachability, real SMTP delivery and support contact.
- Validate database backups/restores, monitoring, reconciliation and restart recovery under production infrastructure.
- Review privacy/terms and commercial pricing with the owner. Do not claim legal or payment-provider approval from engineering tests.
- Perform physical-device/Safari/Firefox acceptance and a full accessibility review before public launch.
- Obtain the client's separate design, functional and production sign-offs.
