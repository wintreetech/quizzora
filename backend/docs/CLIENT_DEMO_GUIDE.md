# Quizora client walkthrough

Updated 23 November 2026. This filename follows the requested handoff package. The application has no customer-facing demo payment mode, demo labels or simulated purchases.

## What the product does

Quizora is a quiz platform for adults 18+. Players explore subjects, play solo, challenge friends, join hosted competitions, review answer explanations and track progress. Organizers create quizzes and host rooms. Super administrators manage users, content, pricing, wallets, payment configuration and reports. The current identity uses white, deep ink and evergreen with a new featured-quiz hero and a separate purchase receipt panel.

The library includes the original eight quizzes plus 30 additional quizzes: 120 new questions across ten categories, each with Easy, Medium and Hard rounds. Each added round has four questions. These additions are free by default and do not overwrite existing content.

## Start the application

From two PowerShell terminals at `D:\office\quiz-aashay`:

```powershell
cd backend
npm.cmd run dev
```

```powershell
cd frontend
npm.cmd run dev -- --port 5173 --strictPort
```

Open http://localhost:5173. The API health endpoint is http://localhost:4000/api/health. Dependencies are already installed in this workspace. On a new checkout, run `npm.cmd ci` separately in each folder and configure `backend/.env` from its example; preserve an existing `.env`.

## Suggested client sequence

1. Open Explore quizzes. Show the Start playing action, subject filters and free/coin entry labels.
2. Open How it works from the footer. Explain choose a quiz, play and score, then earn badges and improve.
3. Create a new adult account with a private password. The welcome guide starts once, saves progress and supports Back, Next, Skip and Finish. Try the practice answer; it does not alter real results. Help can replay the guide later.
4. Filter Mathematics & Logic or Brain Teasers and select an Easy free round. The introduction states question count, level, timing and entry conditions.
5. Start, answer and lock in answers. Each correct answer earns 100 points; wrong, late or unanswered questions earn zero. Multiple-answer questions require the exact correct set. The server decides the score.
6. Open results, expand the explanations and show replay/discovery actions. Open Overview to show recent history, category accuracy and achievements. An active round appears as Continue; deadlines continue during absence.
7. Open Coin store. Choose USD or EUR, then a purchase amount from 10 to 500 with the slider or amount field. Review the server-calculated coin total and exact payable currency. The initial retail rate is 20 coins per USD: $10 gives 200 coins and $500 gives 10,000. EUR allocations use the dated ECB reference shown in the store and round down to whole coins. Admin > Store pricing changes the versioned rate; existing orders retain their confirmed terms.
8. Explain coins honestly: they unlock paid access, never improve score, cannot be transferred or redeemed for cash, and do not expire. Playing earns score points and achievement badges; it does not award spendable coins.
9. If purchases are unavailable, explain that real merchant setup is still required. The purchase button is disabled and free quizzes remain available. Do not claim a successful charge or purchase. If a properly verified merchant is later connected, the real flow is review → hosted provider checkout → independently verified order → wallet credit.
10. Sign out, sign in as an authorized administrator and show Overview, Quizzes, Users and Payments. Use Admin section for question management, categories, store pricing, quiz pricing, recovery, analytics and audits. Merchant setup instructions are confined to this authorized workspace.
11. As an organizer, create a draft, enter distinct answer options, select the key, add an explanation, publish, and open a live room. Share the real room code with a second account. End/cancel the room after review.

## Safe review accounts

There are no committed passwords or public administrator signup. Normal reviewers may sign up through the app. For a repeatable isolated client acceptance environment, the backend provides `npm.cmd run client:accounts`.

This command requires a **separate non-production database** whose `DATABASE_NAME` begins `quizora_review_`, `DATABASE_URL` set to a replica set, and `PAYMENTS_ENABLED=false`. It refuses the regular application database and never rotates existing account passwords or roles on repeat runs.

In a private PowerShell terminal inside `backend`, with the local replica already running:

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'mongodb://127.0.0.1:57017/?replicaSet=quizora-rs'
$env:DATABASE_NAME = 'quizora_review_client'
$env:PAYMENTS_ENABLED = 'false'
$reviewSecret = Read-Host 'Choose a private review password (12+ characters)' -AsSecureString
$env:REVIEW_PASSWORD = [System.Net.NetworkCredential]::new('', $reviewSecret).Password
npm.cmd run client:accounts
Remove-Item Env:REVIEW_PASSWORD
Remove-Variable reviewSecret
```

Accounts are `player@review.quizora.test`, `organizer@review.quizora.test` and `admin@review.quizora.test`, with the password privately supplied above. This creates real accounts in the separate review database, seeds the quiz library and initializes the versioned store rate. It creates no payments or wallet credits. New-account onboarding can be shown using a fresh normal signup; provisioned reviewer accounts have already skipped it.

To use this database without interrupting the normal API, keep the same database variables in this shell, set `$env:PORT='4001'`, `$env:API_PUBLIC_URL='http://localhost:4001'`, then run `npm.cmd run dev`. In a separate frontend terminal set `$env:VITE_API_URL='http://localhost:4001'` and run Vite at 5173 (stop any other server using 5173 first). `APP_ORIGIN` must match the frontend origin. Do not point normal client data at the isolated review database accidentally.

## Payment readiness

Live checkout is currently unavailable. Merchant member ID and secure key exist on the local backend; merchant API login and Partner ID or an API token are absent, and no verified merchant identity has been saved. No real charge or settlement has been executed. A connection check alone does not establish settlement capability.

In Admin → Payments → Connect merchant, enter the actual TransactWorld merchant login and assigned Partner ID. These are not Quizora credentials, and Partner ID is not Member ID. If unavailable, request them from the merchant account manager together with AuthToken and transaction Inquiry access. The backend verifies before saving. Secrets stay in backend environment configuration.

## Review artifacts

Screenshots are under `frontend/artifacts/review/`: `discover-1440.png`, `discover-390.png`, `store-1440.png`, `store-390.png`, `how-it-works-1440.png`, `how-it-works-390.png`, `signup-tour-mobile.png`, `player-overview-desktop.png`, `quiz-result-desktop.png`, `admin-analytics-desktop.png`, and `admin-payments-desktop.png` where captured by the route sweep. Screenshots with test accounts come from isolated automated journeys; they are not production activity or revenue.

Use [QA_REPORT.md](QA_REPORT.md), [CLIENT_APPROVAL_CHECKLIST.md](CLIENT_APPROVAL_CHECKLIST.md) and [DEPLOYMENT_READINESS.md](DEPLOYMENT_READINESS.md) to separate design acceptance, functional acceptance and production approval.
