# Quizora QA report

Executed 23 November 2026 on the existing Windows workspace. All implementation changes are inside `frontend/` or `backend/`. No existing client users, results, wallet entries or payments were deleted. No production deployment, Atlas login or real card charge was performed.

## Final automated evidence

| Command | Directory | Result |
| --- | --- | --- |
| `npm.cmd test` | backend | **89 passed**, five test files |
| `npm.cmd run test:e2e` | frontend | **12 passed**, Chromium browser journeys |
| `npm.cmd run test:e2e -- --grep 'discovery search\|premium design\|USD/EUR amount'` | frontend | Three targeted journeys passed after the mobile navigation-transition polish |
| `npm.cmd run build` | backend | Passed, TypeScript compilation |
| `npm.cmd run build` | frontend | Passed, TypeScript check and Vite production bundle |
| `npm.cmd run lint` | frontend | Passed with the repository's configured JavaScript lint rules; TypeScript is checked by both builds |
| `npm.cmd audit --omit=dev --json` | backend | Zero reported production vulnerabilities |
| `npm.cmd audit --omit=dev --json` | frontend | Zero reported production vulnerabilities |
| `npm.cmd run check:client` | backend | Passed; 32 frontend source/build text artifacts checked for configured backend credential values and removed payment-simulation labels |
| `node scripts/review.mjs` | frontend | 35 local route/viewport checks; no horizontal document overflow or uncaught page errors |
| `npm.cmd run fx:refresh` with local replica configuration | backend | Actual ECB reference retrieved and cached: 20 November 2026, EUR 1 = USD 1.0990 |

Dependency audits required permitted registry network access; no dependencies were added or upgraded during this audit. Package scripts were extended without changing the dependency tree. The browser framework launches isolated test servers at 5174/4100 and a disposable MongoDB replica; its provider transport and exchange reference are fixtures. These tests never charge a real card or credit the normal application's wallets.

The production frontend main JavaScript chunk is approximately 488 kB before compression. Information pages, Admin and Organizer load separately. The previous over-500-kB main-chunk warning was resolved with route splitting. Production builds succeeded without the chunk-size warning.

## Twelve browser journeys executed

1. Discovery search, server categories, filters, saved collection, mobile drawer and theme controls.
2. Adult signup, five-question scored attempt, correct explanations, history, achievements and settings.
3. Organizer quiz creation/publication, hosted room and a second live participant with server scoring.
4. Admin login, real database statistics, user table, guarded access controls, wallet adjustment, pricing, merchant connection using isolated transport, and analytics.
5. Premium previews, explicit spend confirmation, refresh recovery, included replays and insufficient balance.
6. Public page layouts at 320, 390, 768, 1024 and 1440 px: discovery, store, live, tournaments, pricing alias, Help and How It Works.
7. **EUR 25 / 550 coins under the fixture rate**: hosted-form initiation, signed provider return, independent Inquiry, exactly one credit after repeat verification, and paid quiz entry leaving 525 coins. All provider transport is simulated strictly inside the isolated test executable/browser interception, not available as a product mode.
8. Automatic first-signup guide, saved progress after refresh, practice slider, practice scoring answer, completion without automatic repeat, Help replay and mobile display.
9. Unavailable checkout disables purchase, provides free play, creates no real order/wallet change, and exposes no demo purchase controls.
10. Public instructions, new Mathematics & Logic category, saved quiz outside page one, dashboard resume and early finish. A forced 503 on finish is shown inside the modal and successfully retried.
11. Public recovery/legal/not-found routes; player workspace restrictions; all Admin sections; sign-out/sign-in; URL-driven section selection and browser Back; mobile Admin controls.
12. USD/EUR switching, 10–500 bounds, keyboard range changes, numeric clamping, current reference text, a forced EUR conversion outage, disabled checkout on quote failure, and successful quote retry.

## Backend coverage and data checks

- Authentication: adult eligibility, validation, session hashes, expired/revoked sessions, reset tokens, password recovery behavior, suspended users, role injection rejection, CSRF/origin checks and unauthorized routes.
- Quizzes: ownership, creator/admin CRUD and validation, publication/privacy filtering, immutable attempt snapshots, exact single/multiple/text scoring, duplicate/late answers, replay behavior and recovery after downtime.
- New content: 30 quizzes, 120 unique additional questions, ten categories, Easy/Medium/Hard per category, four valid single-choice questions per quiz, exactly one mapped key, explanations, no duplicate options or prompts, and idempotent seed preservation of edited content.
- Saved library: saved-ID filtering before pagination, empty/invalid ID handling and continued exclusion of private/draft quizzes.
- Dashboard: only owned active attempts, no snapshot/answer keys in the resume summary.
- Economy: append-only ledger, atomic nonnegative balances, concurrent debits, explicit priced consent, entry refunds, entitlements, tournament/event cancellation and reversal holds.
- Payments: signature verification, amount/currency/reference matching, independent Inquiry, duplicate callbacks, retries, refunds/chargebacks, recovery when the browser return is lost, and Admin authorization. These use controlled transport, not actual provider transactions.
- Store: USD amount limits, raised rate, exact EUR allocation, validated/stale/future ECB data rejection, unknown currencies, forged coins/version, EUR order snapshots, concurrency idempotency, old cheap routes retired for new orders, Admin edit confirmation and version conflicts, pending-order preservation after price changes, and fail-closed EUR with working USD during reference outages.
- Review accounts: provisioning refuses the normal database and active payments, creates three roles only in a named isolated review database, preserves repeat-run identities/passwords and creates no financial entries.
- Render configuration: assigned public URL/PORT fallback, explicit custom domain, URL whitespace/slash normalization, production database/HTTPS requirement and secure cross-site cookie configuration.

The normal local API was checked independently: healthy, 38 published platform quizzes, amount limits 10–500, initial rate 20 coins/USD, actual dated EUR reference and real checkout unavailable. $500 quotes 10,000 coins. EUR 25 quotes 549 whole coins at the verified local reference of 1.0990. That differs deliberately from the deterministic browser fixture rate of 1.1, where it quotes 550.

## Issues discovered and resolved

| Finding | Resolution |
| --- | --- |
| Saved collection only filtered one fetched catalogue page | Backend saved-ID filter before pagination; bounded validated local IDs |
| New library would inherit the initial commercial-launch script's broad paid selection | Restrict launch pricing to the original eight seed keys |
| Original new-purchase curve made 10,000 coins too cheap and implied a 40% discount | Replace new purchases with 10–500 USD/EUR budgets, initial 20 coins/USD, no fabricated bulk saving |
| Old checkout endpoints could bypass the new retail price | New legacy-curve/package orders return 410; owned existing snapshots can resume |
| No explicit EUR reference/version in new orders | Validated ECB feed, bounded cache age, versioned EUR quotes and immutable order snapshots |
| Signup guide lacked direct play/scoring practice | Extend the existing guide with a practice answer and updated budget/currency explanation |
| No dashboard action for active solo rounds | Owned resume summaries and direct Continue action |
| Early-finish network failure could become an unhandled rejection | Modal error state, disabled duplicate submit and retry |
| Shared modal Escape could capture an old close callback | Latest callback reference and visible/enabled focus trap |
| Dense Admin tab strip and section/back-state mismatch | Frequent actions plus grouped selector; Admin state derives from the validated URL |
| Old visual identity still resembled the earlier game presentation | New evergreen/ink palette, real featured-quiz hero, amount/currency control panel, receipt summary and responsive layouts |
| Local screenshot script waited for a removed heading | Updated route/viewport script with failure collection and current headings |
| ESLint reported missing Node globals in Vite config | Correct Node/browser globals in its configured file scope |
| Cold deployment could omit build tools under production install | Render build uses `npm ci --include=dev` |
| Backend production log/callback fallback could show localhost | Use Render's external URL fallback and explicit public interface binding |

The original brief requested a customer payment demo. The owner subsequently instructed that nothing demo-like be displayed. Customer simulation screens and related screenshots were removed. Stored seeded example events are omitted from public lists without deleting records. Test transport remains isolated, and the delivered customer product does not pretend to take payment.

## Known limitations and not-tested gates

| Scenario | Status |
| --- | --- |
| Real TransactWorld merchant authentication with valid supplied identity | **Not tested successfully**; actual login/Partner ID or supported API token still missing |
| Genuine provider sandbox checkout or real live card/settlement/refund | **Not tested**; no actual card charge |
| Public provider callback delivery on Render | **Not tested**; services not deployed |
| The user's actual Atlas credentials/cluster/network permissions | **Not tested**; connection string was not committed or copied into the frontend |
| Real SMTP verification/reset email delivery | **Not tested**; requires configured mail provider |
| Physical phones, Safari/Firefox and restrictive third-party-cookie environments | **Not tested**; current browser evidence is desktop Chromium at responsive widths |
| Complete WCAG/screen-reader certification, penetration testing and load testing | **Not performed**; targeted accessibility/security checks do not imply certification |
| Multiple API replicas | **Not supported/verified** for Socket.IO delivery and scheduler coordination; Render configuration uses one instance |
| Local-to-Atlas user/payment data transfer | **Not performed**; startup seed is not a data migration or backup restore |
| Legal/commercial/provider approval of the business terms | **Pending owner/provider review** |

## Approval recommendation and artifacts

**Ready for client design/UX review:** yes. **Ready for functional acceptance testing:** yes, with the external gates above identified. **Ready for production purchases:** no.

Screenshots are in `frontend/artifacts/review/`, including desktop/mobile discovery/store/How It Works, signup tour, results, player Overview, EUR store and Admin payments/analytics. Screenshot accounts and financial examples are isolated test fixtures, not real sales.

Use [CLIENT_DEMO_GUIDE.md](CLIENT_DEMO_GUIDE.md) for the client walkthrough, [CLIENT_APPROVAL_CHECKLIST.md](CLIENT_APPROVAL_CHECKLIST.md) for sign-off, [RENDER_DEPLOYMENT.md](RENDER_DEPLOYMENT.md) for exact hosting variables and [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) for production gates.

Selected factual/contract references reviewed: [ECB reference rate source and publication policy](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html), [BIPM SI base units](https://www.bipm.org/en/measurement-units/si-base-units), [National Archives Magna Carta](https://www.nationalarchives.gov.uk/explore-the-collection/explore-by-time-period/medieval/magna-carta/), [ITTF 2026 laws](https://documents.ittf.sport/sites/default/files/public/2026-02/2026_Statutes_v1_consolidated_clean.pdf), and [TransactWorld merchant identity contract](https://docs.transactworld.com/merchant-api/api-specifications.php). Structural answer-key tests do not replace the client's final editorial review of all question content.
