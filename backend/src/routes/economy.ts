import express, { Router } from "express";
import { z } from "zod";
import { requireAuth, allow } from "../auth.js";
import { config } from "../config.js";
import {
  Wallet,
  WalletTransaction,
  CoinPackage,
  PaymentOrder,
  PaymentEvent,
  User,
  Quiz,
  Competition,
  Tournament,
  Participant,
  Attempt,
  PricingHistory,
  Audit,
  AnalyticsEvent,
  Entitlement,
} from "../models.js";
import { HttpError, id, locked } from "../utils.js";
import { ensureWallet, adjustWallet, atomic } from "../services/wallet.js";
import { getPricing, savePricing, modelFor } from "../services/pricing.js";
import {
  gatewayConfig,
  gatewayIssues,
  createCoinOrder,
  createCustomCoinOrder,
  createBudgetCoinOrder,
  recordCallback,
  verifyCoinOrder,
} from "../services/transactworld.js";
import { refundFailedAttempt } from "../services/attempts.js";
import { gatewayAuthToken } from "../services/gateway-token.js";
import { coinPricing, quoteCoinPurchase } from "../services/coin-quotes.js";
import { saveMerchantIdentity } from "../services/merchant-settings.js";
import { storePricing, quoteBudget } from "../services/budget-quotes.js";
import { exchangeRate } from "../services/exchange-rates.js";
import { Settings } from "../models.js";
export const economy = Router(),
  economyAdmin = Router(),
  gatewayCallbacks = Router();
const key = z.string().regex(/^[A-Za-z0-9_-]{16,100}$/);
const packView = (p: any) => ({
  id: id(p),
  name: p.name,
  description: p.description,
  coins: p.coins,
  bonusCoins: p.bonusCoins,
  amountMinor: p.amountMinor,
  currency: p.currency,
  active: p.active,
  version: p.version,
  displayOrder: p.displayOrder,
});
export const paymentView = (p: any) => ({
  id: id(p),
  status: p.status,
  coins: p.coins,
  amountMinor: p.amountMinor,
  currency: p.currency,
  packageName: p.packageSnapshot.name,
  packageId: p.packageId,
  merchantRef: p.merchantRef,
  providerPaymentId: p.providerPaymentId,
  createdAt: p.createdAt,
  creditedAt: p.creditedAt,
  verifiedAt: p.verifiedAt,
  refundedMinor: p.refundedMinor,
  refundedCoins: p.reversedCoins,
  lastCheckedAt: p.lastCheckedAt,
  lastVerificationError: p.lastVerificationError,
});
economy.get("/coin-packages", async (_req, res) => {
  const packs = await CoinPackage.find().sort({ displayOrder: 1 });
  const prices = await Quiz.find({
    status: "published",
    visibility: "public",
    "pricing.coinPrice": { $gt: 0 },
    "pricing.available": true,
  })
    .select("title pricing")
    .limit(100)
    .lean();
  res.json({
    items: packs.map(packView),
    checkoutAvailable: gatewayIssues().length === 0,
    environment: gatewayConfig().environment,
    coinsExpire: false,
    examples: prices.map((p) => ({
      title: p.title,
      coinPrice: p.pricing.coinPrice,
    })),
    policy:
      "Coins are non-transferable digital access credits with no cash value. They do not expire. Paid replays require a new confirmation. Verified platform launch failures and host cancellations restore eligible entry coins once.",
  });
});
economy.get("/coin-purchase/options", async (_req, res) => {
  const pricing = await storePricing();
  const reference = await exchangeRate().catch(() => null);
  const ready = gatewayIssues().length === 0;
  res.json({
    ...pricing,
    checkoutAvailable: ready,
    currencies: ["USD", "EUR"].map((code) => ({ code, quotingAvailable: code === "USD" || !!reference, checkoutAvailable: ready && gatewayConfig().currencies.includes(code) })),
    currency: "USD", defaultAmountMinor: 2500,
    exchangeReference: reference ? { eurUsd: reference.eurUsd, date: reference.date, source: reference.source } : null,
  });
});
economy.get("/coin-purchase/quote", async (req, res) => {
  const data = z
    .object({
      amountMinor: z.coerce.number().int(),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .optional(),
    })
    .parse(req.query);
  const { sourceVersions, ...quote } = await quoteBudget(
    data.amountMinor,
    data.currency || "USD",
  );
  res.json(quote);
});
economy.post("/coin-purchase/checkout", requireAuth, async (req, res) => {
  const legacyKey = key.safeParse(req.body?.requestKey);
  if (req.body?.purchaseKind !== "budget" && (!legacyKey.success || !(await PaymentOrder.exists({ userId: id(req.user), requestKey: legacyKey.data }))))
    throw new HttpError(410, "Coin pricing has changed. Reopen the coin store to choose your purchase amount.");
  if (gatewayIssues().length)
    throw new HttpError(
      503,
      "Checkout is temporarily unavailable. No payment has been taken. Please try again later.",
    );
  try {
    await gatewayAuthToken(gatewayConfig());
  } catch {
    throw new HttpError(
      503,
      "Our payment partner could not start secure checkout. No payment has been taken. Please try again later.",
    );
  }
  res
    .status(201)
    .json(
      await (req.body.purchaseKind === "budget" ? createBudgetCoinOrder : createCustomCoinOrder)(
        id(req.user),
        req.body,
        req.ip || req.socket.remoteAddress || "",
      ),
    );
});
economy.get("/wallet", requireAuth, async (req, res) => {
  const userId = id(req.user);
  const w = await ensureWallet(userId);
  const totals = await WalletTransaction.aggregate([
    { $match: { userId } },
    {
      $group: { _id: "$type", amount: { $sum: "$amount" }, count: { $sum: 1 } },
    },
  ]);
  res.json({
    balance: w.balance,
    reversalHold: w.reversalHold,
    sequence: w.sequence,
    totals,
    coinsExpire: false,
  });
});
economy.get("/wallet/history", requireAuth, async (req, res) => {
  const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .catch(1)
      .parse(req.query.page),
    filter = { userId: id(req.user) };
  res.json({
    items: await WalletTransaction.find(filter)
      .sort({ sequence: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean(),
    total: await WalletTransaction.countDocuments(filter),
    page,
  });
});
economy.get("/payments", requireAuth, async (req, res) =>
  res.json({
    items: (
      await PaymentOrder.find({ userId: id(req.user) })
        .sort({ createdAt: -1 })
        .limit(100)
    ).map(paymentView),
  }),
);
economy.post("/payments/checkout", requireAuth, async (req, res) => {
  const { packageId, ...input } = z
    .object({
      packageId: z.string().length(24),
      confirmed: z.literal(true),
      requestKey: key,
      packageVersion: z.number().int(),
      amountMinor: z.number().int().positive(),
      currency: z.string().length(3),
      coins: z.number().int().positive(),
    })
    .parse(req.body);
  if (!(await PaymentOrder.exists({ userId: id(req.user), requestKey: input.requestKey, packageId })))
    throw new HttpError(410, "Fixed-package purchases have been replaced. Reopen the coin store to choose your amount.");
  if (gatewayIssues().length)
    throw new HttpError(
      503,
      "Checkout is temporarily unavailable. No payment has been taken. Please try again later.",
    );
  try {
    await gatewayAuthToken(gatewayConfig());
  } catch {
    throw new HttpError(
      503,
      "Our payment partner could not start secure checkout. No payment has been taken. Please try again later.",
    );
  }
  res
    .status(201)
    .json(
      await createCoinOrder(
        id(req.user),
        packageId,
        input,
        req.ip || req.socket.remoteAddress || "",
      ),
    );
});
economy.get("/payments/:id", requireAuth, async (req, res) => {
  const p = await PaymentOrder.findOne({
    _id: req.params.id,
    userId: id(req.user),
  });
  if (!p) throw new HttpError(404, "Purchase not found.");
  res.json(paymentView(p));
});
economy.post("/payments/:id/verify", requireAuth, async (req, res) => {
  const p = await PaymentOrder.findOne({
    _id: req.params.id,
    userId: id(req.user),
  });
  if (!p) throw new HttpError(404, "Purchase not found.");
  res.json(paymentView(await verifyCoinOrder(id(p))));
});
economy.post("/analytics/event", requireAuth, async (req, res) => {
  const data = z
    .object({
      kind: z.enum(["PREMIUM_VIEW", "STORE_VIEW"]),
      targetId: z.string().max(100).default("store"),
    })
    .parse(req.body);
  await AnalyticsEvent.updateOne(
    {
      userId: id(req.user),
      ...data,
      day: new Date().toISOString().slice(0, 10),
    },
    { $setOnInsert: {} },
    { upsert: true },
  );
  res.json({ ok: true });
});
gatewayCallbacks.use(
  express.urlencoded({ extended: false, limit: "32kb" }),
  express.json({ limit: "32kb" }),
);
gatewayCallbacks.post("/notify/:ref", async (req, res) => {
  const { order, eventKey } = await recordCallback(
    String(req.params.ref),
    req.body,
    "notification",
  );
  await verifyCoinOrder(id(order));
  await PaymentEvent.updateOne(
    { eventKey },
    { $set: { processedAt: new Date() } },
  );
  res.json({ received: true });
});
gatewayCallbacks.all("/return/:ref", async (req, res) => {
  if (!["GET", "POST"].includes(req.method))
    throw new HttpError(405, "Unsupported return method.");
  const order = await PaymentOrder.findOne({ merchantRef: req.params.ref });
  if (!order) throw new HttpError(404, "Purchase not found.");
  if (req.method === "POST") {
    const result = await recordCallback(
      String(req.params.ref),
      req.body,
      "return",
    );
    try {
      await verifyCoinOrder(id(result.order));
      await PaymentEvent.updateOne(
        { eventKey: result.eventKey },
        { $set: { processedAt: new Date() } },
      );
    } catch (e) {
      if ((e as HttpError).status !== 503) throw e;
    }
  }
  res.redirect(303, `${config.origin}/purchase/${order._id}`);
});
economyAdmin.use(allow("SUPER_ADMIN"));
economyAdmin.get("/store-pricing", async (_req, res) => res.json(await storePricing()));
economyAdmin.put("/store-pricing", async (req, res) => {
  const data = z.object({ coinsPerUsd: z.number().int().min(1).max(10000), expectedVersion: z.number().int().min(1), confirmed: z.literal(true), reason: z.string().trim().min(10).max(500) }).parse(req.body);
  await atomic(async (session) => {
    const row = await Settings.findOne({ key: "coin-store-pricing-v2" }).session(session);
    const before = row?.value || { coinsPerUsd: 20, version: 1 };
    if (before.version !== data.expectedVersion) throw new HttpError(409, "Store pricing changed. Refresh before editing.");
    const value = { coinsPerUsd: data.coinsPerUsd, version: before.version + 1 };
    await Settings.updateOne({ key: "coin-store-pricing-v2" }, { $set: { value } }, { upsert: true, session });
    await Audit.create([{ actorId: id(req.user), action: "store.pricing_updated", targetId: "coin-store-pricing-v2", details: { before, after: value, reason: data.reason } }], { session });
  });
  res.json(await storePricing());
});
economyAdmin.get("/wallets", async (req, res) => {
  const search = z.string().max(100).catch("").parse(req.query.q);
  const users = await User.find(
    search
      ? {
          $or: [
            {
              username: {
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i",
              },
            },
            { email: search.toLowerCase() },
          ],
        }
      : {},
  )
    .sort({ createdAt: -1 })
    .limit(100);
  const items = [];
  for (const u of users) {
    const wallet = await ensureWallet(id(u));
    items.push({
      userId: id(u),
      displayName: u.displayName,
      username: u.username,
      email: u.email,
      balance: wallet.balance,
      reversalHold: wallet.reversalHold,
    });
  }
  res.json({ items });
});
economyAdmin.get("/users/:id", async (req, res) => {
  const userId = String(req.params.id);
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, "Account not found.");
  const wallet = await ensureWallet(userId);
  res.json({
    user: {
      id: userId,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
    },
    wallet: { balance: wallet.balance, reversalHold: wallet.reversalHold },
    transactions: await WalletTransaction.find({ userId })
      .sort({ sequence: -1 })
      .limit(100)
      .lean(),
    purchases: (
      await PaymentOrder.find({ userId }).sort({ createdAt: -1 }).limit(100)
    ).map(paymentView),
    attempts: await Attempt.find({ userId })
      .select("title status score accuracy createdAt billing")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    participations: await Participant.find({ userId })
      .select("-__v")
      .limit(100)
      .lean(),
    audit: await Audit.find({
      $or: [{ actorId: userId }, { targetId: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  });
});
economyAdmin.post("/wallets/:id/adjust", async (req, res) => {
  const data = z
    .object({
      mode: z.enum(["credit", "debit", "target"]),
      amount: z.number().int().min(0).max(1000000),
      expectedBalance: z.number().int().nonnegative(),
      expectedReversalHold: z.number().int().nonnegative().default(0),
      reason: z.string().trim().min(10).max(500),
      requestKey: key,
      confirmed: z.literal(true),
    })
    .parse(req.body);
  res.json(await adjustWallet(id(req.user), String(req.params.id), data));
});
economyAdmin.get("/packages", async (_req, res) =>
  res.json({
    items: (await CoinPackage.find().sort({ displayOrder: 1 })).map(packView),
    merchantCurrencies: gatewayConfig().currencies,
    checkoutAvailable: gatewayIssues().length === 0,
  }),
);
const packageSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().max(300),
    coins: z.number().int().min(1).max(1000000),
    bonusCoins: z.number().int().min(0).max(100000),
    amountMinor: z.number().int().min(1).max(100000000).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    active: z.boolean(),
    displayOrder: z.number().int().min(0).max(100),
  })
  .superRefine((p, c) => {
    if (
      p.active &&
      (!p.amountMinor ||
        !p.currency ||
        !gatewayConfig().currencies.includes(p.currency))
    )
      c.addIssue({
        code: "custom",
        message:
          "Active packages require a configured amount and an approved merchant currency.",
      });
    if (
      p.currency &&
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: p.currency,
      }).resolvedOptions().maximumFractionDigits !== 2
    )
      c.addIssue({
        code: "custom",
        message: "This checkout supports two-decimal merchant currencies.",
      });
  });
economyAdmin.post("/packages", async (req, res) => {
  const data = packageSchema.parse(req.body);
  const p = await CoinPackage.create({
    ...data,
    key: crypto.randomUUID(),
    version: 1,
  });
  await Audit.create({
    actorId: id(req.user),
    action: "coin_package.create",
    targetId: id(p),
    details: data,
  });
  res.status(201).json(packView(p));
});
economyAdmin.put("/packages/:id", async (req, res) => {
  const data = packageSchema.parse(req.body);
  const p = await CoinPackage.findById(req.params.id);
  if (!p) throw new HttpError(404, "Package not found.");
  const before = packView(p);
  Object.assign(p, data);
  p.version++;
  await p.save();
  await Audit.create({
    actorId: id(req.user),
    action: "coin_package.update",
    targetId: id(p),
    details: { before, after: packView(p) },
  });
  res.json(packView(p));
});
economyAdmin.get("/pricing/:kind", async (req, res) => {
  const kind = String(req.params.kind),
    Model = modelFor(kind);
  if (!Model) throw new HttpError(404, "Content type not found.");
  const rows = await Model.find()
    .select(
      "title status category difficulty questions pricing pricingDraft tournamentId",
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({
    items: rows.map((p) => ({
      id: id(p),
      title: p.title,
      status: p.status,
      category: p.category,
      difficulty: p.difficulty,
      questionCount: p.questions?.length,
      pricing: getPricing(p),
      draft: p.pricingDraft,
      tournamentId: p.tournamentId,
    })),
    paidEntriesEnabled: config.paidCompetitions,
  });
});
economyAdmin.put("/pricing/:kind/:id", async (req, res) => {
  const data = z
    .object({
      pricing: z.unknown(),
      publish: z.boolean().default(false),
      confirmed: z.literal(true),
    })
    .parse(req.body);
  res.json(
    await savePricing(
      String(req.params.kind),
      String(req.params.id),
      id(req.user),
      data.pricing,
      data.publish,
    ),
  );
});
economyAdmin.get("/pricing/:kind/:id/history", async (req, res) =>
  res.json({
    items: await PricingHistory.find({
      targetType: req.params.kind,
      targetId: req.params.id,
    })
      .sort({ version: -1 })
      .lean(),
  }),
);
economyAdmin.post("/attempts/:id/refund", async (req, res) => {
  const { reason } = z
    .object({
      reason: z.string().trim().min(20).max(1000),
      confirmed: z.literal(true),
    })
    .parse(req.body);
  res.json(
    await refundFailedAttempt(id(req.user), String(req.params.id), reason),
  );
});
economyAdmin.get("/payments", async (_req, res) =>
  res.json({
    items: (await PaymentOrder.find().sort({ createdAt: -1 }).limit(200)).map(
      (p) => ({ ...paymentView(p), userId: p.userId }),
    ),
    gateway: {
      provider: "TransactWorld",
      enabled: config.payments,
      ready: gatewayIssues().length === 0,
      issues: gatewayIssues(),
      environment: gatewayConfig().environment,
      identity: {
        merchantUsername: gatewayConfig().merchantUsername,
        partnerId: gatewayConfig().partnerId,
      },
    },
    paidEventsEnabled: config.paidCompetitions,
  }),
);
economyAdmin.post("/gateway/connect", async (req, res) => {
  const data = z
    .object({
      merchantUsername: z
        .string()
        .trim()
        .min(1)
        .max(100)
        .regex(/^[A-Za-z0-9._@-]+$/),
      partnerId: z
        .string()
        .trim()
        .regex(/^\d{1,20}$/),
      reason: z.string().trim().min(10).max(500),
      confirmed: z.literal(true),
    })
    .parse(req.body);
  const current = gatewayConfig();
  if (!current.memberId || !current.workingKey)
    throw new HttpError(
      503,
      "Configure the backend merchant member ID and secure key first.",
    );
  try {
    await gatewayAuthToken(
      {
        ...current,
        authToken: "",
        merchantUsername: data.merchantUsername,
        partnerId: data.partnerId,
      },
      true,
    );
  } catch {
    throw new HttpError(
      503,
      "TransactWorld did not authenticate these details. Nothing was saved. Verify the login name, partner ID, secure key and API access with the provider.",
    );
  }
  await saveMerchantIdentity(id(req.user), data);
  res.json({
    authenticated: true,
    checkoutReady: gatewayIssues().length === 0,
    issues: gatewayIssues(),
  });
});
economyAdmin.post("/gateway/check", async (_req, res) => {
  const c = gatewayConfig();
  const issues = gatewayIssues();
  if (
    !c.memberId ||
    !c.workingKey ||
    (!c.authToken && (!c.merchantUsername || !c.partnerId))
  )
    return res
      .status(503)
      .json({ message: "Merchant API authentication is incomplete.", issues });
  try {
    await gatewayAuthToken(c, true);
    res.json({
      authenticated: true,
      environment: c.environment,
      checkoutReady: issues.length === 0,
      issues,
    });
  } catch {
    res.status(503).json({
      message:
        "TransactWorld rejected or could not complete API authentication. Verify merchant login, partner ID, secure key and API access with the provider.",
      issues,
    });
  }
});
economyAdmin.post("/payments/:id/verify", async (req, res) => {
  const data = z
    .object({
      providerPaymentId: z
        .string()
        .regex(/^\d{1,32}$/)
        .optional(),
      reason: z.string().trim().min(10).max(500),
    })
    .parse(req.body);
  const p = await PaymentOrder.findById(req.params.id);
  if (!p) throw new HttpError(404, "Payment order not found.");
  if (data.providerPaymentId) {
    if (p.providerPaymentId && p.providerPaymentId !== data.providerPaymentId)
      throw new HttpError(
        409,
        "A different gateway payment ID is already recorded.",
      );
    p.providerPaymentId = data.providerPaymentId;
    await p.save();
  }
  await Audit.create({
    actorId: id(req.user),
    action: "payment.investigation",
    targetId: id(p),
    details: data,
  });
  res.json(paymentView(await verifyCoinOrder(id(p), undefined, id(req.user))));
});
economyAdmin.get("/analytics", async (_req, res) =>
  res.json(await economyAnalytics()),
);
export async function economyAnalytics() {
  const journal = await WalletTransaction.aggregate([
    {
      $group: { _id: "$type", coins: { $sum: "$amount" }, count: { $sum: 1 } },
    },
  ]);
  const outstanding = await Wallet.aggregate([
    {
      $group: {
        _id: null,
        coins: { $sum: "$balance" },
        holds: { $sum: "$reversalHold" },
      },
    },
  ]);
  const revenue = await PaymentOrder.aggregate([
    {
      $match: {
        creditedAt: { $exists: true },
        verifiedAt: { $exists: true },
      },
    },
    {
      $group: {
        _id: "$currency",
        grossMinor: { $sum: "$amountMinor" },
        refundedMinor: { $sum: "$refundedMinor" },
        payments: { $sum: 1 },
      },
    },
  ]);
  const byDate = await PaymentOrder.aggregate([
    {
      $match: { creditedAt: { $exists: true }, verifiedAt: { $exists: true } },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$creditedAt" } },
          currency: "$currency",
        },
        amountMinor: { $sum: "$amountMinor" },
        refundedMinor: { $sum: "$refundedMinor" },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);
  const status = await PaymentOrder.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const popular = await Attempt.aggregate([
    { $match: { "billing.coinPrice": { $gt: 0 } } },
    {
      $group: {
        _id: "$quizId",
        title: { $last: "$title" },
        entries: { $sum: 1 },
        coins: { $sum: "$billing.coinPrice" },
      },
    },
    { $sort: { entries: -1 } },
    { $limit: 10 },
  ]);
  const packages = await PaymentOrder.aggregate([
    {
      $match: { creditedAt: { $exists: true }, verifiedAt: { $exists: true } },
    },
    {
      $group: {
        _id: "$packageSnapshot.name",
        purchases: { $sum: 1 },
        coins: { $sum: "$coins" },
      },
    },
    { $sort: { purchases: -1 } },
  ]);
  const purchasers = await PaymentOrder.distinct("userId", {
      creditedAt: { $exists: true },
    }),
    visitors = await AnalyticsEvent.distinct("userId", { kind: "STORE_VIEW" }),
    premiumVisitors = await AnalyticsEvent.distinct("userId", {
      kind: "PREMIUM_VIEW",
    }),
    paidPlayers = await Attempt.distinct("userId", {
      "billing.coinPrice": { $gt: 0 },
    });
  const repeat = await PaymentOrder.aggregate([
    { $match: { creditedAt: { $exists: true } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "count" },
  ]);
  return {
    journal,
    outstandingCoins: outstanding[0]?.coins || 0,
    reversalHoldCoins: outstanding[0]?.holds || 0,
    revenue: revenue.map((r) => ({
      ...r,
      netMinor: r.grossMinor - r.refundedMinor,
    })),
    revenueByDate: byDate,
    status,
    popular,
    packages,
    registeredUsers: await User.countDocuments(),
    activeUsers: await User.countDocuments({ suspended: false }),
    newUsers: await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
    }),
    premiumEntries: await Attempt.countDocuments({
      "billing.coinPrice": { $gt: 0 },
    }),
    paidCompetitionEntries: await Participant.countDocuments({
      "billing.coinPrice": { $gt: 0 },
    }),
    storeVisitors: visitors.length,
    purchasers: purchasers.length,
    repeatPurchasers: repeat[0]?.count || 0,
    storeConversion: visitors.length
      ? Math.round(
          (purchasers.filter((p) => visitors.includes(p)).length /
            visitors.length) *
            100,
        )
      : null,
    premiumConversion: premiumVisitors.length
      ? Math.round(
          (paidPlayers.filter((p) => premiumVisitors.includes(p)).length /
            premiumVisitors.length) *
            100,
        )
      : null,
    pricingAwaitingReview: await Quiz.countDocuments({
      pricingDraft: { $ne: null },
    }),
    note: "Coin consumption is digital access usage, not monetary revenue. Monetary amounts are grouped by currency and include only independently gateway-verified purchases.",
  };
}
