import { Router } from "express";
import { z } from "zod";
import { allow } from "../auth.js";
import {
  User,
  Quiz,
  Attempt,
  Competition,
  Audit,
  Report,
  Plan,
  Session,
  Settings,
  Challenge,
  Tournament,
} from "../models.js";
import { safeUser, id, HttpError } from "../utils.js";
import { roles, categories } from "../shared/schemas.js";
import { config } from "../config.js";
import { quizSummary } from "./api.js";
import { getQuizPricing } from "../services/pricing.js";
import { validQuizPricingExpression } from "../services/catalogue.js";
import { quizCategories } from "../services/categories.js";
import { quizSchema } from "../shared/schemas.js";
import { atomic } from "../services/wallet.js";
export const admin = Router();
admin.use(allow("SUPER_ADMIN"));
admin.get("/overview", async (_req, res) =>
  res.json({
    users: await User.countDocuments(),
    organizers: await User.countDocuments({ role: "ORGANIZER" }),
    quizzes: await Quiz.countDocuments({ status: "published" }),
    attempts: await Attempt.countDocuments({ status: "completed" }),
    live: await Competition.countDocuments({ status: "LIVE" }),
    competitions: await Competition.countDocuments(),
    reports: await Report.countDocuments({ status: "open" }),
    challenges: await Challenge.countDocuments(),
    paymentsEnabled: config.payments,
  }),
);
admin.get("/users", async (req, res) => {
  const search = z.string().max(100).catch("").parse(req.query.q);
  const filter: any = {};
  if (req.query.group === "organizers") filter.role = "ORGANIZER";
  if (req.query.group === "admins")
    filter.role = { $in: ["SUPER_ADMIN", "MODERATOR"] };
  if (search)
    filter.$or = [
      {
        username: {
          $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      },
      { email: search.toLowerCase() },
    ];
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({
    items: users.map((u) => ({ ...safeUser(u), suspended: u.suspended })),
  });
});
admin.patch("/users/:id", async (req, res) => {
  const data = z
    .object({
      role: z.enum(roles).optional(),
      suspended: z.boolean().optional(),
      confirm: z.literal(true),
    })
    .parse(req.body);
  if (String(req.params.id) === String(req.user._id))
    throw new HttpError(
      409,
      "You cannot modify your own administrative access.",
    );
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, "User not found.");
  const before = { role: user.role, suspended: user.suspended };
  if (data.role) user.role = data.role;
  if (data.suspended !== undefined) user.suspended = data.suspended;
  await user.save();
  await Session.deleteMany({ userId: user._id });
  await Audit.create({
    actorId: id(req.user),
    action: "user.update",
    targetId: id(user),
    details: { before, after: { role: user.role, suspended: user.suspended } },
  });
  res.json({ ...safeUser(user), suspended: user.suspended });
});
admin.get("/quizzes", async (req, res) => {
  const query = z
    .object({
      q: z.string().trim().max(100).default(""),
      status: z.enum(["all", "published", "draft", "archived"]).default("all"),
      access: z.enum(["all", "free", "paid", "review"]).default("all"),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(100),
    })
    .parse(req.query);
  const filter: any = {};
  if (query.q)
    filter.title = {
      $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  if (query.status !== "all") filter.status = query.status;
  const classify = {
    $cond: [
      validQuizPricingExpression,
      { $cond: [{ $eq: ["$pricing.coinPrice", 0] }, "free", "paid"] },
      "review",
    ],
  };
  const match =
    query.access === "all"
      ? filter
      : { ...filter, $expr: { $eq: [classify, query.access] } };
  const [rows, total, [counts]] = await Promise.all([
    Quiz.find(match)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Quiz.countDocuments(match),
    Quiz.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: {
            $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
          },
          draft: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          free: { $sum: { $cond: [{ $eq: [classify, "free"] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: [classify, "paid"] }, 1, 0] } },
          review: { $sum: { $cond: [{ $eq: [classify, "review"] }, 1, 0] } },
        },
      },
    ]),
  ]);
  res.json({
    items: rows.map(quizSummary),
    total,
    page: query.page,
    pages: Math.ceil(total / query.limit),
    counts: counts || {
      total: 0,
      published: 0,
      draft: 0,
      free: 0,
      paid: 0,
      review: 0,
    },
  });
});
admin.patch("/quizzes/:id", async (req, res) => {
  const { status, reason } = z
    .object({
      status: z.enum(["published", "archived", "draft"]),
      reason: z.string().trim().min(10).max(500),
    })
    .parse(req.body);
  const q = await Quiz.findById(req.params.id);
  if (!q) throw new HttpError(404, "Quiz not found.");
  if (status === "published") {
    quizSchema.parse(q.toObject());
    if (!getQuizPricing(q).configured)
      throw new HttpError(
        400,
        "Review and publish valid quiz pricing before publishing this content.",
      );
  }
  q.status = status;
  await q.save();
  await Audit.create({
    actorId: id(req.user),
    action: "quiz.moderate",
    targetId: id(q),
    details: { status, reason },
  });
  res.json(quizSummary(q));
});
admin.get("/audit", async (_req, res) =>
  res.json({
    items: await Audit.find().sort({ createdAt: -1 }).limit(100).lean(),
  }),
);
admin.get("/reports", async (_req, res) =>
  res.json({
    items: await Report.find().sort({ createdAt: -1 }).limit(100).lean(),
  }),
);
admin.patch("/reports/:id", async (req, res) => {
  const data = z
    .object({ status: z.enum(["open", "resolved", "dismissed"]) })
    .parse(req.body);
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { $set: data },
    { new: true },
  );
  if (!report) throw new HttpError(404, "Report not found.");
  await Audit.create({
    actorId: id(req.user),
    action: "report.update",
    targetId: id(report),
    details: data,
  });
  res.json(report);
});
admin.get("/plans", async (_req, res) =>
  res.json({ items: await Plan.find().lean() }),
);
admin.patch("/plans/:id", async (req, res) => {
  const data = z
    .object({
      name: z.string().min(2).max(60),
      quizLimit: z.number().int().min(0).max(1000),
      participantLimit: z.number().int().min(0).max(1000),
    })
    .parse(req.body);
  const p = await Plan.findByIdAndUpdate(
    req.params.id,
    { $set: data },
    { new: true },
  );
  if (!p) throw new HttpError(404, "Plan not found.");
  await Audit.create({
    actorId: id(req.user),
    action: "plan.update",
    targetId: id(p),
    details: data,
  });
  res.json(p);
});
admin.get("/settings", async (_req, res) =>
  res.json({ items: await Settings.find().lean() }),
);
admin.put("/settings", async (req, res) => {
  const data = z
    .object({
      supportEmail: z.union([z.email(), z.literal("")]),
      announcement: z.string().max(300),
    })
    .parse(req.body);
  await Settings.updateOne(
    { key: "public" },
    { $set: { value: data } },
    { upsert: true },
  );
  await Audit.create({
    actorId: id(req.user),
    action: "settings.update",
    targetId: "public",
    details: data,
  });
  res.json({ ok: true });
});
admin.get("/competitions", async (_req, res) =>
  res.json({
    items: await Competition.find()
      .select("-snapshot")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  }),
);
admin.get("/tournaments", async (_req, res) =>
  res.json({
    items: await Tournament.find().sort({ createdAt: -1 }).limit(100).lean(),
  }),
);
admin.get("/categories", async (_req, res) => {
  const counts = await Quiz.aggregate([
    {
      $group: {
        _id: "$category",
        quizzes: { $sum: 1 },
        published: {
          $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] },
        },
      },
    },
  ]);
  res.json({
    items: (await quizCategories()).map((name) => ({
      name,
      quizzes: counts.find((c) => c._id === name)?.quizzes || 0,
      published: counts.find((c) => c._id === name)?.published || 0,
    })),
  });
});

admin.post("/categories", async (req, res) => {
  const { name } = z
    .object({ name: z.string().trim().min(2).max(50) })
    .parse(req.body);
  await atomic(async (session) => {
    const stored = await Settings.findOne({
      key: "quiz-categories-v1",
    }).session(session);
    const custom = stored?.value?.custom || [];
    if (
      [...categories, ...custom].some(
        (item: string) => item.toLowerCase() === name.toLowerCase(),
      )
    )
      throw new HttpError(409, "This category already exists.");
    await Settings.updateOne(
      { key: "quiz-categories-v1" },
      { $set: { value: { custom: [...custom, name] } } },
      { upsert: true, session },
    );
    await Audit.create(
      [{ actorId: id(req.user), action: "category.create", targetId: name }],
      { session },
    );
  });
  res.status(201).json({ categories: await quizCategories() });
});
