import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { resolve } from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import request from "supertest";
import * as models from "./models.js";
import {
  User,
  Quiz,
  Attempt,
  Wallet,
  WalletTransaction,
  Competition,
  Participant,
  PaymentOrder,
  PaymentEvent,
  CoinPackage,
  TournamentMember,
} from "./models.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { seed } from "./seed.js";
import { migrateEconomy } from "./economy-migration.js";
import {
  atomic,
  ledger,
  adjustWallet,
  ensureWallet,
} from "./services/wallet.js";
import { savePricing, getPricing } from "./services/pricing.js";
import {
  startAttempt,
  finishAttempt,
  refundFailedAttempt,
  serializeAttempt,
  acknowledgeAttempt,
} from "./services/attempts.js";
import {
  joinCompetition,
  controlCompetition,
} from "./services/competitions.js";
import {
  createCoinOrder,
  createCustomCoinOrder,
  recordCallback,
  responseChecksum,
  verifyCoinOrder,
  decimalMinor,
  gatewayIssues,
  type InquiryResult,
} from "./services/transactworld.js";
import { economyAnalytics } from "./routes/economy.js";
import { createGatewayTokenManager } from "./services/gateway-token.js";
import { launchCommercialProducts } from './commerce-launch.js';
import {coinPricing,quoteCoinPurchase} from './services/coin-quotes.js';
import {safeUser} from './utils.js';
let mongo: MongoMemoryReplSet;
const app = createApp(),
  admin = request.agent(app),
  player = request.agent(app);
const post = (agent: any, path: string, body: any = {}) =>
  agent.post(`/api${path}`).set("X-Quizora", "1").send(body);
let adminId: string, playerId: string;
const oldConfig = {
  payments: config.payments,
  paidCompetitions: config.paidCompetitions,
};
const oldEnv = {
  MEMBER_ID: process.env.MEMBER_ID,
  WORKING_KEY: process.env.WORKING_KEY,
  TW_SUPPORTED_CURRENCIES: process.env.TW_SUPPORTED_CURRENCIES,
  TW_ALLOW_LOCAL_CHECKOUT: process.env.TW_ALLOW_LOCAL_CHECKOUT,
  TW_ENVIRONMENT: process.env.TW_ENVIRONMENT,
  TW_MERCHANT_USERNAME: process.env.TW_MERCHANT_USERNAME,
  TW_PARTNER_ID: process.env.TW_PARTNER_ID,
};
const pricing = (coinPrice = 25, includedAttempts = 1) => ({
  accessType: "PAID_PER_ATTEMPT",
  coinPrice,
  includedAttempts,
  previewQuestions: 0,
  available: true,
});
const consent = (q: any) => ({
  confirmed: true,
  coinPrice: q.pricing.coinPrice,
  pricingVersion: q.pricing.version,
  requestKey: randomUUID(),
});
const questions = [
  {
    id: "q1",
    type: "single",
    prompt: "Which number is even?",
    options: ["One", "Two", "Three", "Five"],
    correct: [1],
    explanation: "Two is even.",
    seconds: 30,
  },
];
async function account(coins = 0) {
  const uid = randomBytes(5).toString("hex");
  const u = await User.create({
    email: `${uid}@example.test`,
    username: uid,
    displayName: "Coin test player",
    adultConfirmedAt: new Date(),
  });
  await ensureWallet(String(u._id));
  if (coins)
    await atomic((s) =>
      ledger(s, {
        userId: String(u._id),
        amount: coins,
        type: "ADMIN_CREDIT",
        reference: randomUUID(),
        reason: "Isolated test account funding",
      }),
    );
  return u;
}
async function quiz(price = 25, included = 1) {
  return Quiz.create({
    title: "A premium test quiz",
    slug: randomUUID(),
    description: "Test content",
    status: "published",
    visibility: "public",
    category: "Science",
    difficulty: "Easy",
    questions,
    pricing: { ...pricing(price, included), version: 1 },
  });
}
const balance = async (u: any) =>
  (await Wallet.findOne({ userId: String(u._id || u) }))!.balance;
async function order(u: any) {
  return PaymentOrder.create({
    userId: String(u._id),
    packageId: new mongoose.Types.ObjectId().toString(),
    packageSnapshot: {
      name: "Isolated gateway test",
      coins: 250,
      bonusCoins: 0,
      version: 1,
    },
    coins: 250,
    amountMinor: 1234,
    currency: "USD",
    merchantRef: randomBytes(32).toString("hex"),
    requestKey: randomUUID(),
    providerPaymentId: String(Math.floor(Math.random() * 1e12)),
  });
}
const capture = (p: any): InquiryResult => ({
  paymentId: p.providerPaymentId,
  merchantTransactionId: p.merchantRef,
  amount: "12.34",
  currency: "USD",
  status: "capturesuccess",
  transactionStatus: "Y",
});
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: { version: "7.0.24", downloadDir: resolve(".cache/mongodb") },
  });
  await mongoose.connect(mongo.getUri(), {
    dbName: "isolated_coin_accounting_tests",
  });
  await Promise.all(Object.values(models).map((m) => m.init()));
  await seed();
  await migrateEconomy();
  const password = randomBytes(20).toString("hex");
  for (const [agent, name] of [
    [admin, "economy_admin"],
    [player, "economy_player"],
  ] as const) {
    const r = await post(agent, "/auth/register", {
      displayName: name,
      username: name,
      email: `${name}@example.test`,
      password,
      adult: true,
    });
    expect(r.status).toBe(201);
    if (name === "economy_admin") adminId = r.body.user.id;
    else playerId = r.body.user.id;
  }
  await User.updateOne({ _id: adminId }, { $set: { role: "SUPER_ADMIN" } });
  config.payments = true;
  config.paidCompetitions = true;
  process.env.MEMBER_ID = "isolated-test-member";
  process.env.WORKING_KEY = "isolated-test-key";
  process.env.TW_SUPPORTED_CURRENCIES = "USD";
  process.env.TW_ALLOW_LOCAL_CHECKOUT = "true";
  process.env.TW_ENVIRONMENT = "sandbox";
  process.env.TW_MERCHANT_USERNAME = "isolatedmerchant";
  process.env.TW_PARTNER_ID = "1000";
}, 120000);
afterAll(async () => {
  Object.assign(config, oldConfig);
  for (const [k, v] of Object.entries(oldEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await mongoose.disconnect();
  await mongo?.stop();
});
describe("Coin accounting and pricing", () => {
  it("migrates once without enabling currency purchases or overwriting intentional seed prices", async () => {
    const before = await CoinPackage.countDocuments();
    await migrateEconomy();
    expect(await CoinPackage.countDocuments()).toBe(before);
    expect(await CoinPackage.countDocuments({ active: true })).toBe(0);
    expect(await Quiz.countDocuments({ "pricing.coinPrice": { $gt: 0 } })).toBe(
      26,
    );
    expect(
      await Quiz.countDocuments({ "pricingDraft.coinPrice": { $gt: 0 } }),
    ).toBeGreaterThan(0);
    expect(await balance(playerId)).toBe(0);
  });
  it("denies player access to administration and other users' purchase records", async () => {
    expect((await player.get("/api/admin/economy/wallets")).status).toBe(403);
    const p = await order(await account());
    expect((await player.get(`/api/payments/${p._id}`)).status).toBe(404);
  });
  it("makes support adjustments idempotent, rejects changed keys and stale balances", async () => {
    const u = await account();
    const data = {
      mode: "credit" as const,
      amount: 80,
      expectedBalance: 0,
      requestKey: randomUUID(),
      reason: "Verified support adjustment",
    };
    const a = await adjustWallet(adminId, String(u._id), data);
    const b = await adjustWallet(adminId, String(u._id), data);
    expect(String(a._id)).toBe(String(b._id));
    expect(await balance(u)).toBe(80);
    await expect(
      adjustWallet(adminId, String(u._id), { ...data, amount: 90 }),
    ).rejects.toThrow(/different/);
    await expect(
      adjustWallet(adminId, String(u._id), {
        ...data,
        requestKey: randomUUID(),
      }),
    ).rejects.toThrow(/balance changed/);
    await expect(
      adjustWallet(adminId, String(u._id), {
        ...data,
        mode: "debit",
        amount: 81,
        expectedBalance: 80,
        requestKey: randomUUID(),
      }),
    ).rejects.toThrow(/enough/);
  });
  it("prevents ledger edits and chains each journal entry", async () => {
    const u = await account(50);
    await atomic((s) =>
      ledger(s, {
        userId: String(u._id),
        amount: -10,
        type: "QUIZ_ENTRY",
        reference: randomUUID(),
        reason: "Journal integrity test",
      }),
    );
    const rows = await WalletTransaction.find({ userId: String(u._id) }).sort({
      sequence: 1,
    });
    expect(rows[0].previousHash).toBe("GENESIS");
    expect(rows[1].previousHash).toBe(rows[0].hash);
    expect((await Wallet.findOne({ userId: String(u._id) }))!.headHash).toBe(
      rows[1].hash,
    );
    await expect(
      WalletTransaction.updateOne(
        { _id: rows[0]._id },
        { $set: { amount: 999 } },
      ),
    ).rejects.toThrow(/append-only/);
    rows[0].amount = 999;
    await expect(rows[0].save()).rejects.toThrow(/immutable/);
  });
  it("keeps pricing drafts private and publishes versioned history only through admin", async () => {
    const q = await quiz();
    await savePricing("quiz", String(q._id), adminId, pricing(50), false);
    expect(getPricing(await Quiz.findById(q._id)).coinPrice).toBe(25);
    await savePricing("quiz", String(q._id), adminId, pricing(50), true);
    expect(getPricing(await Quiz.findById(q._id))).toMatchObject({
      coinPrice: 50,
      version: 2,
    });
    expect(
      await models.PricingHistory.countDocuments({ targetId: String(q._id) }),
    ).toBe(1);
  });
  it("never exposes answer keys in preview questions", async () => {
    const q = await quiz();
    await savePricing(
      "quiz",
      String(q._id),
      adminId,
      {
        ...pricing(),
        accessType: "FREE_PREVIEW_THEN_PAID",
        previewQuestions: 1,
      },
      true,
    );
    const r = await player.get(`/api/quizzes/${q._id}/preview`);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain('"correct"');
    expect(JSON.stringify(r.body)).not.toContain('"explanation"');
  });
  it("requires exact current consent and rejects insufficient balance without creating an attempt", async () => {
    const u = await account(20),
      q = await quiz();
    await expect(startAttempt(String(u._id), String(q._id))).rejects.toThrow(
      /confirm/,
    );
    await expect(
      startAttempt(String(u._id), String(q._id), {
        ...consent(q),
        coinPrice: 1,
      }),
    ).rejects.toThrow(/confirm/);
    await expect(
      startAttempt(String(u._id), String(q._id), consent(q)),
    ).rejects.toThrow(/enough/);
    expect(await Attempt.countDocuments({ userId: String(u._id) })).toBe(0);
    expect(await balance(u)).toBe(20);
  });
  it("charges once for concurrent starts and restores the same paid attempt after repricing", async () => {
    const u = await account(100),
      q = await quiz(),
      c = consent(q);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        startAttempt(String(u._id), String(q._id), c),
      ),
    );
    expect(new Set(results.map((a) => String(a._id))).size).toBe(1);
    expect(await balance(u)).toBe(75);
    await savePricing("quiz", String(q._id), adminId, pricing(75), true);
    const resume = await startAttempt(String(u._id), String(q._id));
    expect(String(resume._id)).toBe(String(results[0]._id));
    expect(resume.billing.coinPrice).toBe(25);
    expect(await balance(u)).toBe(75);
    await finishAttempt(String(u._id), String(resume._id));
    await expect(
      startAttempt(String(u._id), String(q._id), consent(q)),
    ).rejects.toThrow(/confirm/);
    expect(
      String((await startAttempt(String(u._id), String(q._id), c))._id),
    ).toBe(String(resume._id));
  });
  it("preserves purchased included attempts across price changes", async () => {
    const u = await account(100),
      q = await quiz(25, 2);
    const a = await startAttempt(String(u._id), String(q._id), consent(q));
    await finishAttempt(String(u._id), String(a._id));
    await savePricing("quiz", String(q._id), adminId, pricing(90), true);
    const b = await startAttempt(String(u._id), String(q._id));
    expect(b.billing.coinPrice).toBe(0);
    expect(b.billing.coveredBy).toBe(a.billing.transactionId);
    expect(await balance(u)).toBe(75);
  });
  it("prevents overspending across simultaneous entries to different quizzes", async () => {
    const u = await account(25),
      a = await quiz(),
      b = await quiz();
    const r = await Promise.allSettled([
      startAttempt(String(u._id), String(a._id), consent(a)),
      startAttempt(String(u._id), String(b._id), consent(b)),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await balance(u)).toBe(0);
    expect(await Attempt.countDocuments({ userId: String(u._id) })).toBe(1);
  });
  it("refunds verified unlaunched attempts once, even after timer expiry, without leaking keys", async () => {
    const u = await account(50),
      q = await quiz(),
      a = await startAttempt(String(u._id), String(q._id), consent(q));
    await Attempt.updateOne({ _id: a._id }, { $set: { status: "completed" } });
    const first = await refundFailedAttempt(
      adminId,
      String(a._id),
      "Verified server incident prevented this launch",
    );
    const again = await refundFailedAttempt(
      adminId,
      String(a._id),
      "Verified server incident prevented this launch",
    );
    expect(String(first._id)).toBe(String(again._id));
    expect(await balance(u)).toBe(50);
    expect(
      serializeAttempt(await Attempt.findById(a._id)).review,
    ).toBeUndefined();
  });
  it("rejects refunds for acknowledged launches and voluntary finishes", async () => {
    const u = await account(100),
      q = await quiz();
    const a = await startAttempt(String(u._id), String(q._id), consent(q));
    await acknowledgeAttempt(String(u._id), String(a._id));
    await expect(
      refundFailedAttempt(
        adminId,
        String(a._id),
        "Investigated request, no outage found",
      ),
    ).rejects.toThrow(/verified launch failure/);
    await finishAttempt(String(u._id), String(a._id));
    const b = await startAttempt(String(u._id), String(q._id), consent(q));
    await finishAttempt(String(u._id), String(b._id));
    await expect(
      refundFailedAttempt(
        adminId,
        String(b._id),
        "Investigated request, no outage found",
      ),
    ).rejects.toThrow(/verified launch failure/);
  });
});
describe("Paid event entitlements", () => {
  it("charges a competition once, rejects capacity overflow, and refunds cancellation once", async () => {
    const host = await account(),
      u = await account(100),
      other = await account(100);
    const c = await Competition.create({
      title: "Paid entry test",
      hostId: String(host._id),
      code: "C" + randomBytes(4).toString("hex"),
      capacity: 1,
      status: "LOBBY",
      snapshot: questions,
      pricing: { ...pricing(50), accessType: "COMPETITION_ENTRY", version: 1 },
    });
    await Promise.all([
      joinCompetition(c.code, u, consent(c)),
      joinCompetition(c.code, u, consent(c)),
    ]);
    expect(await balance(u)).toBe(50);
    await expect(joinCompetition(c.code, other, consent(c))).rejects.toThrow(
      /full/,
    );
    expect(await balance(other)).toBe(100);
    await controlCompetition(String(c._id), host, "cancel");
    await controlCompetition(String(c._id), host, "cancel");
    expect(await balance(u)).toBe(100);
    expect(
      await WalletTransaction.countDocuments({
        userId: String(u._id),
        type: "COMPETITION_REFUND",
      }),
    ).toBe(1);
  });
  it("blocks paid event registration until the merchant approval flag is active", async () => {
    const u = await account(100);
    const c = await Competition.create({
      title: "Unapproved",
      code: "C" + randomBytes(4).toString("hex"),
      capacity: 5,
      status: "LOBBY",
      snapshot: questions,
      pricing: { ...pricing(50), accessType: "COMPETITION_ENTRY", version: 1 },
    });
    config.paidCompetitions = false;
    try {
      await expect(joinCompetition(c.code, u, consent(c))).rejects.toThrow(
        /merchant approval/,
      );
      expect(await balance(u)).toBe(100);
    } finally {
      config.paidCompetitions = true;
    }
  });
  it("charges one tournament pass for every round and refunds the full pass once on round cancellation", async () => {
    const host = await User.findById(adminId);
    const a = await quiz();
    const closes = new Date(Date.now() + 600000).toISOString();
    const r = await post(admin, "/tournaments", {
      title: "Premium tournament test",
      description: "A two round test tournament",
      visibility: "public",
      capacity: 5,
      registrationClosesAt: closes,
      rounds: [
        {
          quizId: String(a._id),
          startsAt: new Date(Date.now() + 1200000).toISOString(),
        },
        {
          quizId: String(a._id),
          startsAt: new Date(Date.now() + 1800000).toISOString(),
        },
      ],
    });
    expect(r.status).toBe(201);
    const tid = r.body.id;
    await savePricing(
      "tournament",
      tid,
      adminId,
      { ...pricing(100), accessType: "TOURNAMENT_PASS" },
      true,
    );
    await adjustWallet(adminId, playerId, {
      mode: "credit",
      amount: 200,
      expectedBalance: 0,
      reason: "Tournament test funding",
      requestKey: randomUUID(),
    });
    const t = await models.Tournament.findById(tid);
    const c = consent(t);
    expect((await post(player, `/tournaments/${tid}/join`, c)).status).toBe(
      200,
    );
    expect((await post(player, `/tournaments/${tid}/join`, c)).status).toBe(
      200,
    );
    expect(await balance(playerId)).toBe(100);
    expect(
      await TournamentMember.countDocuments({
        tournamentId: tid,
        userId: playerId,
      }),
    ).toBe(1);
    expect(
      await Participant.countDocuments({
        userId: playerId,
        competitionId: { $in: t!.roundIds },
      }),
    ).toBe(2);
    const round = await Competition.findById(t!.roundIds[0]);
    await joinCompetition(round!.code, await User.findById(playerId));
    expect(await balance(playerId)).toBe(100);
    await controlCompetition(String(round!._id), host, "cancel");
    await controlCompetition(String(t!.roundIds[1]), host, "cancel");
    expect(await balance(playerId)).toBe(200);
    expect(
      await WalletTransaction.countDocuments({
        userId: playerId,
        type: "TOURNAMENT_REFUND",
      }),
    ).toBe(1);
  });
});
describe("TransactWorld orders, callbacks and reconciliation", () => {
  it('recovers a missing callback through independently verified merchant-reference Inquiry',async()=>{
    const u=await account(),p=await order(u),paymentId=p.providerPaymentId;
    await PaymentOrder.updateOne({_id:p._id},{$unset:{providerPaymentId:1}});
    const inquiry=vi.fn(async(reference:string,idType?:string)=>{expect(reference).toBe(p.merchantRef);expect(idType).toBe('MID');return {...capture(p),paymentId};});
    await verifyCoinOrder(String(p._id),inquiry);expect(await balance(u)).toBe(250);expect((await PaymentOrder.findById(p._id))!.providerPaymentId).toBe(paymentId);
  });
  it('supports explicitly enabled loopback HTTP development while requiring HTTPS in production',()=>{
    const old={production:config.production,apiUrl:config.apiUrl},environment=process.env.TW_ENVIRONMENT;
    try{config.production=false;config.apiUrl='http://localhost:4000';process.env.TW_ENVIRONMENT='live';expect(gatewayIssues()).not.toContain('Public HTTPS API callbacks are required.');config.production=true;expect(gatewayIssues()).toContain('Public HTTPS API callbacks are required.');}
    finally{Object.assign(config,old);process.env.TW_ENVIRONMENT=environment;}
  });
  it("handles real callback routes through the authenticated Inquiry adapter with mocked provider transport", async () => {
    const u = await account(),
      p = await order(u);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url, init) => {
        if (String(url).endsWith("/authToken"))
          return new Response(
            JSON.stringify({ AuthToken: "isolated-merchant-token" }),
            { status: 200 },
          );
        expect(String(url)).toBe(
          "https://sandbox.transactworld.com/transactionServices/REST/v1/inquiry",
        );
        expect(init!.headers).toMatchObject({
          AuthToken: "isolated-merchant-token",
        });
        const form = init!.body as URLSearchParams;
        expect(form.get("paymentId")).toBe(p.providerPaymentId);
        expect(form.get("idType")).toBe("PID");
        expect(form.get("paymentType")).toBe("IN");
        return new Response(JSON.stringify(capture(p)), { status: 200 });
      });
    try {
      const body = {
        paymentId: p.providerPaymentId,
        merchantTransactionId: p.merchantRef,
        amount: "12.34",
        transactionStatus: "Y",
        checksum: responseChecksum(
          p.providerPaymentId,
          p.merchantRef,
          "12.34",
          "Y",
        ),
      };
      expect(
        (
          await request(app)
            .post(`/api/payments/transactworld/notify/${p.merchantRef}`)
            .type("form")
            .send(body)
        ).status,
      ).toBe(200);
      expect(
        (
          await request(app)
            .post(`/api/payments/transactworld/notify/${p.merchantRef}`)
            .type("form")
            .send(body)
        ).status,
      ).toBe(200);
      expect(await balance(u)).toBe(250);
      expect(
        fetcher.mock.calls.filter(([url]) =>
          String(url).endsWith("/authToken"),
        ),
      ).toHaveLength(1);
      expect(
        await WalletTransaction.countDocuments({
          reference: `purchase:${p._id}`,
        }),
      ).toBe(1);
    } finally {
      fetcher.mockRestore();
    }
  });
  it("preserves pending orders when gateway verification is unavailable and GET returns never credit coins", async () => {
    const u = await account(),
      p = await order(u);
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Isolated gateway outage"));
    try {
      const body = {
        paymentId: p.providerPaymentId,
        merchantTransactionId: p.merchantRef,
        amount: "12.34",
        transactionStatus: "Y",
        checksum: responseChecksum(
          p.providerPaymentId,
          p.merchantRef,
          "12.34",
          "Y",
        ),
      };
      expect(
        (
          await request(app)
            .post(`/api/payments/transactworld/notify/${p.merchantRef}`)
            .type("form")
            .send(body)
        ).status,
      ).toBe(503);
      expect(
        (
          await request(app).get(
            `/api/payments/transactworld/return/${p.merchantRef}?status=capturesuccess`,
          )
        ).status,
      ).toBe(303);
      expect((await PaymentOrder.findById(p._id))!.status).toBe("PENDING");
      expect(await balance(u)).toBe(0);
    } finally {
      fetcher.mockRestore();
    }
  });
  it("caches merchant tokens, refreshes them early, and keeps credentials out of errors", async () => {
    let now = 0;
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ authToken: "isolated-api-token" }), {
          status: 200,
        }),
    );
    const manager = createGatewayTokenManager(
        fetcher as typeof fetch,
        () => now,
      ),
      c = {
        memberId: "test-member",
        workingKey: "test-secret",
        origin: "https://sandbox.transactworld.com",
        authToken: "",
      };
    await Promise.all([manager(c), manager(c), manager(c)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    now = 56 * 60000;
    await manager(c);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await manager(c, true);
    expect(fetcher).toHaveBeenCalledTimes(3);
    const broken = createGatewayTokenManager((async () => {
      throw new Error(c.workingKey);
    }) as typeof fetch);
    await expect(broken(c)).rejects.toThrow(/could not authenticate/);
    try {
      await broken(c);
    } catch (e) {
      expect((e as Error).message).not.toContain(c.workingKey);
    }
  });
  it("uses exact minor units and rejects ambiguous gateway amounts", () => {
    expect(decimalMinor("12.34")).toBe(1234);
    for (const bad of ["12.3", "12.340", "1e2", "-1.00", 12.34])
      expect(() => decimalMinor(bad)).toThrow();
  });
  it("rejects altered package prices and creates one immutable order snapshot per purchase key", async () => {
    const u = await account();
    const p = await CoinPackage.create({
      key: randomUUID(),
      name: "Test package",
      coins: 250,
      bonusCoins: 10,
      amountMinor: 1234,
      currency: "USD",
      active: true,
      version: 1,
    });
    const data = {
      confirmed: true,
      requestKey: randomUUID(),
      packageVersion: 1,
      amountMinor: 1234,
      currency: "USD",
      coins: 260,
    };
    await expect(
      createCoinOrder(
        String(u._id),
        String(p._id),
        { ...data, amountMinor: 1 },
        "127.0.0.1",
      ),
    ).rejects.toThrow(/changed/);
    const first = await createCoinOrder(
      String(u._id),
      String(p._id),
      data,
      "127.0.0.1",
    );
    await CoinPackage.updateOne(
      { _id: p._id },
      { $set: { amountMinor: 9999, coins: 9999, version: 2 } },
    );
    const again = await createCoinOrder(
      String(u._id),
      String(p._id),
      data,
      "127.0.0.1",
    );
    expect(again.orderId).toBe(first.orderId);
    expect(first.paymentData?.amount).toBe("12.34");
    expect(first.forwardUrl).toBe(
      "https://sandbox.transactworld.com/transaction/Checkout",
    );
    expect(JSON.stringify(first)).not.toContain("isolated-test-key");
    expect(await balance(u)).toBe(0);
  });
  it("rejects unsigned callbacks and replayed signed callbacks never award coins directly", async () => {
    const u = await account(),
      p = await order(u);
    const body = {
      paymentId: p.providerPaymentId,
      merchantTransactionId: p.merchantRef,
      amount: "12.34",
      transactionStatus: "Y",
      checksum: "0".repeat(32),
    };
    await expect(
      recordCallback(p.merchantRef, body, "notification"),
    ).rejects.toThrow(/checksum/);
    body.checksum = responseChecksum(
      p.providerPaymentId,
      p.merchantRef,
      "12.34",
      "Y",
    );
    await recordCallback(p.merchantRef, body, "notification");
    await recordCallback(p.merchantRef, body, "notification");
    expect(await PaymentEvent.countDocuments({ orderId: String(p._id) })).toBe(
      1,
    );
    expect(await balance(u)).toBe(0);
    await expect(
      recordCallback(
        p.merchantRef,
        {
          ...body,
          amount: "1.00",
          checksum: responseChecksum(
            p.providerPaymentId,
            p.merchantRef,
            "1.00",
            "Y",
          ),
        },
        "notification",
      ),
    ).rejects.toThrow(/amount/);
  });
  it("requires matching independent inquiry evidence and ignores short success alone", async () => {
    const u = await account(),
      p = await order(u);
    await verifyCoinOrder(String(p._id), async () => ({
      ...capture(p),
      status: "pending",
    }));
    expect(await balance(u)).toBe(0);
    for (const changes of [
      { currency: "EUR" },
      { amount: "12.35" },
      { merchantTransactionId: randomBytes(32).toString("hex") },
      { paymentId: "999" },
    ])
      await expect(
        verifyCoinOrder(String(p._id), async () => ({
          ...capture(p),
          ...changes,
        })),
      ).rejects.toThrow(/does not match/);
    expect(await balance(u)).toBe(0);
  });
  it("credits one purchase despite concurrent independent verifications and later package edits", async () => {
    const u = await account(),
      p = await order(u);
    await Promise.all(
      Array.from({ length: 6 }, () =>
        verifyCoinOrder(String(p._id), async () => capture(p)),
      ),
    );
    expect(await balance(u)).toBe(250);
    expect(
      await WalletTransaction.countDocuments({
        reference: `purchase:${p._id}`,
      }),
    ).toBe(1);
    expect((await PaymentOrder.findById(p._id))!.status).toBe("PAID");
  });
  it("handles cumulative partial/full reversals once and holds spent coins against future credits", async () => {
    const u = await account(),
      p = await order(u);
    await verifyCoinOrder(String(p._id), async () => capture(p));
    await atomic((s) =>
      ledger(s, {
        userId: String(u._id),
        amount: -240,
        type: "QUIZ_ENTRY",
        reference: randomUUID(),
        reason: "Spent before gateway reversal",
      }),
    );
    const evidence = {
      ...capture(p),
      status: "refundsuccess",
      refundamount: "6.17",
    };
    await verifyCoinOrder(String(p._id), async () => evidence);
    await verifyCoinOrder(String(p._id), async () => evidence);
    let w = await Wallet.findOne({ userId: String(u._id) });
    expect(w!.balance).toBe(0);
    expect(w!.reversalHold).toBe(115);
    await verifyCoinOrder(String(p._id), async () => ({
      ...evidence,
      refundamount: "12.34",
    }));
    w = await Wallet.findOne({ userId: String(u._id) });
    expect(w!.reversalHold).toBe(240);
    await atomic((s) =>
      ledger(s, {
        userId: String(u._id),
        amount: 250,
        type: "ADMIN_CREDIT",
        reference: randomUUID(),
        reason: "Independent test credit offsets hold",
      }),
    );
    expect(await balance(u)).toBe(10);
    expect(
      (await Wallet.findOne({ userId: String(u._id) }))!.reversalHold,
    ).toBe(0);
    expect((await PaymentOrder.findById(p._id))!.status).toBe("REFUNDED");
  });
  it("does not count support grants, coin consumption or pending orders as revenue", async () => {
    const analytics = await economyAnalytics();
    const captured = await PaymentOrder.find({ creditedAt: { $exists: true } });
    expect(
      analytics.revenue.reduce((n: number, r: any) => n + r.grossMinor, 0),
    ).toBe(captured.reduce((n, p) => n + p.amountMinor, 0));
    expect(analytics.revenue[0]._id).toBe("USD");
    expect(
      analytics.journal.find((r: any) => r._id === "ADMIN_CREDIT")!.coins,
    ).toBeGreaterThan(0);
  });
});

describe('Owner-approved commercial launch and review holds',()=>{
  it('publishes affordable plans only after explicit approval and never overwrites later admin changes',async()=>{
    await expect(launchCommercialProducts(false)).rejects.toThrow(/approval/);
    await launchCommercialProducts(true);
    const packs=await CoinPackage.find({key:{$in:['starter','popular','pro','ultimate']}}).sort({displayOrder:1});
    expect(packs.map(p=>p.amountMinor)).toEqual([299,599,1299,2499]);expect(packs.every(p=>p.active&&p.currency==='USD')).toBe(true);
    expect(await Quiz.countDocuments({ownerId:'platform',seedKey:{$exists:true},'pricing.coinPrice':{$gt:0}})).toBe(26);
    const p=packs[0];p.amountMinor=349;await p.save();await launchCommercialProducts(true);expect((await CoinPackage.findById(p._id))!.amountMinor).toBe(349);
  });
  it('previews support credits and target balances correctly when payment reversal coins are held',async()=>{
    const u=await account(),uid=String(u._id);await atomic(s=>ledger(s,{userId:uid,amount:-80,type:'PAYMENT_REVERSAL',reference:randomUUID(),reason:'Verified test reversal',allowHold:true}));
    await adjustWallet(adminId,uid,{mode:'credit',amount:30,expectedBalance:0,expectedReversalHold:80,reason:'Verified support hold correction',requestKey:randomUUID()});expect(await balance(u)).toBe(0);
    await expect(adjustWallet(adminId,uid,{mode:'credit',amount:10,expectedBalance:0,expectedReversalHold:80,reason:'Stale hold preview rejected',requestKey:randomUUID()})).rejects.toThrow(/balance changed/);
    const entry=await adjustWallet(adminId,uid,{mode:'target',amount:20,expectedBalance:0,expectedReversalHold:50,reason:'Reviewed target and remaining hold',requestKey:randomUUID()});expect(entry.amount).toBe(70);expect(await balance(u)).toBe(20);expect((await Wallet.findOne({userId:uid}))!.reversalHold).toBe(0);
  });
});
