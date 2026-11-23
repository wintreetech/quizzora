# Quizora frontend

Current handoff: [QA report](../backend/docs/QA_REPORT.md), [client walkthrough](../backend/docs/CLIENT_DEMO_GUIDE.md) and [Render + Atlas setup](../backend/docs/RENDER_DEPLOYMENT.md). The current interface uses an ink, white and evergreen identity, a 10–500 purchase-amount slider, USD/EUR selection and server-calculated coin allocations. Customer-facing payment simulations are absent.

An adult knowledge competition product with an evergreen-and-ink identity, featured-quiz hero, amount-based USD/EUR store, first-signup guide, wallet history and explicit premium entry confirmations. `/store` and `/pricing` show the coin builder; `/hosting` contains separate hosting information. All project files stay inside `frontend/` and `backend/`.

## Start locally

Use Node.js 22.12 or newer. Run the backend in a separate terminal using [its setup instructions](../backend/README.md).

```powershell
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` and `/socket.io` to localhost:4000. Create an account in the app; no default accounts or passwords are supplied. Select the organizer checkbox during registration to access Creator studio when organizer registration is enabled on the server.

## Commands

- `npm run dev`: local development.
- `npm run build`: TypeScript check and optimized Vite production build.
- `npm run preview`: inspect the production bundle locally.
- `npm run test:e2e`: isolated Playwright account, quiz, live-hosting, and admin journeys. Requires dependencies installed in both folders. Browser tests launch their own temporary MongoDB and API on 4100 and frontend on 5174, leaving the development database alone.
- `node scripts/review.mjs`: screenshots and overflow checks at 320, 390, 768, 1024, and 1440 pixels against the normal local development servers.

Browser tests use installed Chrome on Windows. Set `CHROME_PATH` to another installed Chromium executable on other systems. Screenshots and traces are ignored local artifacts.

## App structure

```text
src/
  components/  App navigation, quiz cards, original category artwork
  pages/       Discovery, player, live rooms, tournaments, creator/admin tools
  lib.tsx      Credentialed API client, account context, dialogs and UI helpers
  types.ts     Public API view types
  main.tsx     Router and TanStack Query setup
  styles.css   Foundations and product surfaces
  responsive.css  Responsive, management, and dark appearance styles
tests/         Browser journeys and isolated-fixture teardown
```

## Production

Set the Netlify base directory to `frontend`, publish directory to `dist`, and `VITE_API_URL` to your HTTPS backend origin. This variable is public configuration, never a place for secrets. `netlify.toml` supplies SPA fallback and security headers. No deployment has been performed.

Use sibling custom domains, such as `app.example.com` and `api.example.com`, so secure session cookies work as same-site cookies. Separate Netlify and Render service domains can require `SameSite=None` and are subject to third-party cookie restrictions. See [deployment notes](../backend/docs/DEPLOYMENT.md).

## Implementation status

See the [delivery report](../backend/docs/COIN_PLATFORM_DELIVERY.md) and [TransactWorld guide](../backend/docs/TRANSACTWORLD.md). Customers choose purchase amounts from 10 to 500 in USD or EUR. Coin totals use the server-configured retail rate and dated ECB reference. New signups receive a resumable walkthrough, replayable from Help. Connect the missing merchant login/partner ID through Admin → Payments → Connect merchant, or configure a valid backend API token. Checkout tests simulate the provider and never charge a card. Policy pages remain pre-launch drafts.
