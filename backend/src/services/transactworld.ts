// Standard Checkout signing and Inquiry protocol adapted from the user's earlier
// TransactWorld integration. This app keeps its own orders, users and ledger.
import { createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { config } from "../config.js";
import { PaymentOrder, PaymentEvent, CoinPackage, Audit } from "../models.js";
import { HttpError, hash, locked } from "../utils.js";
import { atomic, ledger } from "./wallet.js";
import { gatewayAuthToken } from "./gateway-token.js";
import { quoteCoinPurchase } from "./coin-quotes.js";
import { quoteBudget } from "./budget-quotes.js";
import {
  merchantIdentity,
  hasVerifiedMerchantIdentity,
} from "./merchant-settings.js";
export const md5 = (s: string) =>
  createHash("md5").update(s, "utf8").digest("hex");
export const gatewayConfig = () => ({
  memberId: process.env.MEMBER_ID || "",
  workingKey: process.env.WORKING_KEY || "",
  authToken: hasVerifiedMerchantIdentity()
    ? ""
    : process.env.TW_AUTH_TOKEN || "",
  ...merchantIdentity(),
  environment: process.env.TW_ENVIRONMENT === "live" ? "live" : "sandbox",
  origin:
    process.env.TW_ENVIRONMENT === "live"
      ? "https://secure.transactworld.com"
      : "https://sandbox.transactworld.com",
  toType: process.env.TO_TYPE || "Transactworld",
  language: process.env.LANGUAGE || "ENG",
  paymentMode: process.env.PAYMENT_MODE || "CC",
  paymentBrand: process.env.PAYMENT_BRAND || "VISA",
  currencies: (process.env.TW_SUPPORTED_CURRENCIES || "")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter((v) => /^[A-Z]{3}$/.test(v)),
  allowLocal:
    !config.production && process.env.TW_ALLOW_LOCAL_CHECKOUT === "true",
});
export function gatewayIssues() {
  const c = gatewayConfig();
  const issues = [];
  if (!config.payments) issues.push("Coin checkout has not been activated.");
  if (!c.memberId || !c.workingKey)
    issues.push("TransactWorld merchant credentials are required.");
  if (!c.authToken && (!c.merchantUsername || !c.partnerId))
    issues.push(
      "TransactWorld API authentication requires TW_MERCHANT_USERNAME and TW_PARTNER_ID, or a valid TW_AUTH_TOKEN.",
    );
  if (!c.currencies.length)
    issues.push("Approved merchant currencies must be configured.");
  let url: URL;
  try {
    url = new URL(config.apiUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const localDevelopment =
      !config.production &&
      c.allowLocal &&
      loopback &&
      ["http:", "https:"].includes(url.protocol);
    if (
      (config.production || c.environment === "live") &&
      (url.protocol !== "https:" || loopback) &&
      !localDevelopment
    )
      issues.push("Public HTTPS API callbacks are required.");
    if (!config.production && !localDevelopment && url.protocol !== "https:")
      issues.push(
        "Configure public HTTPS callbacks, or explicitly allow loopback development checkout.",
      );
  } catch {
    issues.push("A valid API_PUBLIC_URL is required.");
  }
  return issues;
}
export function decimalMinor(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,8}\.\d{2}$/.test(value))
    throw new HttpError(
      400,
      "Gateway amounts must use an exact two-decimal value.",
    );
  const [whole, fraction] = value.split(".");
  return Number(whole) * 100 + Number(fraction);
}
export const requestChecksum = (
  amount: string,
  ref: string,
  redirect: string,
  c = gatewayConfig(),
) => md5([c.memberId, c.toType, amount, ref, redirect, c.workingKey].join("|"));
export const responseChecksum = (
  paymentId: string,
  ref: string,
  amount: string,
  status: string,
  c = gatewayConfig(),
) => md5([paymentId, ref, amount, status, c.workingKey].join("|"));
export function buildCheckout(order: any, ip: string) {
  const c = gatewayConfig();
  const issues = gatewayIssues();
  if (issues.length) throw new HttpError(503, issues.join(" "));
  ip = ip.replace(/^::ffff:/, "");
  if (!isIP(ip))
    throw new HttpError(400, "A valid shopper address is required.");
  const amount = (order.amountMinor / 100).toFixed(2),
    redirect = `${config.apiUrl}/api/payments/transactworld/return/${order.merchantRef}`;
  return {
    orderId: String(order._id),
    forwardUrl: `${c.origin}/transaction/Checkout`,
    paymentData: {
      memberId: c.memberId,
      totype: c.toType,
      language: c.language,
      amount,
      currency: order.currency,
      TMPL_AMOUNT: amount,
      TMPL_CURRENCY: order.currency,
      paymentType: "DB",
      paymentMode: c.paymentMode,
      paymentBrand: c.paymentBrand,
      ip,
      merchantTransactionId: order.merchantRef,
      merchantRedirectUrl: redirect,
      notificationUrl: `${config.apiUrl}/api/payments/transactworld/notify/${order.merchantRef}`,
      orderDescription: `${order.coins} Quizora non-redeemable virtual coins`,
      checksum: requestChecksum(amount, order.merchantRef, redirect),
    },
  };
}
export async function createCoinOrder(
  userId: string,
  packageId: string,
  input: any,
  ip: string,
) {
  const data = z
    .object({
      confirmed: z.literal(true),
      requestKey: z.string().min(16).max(100),
      packageVersion: z.number().int(),
      amountMinor: z.number().int(),
      currency: z.string().length(3),
      coins: z.number().int(),
    })
    .parse(input);
  return locked(`checkout:${userId}:${data.requestKey}`, async () => {
    const existing = await PaymentOrder.findOne({
      userId,
      requestKey: data.requestKey,
    });
    if (existing) {
      if (existing.packageId !== packageId)
        throw new HttpError(
          409,
          "This purchase key already belongs to another package.",
        );
      if (existing.status !== "PENDING")
        return { orderId: String(existing._id), status: existing.status };
      return buildCheckout(existing, ip);
    }
    const p = await CoinPackage.findById(packageId);
    if (!p || !p.active)
      throw new HttpError(404, "This coin package is not currently available.");
    if (
      !p.amountMinor ||
      !p.currency ||
      !gatewayConfig().currencies.includes(p.currency)
    )
      throw new HttpError(
        503,
        "This package is awaiting merchant pricing configuration.",
      );
    if (
      p.version !== data.packageVersion ||
      p.amountMinor !== data.amountMinor ||
      p.currency !== data.currency ||
      p.coins + p.bonusCoins !== data.coins
    )
      throw new HttpError(
        409,
        "The package changed. Review its current price before confirming.",
      );
    const draft = {
      _id: undefined,
      userId,
      packageId,
      packageSnapshot: {
        name: p.name,
        coins: p.coins,
        bonusCoins: p.bonusCoins,
        version: p.version,
      },
      coins: p.coins + p.bonusCoins,
      amountMinor: p.amountMinor,
      currency: p.currency,
      merchantRef: randomBytes(32).toString("hex"),
      requestKey: data.requestKey,
      checkoutExpiresAt: new Date(Date.now() + 30 * 60000),
    };
    buildCheckout(draft, ip);
    const order = await PaymentOrder.create(draft);
    return buildCheckout(order, ip);
  });
}
export async function createCustomCoinOrder(
  userId: string,
  input: unknown,
  ip: string,
) {
  const data = z
    .object({
      confirmed: z.literal(true),
      coins: z.number().int(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      amountMinor: z.number().int().positive(),
      pricingVersion: z.string().regex(/^[a-f0-9]{64}$/),
      requestKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
    })
    .parse(input);
  return locked(`checkout:${userId}:${data.requestKey}`, async () => {
    const previous = await PaymentOrder.findOne({
      userId,
      requestKey: data.requestKey,
    });
    if (previous) {
      if (
        previous.coins !== data.coins ||
        previous.currency !== data.currency ||
        previous.amountMinor !== data.amountMinor ||
        previous.packageSnapshot.pricingVersion !== data.pricingVersion
      )
        throw new HttpError(
          409,
          "This purchase key already belongs to a different selection.",
        );
      return previous.status === "PENDING"
        ? buildCheckout(previous, ip)
        : { orderId: String(previous._id), status: previous.status };
    }
    const quote = await quoteCoinPurchase(data.coins, data.currency);
    if (
      quote.pricingVersion !== data.pricingVersion ||
      quote.amountMinor !== data.amountMinor
    )
      throw new HttpError(
        409,
        "The price changed. Review the updated total before confirming.",
      );
    if (!gatewayConfig().currencies.includes(quote.currency))
      throw new HttpError(503, "This currency is not enabled for checkout.");
    const draft = {
      userId,
      packageId: quote.productId,
      packageSnapshot: {
        name: "Custom coin top-up",
        coins: quote.coins,
        bonusCoins: 0,
        pricingVersion: quote.pricingVersion,
        sourceVersions: quote.sourceVersions,
      },
      coins: quote.coins,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
      merchantRef: randomBytes(32).toString("hex"),
      requestKey: data.requestKey,
      checkoutExpiresAt: new Date(Date.now() + 30 * 60000),
    };
    buildCheckout(draft, ip);
    const order = await PaymentOrder.create(draft);
    return buildCheckout(order, ip);
  });
}
export async function createBudgetCoinOrder(userId: string, input: unknown, ip: string) {
  const data = z.object({ confirmed: z.literal(true), amountMinor: z.number().int().positive(), currency: z.enum(["USD", "EUR"]), coins: z.number().int().positive(), pricingVersion: z.string().regex(/^[a-f0-9]{64}$/), requestKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/) }).parse(input);
  return locked(`checkout:${userId}:${data.requestKey}`, async () => {
    const previous = await PaymentOrder.findOne({ userId, requestKey: data.requestKey });
    if (previous) {
      if (previous.packageSnapshot.purchaseKind !== "budget" || previous.coins !== data.coins || previous.currency !== data.currency || previous.amountMinor !== data.amountMinor || previous.packageSnapshot.pricingVersion !== data.pricingVersion)
        throw new HttpError(409, "This purchase key belongs to a different selection.");
      return previous.status === "PENDING" ? buildCheckout(previous, ip) : { orderId: String(previous._id), status: previous.status };
    }
    const quote = await quoteBudget(data.amountMinor, data.currency);
    if (quote.coins !== data.coins || quote.pricingVersion !== data.pricingVersion)
      throw new HttpError(409, "The price or currency reference changed. Review your updated total before confirming.");
    if (!gatewayConfig().currencies.includes(quote.currency)) throw new HttpError(503, "This currency is not enabled for checkout.");
    const draft = { userId, packageId: quote.productId, packageSnapshot: { name: "Wallet top-up", purchaseKind: "budget", coins: quote.coins, bonusCoins: 0, pricingVersion: quote.pricingVersion, sourceVersions: quote.sourceVersions }, coins: quote.coins, amountMinor: quote.amountMinor, currency: quote.currency, merchantRef: randomBytes(32).toString("hex"), requestKey: data.requestKey, checkoutExpiresAt: new Date(Date.now() + 30 * 60000) };
    buildCheckout(draft, ip);
    const order = await PaymentOrder.create(draft);
    return buildCheckout(order, ip);
  });
}
const signedSchema = z.object({
  paymentId: z.coerce.string().regex(/^\d{1,32}$/),
  merchantTransactionId: z.string().regex(/^[a-f0-9]{64}$/),
  amount: z.string().max(32),
  checksum: z.string().regex(/^[a-fA-F0-9]{32}$/),
  transactionStatus: z.enum(["Y", "N", "P"]).optional(),
  status: z
    .string()
    .regex(/^[a-zA-Z0-9_]{1,64}$/)
    .optional(),
  currency: z.string().length(3).optional(),
});
export async function recordCallback(
  ref: string,
  body: any,
  kind: "return" | "notification",
) {
  const c = gatewayConfig();
  if (!c.workingKey)
    throw new HttpError(503, "Gateway signing credentials are not configured.");
  const data = signedSchema.parse(body),
    signedStatus = kind === "return" ? data.status : data.transactionStatus;
  if (!signedStatus || data.merchantTransactionId !== ref)
    throw new HttpError(
      400,
      "Gateway transaction reference or status mismatch.",
    );
  const expected = responseChecksum(
    data.paymentId,
    ref,
    data.amount,
    signedStatus,
  );
  if (
    !timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(data.checksum, "hex"),
    )
  )
    throw new HttpError(400, "Invalid TransactWorld callback checksum.");
  const eventKey = hash(
    `${kind}|${ref}|${data.paymentId}|${data.amount}|${signedStatus}|${data.checksum}`,
  );
  const order = await atomic(async (session) => {
    const p = await PaymentOrder.findOne({ merchantRef: ref }).session(session);
    if (!p) throw new HttpError(404, "Payment order not found.");
    if (
      decimalMinor(data.amount) !== p.amountMinor ||
      (kind === "return" && data.currency?.toUpperCase() !== p.currency)
    )
      throw new HttpError(400, "Gateway amount or currency mismatch.");
    if (p.providerPaymentId && p.providerPaymentId !== data.paymentId)
      throw new HttpError(
        409,
        "This order is linked to another gateway transaction.",
      );
    p.providerPaymentId = data.paymentId;
    await p.save({ session });
    await PaymentEvent.updateOne(
      { eventKey },
      {
        $setOnInsert: {
          orderId: String(p._id),
          kind,
          providerPaymentId: data.paymentId,
          signedFields: {
            merchantTransactionId: ref,
            amount: data.amount,
            status: signedStatus,
          },
        },
      },
      { upsert: true, session },
    );
    return p;
  });
  return { order, eventKey };
}
export type InquiryResult = {
  paymentId: string;
  merchantTransactionId: string;
  amount: string;
  currency: string;
  status: string;
  transactionStatus: string;
  refundamount?: string;
  chargebackamount?: string;
};
export type Inquiry = (
  reference: string,
  idType?: "PID" | "MID",
) => Promise<InquiryResult>;
export const inquirePayment: Inquiry = async (reference, idType = "PID") => {
  const c = gatewayConfig();
  let token = await gatewayAuthToken(c);
  const send = () =>
    fetch(`${c.origin}/transactionServices/REST/v1/inquiry`, {
      method: "POST",
      headers: {
        AuthToken: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "authentication.memberId": c.memberId,
        "authentication.checksum": md5(
          `${c.memberId}|${c.workingKey}|${reference}`,
        ),
        paymentType: "IN",
        idType,
        ...(idType === "PID"
          ? { paymentId: reference }
          : { merchantTransactionId: reference }),
      }),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  let response: globalThis.Response;
  try {
    response = await send();
    if (!c.authToken && [401, 403].includes(response.status)) {
      await response.body?.cancel();
      token = await gatewayAuthToken(c, true);
      response = await send();
    }
  } catch {
    throw new HttpError(
      503,
      "Gateway verification is temporarily unavailable. The order remains pending.",
    );
  }
  if (!response.ok)
    throw new HttpError(
      503,
      "TransactWorld Inquiry failed. Check merchant API access.",
    );
  return z
    .object({
      paymentId: z.coerce.string(),
      merchantTransactionId: z.string(),
      amount: z.string(),
      currency: z.string(),
      status: z.string(),
      transactionStatus: z.string(),
      refundamount: z.string().optional(),
      chargebackamount: z.string().optional(),
    })
    .parse(await response.json());
};
export async function verifyCoinOrder(
  orderId: string,
  inquiry: Inquiry = inquirePayment,
  actorId?: string,
) {
  const original = await PaymentOrder.findById(orderId);
  if (!original) throw new HttpError(404, "Order not found.");
  const verified = await inquiry(
    original.providerPaymentId || original.merchantRef,
    original.providerPaymentId ? "PID" : "MID",
  );
  if (
    !/^\d{1,32}$/.test(verified.paymentId) ||
    (original.providerPaymentId &&
      verified.paymentId !== original.providerPaymentId) ||
    verified.merchantTransactionId !== original.merchantRef ||
    decimalMinor(verified.amount) !== original.amountMinor ||
    verified.currency.toUpperCase() !== original.currency
  )
    throw new HttpError(
      400,
      "The independently verified transaction does not match the order reference, amount and currency.",
    );
  return atomic(async (session) => {
    const p = await PaymentOrder.findById(orderId).session(session);
    if (
      !p ||
      (p.providerPaymentId && p.providerPaymentId !== verified.paymentId)
    )
      throw new HttpError(409, "Payment reference changed.");
    p.providerPaymentId = verified.paymentId;
    const captured =
      verified.status === "capturesuccess" &&
      verified.transactionStatus === "Y";
    if (captured && !p.creditedAt) {
      await ledger(session, {
        userId: p.userId,
        amount: p.coins,
        type: "COIN_PURCHASE",
        reference: `purchase:${p._id}`,
        targetId: String(p._id),
        reason: `${p.packageSnapshot.name} · verified TransactWorld purchase`,
      });
      p.creditedAt = new Date();
    }
    const refund =
        verified.refundamount === undefined
          ? p.verifiedRefundMinor
          : decimalMinor(verified.refundamount),
      chargeback =
        verified.chargebackamount === undefined
          ? p.verifiedChargebackMinor
          : decimalMinor(verified.chargebackamount);
    if (
      /refund|chargeback/i.test(verified.status) &&
      verified.refundamount === undefined &&
      verified.chargebackamount === undefined
    )
      throw new HttpError(
        503,
        "The reversal needs independently verified cumulative refund or chargeback amounts.",
      );
    if (refund > p.amountMinor || chargeback > p.amountMinor)
      throw new HttpError(
        400,
        "Verified reversal exceeds the purchase amount.",
      );
    p.verifiedRefundMinor = Math.max(p.verifiedRefundMinor, refund);
    p.verifiedChargebackMinor = Math.max(p.verifiedChargebackMinor, chargeback);
    p.refundedMinor = Math.min(
      p.amountMinor,
      p.verifiedRefundMinor + p.verifiedChargebackMinor,
    );
    const target = p.creditedAt
      ? Math.min(
          p.coins,
          Math.ceil((p.coins * p.refundedMinor) / p.amountMinor),
        )
      : 0;
    if (target > p.reversedCoins) {
      await ledger(session, {
        userId: p.userId,
        amount: -(target - p.reversedCoins),
        type: "PAYMENT_REVERSAL",
        reference: `reversal:${p._id}:${target}`,
        targetId: String(p._id),
        reason: "TransactWorld verified payment reversal",
        allowHold: true,
      });
      p.reversedCoins = target;
    }
    p.status = p.creditedAt
      ? p.reversedCoins === p.coins
        ? "REFUNDED"
        : p.reversedCoins
          ? "PARTIALLY_REFUNDED"
          : "PAID"
      : p.refundedMinor === p.amountMinor
        ? "REFUNDED"
        : verified.transactionStatus === "N"
          ? "FAILED"
          : "PENDING";
    p.verifiedAt = new Date();
    p.lastCheckedAt = new Date();
    p.gatewayStatus = verified.status;
    p.lastVerificationError = undefined;
    await p.save({ session });
    if (actorId)
      await Audit.create(
        [
          {
            actorId,
            action: "payment.gateway_verified",
            targetId: orderId,
            details: { status: p.status },
          },
        ],
        { session },
      );
    return p;
  });
}
export async function reconcilePendingPayments() {
  if (!config.payments) return;
  const c = gatewayConfig();
  if (!c.authToken && (!c.merchantUsername || !c.partnerId)) return;
  const rows = await PaymentOrder.find({
    status: { $in: ["PENDING", "PAID", "PARTIALLY_REFUNDED"] },
    $or: [
      { lastCheckedAt: { $lt: new Date(Date.now() - 300000) } },
      { lastCheckedAt: { $exists: false } },
    ],
  })
    .sort({ lastCheckedAt: 1 })
    .limit(20);
  for (const p of rows) {
    try {
      await verifyCoinOrder(String(p._id));
    } catch {
      await PaymentOrder.updateOne(
        { _id: p._id },
        {
          $set: {
            lastCheckedAt: new Date(),
            lastVerificationError:
              "Gateway verification is pending. Investigate merchant API access.",
          },
        },
      );
    }
  }
}
