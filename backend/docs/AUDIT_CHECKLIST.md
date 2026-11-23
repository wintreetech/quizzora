# Quizora implementation audit

Updated 23 November 2026. Scope: existing `frontend/` and `backend/` only. Preserve existing users, quizzes, purchases, results and ledger entries.

## Priority 1 — trust, accounting and data

- [x] Inspect authentication, role checks, CSRF/origin validation, session expiry and rate limits.
- [x] Inspect server scoring, immutable attempt snapshots, replay consent and deadline enforcement.
- [x] Inspect atomic ledger writes, duplicate payment prevention, callback signatures, Inquiry, reversal holds and reconciliation.
- [x] Keep unverified merchant checkout unavailable. Do not invent credentials or mark orders paid.
- [x] Replace new purchases with server-authoritative 10–500 USD/EUR amount quotes and a raised 20-coins-per-USD initial rate; preserve agreed existing orders and stale-price protection.
- [x] Restrict the old commercial launch script to its eight original seed identifiers; additional library quizzes remain free unless explicitly repriced by an administrator.
- [x] Add an account provisioning command that refuses production, enabled payments and the regular database, and preserves existing accounts on repeat runs.

## Priority 2 — player journeys

- [x] Make free play the landing page's main action.
- [x] Explain choose → play → improve, points versus coins, badges, and private challenges.
- [x] Add a public How Quizora Works page linked from Help and the footer.
- [x] Extend the existing five-panel signup guide to cover finding quizzes, play, scoring, coins, results/progress and Help, with an interactive practice answer.
- [x] Preserve saved guide progress, skip/completion and manual replay.
- [x] Fix saved quizzes outside the first catalogue page by filtering saved IDs on the server before pagination.
- [x] Validate local saved IDs and cap the collection at 200, with a clear limit message.
- [x] Expose owned active attempts in Overview without answer keys and provide a resume action.
- [x] Show real wallet balance beside progress and explain that playing awards points/badges, not spendable coins.
- [x] Handle early-finish request failure within the confirmation modal and allow retry.
- [x] Correct shared modal Escape handling to use the latest close action and trap focus among visible enabled controls.

## Priority 3 — content, navigation and presentation

- [x] Add 30 idempotently seeded quizzes, 120 original questions, ten categories and three levels per category.
- [x] Reject duplicate single-choice answer labels, including case/whitespace duplicates.
- [x] Populate discovery filters from backend categories, including Mathematics & Logic and Brain Teasers.
- [x] Group Admin tools into a section picker with four frequent actions; retain role isolation.
- [x] Make the Admin section follow the URL and validate unknown section names.
- [x] Save Creator section changes in the URL for browser navigation.
- [x] Improve the merchant form's instructions without putting secrets in the browser.
- [x] Add responsive How It Works, Overview and Admin layouts, keyboard focus styles and reduced-motion support; replace the earlier hero/store with the evergreen/ink identity and amount-based store.
- [x] Split information routes into a separate build chunk; fix the Node globals in the existing ESLint config.
- [x] Repair the stale heading assertion in the local screenshot script.

## Client instruction superseding the original brief

The owner subsequently requested that no demo experience be displayed for client submission. Customer payment simulations, demo labels and demo links were removed. The unavailable store shows a disabled purchase action and a link to free quizzes. Seeded sample events are excluded from public competition lists without deleting stored events. Automated payment transport fixtures remain confined to isolated tests; they are not a product mode.

## External acceptance gates

- [ ] Obtain actual TransactWorld merchant API login and Partner ID (or a valid supported API token).
- [ ] Execute real provider authentication, merchant/currency approval and full sandbox/live financial acceptance.
- [ ] Deploy public HTTPS callbacks and validate notifications, return URLs and reconciliation there.
- [ ] Configure and deliver real verification/recovery mail; confirm the public support contact.
- [ ] Complete client design, functional, legal and operational acceptance. See the separate approval checklist.
