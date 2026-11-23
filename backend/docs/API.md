# REST API

Prefix: `/api`. JSON bodies. Errors: `{ "message": "..." }` and appropriate HTTP status. Use credentialed requests and `X-Quizora: 1` for mutations. Sessions are cookies. IDs are MongoDB ObjectIds. No final score is accepted from a client.

## Public and identity

| Method | Path                    | Behavior                                                                             |
| ------ | ----------------------- | ------------------------------------------------------------------------------------ |
| GET    | /health                 | Database readiness                                                                   |
| GET    | /config                 | Categories, configured support contact, announcement, billing state                  |
| GET    | /auth/me                | Current sanitized account, registration policy                                       |
| POST   | /auth/register          | Adult confirmation, validated account; optional organizer under server policy        |
| POST   | /auth/login             | Password verification, session rotation                                              |
| POST   | /auth/logout            | Revoke session                                                                       |
| POST   | /auth/organizer-access  | Enable creator tools under the server self-service policy; no client role assignment |
| PATCH  | /auth/profile           | Own display name, bio, and visibility                                                |
| POST   | /auth/deletion-request  | Audit request and revoke sessions; operator fulfillment required                     |
| POST   | /auth/forgot-password   | Generic response if SMTP configured; no token disclosure                             |
| POST   | /auth/reset-password    | Consume reset token, update password, revoke all sessions                            |
| POST   | /auth/send-verification | Authenticated verification email                                                     |
| POST   | /auth/verify-email      | Consume one-use token                                                                |

## Quiz and player

| Method | Path                  | Behavior                                                                           |
| ------ | --------------------- | ---------------------------------------------------------------------------------- |
| GET    | /quizzes              | Public published discovery; `q`, `category`, `difficulty`, `sort`, `page`, `limit` |
| GET    | /quizzes/:id          | Safe metadata, no answer keys                                                      |
| POST   | /quizzes/:id/attempts | Authorize and start/resume an immutable attempt                                    |
| GET    | /attempts/:id         | Own current question or completed review                                           |
| POST   | /attempts/:id/answer  | `{questionId, selected, text?}`; server validation and scoring                     |
| POST   | /attempts/:id/advance | Synchronize expired questions; cannot skip an open question                        |
| POST   | /attempts/:id/finish  | Finish own attempt; unanswered questions earn zero                                 |
| GET    | /dashboard            | Saved attempts, actual stats, category performance, earned badges                  |
| GET    | /leaderboard          | Rolling `period=week                                                               | month | all`; best result per quiz |
| GET    | /plans                | Plan definitions, billing availability                                             |
| POST   | /billing/checkout     | Safely unavailable (503); no payment collected                                     |
| POST   | /reports              | Authenticated content report                                                       |

## Competitions, challenges, and tournaments

| Method   | Path                     | Behavior                                                                    |
| -------- | ------------------------ | --------------------------------------------------------------------------- |
| GET      | /competitions            | Public room summaries; sample configuration marked explicitly               |
| POST     | /competitions/join       | `{code}`; authorize lobby entry and enforce capacity                        |
| GET      | /competitions/:id        | Safe state, current question, public-name standings                         |
| POST     | /competitions/:id/answer | Unique server-timed response for joined participant                         |
| GET/POST | /challenges              | Own invitations / create expiring invitation with `{quizId}`                |
| GET      | /challenges/:code        | Invitation and participant-only result comparison                           |
| POST     | /challenges/:code/accept | Atomically claim one rival place before expiry                              |
| POST     | /challenges/:code/play   | Bind and start/retrieve the user’s single challenge attempt                 |
| GET/POST | /tournaments             | Public discovery / organizer creation                                       |
| GET      | /tournaments/:id         | Rounds and derived standings; private access requires invitation/membership |
| POST     | /tournaments/:id/join    | Register and join all rounds before registration closes                     |

Tournament creation takes title, description, public/private visibility, capacity, registration close timestamp, and 2–5 `{quizId, startsAt}` rounds. Round times must increase after registration closes. Hosts explicitly start live rounds.

## Organizer

All paths require ORGANIZER or SUPER_ADMIN, plus owner checks where applicable.

| Method   | Path                                |
| -------- | ----------------------------------- |
| GET      | /organizer/overview                 |
| GET/POST | /organizer/quizzes                  |
| GET/PUT  | /organizer/quizzes/:id              |
| POST     | /organizer/quizzes/:id/duplicate    |
| POST     | /organizer/validate-questions       |
| POST     | /organizer/competitions             |
| POST     | /organizer/competitions/:id/control |
| POST     | /organizer/competitions/:id/remove  |
| GET      | /organizer/competitions/:id/export  |

Control actions: `start`, `pause`, `resume`, `end`, `cancel`. Removal requires user ID and a recorded reason. CSV exports escape spreadsheet formula prefixes. Quiz updates validate every question and increment the version. Existing attempts and rooms retain their original snapshot.

## Super administrator

| Method    | Path                 | Purpose                                                         |
| --------- | -------------------- | --------------------------------------------------------------- |
| GET       | /admin/overview      | Actual platform counts                                          |
| GET/PATCH | /admin/users[/:id]   | Search / role and suspension changes with explicit confirmation |
| GET/PATCH | /admin/quizzes[/:id] | Content review / publication change with reason                 |
| GET       | /admin/competitions  | All room metadata                                               |
| GET/PATCH | /admin/reports[/:id] | Review / resolve / dismiss reports                              |
| GET       | /admin/audit         | Latest 100 administrative/action records                        |
| GET/PATCH | /admin/plans[/:id]   | Plan definitions and allowed limits                             |
| GET/PUT   | /admin/settings      | Public contact and announcement                                 |

Admin user changes revoke all target sessions. Self-demotion/suspension is rejected. User emails are accessible only through authorized account/admin APIs, never public leaderboards.

## Coin purchases and paid access

All paths below have `/api` prefixed. Normal mutations require an authenticated cookie, `X-Quizora: 1`, and the configured origin. Gateway callbacks instead verify the provider signature and independently inquire about the payment.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /coin-packages | Published package quantities/prices, checkout readiness and actual access examples |
| GET | /wallet, /wallet/history?page=1 | Owned balance, reversal hold, totals and paginated immutable journal |
| GET | /payments, /payments/:id | Owned purchase history and current status |
| POST | /payments/checkout | Confirm package/version/amount/currency/quantity; authenticate merchant API; create immutable pending order and signed hosted form |
| POST | /payments/:id/verify | Independently verify owned order by provider ID or merchant order reference, fulfill once |
| POST | /payments/transactworld/notify/:ref | Signed provider notification and independent Inquiry |
| GET/POST | /payments/transactworld/return/:ref | GET redirects only; signed POST records payment then verifies it |
| GET | /quizzes/:id/access, /quizzes/:id/preview | Authoritative charge/entitlements; unscored samples with no answer keys |
| POST | /attempts/:id/launched | Record successful launch acknowledgement for recovery eligibility |
| POST | /analytics/event | Deduplicated signed-in store/premium views |

Paid quiz starts and competition/tournament joins require `{confirmed:true,coinPrice,pricingVersion,requestKey}`. Prices are compared with the current backend version; these fields are consent, never pricing authority. Active attempts and purchased included replays require no new charge. Checkout requires `{packageId,confirmed:true,packageVersion,amountMinor,currency,coins,requestKey}`. Amounts use integer minor units and two-decimal supported merchant currencies.

### Super Admin economy routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /admin/economy/wallets?q=, /admin/economy/users/:id | Account search, real wallet and financial/participation detail |
| POST | /admin/economy/wallets/:id/adjust | Credit/debit/target through an audited journal entry; requires expected balance, expected reversal hold, reason, stable key and explicit confirmation |
| GET/POST/PUT | /admin/economy/packages[/:id] | Package management and publication |
| GET/PUT | /admin/economy/pricing/:kind[/:id] | Quiz/competition/tournament price drafts and publication |
| GET | /admin/economy/pricing/:kind/:id/history | Immutable published price versions |
| POST | /admin/economy/attempts/:id/refund | Verified failed-launch coin recovery with incident evidence |
| GET | /admin/economy/payments | Order records and non-secret gateway readiness issues |
| POST | /admin/economy/payments/:id/verify | Audited independent Inquiry; optional provider ID from merchant records |
| POST | /admin/economy/gateway/check | Verify merchant API authentication without charging a card |
| GET | /admin/economy/analytics | Actual coins, monetary revenue by currency/date, purchases and conversion |
| GET | /admin/tournaments, /admin/categories | Platform tournament list and validated category usage |

User search additionally accepts `group=organizers` or `group=admins`. Recurring hosting checkout `/billing/checkout` remains unavailable; one-time coin purchases use `/payments/checkout`.

## Amount-based USD/EUR store and first-signup guide

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /coin-purchase/options | Versioned coin rate, 10–500 amount bounds/step, USD/EUR quote/payment availability and dated FX reference |
| GET | /coin-purchase/quote?amountMinor=2500&currency=EUR | Server-calculated whole-coin allocation, amount/currency, version, conversion and product reference |
| POST | /coin-purchase/checkout | Current checkout with `{purchaseKind:"budget",confirmed:true,coins,currency,amountMinor,pricingVersion,requestKey}`; server revalidates everything |
| PATCH | /auth/onboarding | Owned progress: `{version:1,step:0..4,status:"in_progress"|"completed"|"skipped"}` |
| POST | /admin/economy/gateway/connect | Admin connection: `{merchantUsername,partnerId,reason,confirmed:true}`; provider verification precedes saving non-secret identity |
| GET/PUT | /admin/economy/store-pricing | Super Admin retail configuration; PUT needs `{coinsPerUsd,expectedVersion,confirmed:true,reason}` and writes an audit entry |

The current store accepts 10–500 whole units of USD/EUR and defaults to 20 coins per USD. EUR allocations use the dated ECB reference, scaled integer arithmetic and rounding down to whole coins. References refresh every six hours and must be no older than seven calendar days, accommodating weekends/holidays; unavailable/stale EUR fails closed while USD remains available. The dated reference is for retail allocation and informational equivalents, not a guaranteed bank or merchant settlement exchange rate. New package/old-curve purchases return 410; existing owned orders can resume under their original snapshots. Stable keys prevent duplicate orders, and no coins are credited until independent gateway success. Guide status remains account-owned with manual Help replay.
