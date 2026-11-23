import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, closeDatabase } from "./database.js";
import { seed } from "./seed.js";
import { setupRealtime } from "./realtime.js";
import {
  tickCompetitions,
  recoverFinalizations,
} from "./services/competitions.js";
import { config } from "./config.js";
import { tickAttempts } from "./services/attempts.js";
import { migrateEconomy } from "./economy-migration.js";
import { reconcilePendingPayments } from "./services/transactworld.js";
import mongoose from "mongoose";
import { loadMerchantIdentity } from "./services/merchant-settings.js";
await connectDatabase();
await loadMerchantIdentity();
await seed();
for (const model of Object.values(mongoose.models)) await model.init();
await migrateEconomy();
const server = createServer(createApp());
const io = setupRealtime(server);
let ticking = false;
const timer = setInterval(async () => {
  if (ticking) return;
  ticking = true;
  try {
    await tickCompetitions();
    await recoverFinalizations();
    await tickAttempts();
  } catch (e) {
    console.error("Quiz scheduler failed", e);
  } finally {
    ticking = false;
  }
}, 500);
let paymentChecking = false;
const paymentTimer = setInterval(async () => {
  if (paymentChecking) return;
  paymentChecking = true;
  try {
    await reconcilePendingPayments();
  } catch {
    console.error("Payment reconciliation will retry.");
  } finally {
    paymentChecking = false;
  }
}, 60000);
server.listen(config.port, "0.0.0.0", () =>
  console.info(`Quizora API ${config.production ? config.apiUrl : `http://localhost:${config.port}`}`),
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  clearInterval(paymentTimer);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  while (ticking || paymentChecking)
    await new Promise((resolve) => setTimeout(resolve, 25));
  await closeDatabase();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
