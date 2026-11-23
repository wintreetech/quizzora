import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
const suffix = randomBytes(4).toString("hex");
const password = randomBytes(20).toString("base64url");
async function register(
  page: Page,
  name: string,
  organizer = false,
  skipTour = true,
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Display name").fill(`${name} Curious`);
  await dialog
    .getByLabel("Username", { exact: true })
    .fill(`${name}_${suffix}`);
  await dialog
    .getByLabel("Email address")
    .fill(`${name}_${suffix}@example.test`);
  await dialog.getByLabel("Password", { exact: true }).fill(password);
  await dialog.getByText("I’m 18 or older").click();
  if (organizer)
    await dialog.getByText("I’d also like to create quizzes").click();
  await dialog.getByRole("button", { name: "Create free account" }).click();
  const guide = page.getByRole("dialog", { name: "Your Quizora guide" });
  await expect(guide).toBeVisible();
  if (skipTour) {
    await guide.getByRole("button", { name: "Skip tour" }).click();
    await expect(guide).not.toBeVisible();
  }
}
test("discovery search, filters, bookmarks, mobile drawer, and themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".quiz-card")).toHaveCount(8);
  await page
    .getByLabel("Quiz category", { exact: true })
    .selectOption("Technology");
  await expect(page.locator(".quiz-card")).toHaveCount(4);
  await expect(
    page.locator(".quiz-card").filter({ hasText: "Think you speak tech?" }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "Save Think you speak tech?" })
    .click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Saved quizzes", exact: true })
    .click();
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Explore quizzes", exact: true })
    .click();
  await page.getByLabel("Search quizzes").fill("cinema");
  await page.getByLabel("Search quizzes").press("Enter");
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await expect(page.locator(".quiz-card")).toContainText(
    "For the love of cinema",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/mobile-open/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).not.toHaveClass(/mobile-open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  expect(errors).toEqual([]);
});
test("adult registration, quiz scoring, explanations, history, achievements, and settings", async ({
  page,
}) => {
  await register(page, "solo");
  await page.goto("/?q=The%20universe%20is%20calling");
  await page
    .locator(".quiz-card")
    .filter({ hasText: "The universe is calling" })
    .getByRole("link", { name: "The universe is calling", exact: true })
    .click();
  await page.getByRole("button", { name: "Let’s see what you know" }).click();
  for (const answers of [
    ["Jupiter"],
    ["Nuclear fusion"],
    ["Venus", "Mars"],
    ["Distance"],
    ["Sputnik 1"],
  ]) {
    await expect(page.locator(".answer-option").first()).toBeVisible();
    for (const answer of answers)
      await page.locator(".answer-option").filter({ hasText: answer }).click();
    await page.getByRole("button", { name: "Lock in my answer" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "A perfect little moment." }),
  ).toBeVisible();
  await expect(page.locator(".result-stats")).toContainText("500");
  await page.locator(".review-item").first().locator("summary").click();
  await expect(page.locator(".review-content").first()).toContainText(
    "Ganymede",
  );
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page.locator(".stat-card").first()).toContainText("1");
  await expect(page.locator(".activity-preview")).toContainText(
    "The universe is calling",
  );
  await expect(page.locator(".player-progress-ring strong")).toHaveText("100%");
  await page.screenshot({
    path: "artifacts/review/dashboard-final-desktop.png",
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `Dashboard at ${width}px`,
    ).toBe(width);
    if (width === 390)
      await page.screenshot({
        path: "artifacts/review/dashboard-final-mobile.png",
        fullPage: true,
      });
  }
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "My activity", exact: true })
    .click();
  await expect(page.locator("table")).toContainText("The universe is calling");
  await page.getByRole("link", { name: "Achievements", exact: true }).click();
  await expect(page.locator(".achievement-card.earned")).toHaveCount(2);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await page
    .getByLabel("A little about you")
    .fill("Curious about the universe.");
  await page.getByRole("button", { name: "Save my changes" }).click();
  await expect(page.locator(".toast")).toContainText("Profile updated");
});
test("organizer creates and publishes a quiz, hosts a room, and receives a live participant", async ({
  page,
  browser,
}) => {
  await register(page, "host", true);
  await page.getByRole("link", { name: "Creator studio", exact: true }).click();
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Give your quiz a name")
    .fill("A browser-tested quiz night");
  await d
    .getByLabel("A little introduction")
    .fill("A real round with server-verified scoring and a great question.");
  await d
    .getByLabel("Question", { exact: true })
    .fill("Which planet is called the Red Planet?");
  await d.getByLabel("Option 1 for question 1", { exact: true }).fill("Mars");
  await d.getByLabel("Option 2 for question 1", { exact: true }).fill("Venus");
  await d.getByLabel("Option 3 for question 1", { exact: true }).fill("Earth");
  await d.getByLabel("Option 4 for question 1", { exact: true }).fill("Saturn");
  await d
    .getByLabel("The aha behind the answer")
    .fill("Iron oxide on its surface gives Mars its reddish color.");
  await d
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("published");
  await d.getByRole("button", { name: "Save & publish" }).click();
  await expect(d).not.toBeVisible();
  await expect(page.locator("table")).toContainText(
    "A browser-tested quiz night",
  );
  await page
    .getByRole("button", { name: "Host a competition", exact: true })
    .click();
  const hostDialog = page.getByRole("dialog");
  await hostDialog
    .getByLabel("Competition name")
    .fill("A real browser competition");
  await hostDialog
    .getByLabel("Choose a published quiz")
    .selectOption({ label: "A browser-tested quiz night · 1 questions" });
  await hostDialog.getByRole("button", { name: "Open my room" }).click();
  await expect(
    page.getByRole("heading", { name: "A real browser competition" }),
  ).toBeVisible();
  const roomCode = (await page
    .locator(".room-code>button")
    .textContent())!.trim();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await register(guest, "rival");
  await guest
    .getByRole("button", { name: "Join with a code", exact: true })
    .click();
  await guest.getByLabel("Room code").fill(roomCode);
  await guest.getByRole("button", { name: "Join the room" }).click();
  await expect(
    guest.getByRole("heading", { name: "You’re in. Get comfortable." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start competition", exact: true })
    .click();
  await expect(
    guest.getByRole("heading", {
      name: "Which planet is called the Red Planet?",
    }),
  ).toBeVisible();
  await guest.locator(".answer-option").filter({ hasText: "Mars" }).click();
  await guest.getByRole("button", { name: "Lock in my answer" }).click();
  await expect(guest.getByText("Locked in. Nice work.")).toBeVisible();
  await page
    .getByRole("button", { name: "End competition", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm end", exact: true }).click();
  await expect(
    guest.getByRole("heading", { name: "Good questions. Great company." }),
  ).toBeVisible();
  await expect(guest.locator(".room-participants")).toContainText("100");
  await guestContext.close();
});
test("admin sign-in, real statistics, user table, audit, and guarded access changes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Your curious side Sign in to make it yours" })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Email address").fill("browser-admin@example.test");
  await d
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await d.getByRole("button", { name: "Let’s play" }).click();
  await expect(d).not.toBeVisible();
  await page.getByRole("link", { name: "Administration", exact: true }).click();
  await expect(page.locator(".stat-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(page.locator("table")).toContainText("Test administrator");
  await expect(
    page
      .locator("tr")
      .filter({ hasText: "Test administrator" })
      .getByRole("button", { name: "Manage access" }),
  ).toBeDisabled();
  await page.getByLabel("Admin section").selectOption("Audit logs");
  await expect(page.locator("table")).toContainText(
    /account.register|account.provision/,
  );
  await page.getByLabel("Admin section").selectOption("Wallets & Coins");
  const adminRow = page.locator("tr").filter({ hasText: "Test administrator" });
  await adminRow.getByRole("button", { name: "Adjust coins" }).click();
  const adjustment = page.getByRole("dialog");
  await adjustment.getByLabel("Number of coins").fill("50");
  await adjustment
    .getByLabel("Reason for this adjustment")
    .fill("Verified browser test support adjustment");
  await expect(adjustment.locator(".adjustment-preview")).toContainText(
    "50 coins",
  );
  await adjustment.getByRole("checkbox").check();
  await adjustment
    .getByRole("button", { name: "Confirm ledger adjustment" })
    .click();
  await expect(adjustment).not.toBeVisible();
  await expect(adminRow.locator(".table-coin-balance")).toContainText("50");
  await page.getByLabel("Admin section").selectOption("Quiz Pricing");
  const business = page
    .locator("tr")
    .filter({ hasText: "The business of knowing" });
  await business.getByRole("button", { name: "Manage pricing" }).click();
  const pricing = page.getByRole("dialog");
  await pricing.getByLabel("Coin price", { exact: true }).fill("50");
  await pricing.getByRole("checkbox").last().check();
  await pricing
    .getByRole("button", { name: "Publish reviewed pricing" })
    .click();
  await expect(pricing).not.toBeVisible();
  await expect(business.locator(".price-pill")).toContainText("50 coins");
  await page.getByLabel("Admin section").selectOption("Coin Packages");
  await expect(page.locator(".admin-package")).toHaveCount(4);
  await page.getByRole("button", { name: "Payments", exact: true }).click();
  await page
    .getByRole("button", { name: "Connect merchant", exact: true })
    .click();
  const gateway = page.getByRole("dialog", {
    name: "Connect TransactWorld merchant",
  });
  await gateway.getByLabel("Merchant login name").fill("browsermerchant");
  await gateway.getByLabel("Partner ID", { exact: true }).fill("1000");
  await gateway.getByRole("checkbox").check();
  await gateway
    .getByRole("button", { name: "Verify and connect merchant" })
    .click();
  await expect(gateway).not.toBeVisible();
  await page.getByLabel("Admin section").selectOption("Analytics");
  await expect(
    page.getByRole("heading", { name: "Most purchased quizzes." }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/review/admin-analytics-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("premium preview, explicit coin consent, refresh recovery, included replays and insufficient balance", async ({
  page,
  browser,
}) => {
  await register(page, "premium");
  const backend = "http://localhost:4100/api";
  const operator = await browser.newContext();
  const login = await operator.request.post(`${backend}/auth/login`, {
    headers: { "X-Quizora": "1" },
    data: {
      email: "browser-admin@example.test",
      password: process.env.E2E_ADMIN_PASSWORD,
    },
  });
  expect(login.ok()).toBeTruthy();
  const me = await (await page.request.get(`${backend}/auth/me`)).json();
  const quizzes = await (
    await page.request.get(`${backend}/quizzes?q=tech`)
  ).json();
  const q = quizzes.items[0];
  const grant = await operator.request.post(
    `${backend}/admin/economy/wallets/${me.user.id}/adjust`,
    {
      headers: { "X-Quizora": "1" },
      data: {
        mode: "credit",
        amount: 50,
        expectedBalance: 0,
        reason: "Isolated browser test support credit",
        confirmed: true,
        requestKey: randomBytes(18).toString("hex"),
      },
    },
  );
  expect(grant.ok()).toBeTruthy();
  const price = await operator.request.put(
    `${backend}/admin/economy/pricing/quiz/${q.id}`,
    {
      headers: { "X-Quizora": "1" },
      data: {
        confirmed: true,
        publish: true,
        pricing: {
          accessType: "FREE_PREVIEW_THEN_PAID",
          coinPrice: 25,
          includedAttempts: 2,
          previewQuestions: 1,
          available: true,
        },
      },
    },
  );
  expect(price.ok()).toBeTruthy();
  await page.goto(`/quiz/${q.id}`);
  await page.getByRole("button", { name: /preview/i }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Unlock the complete quiz for 25 coins",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Start paid quiz/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Confirm coin entry" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Not this round", exact: true })
    .click();
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(50);
  await page.getByRole("button", { name: /Start paid quiz/ }).click();
  await page.getByRole("button", { name: "Confirm & spend 25 coins" }).click();
  await expect(page).toHaveURL(/\/play\//);
  const attemptUrl = page.url();
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(25);
  await page.reload();
  await expect(page.locator(".answer-option").first()).toBeVisible();
  expect(page.url()).toBe(attemptUrl);
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(25);
  await page.getByRole("button", { name: "Finish early" }).click();
  await page.getByRole("button", { name: "Finish & see my result" }).click();
  await page.getByRole("button", { name: "Use included replay" }).click();
  await page.getByRole("button", { name: "Use an included attempt" }).click();
  await expect(page).toHaveURL(/\/play\//);
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(25);
  await page.getByRole("button", { name: "Finish early" }).click();
  await page.getByRole("button", { name: "Finish & see my result" }).click();
  await page.getByRole("button", { name: "Replay — 25 coins" }).click();
  await page.getByRole("button", { name: /Start paid quiz/ }).click();
  await page.getByRole("button", { name: "Confirm & spend 25 coins" }).click();
  await expect(page).toHaveURL(/\/play\//);
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(0);
  await page.goto("/wallet");
  await expect(page.locator("table").first()).toContainText("QUIZ ENTRY");
  const others = await (
    await page.request.get(`${backend}/quizzes?q=cinema`)
  ).json();
  const otherQuiz = others.items[0];
  await operator.request.put(
    `${backend}/admin/economy/pricing/quiz/${otherQuiz.id}`,
    {
      headers: { "X-Quizora": "1" },
      data: {
        confirmed: true,
        publish: true,
        pricing: {
          accessType: "PAID_PER_ATTEMPT",
          coinPrice: 25,
          includedAttempts: 1,
          previewQuestions: 0,
          available: true,
        },
      },
    },
  );
  await page.goto(`/quiz/${otherQuiz.id}`);
  await page.getByRole("button", { name: /Start paid quiz/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "You need 25 more coins",
  );
  await expect(
    page.getByRole("link", { name: "Explore coin store" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/wallet");
  await page.screenshot({
    path: "artifacts/review/wallet-desktop.png",
    fullPage: true,
  });
  await operator.close();
});

test("premium design remains readable without horizontal page overflow from mobile to desktop", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of [
      "/",
      "/store",
      "/live",
      "/tournaments",
      "/pricing",
      "/help",
      "/how-it-works",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await page.waitForTimeout(100);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${path} at ${width}px`,
      ).toBe(width);
      if (
        (width === 390 || width === 1440) &&
        (path === "/" || path === "/store")
      )
        await page.screenshot({
          path: `artifacts/review/${path === "/" ? "discover" : "store"}-${width}.png`,
          fullPage: true,
        });
    }
  }
  expect(errors).toEqual([]);
});

test("coin plan checkout, signed gateway return, independent verification and paid quiz entry", async ({
  page,
  browser,
}) => {
  await register(page, "buyer");
  const backend = "http://localhost:4100/api",
    operator = await browser.newContext();
  expect(
    (
      await operator.request.post(`${backend}/auth/login`, {
        headers: { "X-Quizora": "1" },
        data: {
          email: "browser-admin@example.test",
          password: process.env.E2E_ADMIN_PASSWORD,
        },
      })
    ).ok(),
  ).toBeTruthy();
  const packages = await (
      await operator.request.get(`${backend}/admin/economy/packages`)
    ).json(),
    pack = packages.items[0];
  const publish = await operator.request.put(
    `${backend}/admin/economy/packages/${pack.id}`,
    {
      headers: { "X-Quizora": "1" },
      data: {
        name: "Starter",
        description: "250 coins for your next challenge.",
        coins: 250,
        bonusCoins: 0,
        amountMinor: 299,
        currency: "USD",
        active: true,
        displayOrder: 0,
      },
    },
  );
  expect(publish.ok()).toBeTruthy();
  await page.route(
    "https://sandbox.transactworld.com/transaction/Checkout",
    async (route) => {
      const form = new URLSearchParams(route.request().postData() || "");
      expect(form.get("amount")).toBe("25.00");
      expect(form.get("currency")).toBe("EUR");
      const provider = await page.request.post(
        `http://localhost:4100/__e2e/gateway-return/${form.get("merchantTransactionId")}`,
        { headers: { "x-test-key": process.env.E2E_ADMIN_PASSWORD! } },
      );
      expect(provider.ok()).toBeTruthy();
      const callback = await provider.json();
      const inputs = Object.entries(callback.fields)
        .map(
          ([name, value]) =>
            `<input type="hidden" name="${name}" value="${value}">`,
        )
        .join("");
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!doctype html><html><body><h1>TransactWorld test checkout</h1><p>Simulated provider transport. No real payment.</p><form method="POST" action="${callback.action}">${inputs}<button type="submit">Complete simulated payment</button></form></body></html>`,
      });
    },
  );
  await page.goto("/store");
  await page.getByRole("button", { name: /EUR.*Euro/ }).click();
  await page.getByRole("slider", { name: "Choose purchase amount" }).fill("25");
  await expect(page.locator(".receipt-coins > strong")).toContainText("550");
  await page.getByRole("button", { name: "Review purchase" }).click();
  await expect(page.getByRole("dialog")).toContainText("€25.00");
  await page.getByRole("button", { name: "Continue to pay €25.00" }).click();
  await expect(
    page.getByRole("heading", { name: "TransactWorld test checkout" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Complete simulated payment" })
    .click();
  await expect(page).toHaveURL(/\/purchase\//);
  await expect(
    page.getByText("550 coins were added.", { exact: false }),
  ).toBeVisible();
  const orderId = page.url().split("/").pop();
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(550);
  await page.request.post(`${backend}/payments/${orderId}/verify`, {
    headers: { "X-Quizora": "1" },
  });
  await page.reload();
  await expect(
    page.getByText("550 coins were added.", { exact: false }),
  ).toBeVisible();
  const journal = await (
    await page.request.get(`${backend}/wallet/history`)
  ).json();
  expect(
    journal.items.filter((t: any) => t.type === "COIN_PURCHASE"),
  ).toHaveLength(1);
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(550);
  const quizzes = await (
      await page.request.get(`${backend}/quizzes?q=tech`)
    ).json(),
    quiz = quizzes.items[0];
  await operator.request.put(
    `${backend}/admin/economy/pricing/quiz/${quiz.id}`,
    {
      headers: { "X-Quizora": "1" },
      data: {
        confirmed: true,
        publish: true,
        pricing: {
          accessType: "PAID_PER_ATTEMPT",
          coinPrice: 25,
          includedAttempts: 1,
          previewQuestions: 0,
          available: true,
        },
      },
    },
  );
  await page.goto(`/quiz/${quiz.id}`);
  await page.getByRole("button", { name: /Start paid quiz/ }).click();
  await page.getByRole("button", { name: "Confirm & spend 25 coins" }).click();
  await expect(page).toHaveURL(/\/play\//);
  expect(
    (await (await page.request.get(`${backend}/wallet`)).json()).balance,
  ).toBe(525);
  await operator.close();
});

test("first signup opens a resumable guide and completed users can replay it from Help", async ({
  page,
}) => {
  await register(page, "guided", false, false);
  const guide = page.getByRole("dialog", { name: "Your Quizora guide" });
  await expect(
    guide.getByRole("heading", { name: "Your next great round starts here." }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "Follow what makes you curious." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    guide.getByRole("heading", { name: "Follow what makes you curious." }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await guide
    .getByRole("slider", { name: "Try choosing a purchase amount" })
    .fill("75");
  await expect(guide.locator(".tour-slider-demo strong")).toContainText("75");
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    guide.getByRole("heading", { name: "You are always in control." }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Mars", exact: true }).click();
  await expect(guide.getByRole("status")).toContainText("100 practice points");
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await guide.getByRole("button", { name: "Start exploring" }).click();
  await expect(guide).not.toBeVisible();
  await page.reload();
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(guide).not.toBeVisible();
  const me = await (
    await page.request.get("http://localhost:4100/api/auth/me")
  ).json();
  expect(me.user.onboarding).toMatchObject({
    required: false,
    status: "completed",
  });
  await page.goto("/help");
  await page.getByRole("button", { name: "Take the product tour" }).click();
  await expect(
    guide.getByRole("heading", { name: "Your next great round starts here." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "artifacts/review/signup-tour-mobile.png" });
  await guide.getByRole("button", { name: "Skip tour" }).click();
  await expect(guide).not.toBeVisible();
  expect(
    (await (await page.request.get("http://localhost:4100/api/auth/me")).json())
      .user.onboarding.status,
  ).toBe("completed");
});

test("unavailable purchases preserve real balances and show no demo controls", async ({
  page,
}) => {
  await register(page, "paused_buyer");
  const before = await (
    await page.request.get("http://localhost:4100/api/wallet")
  ).json();
  const initial = await (
    await page.request.get("http://localhost:4100/api/payments")
  ).json();
  const mutations: string[] = [];
  await page.route("**/api/coin-purchase/options", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), checkoutAvailable: false },
    });
  });
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /coin-purchase\/checkout|payments\/checkout|transactworld\.com/.test(
        request.url(),
      )
    )
      mutations.push(request.url());
  });
  await page.goto("/store");
  await page
    .getByRole("slider", { name: "Choose purchase amount" })
    .fill("500");
  await expect(page.locator(".receipt-coins > strong")).toContainText("10,000");
  await expect(
    page.getByText("Coin purchases are temporarily unavailable.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review purchase" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/demo payment|try demo|simulate payment/i),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({
    path: "artifacts/review/coin-store-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Explore free quizzes", exact: true })
    .click();
  await expect(page.locator(".quiz-card").first()).toBeVisible();
  await expect(page.locator(".quiz-price.premium")).toHaveCount(0);
  const after = await (
    await page.request.get("http://localhost:4100/api/wallet")
  ).json();
  expect(after).toEqual(before);
  expect(
    await (await page.request.get("http://localhost:4100/api/payments")).json(),
  ).toEqual(initial);
  expect(mutations).toEqual([]);
});

test("public instructions, expanded categories, saved quizzes beyond page one and dashboard resume", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/how-it-works");
  await expect(
    page.getByRole("heading", { name: "Choose a quiz", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Find a free quiz", exact: true })
    .click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByLabel("Quiz category", { exact: true })
    .selectOption("Mathematics & Logic");
  await expect(page.locator(".quiz-card")).toHaveCount(3);
  const target = "A little number sense: The challenge";
  await page
    .getByRole("button", { name: `Save ${target}`, exact: true })
    .click();
  await page
    .locator(".sidebar")
    .getByRole("link", { name: "Saved quizzes", exact: true })
    .click();
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await expect(page.locator(".quiz-card")).toContainText(target);
  await page.getByRole("link", { name: target, exact: true }).click();
  await expect(page.getByRole("heading", { name: target })).toBeVisible();
  await register(page, "resume_new");
  const catalogue = await (
    await page.request.get(
      "http://localhost:4100/api/quizzes?category=Mathematics%20%26%20Logic",
    )
  ).json();
  const quiz = catalogue.items.find((q: any) => q.difficulty === "Easy");
  await page.goto(`/quiz/${quiz.id}`);
  await page.getByRole("button", { name: "Let’s see what you know" }).click();
  await expect(page.locator(".answer-option").first()).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.locator(".continue-grid").getByRole("link").first(),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/review/player-overview-desktop.png",
    fullPage: true,
  });
  await page.locator(".continue-grid").getByRole("link").first().click();
  await expect(page.locator(".answer-option").first()).toBeVisible();
  await page.getByRole("button", { name: "Finish early", exact: true }).click();
  await page.route(
    "**/api/attempts/*/finish",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Connection interrupted. Please retry.",
        }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Finish & see my result" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Connection interrupted. Please retry.",
  );
  await page.getByRole("button", { name: "Finish & see my result" }).click();
  await expect(page.locator(".result-stats")).toContainText("0");
  await page.screenshot({
    path: "artifacts/review/quiz-result-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("public recovery routes, player restrictions, every admin section and browser back navigation", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    serverErrors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("/api/"))
      serverErrors.push(`${response.status()} ${response.url()}`);
  });
  for (const path of [
    "/hosting",
    "/legal/privacy",
    "/legal/terms",
    "/reset-password",
    "/verify-email",
    "/missing-page",
    "/admin",
    "/organizer",
    "/dashboard",
    "/wallet",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".spinner")).toHaveCount(0);
  }
  await register(page, "restricted");
  await page.goto("/admin");
  await expect(
    page.getByText(
      "Your account does not have access to administration tools.",
    ),
  ).toBeVisible();
  expect(
    (
      await page.request.get("http://localhost:4100/api/admin/overview")
    ).status(),
  ).toBe(403);
  await page.goto("/organizer");
  await expect(
    page.getByRole("button", { name: "Enable creator tools" }),
  ).toBeVisible();
  for (const path of [
    "/dashboard",
    "/library",
    "/wallet",
    "/achievements",
    "/challenges",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator(".spinner")).toHaveCount(0);
    await expect(page.locator("main .error-note")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Get started", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Your curious side Sign in to make it yours" })
    .click();
  const login = page.getByRole("dialog");
  await login.getByLabel("Email address").fill("browser-admin@example.test");
  await login
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await login.getByRole("button", { name: "Let’s play", exact: true }).click();
  await expect(login).not.toBeVisible();
  await page.goto("/admin?section=Users");
  await expect(page.getByLabel("Admin section")).toHaveValue("Users");
  await page.getByLabel("Admin section").selectOption("Quizzes");
  await expect(page).toHaveURL(/section=Quizzes/);
  await page.goBack();
  await expect(page.getByLabel("Admin section")).toHaveValue("Users");
  const sections = await page
    .getByLabel("Admin section")
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  for (const section of sections) {
    await page.getByLabel("Admin section").selectOption(section);
    await expect(page.locator(".spinner")).toHaveCount(0);
    await expect(page.locator("main .error-note")).toHaveCount(0);
    await expect(page.getByLabel("Admin section")).toHaveValue(section);
    await expect(page.locator("main")).not.toHaveText("");
  }
  await page.getByLabel("Admin section").selectOption("Payments");
  await page.screenshot({
    path: "artifacts/review/admin-payments-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.getByLabel("Admin section")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  expect(errors).toEqual([]);
  expect(serverErrors).toEqual([]);
});

test("USD/EUR amount selection, bounds, keyboard controls and currency outage recovery", async ({
  page,
}) => {
  await page.goto("/store");
  const slider = page.getByRole("slider", { name: "Choose purchase amount" });
  await expect(slider).toHaveAttribute("min", "10");
  await expect(slider).toHaveAttribute("max", "500");
  await slider.fill("10");
  await expect(page.locator(".receipt-coins > strong")).toContainText("200");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("11");
  await expect(page.locator(".receipt-coins > strong")).toContainText("220");
  await page.getByRole("button", { name: /EUR.*Euro/ }).click();
  await expect(page.locator(".receipt-total")).toContainText("€11.00");
  await expect(page.locator(".receipt-coins > strong")).toContainText("242");
  await expect(page.locator(".currency-reference")).toContainText(
    "ECB reference",
  );
  await slider.fill("500");
  await expect(page.locator(".receipt-coins > strong")).toContainText("11,000");
  await page.getByLabel("Purchase amount", { exact: true }).fill("999");
  await page.getByLabel("Purchase amount", { exact: true }).press("Enter");
  await expect(page.getByLabel("Purchase amount", { exact: true })).toHaveValue(
    "500",
  );
  let offline = true;
  await page.route("**/api/coin-purchase/quote?**", async (route) => {
    if (
      offline &&
      new URL(route.request().url()).searchParams.get("currency") === "EUR"
    )
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "EUR conversion is temporarily unavailable. Please retry.",
        }),
      });
    else await route.continue();
  });
  await slider.fill("25");
  await expect(page.getByRole("alert")).toContainText(
    "EUR conversion is temporarily unavailable",
  );
  await expect(
    page.getByRole("button", { name: "Review purchase" }),
  ).toBeDisabled();
  offline = false;
  await page.getByRole("button", { name: "Retry quote", exact: true }).click();
  await expect(page.locator(".receipt-coins > strong")).toContainText("550");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator(".sidebar")).not.toBeInViewport();
  await page.locator("h1").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "artifacts/review/eur-store-mobile.png",
    fullPage: true,
  });
});

test("All lists every eligible quiz ID across pages and resets access without losing explicit subject filters", async ({
  page,
}) => {
  test.setTimeout(90000);
  const expected: string[] = [];
  let total = 0;
  for (let pageNumber = 1; pageNumber <= 3; pageNumber++) {
    const response = await (
      await page.request.get(
        `http://localhost:4100/api/quizzes?limit=24&page=${pageNumber}`,
      )
    ).json();
    total = response.total;
    expected.push(...response.items.map((quiz: any) => quiz.id));
    if (expected.length === total) break;
  }
  await page.goto("/?access=free");
  await expect(page.locator(".quiz-price.premium")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  const actual: string[] = [];
  let pageNumber = 1;
  while (actual.length < total) {
    await expect(page.locator(".catalogue-pagination")).toContainText(
      `Page ${pageNumber} of`,
    );
    await expect(page.locator(".quiz-card")).toHaveCount(
      Math.min(8, total - actual.length),
    );
    actual.push(
      ...(await page
        .locator(".quiz-card")
        .evaluateAll((cards) =>
          cards.map((card) => card.getAttribute("data-quiz-id")!),
        )),
    );
    if (actual.length < total) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      pageNumber++;
    }
  }
  expect(actual.length).toBe(total);
  expect(new Set(actual).size).toBe(total);
  expect(actual.sort()).toEqual(expected.sort());
  await page.getByRole("button", { name: "Paid", exact: true }).click();
  await page
    .getByLabel("Quiz category", { exact: true })
    .selectOption("Mathematics & Logic");
  await expect(page.locator(".quiz-card")).toHaveCount(2);
  await expect(page.locator(".quiz-price.free")).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator(".quiz-card")).toHaveCount(3);
  await page
    .getByLabel("Quiz difficulty", { exact: true })
    .selectOption("Hard");
  await page.getByLabel("Search quiz catalogue").fill("number");
  await page.getByRole("button", { name: "Apply quiz search" }).click();
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await expect(page.locator(".quiz-price.premium")).toContainText("75 coins");
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.locator(".catalogue-count")).toHaveText(String(total));
  await expect(page.getByLabel("Quiz category", { exact: true })).toHaveValue(
    "",
  );
});

test("Admin creates a category, publishes a paid quiz and changes its price through the new content workspace", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Your curious side Sign in to make it yours" })
    .click();
  const login = page.getByRole("dialog");
  await login.getByLabel("Email address").fill("browser-admin@example.test");
  await login
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD!);
  await login.getByRole("button", { name: "Let’s play" }).click();
  await expect(login).not.toBeVisible();
  await page.goto("/admin?section=Quizzes");
  await expect(page.locator(".admin-content-counts")).toContainText("Paid");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Category name").fill("Architecture");
  await dialog.getByRole("button", { name: "Save category" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Create quiz", exact: true }).click();
  await dialog
    .getByLabel("Give your quiz a name")
    .fill("Architecture: a fresh perspective");
  await dialog
    .getByLabel("A little introduction")
    .fill("Explore how buildings shape our everyday surroundings.");
  await dialog
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("Architecture");
  await dialog.getByLabel("Access mode").selectOption("PAID_PER_ATTEMPT");
  await dialog.getByLabel("Entry price in coins").fill("65");
  await dialog
    .getByLabel("Question", { exact: true })
    .fill("Which structure is supported by columns?");
  for (const [index, text] of [
    "A portico",
    "A painting",
    "A carpet",
    "A book",
  ].entries())
    await dialog
      .getByLabel(`Option ${index + 1} for question 1`, { exact: true })
      .fill(text);
  await dialog
    .getByLabel("The aha behind the answer")
    .fill("A portico is a roofed entrance supported by columns.");
  await dialog
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("published");
  await dialog.getByRole("button", { name: "Save & publish" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByLabel("Search managed quizzes")
    .fill("Architecture: a fresh perspective");
  const row = page
    .locator("tr")
    .filter({ hasText: "Architecture: a fresh perspective" });
  await expect(row).toContainText("65 coins");
  await row.getByRole("button", { name: "Edit quiz & price" }).click();
  await dialog.getByLabel("Entry price in coins").fill("85");
  await dialog.getByRole("button", { name: "Save & publish" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText("85 coins");
  await page.locator("h1").click();
  const dismiss = page.getByRole("button", {
    name: "Dismiss notification",
    exact: true,
  });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "artifacts/review/admin-quiz-management.png",
    fullPage: true,
  });
  await page.goto("/?category=Architecture&tab=paid");
  await expect(page.locator(".quiz-card")).toHaveCount(1);
  await expect(page.locator(".quiz-card")).toContainText("85 coins");
  await expect(page.getByLabel("Quiz category", { exact: true })).toHaveValue(
    "Architecture",
  );
  await page
    .locator(".quiz-card")
    .getByRole("link", { name: "Play quiz", exact: true })
    .click();
  await expect(page.locator(".quiz-access-panel")).toContainText("85 coins");
  for (const status of ["draft", "published"]) {
    await page.goto("/admin?section=Quizzes");
    await page
      .getByLabel("Search managed quizzes")
      .fill("Architecture: a fresh perspective");
    await row
      .getByRole("button", { name: "Review content", exact: true })
      .click();
    await dialog
      .getByRole("combobox", { name: "Publication status", exact: true })
      .selectOption(status);
    await dialog
      .getByLabel("Reason for this change")
      .fill("Verified client publication workflow");
    await dialog
      .getByRole("button", { name: "Save publication", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.goto("/?category=Architecture&tab=paid");
    await expect(page.locator(".quiz-card")).toHaveCount(
      status === "draft" ? 0 : 1,
    );
  }
});
