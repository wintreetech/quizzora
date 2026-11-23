# Deployment preparation

No application has been published or deployed. All configurations remain under the two requested folders.

## MongoDB Atlas

Create a dedicated database user with access only to the application database. Put its connection string in `DATABASE_URL`. Configure the network allowlist for the backend host. Use TLS and backups. Do not use the embedded development database for production. Set `DATABASE_NAME` consistently when overriding the default `quizora`.

## Render API

Select `backend` as the service root directory. Build: `npm ci && npm run build`. Start: `npm start`. Health path: `/api/health`. Use the `render.yaml` template as a reference; if the folders are separate repositories, remove its `rootDir: backend` field.

Required environment: `NODE_ENV=production`, `DATABASE_URL`, and an HTTPS `APP_ORIGIN` matching the frontend exactly, without a trailing slash. Keep `BILLING_ENABLED=false`. Set `MONGOMS_DISABLE_POSTINSTALL=1` to skip the embedded MongoDB installer on production hosts. Optional SMTP variables are documented in `.env.example`.

Coin accounting requires MongoDB Atlas or another replica set. Configure TransactWorld with `PAYMENTS_ENABLED`, `MEMBER_ID`, `WORKING_KEY`, `TW_MERCHANT_USERNAME`, `TW_PARTNER_ID` (or valid `TW_AUTH_TOKEN`), `TW_SUPPORTED_CURRENCIES` and `API_PUBLIC_URL`. See [TransactWorld acceptance and configuration](TRANSACTWORLD.md). The local owner-approved launch prices are USD 2.99/5.99/12.99/24.99; fresh deployments retain the safe migration until the operator explicitly runs `COMMERCE_LAUNCH_APPROVED=true npm run launch:products` after reviewing those prices. The operation is repeat-safe and preserves later Admin edits.

HTTP works on loopback in development with the explicit `TW_ALLOW_LOCAL_CHECKOUT=true` override. Production requires public HTTPS. Provider checkout and API calls always use HTTPS. Gateway notifications cannot reach localhost; signed browser returns and authenticated merchant-reference Inquiry provide local recovery, but production should use reliable public HTTPS notifications. Redirect public HTTP to HTTPS at the deployment proxy. No deployment or actual card charge has been performed in this workspace.

Run a single always-on API instance with persistent WebSocket support. An instance that sleeps or restarts during a quiz interrupts live service. Do not configure autoscaling or multiple Node workers until distributed coordination is implemented. Participant limits are product limits, not measured concurrency claims.

## Netlify frontend

Set base directory `frontend`, build command `npm ci && npm run build`, publish directory `dist`, and `VITE_API_URL=https://your-api-origin`. The included `netlify.toml` implements history fallback, so direct player/result links work.

Use sibling custom domains (for example `app.example.com` and `api.example.com`) for reliable same-site cookie authentication. Set APP_ORIGIN to the frontend and leave COOKIE_SAME_SITE=lax. For unrelated hosting domains, COOKIE_SAME_SITE=none requires HTTPS and can still be blocked by browser third-party cookie policies. Verify login, cookie persistence, WebSocket handshake, and reconnect behavior on the actual deployment.

## Docker

From `backend`, build with `docker build -t quizora-api .`. Run with production environment variables provided securely and port 4000 published. The image uses a non-root Node process and requires external MongoDB. The Dockerfile is prepared but has not been verified by building an image in this environment.

## First release checks

Run both production builds, backend integration tests, and frontend browser tests. Confirm SMTP verification/recovery with a real mail-catching/sandbox provider. Provision the first administrator using the environment-based CLI against the intended database. Replace policy drafts with operator-specific documents and establish deletion/retention handling. Review indexes and create database backups. Load-test the chosen participant limits on the actual host. Billing, legal/operator details, and deployment credentials remain external configuration.

## Scaling later

Introduce a shared Socket.IO adapter, coordinated room mutations, durable scheduler ownership, transactional registration and finalization, and metrics before using multiple API instances. Socket recovery compatibility must be verified for the selected adapter. Do not simply add a Redis adapter and claim multi-writer safety.
