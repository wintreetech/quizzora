# Quizora implementation report

Delivered on 29 October 2026. All source, configuration, dependencies, documentation, runtime data, and local test artifacts are contained in the existing `frontend/` and `backend/` folders. The project root contains only those two folders. No deployment, publication, remote repository, payment charge, or external message was created.

## Product and design

Quizora is a working free/core MVP for adults aged 18 and above. The interface uses an ivory canvas, violet accents, warm editorial typography, original code-native category illustrations, a responsive sidebar, focused quiz screens, live-room controls, and light/dark appearance. Registration includes explicit adult eligibility and policy agreement. The content covers adult general knowledge, science, technology, entertainment, geography, history, sports, and business. No school or child-oriented product flows are included.

The app is independent of any other gaming project. Scores, participants, dashboards, and leaderboards are backed by MongoDB. The seed contains eight original quizzes with forty questions and explanations. The public sample competition is labeled as a sample; it has no invented live activity or fabricated players.

## Feature classification

| Area                          | Classification                          | Delivered behavior and limits                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity                      | COMPLETED AND TESTED                    | Adult registration, login/logout, scrypt passwords, opaque HttpOnly cookies, session revocation, roles, CSRF checks, profile updates, visibility, deletion requests                                                                                         |
| Discovery                     | COMPLETED AND TESTED                    | Search, category/difficulty filters, stable sorts, server pagination, safe details, local saved-quiz collection                                                                                                                                             |
| Quiz engine                   | COMPLETED AND TESTED                    | Immutable versions, authorized attempts, server deadlines, scheduler-driven expiry, unique answers, server scoring, saved results, completed answer review                                                                                                  |
| Question formats              | COMPLETED AND TESTED                    | Single/multiple exact-set scoring and text normalization covered by integrity tests; true/false and image validation implemented through the same choice engine                                                                                             |
| Player experience             | COMPLETED AND TESTED                    | Actual attempt history, accuracy chart, category performance, earned achievement rules, public weekly/monthly/all-time best-result rankings, settings and appearance                                                                                        |
| Organizer core                | COMPLETED AND TESTED                    | Server-authorized creator access, validated drafts/publishing, owner isolation, versioning, question bank, quiz builder, duplicate flow, host creation and results export                                                                                   |
| CSV and preview               | IMPLEMENTED BUT NEEDS LIVE VERIFICATION | Local quoted-field CSV parsing, server question validation, bulk import and host-only preview provided; not every import/file edge case is covered by browser tests                                                                                         |
| Live competition core         | COMPLETED AND TESTED                    | Codes, membership/capacity, shared locks, timed rounds, pause/resume/end/cancel, authenticated sockets, reconnect synchronization, REST recovery, immutable responses, deterministic standings                                                              |
| Restart recovery              | COMPLETED AND TESTED                    | Expired schedules catch up from persisted deadlines; interrupted finalization rebuilds points from the response ledger without double counting                                                                                                              |
| Participant removal           | IMPLEMENTED BUT NEEDS LIVE VERIFICATION | Audited host removal API, revoked submission access and socket membership; dedicated host removal UI is a later refinement                                                                                                                                  |
| Admin core console            | COMPLETED AND TESTED                    | Protected overview, user search, roles, suspension/reactivation, publication moderation, competition inspection, reports, audit records, plan limits, public settings                                                                                       |
| Friend challenges             | COMPLETED AND TESTED                    | Expiring shareable invitations, one accepted rival, user-bound attempts, result comparison, takeover and expiry rejection; direct link invitation without contacts access                                                                                   |
| Multi-round tournaments       | COMPLETED AND TESTED                    | Creation, future registration window, 2–5 sequentially scheduled rounds, public/private invitations, bounded registration, membership in each round, verified completed-round aggregation                                                                   |
| Email recovery/verification   | IMPLEMENTED BUT NEEDS LIVE VERIFICATION | Hashed expiring one-use tokens and Nodemailer transport; token replay and unconfigured transport errors tested; delivery needs real SMTP configuration                                                                                                      |
| Billing safeguards            | COMPLETED AND TESTED                    | Plan definitions/limits are server-controlled; checkout returns unavailable; startup rejects BILLING_ENABLED=true; no payment collection                                                                                                                    |
| Merchant billing              | BLOCKED BY EXTERNAL INTEGRATION         | Provider, merchant country/currency, pricing, recurring/prepaid model and operational approval still needed before payment orders, signed webhooks, subscriptions or refunds can be implemented                                                             |
| Hosting                       | REQUIRES CONFIGURATION                  | Atlas, HTTPS domains, Render/Netlify projects, environment values, email/support contact, operator-specific policies and first administrator                                                                                                                |
| Deployment assets             | IMPLEMENTED BUT NEEDS LIVE VERIFICATION | Production builds, health endpoint, Dockerfile, Netlify fallback/security headers, Render reference; Docker and hosted WebSocket/cookie behavior not exercised on external hosts                                                                            |
| Extended platform features    | FUTURE PHASE                            | Team/organization tenancy, scoped moderator assignments, editable category catalogue, full administrative detail/history screens, daily and quiz-specific ranking views, notification/reminder delivery, advanced analytics and all-volume admin pagination |
| Advanced competition features | FUTURE PHASE                            | Brackets, challenge rematch orchestration, automatic scheduled starts, media upload/storage, formal score-correction workflow, comprehensive tournament cancellation/rescheduling, distributed coordination and load-tested capacity                        |

## Architecture and repository structure

The frontend is React/TypeScript with Vite, React Router and TanStack Query. The backend is one Express/TypeScript service with Mongoose, Zod and Socket.IO. Runtime state and answer keys stay on the backend. The two folders are independently installable; no root workspace files are required.

```text
frontend/
  src/components/       Layout, quiz cards, original SVG artwork
  src/pages/            Discover, Quiz, Live, Player, Organizer, Admin, Tournaments, Info
  src/lib.tsx           API, auth context, accessible dialogs and UI helpers
  src/types.ts          Public view contracts
  src/main.tsx          Routes and query client
  src/styles.css        Product surfaces and foundational styles
  src/responsive.css    Responsive, management, readability, dark styles
  tests/                Playwright journeys and test-fixture teardown
  scripts/              Local visual/overflow verification
  public/favicon.svg
  package.json / package-lock.json / tsconfig.json / vite.config.js
  playwright.config.ts / netlify.toml / .env.example / .gitignore / README.md
backend/
  src/routes/           Public/player, auth, organizer, admin, tournament APIs
  src/services/         Authoritative attempts and live competitions
  src/shared/           Validated schemas and category/role contracts
  src/scripts/          Admin provisioning, repeatable seed, isolated browser fixture
  src/platform.test.ts  Isolated MongoDB integration tests
  src/models.ts         Mongoose collections and indexes
  src/auth.ts           Sessions and permission middleware
  src/realtime.ts       Authenticated room subscriptions and state broadcast
  src/app.ts / index.ts / config.ts / database.ts / mail.ts / seed.ts / utils.ts
  docs/                 Architecture, API, fairness, deployment and this report
  package.json / package-lock.json / tsconfig.json / .env.example / .gitignore
  Dockerfile / .dockerignore / render.yaml / README.md
```

The original frontend package/configuration and HTML entry were updated. Starter JSX entry/components/styles were replaced with TypeScript application modules. Existing unused starter asset files were left intact. Runtime and generated build/test files are ignored.

## Models and endpoints

Identity: User, Session, AuthToken. Quizzes: Quiz, Attempt. Live events: Competition, Participant, Response. Social competition: Challenge, Tournament, TournamentMember. Platform: Plan, Report, Audit, Settings.

The [architecture document](ARCHITECTURE.md) describes indexes, ownership and concurrency. The [API reference](API.md) lists account, quiz, attempt, dashboard, leaderboard, organizer, competition, challenge, tournament, report and admin endpoints. The [competition guide](COMPETITIONS.md) describes timers, state transitions, reconnection and scoring.

There is no client-side administrator switch, public admin signup, default administrator password, localStorage authentication secret, score-submission API, or silent score-editing tool. Public leaderboards exclude email addresses and private profiles. Admin role changes revoke existing target sessions and record an audit entry.

## Scoring and ranking

Every correct answer earns 100 points. Incorrect/unanswered answers earn zero. Multiple-answer questions require the exact unique correct set. Text matching is explicitly normalized, without fuzzy scoring. Timing is based on server observation, with no speed bonus or network-latency compensation.

Room ranking uses score, correct answers, eligible response time, then stable user ID. Unanswered played questions use their full timer in finalized tie-break time. Public solo rankings count one best result per quiz per user in the selected window. Tournament standings sum verified completed-round results.

## Verification results

| Check                                                     | Result                                               |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Backend TypeScript production build                       | PASS                                                 |
| Frontend TypeScript + Vite production build               | PASS                                                 |
| Isolated MongoDB integration/integrity suite              | 30 tests PASS                                        |
| Isolated Chrome/Playwright journeys                       | 4 tests PASS                                         |
| Discovery layout at 320, 390, 768, 1024, 1280, 1440 px    | No document horizontal overflow; 8 quiz cards loaded |
| Browser runtime errors during responsive discovery checks | None                                                 |
| Production dependency audits in both folders              | 0 reported vulnerabilities at delivery               |

Browser journeys cover search and category reset, bookmarks, mobile drawer/Escape, adult registration, a complete perfectly scored quiz with explanations, dashboard history, achievements, theme/profile changes, publishing a new quiz, hosting and playing with two browser accounts, live final standings, and protected admin sign-in/tables. Test accounts and browser-fixture databases are isolated and ephemeral.

Integration checks additionally cover bad credentials, role injection, CSRF/origin checks, reset-token replay, owner isolation, invalid questions, hidden answer keys, concurrent attempts, snapshots, duplicate answers, late answers, timer expiry without browser participation, best-result de-duplication, room-capacity races, invalid host transitions, response replay, private room access, CSV export permissions, socket reconnect, invitation takeover/expiry, tournament membership, audited suspension, disabled billing, zero plan limits, finalization recovery and schedule catch-up.

No real email delivery, real payment, hosted deployment, Docker image build, formal accessibility conformance audit, load test, or separate fresh-clone rehearsal was performed. Both dependency installations and production builds succeeded from the supplied folders. Trivia content is original and has deterministic answer keys/explanations; commercial editorial review remains an operator task.

## Local use and first administrator

Run `npm ci` and `npm run dev` separately inside each folder. Frontend: http://localhost:5173. API: http://localhost:4000. Development can use the real persisted embedded MongoDB automatically; production requires configured external MongoDB. See the [backend setup guide](../README.md) and [frontend setup guide](../../frontend/README.md).

Provision an administrator only through `npm run admin` inside backend with privately supplied ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_NAME and ADMIN_PASSWORD environment values. Stop the embedded-development API first to avoid sharing its MongoDB data directory. The command is provided but must be run by the operator against the intended database; no administrator credentials were installed for this delivery.

## Production boundaries and remaining work

Use one always-on API instance. In-process locks are designed for one writer; adding a Socket.IO adapter alone does not provide multi-instance consistency. Tournament creation/registration and challenge association use idempotent/compensating writes, with multi-document transactional hardening left for a replica-set deployment. Completed room results have a recovery flag and are reconciled from responses after interrupted finalization.

Configure SMTP, Atlas/network access/backups, HTTPS sibling domains, support identity, final policy text, deletion fulfillment/retention and hosting before public launch. Docker and actual hosted cookie/WebSocket behavior require verification. Set merchant billing aside until provider and pricing are confirmed; no production billing implementation is claimed.

The source is structured for a GitHub repository and includes lockfiles and nested ignore rules. No remote was created and no credentials, local databases, node_modules, test artifacts or compiled output should be committed. Follow [deployment preparation](DEPLOYMENT.md) when authorized to deploy.

## Technical references

Implementation choices were checked against the official [Express 5 migration documentation](https://expressjs.com/en/guide/migrating-5/), [Socket.IO middleware guide](https://socket.io/docs/v4/middlewares/), and [Socket.IO server API](https://socket.io/docs/v4/server-api/). These references inform the framework behavior; the test results above come from local execution.
