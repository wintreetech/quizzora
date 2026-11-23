# Coin platform delivery — historical implementation report

This report describes the earlier delivery. The 23 November audit and subsequent changes replace the old new-purchase discount curve with 10–500 USD/EUR amount selection, add the expanded library and prepare Render/Atlas configuration. See [QA_REPORT.md](QA_REPORT.md), [CLIENT_DEMO_GUIDE.md](CLIENT_DEMO_GUIDE.md) and [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for current behavior and evidence.

## Latest update: custom top-ups and first-signup guide

The storefront now uses a **100–10,000 coin slider in 50-coin increments**, with number entry and plus/minus controls. Fixed package cards and the homepage's four fixed amounts were removed. `/store` and `/pricing` open the custom builder. Exact totals, savings and pricing versions come from the backend's Admin-controlled price curve. Custom checkout revalidates quantity, total and version, snapshots the purchase, and preserves one order across retries. Repricing requires fresh confirmation and never rewrites existing orders.

New registrations automatically receive a five-step guide covering discovery, free/premium entries, the slider, explicit confirmation, scoring and wallet history. Progress saves to the account, resumes after refresh and remembers completion or skipping. Help can replay it. Existing accounts are not forced into onboarding. Deferred post-login actions wait for the first guide to finish or be skipped so it cannot consume a timed attempt.

**Admin → Payments → Connect merchant** accepts the actual TransactWorld merchant login and partner ID. It authenticates with the provider before saving non-secret identity fields and an audit record. The settings are bound to the current merchant/environment and loaded on startup; secure keys stay in backend environment configuration and provider tokens stay in memory. Rejected connections do not save. Verified identity uses automatic token exchange instead of an obsolete static token. Actual live checkout remains paused until valid merchant credentials are supplied.

New source: `backend/src/services/coin-quotes.ts`, `backend/src/services/merchant-settings.ts`, `backend/src/coin-purchase.test.ts`, `frontend/src/pages/CoinBuilder.tsx`, `frontend/src/components/OnboardingTour.tsx` and `frontend/src/coin-builder.css`. Account models/views, registration, guide progress, checkout/Admin APIs, startup, Help and browser tests were updated. Ordinary account reads and guide steps no longer exhaust the credential-operation rate limit; general API limits still apply.

Verification: **69 backend tests and 8 browser journeys pass**, including arbitrary slider selection, simulated hosted checkout, independent verification, one coin credit, paid access, tour persistence and merchant connection. Provider transport in browser tests is simulated, not an actual card charge. Both production builds pass.

## Scope and audit

All code, documentation, generated previews and build artifacts are inside the existing `frontend/` and `backend/` folders. The repository root was not changed. The earlier delivery report describes the original free-core milestone; this report supersedes its payment, pricing and design status.

The audit found real cookie-session authentication, organizer quiz editing/import, timed server-scored attempts, private challenges, Socket.IO live rooms, tournaments, leaderboards, history, reports and an existing Super Admin panel. Those features used backend APIs and were reused. Existing plan cards described free hosting and an unavailable future paid plan; the old subscription checkout deliberately returned 503. There was no wallet, coin ledger, package purchase service or merchant configuration in this standalone project. Public content defaulted to free. Small navigation, form and supporting text and the violet dashboard styling needed replacement.

## Implementation and activation classifications

| Feature | Status | Evidence or activation boundary |
| --- | --- | --- |
| Real wallets and append-only hash-chained ledger | COMPLETED AND TESTED | Atomic support credits/debits/target adjustments, unique references, insufficient funds, concurrent spending and immutable entries tested |
| Free, preview-then-paid and paid official quiz attempts | COMPLETED AND TESTED | Server prices, confirmation, preview key exclusion, refresh recovery, repricing, extra purchased attempts, replay and failed-launch refunds covered |
| Owner-approved launch prices | COMPLETED AND TESTED | The owner delegated initial pricing on 30 October; four USD coin plans and six 25/50/75-coin quizzes are published in the existing local database; two introductions remain free |
| Coin store, owned payment history and purchase status | COMPLETED AND TESTED | Actual API data, configured totals, no invented money prices, explicit purchase confirmation and return-to-content flow |
| TransactWorld Standard Checkout, callback verification and Inquiry | IMPLEMENTED BUT NOT VERIFIED END TO END | Provider transport is mocked in automated tests; no live/provider-hosted sandbox charge performed |
| Accepting real coin purchases | REQUIRES PAYMENT CONFIGURATION | Existing member ID/key and USD/EUR configuration were securely reused; live auth returned 30071/30055 because merchant login and partner ID are absent. Supply those or a valid API token and complete provider acceptance |
| Competition entry and tournament pass accounting | COMPLETED AND TESTED | Capacity, one-time entry, all-round entitlements, merchant gating, cancellation and idempotent refunds covered in replica-set tests |
| Activation of paid live competitions/tournaments | BLOCKED BY EXTERNAL APPROVAL | Both paid-event flags remain false until the operator has merchant approval |
| Admin package, pricing, wallet and recovery controls | COMPLETED AND TESTED | Integrated into the existing panel; browser tests exercise support adjustments and reviewed price publishing; verification calls independent Inquiry |
| Real monetary and coin analytics | COMPLETED AND TESTED | Coin use and support adjustments are separate from verified money; revenue grouped by currency, date and reversals |
| Premium visual system and responsive navigation | COMPLETED AND TESTED | Discovery, store, wallet, quiz, live, organizer and admin surfaces updated; mobile drawer, collapsed navigation, themes and viewport checks |
| Original free-core functionality | COMPLETED AND TESTED | Existing account, solo, live host/participant and administration tests retained |

Time-limited access passes, paid organizer hosting and recurring subscriptions are deferred and **not implemented**, as permitted by the brief. They are not advertised as purchasable products.

## Coin products and pricing

The migration initially creates inactive price points. After owner approval, the commercial launch operation published the initial 250/600/1,500/3,500-coin price points. **These now define the server's custom-slider pricing curve rather than fixed customer packages.** Admin controls them; later edits are preserved and checkout snapshots protect existing orders. Hosting remains separate at `/hosting`.

The short five-question catalogue is retained. The owner-approved launch operation published six premium quizzes at 25/50/75 coins and kept cosmic/geography introductions free. Initial migration alone never activates those drafts; explicit owner approval is required. Existing purchased entitlements remain intact. Store access examples derive from current published, available prices and disclose that future prices can change.

Coins are non-redeemable and non-transferable, never expire, and do not affect answer correctness, points, ranking or timers. No monetary prizes, bets, cash-out, withdrawals, schools or classroom features were introduced. Organizer hosting limits remain a separate future commercial phase; player participation coins are not silently repurposed as hosting credits.

## Paid quiz and event lifecycles

Quiz access is quoted by the backend. Paid starts require explicit consent to the current price/version and a stable participation key. A MongoDB transaction deducts coins, appends the linked ledger entry, creates the question/timer snapshot and issues any included attempts. An active attempt resumes without another charge. Reusing a completed request key returns its original attempt. New replays obtain a new quote and confirmation unless an included attempt remains. Price changes never rewrite paid snapshots or remove purchased included attempts.

Previews expose sample prompts and options without correct answers or explanations. Scoring remains server-authorized: 100 points per correct answer, exact-set multiple-choice checks and server deadlines. Returning from checkout or paying more does not alter scoring.

Failed launch recovery first preserves the existing attempt. An administrator can record verified incident evidence and refund a paid, unacknowledged launch with no answers and no consumed bundle attempts. Refunds use the original transaction reference once; expired unlaunched attempts can be reviewed, but acknowledged play, submitted answers and voluntary completion are rejected. Refunded launches expose no review keys.

Competition registration checks eligibility, capacity and current price inside the same transaction as membership and debit. Rejoining the same room does not charge again. Canceled paid events refund each original paid entry once. A tournament pass admits the player into every scheduled round at one disclosed price; rounds cannot separately charge new fees. Canceling a round cancels remaining active rounds and refunds the full pass once. Completed results and original paid records remain historical records.

## Wallet, database and payments

New collections/models: `Wallet`, `WalletTransaction`, `CoinPackage`, `PaymentOrder`, `PaymentEvent`, `Entitlement`, `PricingHistory`, and retained daily `AnalyticsEvent` records. Existing quiz, attempt, participant, competition, tournament and tournament-member models gain pricing/billing references and snapshots. Unique indexes guard journal references, wallet sequence, user purchase keys, active attempts, membership and provider payment IDs.

Financial writes use MongoDB snapshot transactions with majority writes. Wallet balance cannot go negative. Journal records contain sequence, previous hash and entry hash; model middleware rejects updates/deletes of existing ledger records. Database administrators can bypass application middleware, so production database permissions, backups and monitoring remain operational requirements.

The local development database now uses a persistent single-member replica set on port 57017. Bootstrap preserves the existing data directory and repairs old random development member addresses. Startup requires a replica set/Atlas when coins are enabled; it does not quietly fall back to unsafe standalone accounting.

TransactWorld integration details and acceptance steps are in [TRANSACTWORLD.md](TRANSACTWORLD.md). Signed callbacks never directly grant coins. Authenticated Inquiry must match the independent payment evidence; fulfillment and wallet credit occur together. Pending recovery, provider-ID investigations, delayed callback retries and cumulative reversal accounting are implemented. Support grants are audited separately and never manufacture revenue. No card data is stored.

## Administration and analytics

The same role-guarded Admin workspace now includes dashboard, users, wallets/coins, packages, quiz management, question bank, category counts, pricing, competitions, tournaments, organizers, payments, pending recovery, analytics, audit logs, admin management, hosting plans and settings. Question editing reuses Creator studio. Categories retain the established validated taxonomy; the category view reports actual content counts rather than introducing unconnected category settings.

Support adjustment flow: search account → inspect wallet → choose credit/debit/target → enter reason → preview movement and resulting balance → confirm. The server checks the expected current balance, idempotency key and operator permission, writes the journal and audit atomically and rejects stale previews. User detail shows real wallet history, purchases, solo attempts, event participation and audit records, with a launch-failure review action.

Pricing supports draft/publish, access product, coin price, included attempts, preview count, availability, versions and publication history. Existing room/attempt snapshots remain unchanged. Turning off new entries does not revoke a current active attempt or an already purchased included attempt. Purchase limits include package quantity/amount bounds and a maximum wallet size; there is no separate configurable per-user daily spend policy in this phase.

Analytics show registered/unsuspended/new accounts, purchased and outstanding coins, entry coin use/refunds/reversals, paid entries, gateway order statuses, verified revenue by date/currency, purchased quiz rankings, package rankings and observed conversion/repeat purchasers. Visitors are distinct signed-in accounts within the retained 90-day event window; conversion compares that cohort with actual purchasers/players and is unavailable when there is no data. Revenue is reported in original currencies and is never added across currencies or inferred from coins.

## Design and typography

The final redesign replaces the old cream/green game presentation with cobalt, white and ink, a geometric competition hero, editorial typographic quiz covers and a consistent dark theme. The old illustrated tickets and category cartoons are no longer used on discovery or quiz detail. The homepage features actual coin-plan prices. The dedicated plans page uses clear money prices, quantities, inclusions and explicit confirmation. Wallet/admin views distinguish balances, ledger entries and verified purchases.

Inter/system body and form text use a 16px base; section headings generally 24–32px, page headings 32–44px and desktop heroes 48–72px. Main navigation, buttons and forms use 16px; small decorative metadata is subordinate. Questions and answers have prominent reading sizes. Responsive layouts reflow cards, facts and forms; desktop navigation collapses, mobile navigation uses an accessible drawer with focus/Escape behavior, and workspace navigation changes for player, organizer and admin contexts. Reduced-motion and keyboard focus rules are retained. Third-party web fonts have system fallbacks.

## Source changes and APIs

New backend files: `src/economy-migration.ts`, `src/economy.test.ts`, `src/services/wallet.ts`, `src/services/pricing.ts`, `src/services/transactworld.ts`, `src/services/gateway-token.ts`, `src/routes/economy.ts`, this report and the gateway guide.

Updated backend areas: models, configuration, database bootstrap, startup/reconciliation, authentication wallet creation, attempt lifecycle, competition/tournament billing, API access quotes/previews, admin views, seed plan descriptions, browser fixture, existing test replica setup, `.env.example`, Render configuration, README and API/deployment documentation.

New frontend files: `src/pages/Economy.tsx`, `src/pages/EconomyAdmin.tsx`, `src/components/BrandArtwork.tsx`, `src/identity.css`, `scripts/review.mjs`. Updated discovery, quiz/player/challenge, live/tournament, organizer/admin, layout/navigation, reusable spend confirmation, types/router, styles, favicon, README and browser journeys. Original question data and functional editors were reused. `newRequestKey` uses cryptographic random bytes and also works on HTTP contexts without `crypto.randomUUID`. New backend launch files are `src/commerce-launch.ts` and `src/scripts/launch-products.ts`.

Primary new API groups: `/api/wallet`, `/wallet/history`, `/coin-packages`, `/payments`, `/payments/checkout`, owned `/payments/:id[/verify]`, `/quizzes/:id/access`, `/quizzes/:id/preview`, `/attempts/:id/launched`, `/admin/economy/*`, signed `/payments/transactworld/*`, and admin tournament/category views. Detailed routes are in [API.md](API.md).

## Verification, deployment and external requirements

Automated verification includes the original integrity suite plus new replica-set accounting and gateway tests. Browser checks cover adult registration, free scoring, organizer publishing/live multiplayer, admin controls, premium consent, previews, wallet history, insufficient balance, refresh recovery and included replay. Layout checks cover 320, 390, 768, 1024 and 1440px. Review screenshots are written under `frontend/artifacts/review/`.

Final command results are recorded below after the last validation run. Gateway fixtures are explicitly test data, not proof of merchant acceptance.

- Backend tests: **69 passing**.
- Backend TypeScript build: passing at the integration checkpoint.
- Frontend TypeScript/Vite build: passing at the integration checkpoint; organizer/admin code is split into lazy-loaded chunks.
- Final browser run: **8 passing**, including slider purchase → hosted form → signed return → independent Inquiry → one wallet credit → paid access, plus first-signup guide persistence and replay. Provider transport is simulated only in the isolated fixture. Live merchant authentication returned the missing-login/partner errors; no actual card charge was made.

Start locally with `npm run dev` in each folder. See [backend README](../README.md), [frontend README](../../frontend/README.md), [deployment guide](DEPLOYMENT.md) and the complete [TransactWorld activation sequence](TRANSACTWORLD.md). No deployment or real charge was performed. HTTP loopback development and public HTTPS production are supported; provider traffic always uses HTTPS. Production still needs the missing merchant API credentials, real hosted payment acceptance, HTTPS domains/callbacks and operator policy/support details. Keep future paid prices in draft until reviewed, and keep paid-event switches off until merchant approval.
