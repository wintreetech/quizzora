# Quizora API

Current handoff: [client walkthrough](docs/CLIENT_DEMO_GUIDE.md), [QA report](docs/QA_REPORT.md), [approval checklist](docs/CLIENT_APPROVAL_CHECKLIST.md) and [Render + Atlas setup](docs/RENDER_DEPLOYMENT.md).

A standalone Express/TypeScript modular monolith using MongoDB/Mongoose, opaque HttpOnly sessions, and authenticated Socket.IO rooms. Intended for adults aged 18+. No schools, gambling, wagers, or real-money prizes.

## Local setup

```powershell
cd backend
npm ci
Copy-Item .env.example .env
npm run dev
```

The API runs at http://localhost:4000. Health: `/api/health`. With `DATABASE_URL` empty in development, the app downloads an official MongoDB 7 binary once and runs a real local single-member replica set on port 57017, persisted under `.data/mongo`. Existing data is preserved. The first download is large; alternatively use an Atlas connection string or a configured MongoDB replica set. A standalone MongoDB server is rejected while the coin economy is enabled because atomic financial transactions require a replica set. Never commit `.env`, `.data`, or `.cache`.

In another terminal, run `npm ci` and `npm run dev` inside `frontend`. Each folder has its own package manifest and lockfile; there is no root workspace package.

The idempotent startup seed inserts eight original quizzes/40 questions plus 30 additional quizzes/120 questions across ten categories, without overwriting existing edits or creating accounts. New library additions remain free until explicitly repriced. Stored example events are excluded from public competition listings. The store now supports purchases of 10–500 in USD/EUR at a server-configured coin rate, replacing the earlier discounted slider pricing for new orders.

## Scripts

- `npm run dev`: development API and scheduler.
- `npm run build`: compile TypeScript into `dist`.
- `npm start`: run the compiled server.
- `npm test`: isolated MongoDB integration and integrity tests.
- `npm run seed`: repeatable seed.
- `npm run admin`: provision a first administrator from environment variables.
- `npm run client:accounts`: provision isolated review accounts; refuses production, active payments and the regular database.
- `npm run check:client`: scan frontend source/build artifacts for configured backend credential values without printing them.
- `npm run fx:refresh`: refresh the dated ECB EUR/USD reference in the selected database.

## First administrator

In a private shell, set `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_NAME`, and a unique `ADMIN_PASSWORD` of at least 12 characters. These values are read from the environment, never command-line arguments. Then run:

```powershell
npm run admin
Remove-Item Env:ADMIN_PASSWORD
```

Use the same `DATABASE_URL` and `DATABASE_NAME` as the running API. Stop the development server before provisioning when using the embedded database, so two MongoDB processes do not try to open the same data directory. Restart afterward and sign in through the regular app. Re-provisioning an existing email rotates its password, verifies its email, elevates its role, revokes old sessions, and records an audit entry. There is no public admin signup.

## Configuration

See `.env.example`. Production requires an explicit MongoDB URL and HTTPS `APP_ORIGIN`. `COOKIE_SAME_SITE` is `lax` by default. Use HTTPS for production cookies. Sessions use cryptographically random, opaque values and store only hashes in MongoDB, so no shared signing secret is required.

`PUBLIC_REGISTRATION_ENABLED`, `ORGANIZER_REGISTRATION_ENABLED`, and `REQUIRE_EMAIL_VERIFICATION` are enforced by the API. Organizer self-registration is an explicit server policy; client role fields are ignored. SMTP settings enable email verification and password recovery. Without SMTP, the API clearly reports those functions as unavailable rather than claiming to send messages.

Keep `BILLING_ENABLED=false`; recurring subscriptions are a later phase. One-time coin purchases use the separate `PAYMENTS_ENABLED` switch and the TransactWorld integration. See [merchant setup and activation](docs/TRANSACTWORLD.md). Set approved currencies and actual package prices in Admin; no real-money prices are invented. New paid content recommendations are drafts until an administrator reviews and publishes them. Coin-entry events additionally require both merchant approval and activation flags.

## Documentation

- [Architecture, data models, and concurrency](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Competition timing and fairness](docs/COMPETITIONS.md)
- [Netlify, Render, Atlas, and Docker](docs/DEPLOYMENT.md)
- [Delivery and verification report](docs/DELIVERY.md)
- [Coin platform delivery and verification](docs/COIN_PLATFORM_DELIVERY.md)
- [TransactWorld configuration and sandbox acceptance](docs/TRANSACTWORLD.md)
