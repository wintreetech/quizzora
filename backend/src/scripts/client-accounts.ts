import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { config } from "../config.js";
import { connectDatabase, closeDatabase } from "../database.js";
import { User, Audit } from "../models.js";
import * as models from "../models.js";
import { hashPassword } from "../utils.js";
import { registrationSchema } from "../shared/schemas.js";
import { seed } from "../seed.js";
import { migrateEconomy } from "../economy-migration.js";

// This executable refuses the normal application database. Supply a private
// password through the environment; no password is generated into tracked files.
if (config.production || config.payments || !config.database || !/^quizora_review_[a-z0-9_]+$/.test(process.env.DATABASE_NAME || ""))
  throw new Error("Review accounts require non-production, PAYMENTS_ENABLED=false, DATABASE_URL and a separate DATABASE_NAME beginning quizora_review_.");
registrationSchema.parse({ displayName: "Review validation", username: "review_validation", email: "validate@example.test", password: process.env.REVIEW_PASSWORD, adult: true });
await connectDatabase();
try {
  if (mongoose.connection.name !== process.env.DATABASE_NAME) throw new Error("Review database isolation check failed.");
  await Promise.all(Object.values(models).map((model) => model.init()));
  await seed();
  await migrateEconomy();
  await models.Settings.updateOne({ key: "coin-store-pricing-v2" }, { $setOnInsert: { value: { coinsPerUsd: 20, version: 1 } } }, { upsert: true });
  for (const [suffix, role, displayName] of [["player", "PLAYER", "Review player"], ["organizer", "ORGANIZER", "Review organizer"], ["admin", "SUPER_ADMIN", "Review administrator"]] as const) {
    const email = `${suffix}@review.quizora.test`, username = `quizora_review_${suffix}`;
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      console.info(`${displayName}: exists; password and role preserved.`);
      continue;
    }
    const user = await User.create({ email, username, displayName, role, passwordHash: await hashPassword(process.env.REVIEW_PASSWORD!), adultConfirmedAt: new Date(), emailVerified: true, onboarding: { required: false, status: "skipped", version: 1, step: 0 } });
    await Audit.create({ actorId: "isolated-review-cli", action: "review.account_created", targetId: String(user._id), details: { isolatedReview: true, reference: randomBytes(8).toString("hex") } });
    console.info(`${displayName}: ${email}`);
  }
  console.info("Review setup complete. Run this separate backend with PAYMENTS_ENABLED=false. Clear REVIEW_PASSWORD from your shell. No wallet credits or payments were created.");
} finally { await closeDatabase(); }
