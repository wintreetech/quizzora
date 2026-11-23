import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import request from "supertest";
import * as models from "./models.js";
import { CoinPackage, PaymentOrder, Wallet, User } from "./models.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { coinPricing, quoteCoinPurchase } from "./services/coin-quotes.js";
import { safeUser } from "./utils.js";
import {
  loadMerchantIdentity,
  merchantIdentity,
} from "./services/merchant-settings.js";
import { gatewayConfig, createCustomCoinOrder } from "./services/transactworld.js";
let mongo: MongoMemoryReplSet, highAnchorId: string;
const originalEnv = {
  MEMBER_ID: process.env.MEMBER_ID,
  WORKING_KEY: process.env.WORKING_KEY,
  TW_AUTH_TOKEN: process.env.TW_AUTH_TOKEN,
  TW_ENVIRONMENT: process.env.TW_ENVIRONMENT,
  TW_SUPPORTED_CURRENCIES: process.env.TW_SUPPORTED_CURRENCIES,
  TW_ALLOW_LOCAL_CHECKOUT: process.env.TW_ALLOW_LOCAL_CHECKOUT,
};
const originalPayments = config.payments;
const app = createApp(),
  buyer = request.agent(app),
  other = request.agent(app);
const send = (agent: any, path: string, data: any) =>
  agent.post(`/api${path}`).set("X-Quizora", "1").send(data);
const progress = (agent: any, data: any) =>
  agent.patch("/api/auth/onboarding").set("X-Quizora", "1").send(data);
const password = randomBytes(20).toString("hex");
let buyerId: string;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: { version: "7.0.24", downloadDir: resolve(".cache/mongodb") },
  });
  await mongoose.connect(mongo.getUri(), {
    dbName: "isolated_custom_coin_tests",
  });
  await Promise.all(Object.values(models).map((m) => m.init()));
  Object.assign(process.env, {
    MEMBER_ID: "isolated-member",
    WORKING_KEY: "isolated-key",
    TW_AUTH_TOKEN: "isolated-static-test-token",
    TW_ENVIRONMENT: "sandbox",
    TW_SUPPORTED_CURRENCIES: "USD,EUR",
    TW_ALLOW_LOCAL_CHECKOUT: "true",
  });
  config.payments = true;
  await CoinPackage.create({
    key: "price-low",
    name: "Base price point",
    coins: 100,
    bonusCoins: 0,
    amountMinor: 100,
    currency: "USD",
    active: true,
    displayOrder: 0,
    version: 1,
  });
  const high = await CoinPackage.create({
    key: "price-high",
    name: "Volume price point",
    coins: 1000,
    bonusCoins: 0,
    amountMinor: 800,
    currency: "USD",
    active: true,
    displayOrder: 1,
    version: 1,
  });
  highAnchorId = String(high._id);
  for (const [agent, name] of [
    [buyer, "slider_buyer"],
    [other, "tour_other"],
  ] as const) {
    const response = await send(agent, "/auth/register", {
      displayName: name,
      username: name,
      email: `${name}@example.test`,
      password,
      adult: true,
    });
    expect(response.status).toBe(201);
    if (name === "slider_buyer") buyerId = response.body.user.id;
  }
}, 120000);
afterAll(async () => {
  config.payments = originalPayments;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await mongoose.disconnect();
  await mongo?.stop();
});
describe("Custom coin slider quotes and checkout", () => {
  it("computes different exact prices for custom quantities and preserves configured endpoints", async () => {
    const actual = [];
    for (const coins of [100, 250, 500, 750, 1000, 10000])
      actual.push((await quoteCoinPurchase(coins, "USD")).amountMinor);
    expect(actual).toEqual([100, 217, 411, 606, 800, 8000]);
    expect((await coinPricing()).currency).toBe("USD");
  });
  it("rejects out-of-range, fractional and unsupported quantities/currencies", async () => {
    for (const coins of [0, 50, 101, 149, 500.5, 10050])
      await expect(quoteCoinPurchase(coins, "USD")).rejects.toThrow(/Choose/);
    await expect(quoteCoinPurchase(500, "EUR")).rejects.toThrow(/unavailable/);
    expect(
      (await buyer.get("/api/coin-purchase/quote?coins=not-a-number")).status,
    ).toBe(400);
  });
  it("does not create an order or change wallet balance for a forged price or version", async () => {
    const q = await quoteCoinPurchase(500, "USD");
    for (const change of [
      { amountMinor: 1 },
      { pricingVersion: "0".repeat(64) },
    ])
      await expect(
          createCustomCoinOrder(buyerId, {
            confirmed: true,
            coins: 500,
            currency: "USD",
            amountMinor: q.amountMinor,
            pricingVersion: q.pricingVersion,
            requestKey: randomUUID(),
            ...change,
          }, "127.0.0.1")
      ).rejects.toMatchObject({ status: 409 });
    expect(await PaymentOrder.countDocuments()).toBe(0);
    expect((await Wallet.findOne({ userId: buyerId }))!.balance).toBe(0);
  });
  it("creates one signed pending custom order across concurrent retries and snapshots the quantity", async () => {
    const q = await quoteCoinPurchase(500, "USD"),
      data = {
        confirmed: true,
        coins: q.coins,
        amountMinor: q.amountMinor,
        currency: q.currency,
        pricingVersion: q.pricingVersion,
        requestKey: randomUUID(),
      };
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        createCustomCoinOrder(buyerId, data, "127.0.0.1"),
      ),
    );
    expect(new Set(responses.map((r) => r.orderId)).size).toBe(1);
    expect(responses[0].paymentData?.amount).toBe("4.11");
    const order = await PaymentOrder.findById(responses[0].orderId);
    expect(order!.coins).toBe(500);
    expect(order!.packageSnapshot.name).toBe("Custom coin top-up");
    expect((await Wallet.findOne({ userId: buyerId }))!.balance).toBe(0);
    await expect(createCustomCoinOrder(buyerId, { ...data, coins: 750 }, "127.0.0.1")).rejects.toMatchObject({ status: 409 });
  });
  it("requires a new confirmation after pricing changes while preserving an existing order", async () => {
    const q = await quoteCoinPurchase(750, "USD"),
      data = {
        confirmed: true,
        coins: q.coins,
        amountMinor: q.amountMinor,
        currency: q.currency,
        pricingVersion: q.pricingVersion,
        requestKey: randomUUID(),
      };
    const order = await createCustomCoinOrder(buyerId, data, "127.0.0.1");
    await CoinPackage.updateOne(
      { _id: highAnchorId },
      { $set: { amountMinor: 850 }, $inc: { version: 1 } },
    );
    expect(
      (await createCustomCoinOrder(buyerId, data, "127.0.0.1")).orderId,
    ).toBe(order.orderId);
    await expect(
        createCustomCoinOrder(buyerId, {
          ...data,
          requestKey: randomUUID(),
        }, "127.0.0.1")
    ).rejects.toMatchObject({ status: 409 });
    expect((await quoteCoinPurchase(750, "USD")).pricingVersion).not.toBe(
      q.pricingVersion,
    );
  });
});
describe("First-signup guide persistence", () => {
  it("requires the guide for new accounts and keeps legacy accounts unaffected", async () => {
    const me = await buyer.get("/api/auth/me");
    expect(me.body.user.onboarding).toMatchObject({
      required: true,
      status: "pending",
      step: 0,
    });
    const legacy = await User.create({
      email: "legacy@example.test",
      username: "legacy",
      displayName: "Legacy account",
    });
    expect(safeUser(legacy).onboarding.required).toBe(false);
  });
  it("saves progress only for the current account and remembers completion", async () => {
    expect(
      (await progress(buyer, { version: 1, step: 2, status: "in_progress" }))
        .status,
    ).toBe(200);
    expect((await buyer.get("/api/auth/me")).body.user.onboarding.step).toBe(2);
    expect((await other.get("/api/auth/me")).body.user.onboarding.step).toBe(0);
    await progress(buyer, { version: 1, step: 4, status: "completed" });
    await send(buyer, "/auth/logout", {});
    await send(buyer, "/auth/login", {
      email: "slider_buyer@example.test",
      password,
    });
    expect(
      (await buyer.get("/api/auth/me")).body.user.onboarding,
    ).toMatchObject({ required: false, status: "completed", step: 4 });
  });
  it("remembers skipping and validates guide requests", async () => {
    await progress(other, { version: 1, step: 0, status: "skipped" });
    expect(
      (await other.get("/api/auth/me")).body.user.onboarding.required,
    ).toBe(false);
    expect(
      (await progress(buyer, { version: 1, step: 10, status: "in_progress" }))
        .status,
    ).toBe(400);
    expect(
      (await progress(request(app), { version: 1, step: 0, status: "skipped" }))
        .status,
    ).toBe(401);
  });
});

describe("Verified merchant connection", () => {
  const details = {
    merchantUsername: "connectedmerchant",
    partnerId: "777",
    reason: "Connect verified merchant for custom coin purchases",
    confirmed: true,
  };
  it("rejects unauthorized changes and never saves a rejected provider connection", async () => {
    expect(
      (await send(buyer, "/admin/economy/gateway/connect", details)).status,
    ).toBe(403);
    await User.updateOne(
      { username: "tour_other" },
      { $set: { role: "SUPER_ADMIN" } },
    );
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            result: { code: "30055", description: "Invalid partner" },
          }),
          { status: 200 },
        ),
      );
    try {
      expect(
        (await send(other, "/admin/economy/gateway/connect", details)).status,
      ).toBe(503);
      expect(
        await models.Settings.exists({
          key: "transactworld-merchant-identity",
        }),
      ).toBeNull();
    } finally {
      fetcher.mockRestore();
    }
  });
  it("verifies before saving non-secret account identity, audits it and scopes it to this merchant", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_url, init) => {
        const form = init!.body as URLSearchParams;
        expect(form.get("merchant.username")).toBe(details.merchantUsername);
        expect(form.get("authentication.partnerId")).toBe(details.partnerId);
        return new Response(
          JSON.stringify({ AuthToken: "connected-test-token" }),
          { status: 200 },
        );
      });
    try {
      const response = await send(
        other,
        "/admin/economy/gateway/connect",
        details,
      );
      expect(response.status).toBe(200);
      expect(response.body.authenticated).toBe(true);
      const record = await models.Settings.findOne({
        key: "transactworld-merchant-identity",
      });
      expect(record!.value).toMatchObject({
        merchantUsername: details.merchantUsername,
        partnerId: details.partnerId,
      });
      expect(JSON.stringify(record)).not.toContain("connected-test-token");
      expect(JSON.stringify(record)).not.toContain("isolated-key");
      await loadMerchantIdentity();
      expect(merchantIdentity().merchantUsername).toBe(
        details.merchantUsername,
      );
      expect(gatewayConfig().authToken).toBe('');
      expect(
        await models.Audit.countDocuments({
          action: "payment.merchant_identity_verified",
        }),
      ).toBe(1);
      expect(
        JSON.stringify((await buyer.get("/api/coin-packages")).body),
      ).not.toContain(details.merchantUsername);
    } finally {
      fetcher.mockRestore();
    }
  });
});
