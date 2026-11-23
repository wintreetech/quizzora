// Isolated browser-test fixture. Never imported by the application server.
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { resolve } from "node:path";
import { createServer } from "node:http";
import express from "express";
import { createApp } from "../app.js";
import { seed } from "../seed.js";
import { setupRealtime } from "../realtime.js";
import { tickCompetitions } from "../services/competitions.js";
import { tickAttempts } from "../services/attempts.js";
import { User } from "../models.js";
import * as models from "../models.js";
import { migrateEconomy } from "../economy-migration.js";
import { hashPassword } from "../utils.js";
import { config } from "../config.js";
import { responseChecksum } from "../services/transactworld.js";
import { launchPlans } from "../commerce-launch.js";
if (!process.env.E2E_ADMIN_PASSWORD || process.env.NODE_ENV === "production")
  throw new Error(
    "This fixture requires generated test credentials and a non-production environment.",
  );
// All provider transport is simulated only inside this isolated executable.
// Production never imports this fixture and has no simulation endpoints.
Object.assign(config, { payments: true, apiUrl: "http://localhost:4100" });
Object.assign(process.env, {
  MEMBER_ID: "browser-test-member",
  WORKING_KEY: "browser-test-signing-key",
  TW_MERCHANT_USERNAME: "browsermerchant",
  TW_PARTNER_ID: "1000",
  TW_ENVIRONMENT: "sandbox",
  TW_SUPPORTED_CURRENCIES: "USD,EUR",
  TW_ALLOW_LOCAL_CHECKOUT: "true",
  TW_AUTH_TOKEN: "",
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (
    url ===
    "https://sandbox.transactworld.com/transactionServices/REST/v1/authToken"
  )
    return new Response(
      JSON.stringify({ AuthToken: "browser-test-api-token" }),
      { status: 200 },
    );
  if (
    url ===
    "https://sandbox.transactworld.com/transactionServices/REST/v1/inquiry"
  ) {
    const form = init?.body as URLSearchParams;
    const order = await models.PaymentOrder.findOne(
      form.get("paymentId")
        ? { providerPaymentId: form.get("paymentId") }
        : { merchantRef: form.get("merchantTransactionId") },
    );
    if (!order)
      return new Response(
        JSON.stringify({ result: { code: "TEST_NOT_FOUND" } }),
        { status: 404 },
      );
    return new Response(
      JSON.stringify({
        paymentId: order.providerPaymentId,
        merchantTransactionId: order.merchantRef,
        amount: (order.amountMinor / 100).toFixed(2),
        currency: order.currency,
        status: "capturesuccess",
        transactionStatus: "Y",
        refundamount: "0.00",
        chargebackamount: "0.00",
      }),
      { status: 200 },
    );
  }
  return originalFetch(input, init);
};
const mongo = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: "wiredTiger" },
  binary: { version: "7.0.24", downloadDir: resolve(".cache/mongodb") },
});
await mongoose.connect(mongo.getUri(), { dbName: "quizora_browser_tests" });
await Promise.all(Object.values(models).map((m) => m.init()));
await seed();
await models.Settings.create({ key: "eur-usd-reference-v1", value: { eurUsd: 1.1, date: new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString(), source: "ECB" } });
await migrateEconomy();
for (const p of launchPlans)
  await models.CoinPackage.updateOne(
    { key: p.key },
    {
      $set: {
        name: p.name,
        amountMinor: p.amountMinor,
        currency: "USD",
        active: true,
      },
    },
  );
const fixtureAdmin = await User.create({
  email: "browser-admin@example.test",
  username: "browser_admin",
  displayName: "Test administrator",
  role: "SUPER_ADMIN",
  adultConfirmedAt: new Date(),
  emailVerified: true,
  passwordHash: await hashPassword(process.env.E2E_ADMIN_PASSWORD),
});
await models.Audit.create({
  actorId: String(fixtureAdmin._id),
  action: "account.provision",
  targetId: String(fixtureAdmin._id),
  details: { testFixture: true },
});
const fixture = express();
fixture.post("/__e2e/gateway-return/:ref", async (req, res) => {
  if (req.headers["x-test-key"] !== process.env.E2E_ADMIN_PASSWORD)
    return res.sendStatus(403);
  const order = await models.PaymentOrder.findOne({
    merchantRef: req.params.ref,
  });
  if (!order) return res.sendStatus(404);
  const paymentId = String(Date.now()),
    amount = (order.amountMinor / 100).toFixed(2),
    status = "capturesuccess";
  res.json({
    action: `${config.apiUrl}/api/payments/transactworld/return/${order.merchantRef}`,
    fields: {
      paymentId,
      merchantTransactionId: order.merchantRef,
      amount,
      currency: order.currency,
      status,
      transactionStatus: "Y",
      checksum: responseChecksum(paymentId, order.merchantRef, amount, status),
    },
  });
});
fixture.post("/__e2e/shutdown", (req, res) => {
  if (req.headers["x-test-key"] !== process.env.E2E_ADMIN_PASSWORD)
    return res.sendStatus(403);
  res.json({ ok: true });
  setTimeout(() => void close(), 100);
});
fixture.use(createApp());
const server = createServer(fixture);
const io = setupRealtime(server);
let ticking = false;
const timer = setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    await tickCompetitions();
    await tickAttempts();
  } finally {
    ticking = false;
  }
}, 200);
server.listen(4100, "127.0.0.1", () =>
  console.info("Isolated browser API on 4100"),
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  while (ticking) await new Promise((resolve) => setTimeout(resolve, 25));
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
