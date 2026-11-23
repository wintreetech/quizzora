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
  const filter:any = {};
  if (req.query.group === "organizers") filter.role = "ORGANIZER";
  if (req.query.group === "admins") filter.role = { $in: ["SUPER_ADMIN", "MODERATOR"] };
  if (search) filter.$or = [{username: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }}, {email: search.toLowerCase()}];
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .limit(100);
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
admin.get("/quizzes", async (_req, res) =>
  res.json({
    items: (await Quiz.find().sort({ createdAt: -1 }).limit(100)).map(
      quizSummary,
    ),
  }),
);
admin.patch("/quizzes/:id", async (req, res) => {
  const { status, reason } = z
    .object({
      status: z.enum(["published", "archived", "draft"]),
      reason: z.string().trim().min(10).max(500),
    })
    .parse(req.body);
  const q = await Quiz.findById(req.params.id);
  if (!q) throw new HttpError(404, "Quiz not found.");
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
admin.get("/tournaments", async (_req,res) => res.json({ items: await Tournament.find().sort({ createdAt: -1 }).limit(100).lean() }));
admin.get("/categories", async (_req,res) => {
  const counts = await Quiz.aggregate([{ $group: { _id: "$category", quizzes: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ["$status", "published"] },1,0] } } } }]);
  res.json({ items: categories.map(name => ({ name, quizzes: counts.find(c=>c._id===name)?.quizzes||0, published: counts.find(c=>c._id===name)?.published||0 })) });
});
