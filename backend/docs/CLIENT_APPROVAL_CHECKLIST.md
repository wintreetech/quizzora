# Client approval checklist

Prepared 23 November 2026. Engineering verification is evidence for review; it does not substitute for client sign-off.

| Area | Engineering state | Client acceptance |
| --- | --- | --- |
| Midnight/blue player workspace, progress hero, category artwork, discovery and wallet sidebar | Implemented; desktop/mobile screenshots available | Pending client review |
| Complete All catalogue: 38 published / 12 free / 26 paid, full ID/page comparison and combined filters | Integration and browser coverage | Pending |
| Explicit pricing, invalid-price review, preserved Admin prices, versioned edits | Integration and browser coverage | Pending |
| Admin create/category/publish/unpublish/search/access filters and counts | Integration and browser coverage | Pending |
| Clear free-play action, categories and three-step explanation | Implemented and browser tested | Pending |
| Public How Quizora Works page, Help and footer links | Implemented and browser tested | Pending |
| Signup, login, profile, sessions and logout | Automated integration/browser coverage | Pending |
| Existing onboarding: saved progress, skip, completion, replay, keyboard/modal behavior | Automated coverage, mobile review | Pending |
| Expanded content: 30 quizzes / 120 questions / ten categories / three levels each | Seed validation, uniqueness and data-preservation tests | Pending content review |
| Server scoring, timing, exact multi-answer keys and explanation review | Automated coverage | Pending |
| Dashboard, paginated My Activity, accuracy trend, active-round resume and earned badges | Implemented and browser tested | Pending |
| Coins, wallet history, explicit paid consent and insufficient balance | Automated coverage | Pending |
| 10-500 USD/EUR amount slider, dated conversion and server coin allocation | Automated coverage | Pending retail rate approval |
| No customer-facing payment simulation or demo labels | Removed per subsequent owner instruction; regression check | Pending |
| Merchant connection form and role restrictions | Automated provider-transport fixtures; genuine credentials still missing | **External blocker** |
| Successful actual provider payment, callback delivery, wallet credit and settlement | **Not tested with a real merchant** | **Blocked** |
| Admin content/users/economy/payments/reporting and grouped navigation | Automated integration and browser coverage | Pending |
| Organizer quiz authoring, publication and live room | Automated integration/browser coverage | Pending |
| Mobile, tablet and desktop layout | Chromium checks at 320, 390, 768, 1024 and 1440 px | Pending physical-device review |
| Build/type checks and production dependency audit | Passed at delivery; see QA report | Review environment and versions |
| Accessible controls, focus handling and reduced motion | Implemented and targeted keyboard/layout checks | Full screen-reader/contrast audit pending |
| Public HTTPS hosting and provider callbacks | Configuration prepared; not deployed | **Blocked** |
| SMTP delivery, support contact, legal wording, backups and operations | Require environment/owner approval and operational tests | **Blocked for production approval** |

## Approval recommendation

- Ready for client design/UX review: **Yes**.
- Ready for functional acceptance testing: **Yes**, for the implemented local flows; external payment and mail acceptance remain separate.
- Ready for production deployment with real purchases: **No**.

## Sign-off record

Client/reviewer: ____________________

Date: ____________________

Approved scope: ____________________

Requested changes: ____________________

Payment/operations acceptance reference: ____________________
