# Deploy Quizora on Render with MongoDB Atlas

This guide uses two services from the same repository: a Node Web Service for `backend` and a Static Site for `frontend`. All configuration files remain inside those two folders. Your database password belongs only in Render's backend environment. Rotate any database password shared in chat before using it for the live deployment.

## Service settings

| Setting | Backend | Frontend |
| --- | --- | --- |
| Render service type | Web Service | Static Site |
| Runtime | Node | Static |
| Root Directory | `backend` | `frontend` |
| Build Command | `npm ci --include=dev && npm run build` | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` | None |
| Publish Directory | None | `dist` |
| Health Check Path | `/api/health` | None |
| Node version | `NODE_VERSION=22` | `NODE_VERSION=22` |

The explicit `--include=dev` installs TypeScript and Vite during build even when the server environment is production. Render assigns the backend `PORT`; the app reads it and binds to `0.0.0.0`.

For a Blueprint, choose **`backend/render.yaml`** as the Blueprint file path during setup. It contains both services. Use this only when both folders are in the same repository at its root. If you upload them to separate repositories, create each service manually and leave Root Directory blank in each respective repository. Do not create duplicate services if you already created them manually.

## Deploy in this order

1. Push the application source and both lockfiles to your Git provider. Do not upload `.env`, `.data`, `.cache`, `node_modules`, test fixtures' runtime data, or captured client credentials.
2. Create the **frontend Static Site** with the settings above. It can build before the API is connected; do not test account features until step 6. Copy its actual assigned HTTPS URL from Render.
3. Create the **backend Web Service**. Add the backend variables below, using the actual frontend URL for `APP_ORIGIN`. Add the Web Service's outbound IP ranges to Atlas Network Access. Ensure the Atlas database user has the necessary read/write and index permissions for the `quizora` database.
4. Deploy the backend and copy its actual assigned HTTPS URL. The app automatically uses Render's `RENDER_EXTERNAL_URL` as the default public callback origin. You can explicitly set `API_PUBLIC_URL` to the backend URL, especially if using a custom domain.
5. Visit `https://YOUR-BACKEND-HOST/api/health`. Success is `{"status":"ok"}`. The backend root `/` is an API, so it does not render the Quizora website.
6. Set frontend `VITE_API_URL` to that backend origin and **rebuild/redeploy the frontend**. This is a Vite build-time variable. For example `https://YOUR-BACKEND-HOST`, with no `/api` suffix.
7. Add the Static Site rewrite rule: Source `/*`, Destination `/index.html`, Action `Rewrite`. It is already included if using the Blueprint. Refresh `/dashboard`, `/store` and `/how-it-works` directly to confirm client routing.
8. Create the first administrator and review store pricing as described below. Verify signup → tour → free quiz → results → Overview, then organizer/live and Admin functions against the actual public URLs.

## Backend environment

Set these on the **Web Service**, not the Static Site:

```dotenv
NODE_ENV=production
NODE_VERSION=22
DATABASE_URL=YOUR_NEW_ATLAS_CONNECTION_STRING
DATABASE_NAME=quizora
APP_ORIGIN=https://YOUR-FRONTEND-HOST
API_PUBLIC_URL=https://YOUR-BACKEND-HOST
COOKIE_SAME_SITE=none
MONGOMS_DISABLE_POSTINSTALL=1
COIN_SYSTEM_ENABLED=true
PAID_QUIZZES_ENABLED=true
PUBLIC_REGISTRATION_ENABLED=true
ORGANIZER_REGISTRATION_ENABLED=true
REQUIRE_EMAIL_VERIFICATION=false
BILLING_ENABLED=false
PAYMENTS_ENABLED=false
PAID_COMPETITIONS_ENABLED=false
PAID_EVENTS_MERCHANT_APPROVED=false
TW_ENVIRONMENT=live
TW_ALLOW_LOCAL_CHECKOUT=false
```

Replace the three uppercase placeholders with real values; they are not literal configuration values. `API_PUBLIC_URL` can be omitted on Render when using the automatically assigned backend URL. No manual `PORT` is needed.

The Atlas URI format is:

```text
mongodb+srv://DB_USER:NEW_PASSWORD@CLUSTER_HOST/quizora?retryWrites=true&w=majority&appName=Quizora
```

Use Atlas's generated connection string and URL-encode reserved characters in the password. The app also uses `DATABASE_NAME=quizora` explicitly. The Atlas website account and the database username/password are different credentials.

Add Render's actual outbound IP ranges in Atlas Network Access. A local machine also needs its own allowed IP if you run provisioning against Atlas locally. Do not solve connectivity by committing the URI or copying it to the frontend.

For the two separate `onrender.com` origins, `COOKIE_SAME_SITE=none` enables Secure cross-site cookies. The client already sends credentials, and the backend allows only `APP_ORIGIN`. Browser third-party-cookie restrictions may still block cross-site sessions; test the actual deployment in the client's browser. For a public launch, use frontend/backend subdomains of the same custom domain when possible and validate `lax` cookies there. See [MDN cookie guidance](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies).

Add real SMTP variables and `SUPPORT_EMAIL` before enabling mandatory email verification or relying on password-reset mail. `REQUIRE_EMAIL_VERIFICATION=false` permits initial account acceptance without pretending email delivery has been configured.

## Frontend environment

Set on the **Static Site**:

```dotenv
NODE_VERSION=22
VITE_API_URL=https://YOUR-BACKEND-HOST
SKIP_INSTALL_DEPS=true
```

Then redeploy. The build command installs dependencies explicitly. Never set MongoDB credentials, `WORKING_KEY`, merchant tokens or SMTP passwords in a frontend variable: `VITE_*` values are public in the compiled application.

## First admin and fresh Atlas data

An empty Atlas database receives the idempotent quiz seed on backend startup: 38 quizzes / 160 questions in the unedited platform library. Existing Atlas data is preserved. Local users, old attempts, active prices and wallet transactions are **not automatically copied from the embedded database to Atlas**. If you need those records, arrange and verify a database backup/restore before switching the production database.

There is no default administrator password. Provision with the same Atlas connection and database name. From a private PowerShell terminal inside `backend` on a machine whose IP Atlas allows:

```powershell
$databaseSecret = Read-Host 'Paste the NEW Atlas URI' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $databaseSecret).Password
$env:DATABASE_NAME = 'quizora'
$env:NODE_ENV = 'development'
$env:COOKIE_SAME_SITE = 'lax'
$env:ADMIN_EMAIL = Read-Host 'Admin email'
$env:ADMIN_USERNAME = Read-Host 'Admin username (letters, numbers or underscores)'
$env:ADMIN_NAME = Read-Host 'Admin display name'
$adminSecret = Read-Host 'Choose an admin password (12+ characters)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
npm.cmd run admin
Remove-Item Env:ADMIN_PASSWORD, Env:DATABASE_URL
Remove-Variable adminSecret, databaseSecret
```

This command contacts Atlas directly; it does not call the hosted API. Setting `NODE_ENV=development` here affects this private provisioning command only. Re-provisioning an existing email deliberately rotates its password, sets its admin role and revokes old sessions. Use the intended administrator identity.

Sign in on the deployed frontend. A fresh database supports USD store quotes immediately, with a default of **20 coins per USD**. Purchases range from 10 to 500 in USD or EUR. Open Admin ? Admin section ? Store pricing to review or change the coin rate; changes are versioned and audited, and existing orders retain their confirmed terms.

EUR quotes require a recent verified ECB reference. The backend fetches it automatically and caches it in Atlas; the source date appears in the storefront. If the reference is unavailable or too old, EUR quoting fails closed and USD remains usable. No 1:1 conversion is invented. `npm run fx:refresh` can refresh the reference using the selected backend database environment. The host must be able to reach `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`.

At the initial rate, $10 gives 200 coins and $500 gives 10,000 coins. EUR coin totals depend on the dated reference and round down to whole coins. Earlier fixed-package and discounted quantity prices are retained for existing orders only and cannot create new purchases. The old package activation process is not needed for this new store. All 30 additional library quizzes remain free unless explicitly repriced.

## Real payments

Atlas enables persistence; it does not complete TransactWorld merchant authentication. Keep `PAYMENTS_ENABLED=false` until actual provider credentials and financial acceptance are complete. To connect the real provider, add these backend secrets/config values:

```dotenv
MEMBER_ID=YOUR_REAL_MERCHANT_MEMBER_ID
WORKING_KEY=YOUR_REAL_SECURE_KEY
TW_MERCHANT_USERNAME=YOUR_REAL_MERCHANT_LOGIN
TW_PARTNER_ID=YOUR_PROVIDER_ASSIGNED_PARTNER_ID
TW_SUPPORTED_CURRENCIES=YOUR_APPROVED_CURRENCY_CODES
```

Alternatively, connect the non-secret merchant login and Partner ID through Admin → Payments → Connect merchant after the member ID/key are configured. The server verifies before saving. A configured connection still needs a genuine hosted purchase, callback, independent Inquiry, reconciliation and settlement acceptance. No customer-facing simulated payment mode exists. See [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) for the full financial gates.

The Blueprint uses one backend instance and explicitly starts on a free compute plan to avoid implying an unapproved paid resource. Render free services can sleep; choose an always-on plan for sustained live competitions and timely reconciliation. Do not scale to multiple API instances until shared Socket.IO delivery and scheduler coordination are implemented and tested.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Frontend opens but quizzes do not load | Static Site `VITE_API_URL` is the real backend origin; rebuild after changing it; inspect `/api/health` |
| Backend root shows Endpoint not found | Expected for an API root; open `/api/health`, and use the frontend URL for the app |
| Backend build says TypeScript is missing | Use `npm ci --include=dev && npm run build` |
| Backend cannot connect to Atlas | Database user/password, URL encoding, allowed Render outbound IPs, running cluster and database permissions |
| Login succeeds then disappears | Exact `APP_ORIGIN`, `COOKIE_SAME_SITE=none`, HTTPS, browser cookie blocking and credentialed CORS |
| Refresh on `/store` gives 404 | Add the Static Site `/*` → `/index.html` rewrite |
| Store says pricing unavailable | Review Admin ? Store pricing; for EUR, check access to the official currency reference |
| Coin checkout is unavailable | Merchant verification and payment activation are separate from Atlas; do not bypass them |

References: [Render Node services](https://render.com/docs/web-services), [Render monorepos](https://render.com/docs/monorepo-support), [Render/Atlas connectivity](https://render.com/docs/connect-to-mongodb-atlas), [Render default environment](https://render.com/docs/environment-variables), [Vite deployment on Render](https://vite.dev/guide/static-deploy.html#render), and [Render Blueprint specification](https://render.com/docs/blueprint-spec).
