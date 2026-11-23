# Architecture

The two existing folders are the complete source boundary. Each is independently installable. The frontend uses React, TypeScript, Vite, React Router, TanStack Query, and CSS. The backend uses Express 5, TypeScript, Zod, Mongoose, and Socket.IO. No other application backend is involved.

## Backend structure

`config.ts` validates environment; `database.ts` manages MongoDB; `models.ts` defines collections and indexes; `auth.ts` handles sessions and role middleware; `routes/` contains REST modules; `services/` owns attempts and competitions; `realtime.ts` authenticates sockets and broadcasts sanitized state; `shared/schemas.ts` owns validated server contracts; `scripts/` provides explicit admin and seed commands. `platform.test.ts` runs against an isolated database.

## Stored models

| Model            | Purpose and integrity                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| User             | Unique email and username; scrypt password hash; server role; age confirmation; privacy; suspension and deletion request   |
| Session          | Unique hashed opaque session token; seven-day expiry with TTL index; revocable server-side                                 |
| AuthToken        | Hashed, expiring, one-use password-reset and verification tokens                                                           |
| Quiz             | Bounded validated questions; visibility/publication; owner; incrementing version; unique slug                              |
| Attempt          | Immutable question/version snapshot; server deadlines; bounded responses; unique active user/quiz pair; saved final result |
| Competition      | Immutable question snapshot; host; unique room code; state, sequence, deadline; capacity                                   |
| Participant      | Unique competition/user membership and derived verified scores                                                             |
| Response         | Unique competition/user/question response; authoritative elapsed time and correctness                                      |
| Challenge        | Random shareable invitation; expiry; one accepted rival; server-bound attempt references                                   |
| Tournament       | Two to five sequentially scheduled live rounds and registration deadline                                                   |
| TournamentMember | Unique tournament/user registration; standings derived from completed rounds                                               |
| Plan             | Configurable names, quiz limits, participant limits; billing disabled                                                      |
| Report           | Content report and moderation status                                                                                       |
| Audit            | Account, host, publication, moderation, role, plan, and settings actions                                                   |
| Settings         | Public support email and announcement; no infrastructure secrets                                                           |

Questions are embedded in bounded quiz/version snapshots, not spread into needless collections. Competition responses and memberships use separate indexed collections. The coin economy adds Wallet, WalletTransaction, CoinPackage, PaymentOrder, PaymentEvent, Entitlement, PricingHistory and AnalyticsEvent models. Financial writes use replica-set transactions and unique references. Organization, subscription and invoice collections are not created for deferred behavior. See [the current coin platform report](COIN_PLATFORM_DELIVERY.md).

## Authorization

Registration cannot accept a client-supplied administrator role or verified-email flag. Organizer registration is allowed only under the server environment policy. All protected endpoints load an unexpired hashed session, re-read the current user and suspension state, and authorize the server role. Ownership filters isolate organizer content. `MODERATOR` is reserved; assigned moderation scope is a future extension. Super-admin APIs are protected separately.

Passwords use scrypt with per-account random salts. Cookies are HttpOnly, Secure in production, and explicitly SameSite. Mutations require an allowlisted Origin when supplied and a custom header, preventing cross-origin simple-request CSRF; CORS allows only the configured app origin. Request bodies, rate limits, and validation constrain inputs. React renders user content as text; no raw HTML insertion is used. Auth secrets are never written to localStorage.

## Single-instance consistency

The supported deployment is one Node process per database, with an in-process keyed queue around attempts and room transitions, optimistic document versioning, and MongoDB unique indexes. All room joins, submissions, and controls share a competition lock. Duplicate responses cannot double-count. Participation scores can be rebuilt from immutable response rows, including on finalization. This design intentionally avoids requiring multi-document transactions for the initial single-writer setup.

Crash points across multiple writes remain a production hardening concern, especially tournament creation/registration and challenge attempt association. Tournament creation performs compensating cleanup; registration is idempotent but not a multi-document transaction. A replica set plus transactional services and a durable event outbox should be introduced before multi-instance or strict financial workflows. Do not run multiple API writers against this design.

## Database setup and evolution

Seed version 1 uses unique `seedKey` values and `$setOnInsert` so it is repeatable and does not overwrite users, edits, results, or settings. Mongoose declares unique, discovery, ownership, and ranking indexes. Production operators should review and apply index changes during controlled releases; no destructive schema migration is performed at startup. Version snapshots protect existing attempts when quizzes change.
