import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import request from "supertest";
import * as models from "./models.js";
import { Settings, PaymentOrder, Wallet, User } from "./models.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { quoteBudget } from "./services/budget-quotes.js";
import { parseEcbRate, exchangeRate } from "./services/exchange-rates.js";
let mongo: MongoMemoryReplSet, buyerId: string;
const app = createApp(), buyer = request.agent(app), admin = request.agent(app);
const originalPayments = config.payments;
const keys = ["MEMBER_ID", "WORKING_KEY", "TW_AUTH_TOKEN", "TW_ENVIRONMENT", "TW_SUPPORTED_CURRENCIES", "TW_ALLOW_LOCAL_CHECKOUT"];
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const send = (agent: any, path: string, data: any) => agent.post(`/api${path}`).set("X-Quizora", "1").send(data);
const edit = (data: any, agent = admin) => agent.put("/api/admin/economy/store-pricing").set("X-Quizora", "1").send(data);
const selection = (quote: any) => ({ purchaseKind: "budget", confirmed: true, coins: quote.coins, amountMinor: quote.amountMinor, currency: quote.currency, pricingVersion: quote.pricingVersion, requestKey: randomBytes(16).toString("hex") });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" }, binary: { version: "7.0.24", downloadDir: resolve(".cache/mongodb") } });
  await mongoose.connect(mongo.getUri(), { dbName: "isolated_budget_purchases" });
  await Promise.all(Object.values(models).map((model) => model.init()));
  Object.assign(process.env, { MEMBER_ID: "budget-test-member", WORKING_KEY: "budget-test-key", TW_AUTH_TOKEN: "budget-test-api-token", TW_ENVIRONMENT: "sandbox", TW_SUPPORTED_CURRENCIES: "USD,EUR", TW_ALLOW_LOCAL_CHECKOUT: "true" });
  config.payments = true;
  await Settings.create({ key: "eur-usd-reference-v1", value: { eurUsd: 1.1, date: new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString(), source: "ECB" } });
  const password = randomBytes(20).toString("hex");
  for (const [agent, username] of [[buyer, "budget_buyer"], [admin, "budget_admin"]] as const) {
    const result = await send(agent, "/auth/register", { displayName: username, username, email: `${username}@example.test`, password, adult: true });
    expect(result.status).toBe(201);
    if (agent === buyer) buyerId = result.body.user.id;
    else await User.updateOne({ _id: result.body.user.id }, { $set: { role: "SUPER_ADMIN" } });
  }
}, 120000);
afterAll(async () => { config.payments = originalPayments; for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } await mongoose.disconnect(); await mongo?.stop(); });

describe("Amount-based USD and EUR store", () => {
  it("prices the full 10–500 USD range at the raised retail rate without volume discounts", async () => {
    expect((await quoteBudget(1000, "USD")).coins).toBe(200);
    expect((await quoteBudget(2500, "USD")).coins).toBe(500);
    expect((await quoteBudget(50000, "USD")).coins).toBe(10000);
    const response = await buyer.get("/api/coin-purchase/options");
    expect(response.body.currencies.map((row: any) => row.code)).toEqual(["USD", "EUR"]);
  });
  it("uses the dated currency reference for exact EUR allocation and returns the reference equivalent", async () => {
    const usd = await quoteBudget(2500, "USD"), eur = await quoteBudget(2500, "EUR");
    expect(eur.coins).toBe(550); expect(eur.amountMinor).toBe(2500); expect(eur.currency).toBe("EUR");
    expect(eur.conversion).toMatchObject({ eurUsd: 1.1, source: "ECB", otherCurrency: "USD", otherAmountMinor: 2750 });
    expect(usd.pricingVersion).not.toBe(eur.pricingVersion);
    expect((await exchangeRate()).eurUsd).toBe(1.1);
  });
  it("rejects out-of-range, fractional and unsupported requests", async () => {
    for (const amount of [0, 999, 1050, 2500.5, 50100]) await expect(quoteBudget(amount, "USD")).rejects.toMatchObject({ status: 400 });
    await expect(quoteBudget(2500, "GBP")).rejects.toMatchObject({ status: 400 });
  });
  it("validates official XML and rejects missing, stale and future reference dates", () => {
    const now = Date.parse("2026-11-23T10:00:00Z");
    const xml = "<Cube time='2026-11-20'><Cube currency='USD' rate='1.0990'/></Cube>";
    expect(parseEcbRate(xml, now).eurUsd).toBe(1.099);
    for (const bad of ["<html>unavailable</html>", xml.replace("1.0990", "0"), xml.replace("2026-11-20", "2026-10-01"), xml.replace("2026-11-20", "2027-01-01")]) expect(() => parseEcbRate(bad, now)).toThrow();
  });
  it("rejects forged coins and stale versions without changing a wallet", async () => {
    const data = selection(await quoteBudget(2500, "USD"));
    for (const changed of [{ coins: 99999 }, { pricingVersion: "0".repeat(64) }]) expect((await send(buyer, "/coin-purchase/checkout", { ...data, ...changed })).status).toBe(409);
    expect(await PaymentOrder.countDocuments()).toBe(0);
    expect((await Wallet.findOne({ userId: buyerId }))?.balance).toBe(0);
  });
  it("creates exactly one EUR order across retries and snapshots the conversion", async () => {
    const data = selection(await quoteBudget(2500, "EUR"));
    const results = await Promise.all(Array.from({ length: 5 }, () => send(buyer, "/coin-purchase/checkout", data)));
    expect(results.every((result) => result.status === 201)).toBe(true);
    expect(new Set(results.map((result) => result.body.orderId)).size).toBe(1);
    expect(results[0].body.paymentData).toMatchObject({ amount: "25.00", currency: "EUR" });
    const order = await PaymentOrder.findById(results[0].body.orderId);
    expect(order?.coins).toBe(550);
    expect(order?.packageSnapshot.sourceVersions.exchangeRate.eurUsd).toBe(1.1);
    expect((await Wallet.findOne({ userId: buyerId }))?.balance).toBe(0);
  });
  it("retires old cheap checkout routes for new orders", async () => {
    expect((await send(buyer, "/coin-purchase/checkout", { confirmed: true, coins: 750, currency: "USD", amountMinor: 716, pricingVersion: "1".repeat(64), requestKey: randomBytes(16).toString("hex") })).status).toBe(410);
    expect((await send(buyer, "/payments/checkout", { packageId: new mongoose.Types.ObjectId().toString(), confirmed: true, requestKey: randomBytes(16).toString("hex"), packageVersion: 1, amountMinor: 299, currency: "USD", coins: 250 })).status).toBe(410);
  });
  it("restricts pricing edits, requires confirmation and rejects concurrent stale updates", async () => {
    const data = { coinsPerUsd: 18, expectedVersion: 1, confirmed: true, reason: "Owner-approved retail price adjustment" };
    expect((await edit(data, buyer)).status).toBe(403);
    expect((await edit({ ...data, confirmed: false })).status).toBe(400);
    const results = await Promise.all([edit(data), edit({ ...data, coinsPerUsd: 19 })]);
    expect(results.map((row) => row.status).sort()).toEqual([200, 409]);
    expect(await models.Audit.countDocuments({ action: "store.pricing_updated" })).toBe(1);
  });
  it("requires fresh consent after a price change while preserving a pending order", async () => {
    const quote = await quoteBudget(2500, "USD"), data = selection(quote);
    const original = await send(buyer, "/coin-purchase/checkout", data);
    expect(original.status).toBe(201);
    const policy = (await admin.get("/api/admin/economy/store-pricing")).body;
    expect((await edit({ coinsPerUsd: 15, expectedVersion: policy.version, confirmed: true, reason: "Reviewed new allocation for future purchases" })).status).toBe(200);
    expect((await send(buyer, "/coin-purchase/checkout", data)).body.orderId).toBe(original.body.orderId);
    expect((await send(buyer, "/coin-purchase/checkout", { ...data, requestKey: randomBytes(16).toString("hex") })).status).toBe(409);
    expect((await PaymentOrder.findById(original.body.orderId))?.coins).toBe(quote.coins);
  });
  it("fails closed for stale EUR references while USD quotes stay available", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Isolated network outage"));
    try {
      await Settings.updateOne({ key: "eur-usd-reference-v1" }, { $set: { "value.date": "2000-01-01", "value.fetchedAt": "2000-01-01T00:00:00Z" } });
      await expect(quoteBudget(2500, "EUR")).rejects.toMatchObject({ status: 503 });
      expect((await quoteBudget(2500, "USD")).coins).toBe(375);
    } finally { fetcher.mockRestore(); }
  });
});
