# TransactWorld coin purchases

This standalone quiz application implements TransactWorld Standard Checkout, signed browser returns and notifications, merchant API authentication, and server-side Inquiry. The protocol was adapted from the user's previous implementation. At the owner's request, the existing merchant member ID/key and supported USD/EUR configuration were securely copied into this backend's ignored `.env`; no secret was printed or put in client code. Accounts, orders and databases remain separate.

## Current activation state

The code is integrated and covered by transport, callback, accounting and full browser checkout tests. **No actual card payment has been performed.** A real live auth request reached TransactWorld and returned codes `30071 | 30055`: the merchant login name is missing and the partner ID is missing or misconfigured. Neither exists in the previous app's environment. `TW_MERCHANT_USERNAME` and `TW_PARTNER_ID`, or a valid `TW_AUTH_TOKEN`, must be supplied. Checkout authenticates the merchant before creating a hosted payment order and rejects incomplete/failed setup without taking payment. USD 2.99/5.99/12.99/24.99 launch plans are published locally with owner approval. Automated provider tests use fake credentials/transport and never charge a card.

## Merchant configuration

Customers now choose a custom quantity on a slider. Original package values remain backend price points, not fixed storefront cards. `/coin-purchase/checkout` uses the same hosted form and independently verified fulfillment.

Enter the missing merchant login and partner ID at **Admin → Payments → Connect merchant → Verify and connect merchant**. The server authenticates with TransactWorld before persisting these non-secret fields. Rejected values leave the prior setup untouched. Saved identity is bound to the current member ID and sandbox/live environment, is loaded on startup and is audited. Secure keys remain in backend environment settings; tokens remain in memory. Environment configuration or a valid backend `TW_AUTH_TOKEN` remains an alternative. No actual card charge has been performed.

Configure these only in the backend environment or hosting secret manager:

| Variable | Purpose |
| --- | --- |
| `PAYMENTS_ENABLED` | `true` permits checkout when every readiness check passes; default `false` |
| `TW_ENVIRONMENT` | `sandbox` initially; `live` only after merchant acceptance |
| `MEMBER_ID` | Merchant-issued member ID |
| `WORKING_KEY` | Merchant-issued checkout/signing and API secret |
| `TW_MERCHANT_USERNAME` | Merchant login name required by the real token API |
| `TW_PARTNER_ID` | Merchant's provider-issued partner ID required by the real token API |
| `TW_SUPPORTED_CURRENCIES` | Explicit merchant-approved currency codes, comma separated; no default |
| `API_PUBLIC_URL` | Public HTTPS API origin, without `/api` or trailing slash |
| `APP_ORIGIN` | Public frontend origin; use HTTPS in production |
| `TO_TYPE` | Merchant checkout type; default `Transactworld` |
| `LANGUAGE` | Default `ENG` |
| `PAYMENT_MODE` / `PAYMENT_BRAND` | Default `CC` / `VISA`; match the merchant's enabled methods |
| `TW_AUTH_TOKEN` | Optional operator-supplied API token; normally blank to use automatic token exchange |
| `TW_ALLOW_LOCAL_CHECKOUT` | Explicit loopback HTTP/HTTPS development checkout; cannot relax production HTTPS requirements |

The current money adapter supports exact two-decimal currencies. Configure only currencies that the merchant has approved and the operator has verified for this account. Package amounts are stored in integer minor units. Set each package's complete payable amount, including any required taxes or merchant fees; the application adds no undisclosed fee.

Coin flags are separate from merchant checkout: `COIN_SYSTEM_ENABLED=true`, `PAID_QUIZZES_ENABLED=true`. Keep `BILLING_ENABLED=false`: recurring subscriptions are not implemented. Paid events require **both** `PAID_COMPETITIONS_ENABLED=true` and `PAID_EVENTS_MERCHANT_APPROVED=true`. Those switches are false by default; enabling payments alone does not approve paid live events.

## Provider protocol

- Sandbox checkout: `https://sandbox.transactworld.com/transaction/Checkout`.
- Live checkout: `https://secure.transactworld.com/transaction/Checkout`.
- The frontend submits a hosted POST form using only backend-signed fields. It never receives the working key or API token. Cards and CVV stay on the provider's hosted page.
- Request signature: MD5 of `memberId|totype|amount|merchantTransactionId|merchantRedirectUrl|workingKey`, as required by this provider's existing integration.
- Hosted return signature: MD5 of `paymentId|merchantTransactionId|amount|status|workingKey`, using the full status.
- Notification signature uses the short `transactionStatus` in the same signature format. A short `Y` alone never fulfills coins.
- API token: POST `/transactionServices/REST/v1/authToken` with URL-encoded `authentication.memberId`, `authentication.sKey`, configured `merchant.username` and `authentication.partnerId`. Tokens stay in memory, refresh after 55 minutes, and are refreshed once after an Inquiry 401/403. Admin → Payments includes **Check gateway connection**.
- Inquiry: POST `/transactionServices/REST/v1/inquiry`, `AuthToken` header, fields `authentication.memberId`, `authentication.checksum` (MD5 of `memberId|workingKey|paymentId`), `paymentType=IN`, `idType=PID`, and `paymentId`.
- Fulfillment requires `status=capturesuccess`, `transactionStatus=Y`, and matching payment ID, merchant reference, exact amount and currency. Failure or unavailable Inquiry leaves the order unfulfilled. Redirects are rejected and calls have 15-second timeouts.

Provider documentation entry points: [integration overview](https://docs.transactworld.com/integration/overview.php) and [back-office API](https://docs.transactworld.com/integration/backoffice.php). Confirm merchant-specific field/method availability with TransactWorld before activation; the earlier app is protocol reference, not evidence this merchant account has been enabled.

## Callbacks and recovery

The backend constructs per-order URLs:

```text
POST /api/payments/transactworld/notify/<64-character merchant reference>
POST /api/payments/transactworld/return/<64-character merchant reference>
```

Allow these unauthenticated gateway endpoints through the reverse proxy. They verify signatures rather than requiring the browser's CSRF header or session. JSON and URL-encoded bodies are capped at 32 KB. A GET return only redirects to the owned order-status page; it cannot credit coins.

Signed callbacks bind the provider payment ID and persist a deduplicated event. Inquiry then fulfills the immutable order snapshot and wallet ledger in one MongoDB transaction. Concurrent callback replays, user status checks and admin verification all share the same unique `purchase:<order ID>` reference.

The scheduler runs every minute and checks up to 20 oldest eligible pending/paid/partially reversed orders whose last check was at least five minutes ago. Checking paid orders also detects missed reversal notifications. Missing callback/payment IDs recover through documented `idType=MID` Inquiry using the original merchant order reference and its checksum. The returned payment ID is bound only after exact authenticated evidence matches. Admin recovery can optionally supply a provider ID from merchant records with an investigation reason. There is no arbitrary “mark paid” action.

If Inquiry is unavailable, leave the order pending and retry. A separately reasoned support coin adjustment is available but never counts as verified payment or revenue. The app does not implement manual monetary settlement, automatic provider refund submission, recurring charges or cash withdrawals.

Verified cumulative refund/chargeback amounts reverse the corresponding proportion of purchased coins, rounded up and capped at the original purchased quantity. Duplicate or older cumulative evidence cannot reverse coins twice. If coins have been spent, available balance stays nonnegative and a coin review hold offsets later credits; it is not a monetary debt. An eligible entry-coin refund restores access coins and does not initiate a cash refund.

## Activation sequence

1. Provision the merchant's sandbox credentials and approved currencies in the backend. Set public HTTPS callback URLs reachable by TransactWorld and the matching frontend origin.
2. Use MongoDB Atlas or a replica set. Run startup to initialize indexes and migrate legacy wallets without replacing existing accounts/content.
3. In the existing Admin panel, review the 250/600/1500/3500-coin packages. Enter the merchant's actual full prices and currencies. Leave unavailable packages inactive.
4. Enable sandbox checkout and complete actual provider-hosted success, declined, abandoned and delayed-notification scenarios. Match the provider ledger, app order, wallet balance and one purchase entry.
5. Replay notifications, refresh the status page, retry admin verification, interrupt Inquiry and recover it, and verify partial/full reversal accounting using merchant-supported sandbox transactions. Confirm the exact Inquiry payload for this merchant account.
6. Review the drafted quiz prices: introductory free, standard 25, advanced 50, expert 75 coins are recommendations only. Publish each reviewed price; existing purchases keep their snapshots.
7. Obtain provider approval for the business and any coin-entry events. Finalize operator identity, support, jurisdiction and policy drafts. Configure monitoring, backups, database permissions and domain cookies using the deployment guide.
8. Switch to live credentials/environment only after those checks. Do not use local checkout overrides in production. Activate paid events separately only after their merchant approval.

When adding a Content Security Policy to the frontend host, its `form-action` must permit the selected TransactWorld checkout origin. Retain the app's HTTPS API/socket and font origins as appropriate. Do not embed merchant secrets in any `VITE_` variable or client bundle.
