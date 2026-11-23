import { beforeAll, afterAll, describe, it, expect } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "./app.js";
import * as models from "./models.js";
import {
  Quiz,
  User,
  Attempt,
  Audit,
  PricingHistory,
  WalletTransaction,
} from "./models.js";
import { seed } from "./seed.js";
import { migrateQuizAccess } from "./quiz-access-migration.js";
import {
  freePricing,
  getQuizPricing,
  savePricing,
} from "./services/pricing.js";
import { adjustWallet, ensureWallet } from "./services/wallet.js";
import { startAttempt, finishAttempt } from "./services/attempts.js";
let mongo: MongoMemoryReplSet, adminId: string, playerId: string;
const app = createApp(),
  admin = request.agent(app),
  player = request.agent(app);
const post = (agent: any, url: string, body: any) =>
  agent.post(`/api${url}`).set("X-Quizora", "1").send(body);
const question = {
  id: "one",
  type: "single",
  prompt: "Which number is even?",
  options: ["One", "Two"],
  correct: [1],
  explanation: "Two divides evenly by two.",
  seconds: 60,
};
const body = {
  title: "A published catalogue round",
  description: "A real quiz to verify publishing and entry pricing.",
  category: "General Knowledge",
  difficulty: "Easy",
  cover: "tech",
  visibility: "public",
  status: "published",
  questions: [question],
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: "7.0.24", downloadDir: resolve(".cache/mongodb") },
  });
  await mongoose.connect(mongo.getUri(), {
    dbName: "isolated_catalogue_tests",
  });
  await Promise.all(Object.values(models).map((model) => model.init()));
  await seed();
  for (const [agent, name] of [
    [admin, "catalogue_admin"],
    [player, "catalogue_player"],
  ] as const) {
    const response = await post(agent, "/auth/register", {
      displayName: name,
      username: name,
      email: `${name}@example.test`,
      password: randomUUID(),
      adult: true,
    });
    expect(response.status).toBe(201);
    if (agent === admin) adminId = response.body.user.id;
    else playerId = response.body.user.id;
  }
  await User.updateOne({ _id: adminId }, { $set: { role: "SUPER_ADMIN" } });
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
describe("Explicit pricing and complete quiz discovery", () => {
  it("seeds an explicit 12 free / 26 paid mix and returns every eligible ID exactly once for every sort", async () => {
    expect(await Quiz.countDocuments({ "pricing.accessType": "FREE" })).toBe(
      12,
    );
    expect(await Quiz.countDocuments({ "pricing.coinPrice": { $gt: 0 } })).toBe(
      26,
    );
    const expected = (
      await Quiz.find({ status: "published", visibility: "public" }).select(
        "_id",
      )
    )
      .map((quiz) => String(quiz._id))
      .sort();
    for (const sort of ["featured", "newest", "quickest", "popular"]) {
      const ids: string[] = [];
      for (let page = 1; page <= 5; page++) {
        const response = await request(app).get(
          `/api/quizzes?sort=${sort}&limit=8&page=${page}`,
        );
        expect(response.status, JSON.stringify(response.body)).toBe(200);
        expect(response.body.total).toBe(38);
        expect(
          response.body.items.every((quiz: any) => quiz.pricing.configured),
        ).toBe(true);
        expect(JSON.stringify(response.body)).not.toContain('"correct":');
        ids.push(...response.body.items.map((quiz: any) => quiz.id));
      }
      expect(new Set(ids).size).toBe(38);
      expect(ids.sort()).toEqual(expected);
    }
  });
  it("combines free, paid, category, difficulty and search filters without leaking drafts/private quizzes", async () => {
    await Quiz.create([
      {
        ...body,
        slug: randomUUID(),
        ownerId: adminId,
        status: "draft",
        pricing: { ...freePricing, version: 1 },
      },
      {
        ...body,
        slug: randomUUID(),
        ownerId: adminId,
        visibility: "private",
        pricing: { ...freePricing, version: 1 },
      },
    ]);
    const free = await request(app).get("/api/quizzes?access=free&limit=24");
    expect(free.body.total).toBe(12);
    expect(
      free.body.items.every(
        (quiz: any) =>
          quiz.pricing.accessType === "FREE" && quiz.pricing.coinPrice === 0,
      ),
    ).toBe(true);
    const paid = await request(app).get(
      "/api/quizzes?access=paid&category=Mathematics%20%26%20Logic&difficulty=Hard&q=number",
    );
    expect(paid.body.total).toBe(1);
    expect(paid.body.items[0].pricing.coinPrice).toBe(75);
    expect((await request(app).get("/api/quizzes?limit=24")).body.total).toBe(
      38,
    );
    expect(
      (await request(app).get("/api/quizzes?category=missing")).body.items,
    ).toEqual([]);
  });
  it("flags ambiguous prices, blocks charging/playing/publishing, and lets Admin repair the exact price", async () => {
    const quiz = await Quiz.create({
      ...body,
      slug: randomUUID(),
      ownerId: adminId,
      pricing: { coinPrice: 0 },
    });
    const detail = await player.get(`/api/quizzes/${quiz.id}`);
    expect(detail.body.pricing).toMatchObject({
      configured: false,
      accessType: "UNCONFIGURED",
      available: false,
    });
    expect(
      (await post(player, `/quizzes/${quiz.id}/attempts`, {})).status,
    ).toBe(409);
    expect(
      (
        await admin
          .patch(`/api/admin/quizzes/${quiz.id}`)
          .set("X-Quizora", "1")
          .send({ status: "published", reason: "Review before publication" })
      ).status,
    ).toBe(400);
    const review = await admin.get("/api/admin/quizzes?access=review");
    expect(review.body.items.map((row: any) => row.id)).toContain(quiz.id);
    const priced = await savePricing(
      "quiz",
      quiz.id,
      adminId,
      { ...freePricing, accessType: "PAID_PER_ATTEMPT", coinPrice: 35 },
      true,
    );
    expect(priced.pricing).toMatchObject({ coinPrice: 35, configured: true });
    expect(
      (await player.get(`/api/quizzes/${quiz.id}`)).body.pricing.coinPrice,
    ).toBe(35);
    expect(await WalletTransaction.countDocuments({ userId: playerId })).toBe(
      0,
    );
    const incomplete = await Quiz.create({
      ...body,
      slug: randomUUID(),
      ownerId: adminId,
      status: "draft",
      pricing: { ...freePricing, version: undefined },
    });
    const repaired = await admin
      .put(`/api/organizer/quizzes/${incomplete.id}`)
      .set("X-Quizora", "1")
      .send({ ...body, pricing: freePricing });
    expect(repaired.status, JSON.stringify(repaired.body)).toBe(200);
    expect(repaired.body.pricing).toMatchObject({
      configured: true,
      accessType: "FREE",
      version: 1,
    });
  });
  it("creates categories and priced quizzes through Admin, preserves price on content edits, and exposes a new publication", async () => {
    expect(
      (await post(player, "/admin/categories", { name: "Architecture" }))
        .status,
    ).toBe(403);
    expect(
      (await post(admin, "/admin/categories", { name: "Architecture" })).status,
    ).toBe(201);
    const created = await post(admin, "/organizer/quizzes", {
      ...body,
      category: "Architecture",
      pricing: {
        ...freePricing,
        coinPrice: 45,
        accessType: "PAID_PER_ATTEMPT",
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.id;
    expect(created.body.pricing).toMatchObject({
      coinPrice: 45,
      configured: true,
    });
    const edit = await admin
      .put(`/api/organizer/quizzes/${id}`)
      .set("X-Quizora", "1")
      .send({
        ...body,
        title: "Updated architecture round",
        category: "Architecture",
      });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect(edit.body.pricing.coinPrice).toBe(45);
    expect(edit.body.pricing.version).toBe(1);
    const discovery = await request(app).get(
      "/api/quizzes?category=Architecture&access=paid&q=architecture",
    );
    expect(discovery.body.items.map((quiz: any) => quiz.id)).toEqual([id]);
    expect(discovery.body.categories).toContain("Architecture");
    expect(
      (
        await post(admin, "/organizer/quizzes", {
          ...body,
          questions: [],
          pricing: freePricing,
        })
      ).status,
    ).toBe(400);
    expect(await PricingHistory.countDocuments({ targetId: id })).toBe(1);
  });
  it("repairs only untouched known seeds, audits the repair once and preserves explicit Admin prices and existing attempts", async () => {
    const missing =
      (await Quiz.findOne({ seedKey: "library-v1-technology-medium" })) ||
      (await Quiz.findOne({ seedKey: /^library-v1-/ }));
    expect(missing).toBeTruthy();
    await Quiz.updateOne({ _id: missing!._id }, { $unset: { pricing: 1 } });
    const custom = await Quiz.create({
      ...body,
      slug: randomUUID(),
      ownerId: adminId,
    });
    const paid = await Quiz.findOne({ seedKey: "tech" });
    if (paid)
      await savePricing(
        "quiz",
        paid.id,
        adminId,
        { ...freePricing, accessType: "PAID_PER_ATTEMPT", coinPrice: 91 },
        true,
      );
    const attempts = await Attempt.countDocuments();
    await migrateQuizAccess();
    expect(getQuizPricing(await Quiz.findById(missing!._id)).configured).toBe(
      true,
    );
    expect(getQuizPricing(await Quiz.findById(custom._id)).configured).toBe(
      false,
    );
    if (paid)
      expect((await Quiz.findById(paid._id))!.pricing.coinPrice).toBe(91);
    const count = await Audit.countDocuments({
      action: "quiz.access_backfill",
    });
    await migrateQuizAccess();
    expect(await Audit.countDocuments({ action: "quiz.access_backfill" })).toBe(
      count,
    );
    expect(await Attempt.countDocuments()).toBe(attempts);
  });
  it("charges paid entries once under concurrency, debits nothing for free entry, and returns real dashboard/activity totals", async () => {
    await adjustWallet(adminId, playerId, {
      mode: "credit",
      amount: 100,
      expectedBalance: 0,
      reason: "Catalogue integration test grant",
      requestKey: randomUUID(),
    });
    const paid = await Quiz.findOne({ "pricing.coinPrice": 25 });
    const free = await Quiz.findOne({ "pricing.accessType": "FREE" });
    const consent = {
      confirmed: true,
      coinPrice: 25,
      pricingVersion: paid!.pricing.version,
      requestKey: randomUUID(),
    };
    const [a, b] = await Promise.all([
      startAttempt(playerId, paid!.id, consent),
      startAttempt(playerId, paid!.id, consent),
    ]);
    expect(String(a._id)).toBe(String(b._id));
    expect((await ensureWallet(playerId)).balance).toBe(75);
    expect(
      await WalletTransaction.countDocuments({
        userId: playerId,
        type: "QUIZ_ENTRY",
      }),
    ).toBe(1);
    await finishAttempt(playerId, a.id);
    const f = await startAttempt(playerId, free!.id);
    await finishAttempt(playerId, f.id);
    expect((await ensureWallet(playerId)).balance).toBe(75);
    const dashboard = await player.get("/api/dashboard"),
      activity = await player.get("/api/activity");
    expect(dashboard.body.total).toBe(2);
    expect(dashboard.body.bestAccuracy).toBe(0);
    expect(activity.body.total).toBe(2);
    expect(activity.body.items).toHaveLength(2);
    expect(JSON.stringify(activity.body)).not.toContain('"correct":');
    expect((await player.get("/api/wallet")).body.purchasesAvailable).toBe(
      false,
    );
  });
});
