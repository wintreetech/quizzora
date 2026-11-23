import { Router } from "express";
import { z } from "zod";
import { categories, answerSchema } from "../shared/schemas.js";
import {
  Quiz,
  Attempt,
  User,
  Competition,
  Participant,
  Plan,
  Report,
  Challenge,
  Settings,
} from "../models.js";
import { requireAuth } from "../auth.js";
import { HttpError, id, rankSort } from "../utils.js";
import {
  startAttempt,
  ownedAttempt,
  advanceAttempt,
  finishAttempt,
  serializeAttempt,
  quizAccess,
  acknowledgeAttempt,
} from "../services/attempts.js";
import {
  joinCompetition,
  competitionState,
  submitCompetition,
} from "../services/competitions.js";
import { config } from "../config.js";
import { randomBytes } from "node:crypto";
import { getQuizPricing } from "../services/pricing.js";
import { discoverQuizzes } from "../services/catalogue.js";
import { quizCategories } from "../services/categories.js";
import { publicStandings } from "../services/standings.js";
export const api = Router();
export const quizSummary = (q: any) => ({
  id: id(q),
  title: q.title,
  slug: q.slug,
  description: q.description,
  category: q.category,
  difficulty: q.difficulty,
  cover: q.cover,
  questionCount: q.questions.length,
  duration: Math.ceil(
    q.questions.reduce((n: number, v: any) => n + v.seconds, 0) / 60,
  ),
  status: q.status,
  visibility: q.visibility,
  ownerId: q.ownerId,
  createdAt: q.createdAt,
  pricing: getQuizPricing(q),
  progress: q.progress || null,
  players: q.players || 0,
});
api.get("/config", async (_req, res) => {
  const settings = await Settings.findOne({ key: "public" });
  res.json({
    categories: await quizCategories(),
    supportEmail:
      settings?.value?.supportEmail || process.env.SUPPORT_EMAIL || null,
    announcement: settings?.value?.announcement || "",
    billingEnabled: false,
    requireEmailVerification: config.verify,
  });
});
api.get("/quizzes", async (req, res) => {
  const { rows, ...result } = await discoverQuizzes(
    req.query,
    req.user ? String(req.user._id) : undefined,
  );
  res.json({ ...result, items: rows.map(quizSummary) });
});
api.get("/quizzes/:id", async (req, res) => {
  const q = await Quiz.findById(req.params.id);
  if (
    !q ||
    q.status !== "published" ||
    (q.visibility !== "public" && q.ownerId !== String(req.user?._id))
  )
    throw new HttpError(404, "Quiz not found.");
  res.json(quizSummary(q));
});
api.get("/quizzes/:id/access", async (req, res) => {
  const q = await Quiz.findById(req.params.id);
  if (
    !q ||
    q.status !== "published" ||
    (q.visibility !== "public" && q.ownerId !== String(req.user?._id))
  )
    throw new HttpError(404, "Quiz not found.");
  res.json(await quizAccess(req.user ? String(req.user._id) : undefined, q));
});
api.get("/quizzes/:id/preview", async (req, res) => {
  const q = await Quiz.findOne({
    _id: req.params.id,
    status: "published",
    visibility: "public",
  });
  if (!q) throw new HttpError(404, "Quiz not found.");
  const p = getQuizPricing(q);
  if (p.accessType !== "FREE_PREVIEW_THEN_PAID" || !p.previewQuestions)
    throw new HttpError(404, "A preview is not available for this quiz.");
  res.json({
    title: q.title,
    scored: false,
    questions: q.questions.slice(0, p.previewQuestions).map((v: any) => ({
      id: v.id,
      prompt: v.prompt,
      options: v.options,
      type: v.type,
      image: v.image,
    })),
    pricing: p,
  });
});
api.post("/quizzes/:id/attempts", requireAuth, async (req, res) =>
  res
    .status(201)
    .json(
      serializeAttempt(
        await startAttempt(
          String(req.user._id),
          String(req.params.id),
          req.body,
        ),
      ),
    ),
);
api.get("/attempts/:id", requireAuth, async (req, res) =>
  res.json(
    serializeAttempt(
      await ownedAttempt(String(req.user._id), String(req.params.id)),
    ),
  ),
);
api.post("/attempts/:id/launched", requireAuth, async (req, res) => {
  await acknowledgeAttempt(String(req.user._id), String(req.params.id));
  res.json({ ok: true });
});
api.post("/attempts/:id/answer", requireAuth, async (req, res) =>
  res.json(
    serializeAttempt(
      await advanceAttempt(
        String(req.user._id),
        String(req.params.id),
        answerSchema.parse(req.body),
      ),
    ),
  ),
);
api.post("/attempts/:id/advance", requireAuth, async (req, res) =>
  res.json(
    serializeAttempt(
      await advanceAttempt(String(req.user._id), String(req.params.id)),
    ),
  ),
);
api.post("/attempts/:id/finish", requireAuth, async (req, res) =>
  res.json(
    serializeAttempt(
      await finishAttempt(String(req.user._id), String(req.params.id)),
    ),
  ),
);
api.get("/dashboard", requireAuth, async (req, res) => {
  const userId = String(req.user._id);
  const running = await Attempt.find({ userId, status: "active" })
    .select("_id")
    .limit(20);
  for (const attempt of running)
    await ownedAttempt(userId, String(attempt._id));
  const attempts = await Attempt.find({ userId, status: "completed" })
    .sort({ completedAt: -1 })
    .lean();
  const competitions = await Participant.find({ userId }).lean();
  const active = await Attempt.find({ userId, status: "active" })
    .sort({ updatedAt: -1 })
    .limit(6)
    .select("_id title quizId index snapshot deadline")
    .lean();
  const score = attempts.reduce((n, a) => n + a.score, 0);
  const all = await publicStandings();
  const rank = all.findIndex((a) => a.userId === userId) + 1;
  res.json({
    total: attempts.length,
    active: active.map((a) => ({
      id: id(a),
      quizId: a.quizId,
      title: a.title,
      answered: a.index,
      total: a.snapshot.length,
      deadline: a.deadline,
    })),
    accuracy: attempts.length
      ? Math.round(
          attempts.reduce((n, a) => n + a.accuracy, 0) / attempts.length,
        )
      : 0,
    best: attempts.length ? Math.max(...attempts.map((a) => a.score)) : 0,
    bestAccuracy: attempts.length
      ? Math.max(...attempts.map((a) => a.accuracy))
      : 0,
    points: score,
    rank: rank || null,
    competitions: competitions.length,
    attempts: attempts.slice(0, 30).map((a) => ({
      id: id(a),
      title: a.title,
      category: a.category,
      score: a.score,
      accuracy: a.accuracy,
      completedAt: a.completedAt,
      elapsedMs: a.elapsedMs,
    })),
    categories: [...new Set(attempts.map((attempt) => attempt.category))]
      .map((c) => {
        const rows = attempts.filter((a) => a.category === c);
        return {
          category: c,
          attempts: rows.length,
          accuracy: rows.length
            ? Math.round(rows.reduce((n, a) => n + a.accuracy, 0) / rows.length)
            : 0,
        };
      })
      .filter((c) => c.attempts),
    achievements: [
      ...(attempts.length
        ? [
            {
              name: "First things first",
              description: "Completed your first quiz",
              icon: "sparkles",
            },
          ]
        : []),
      ...(attempts.some((a) => a.accuracy === 100)
        ? [
            {
              name: "Perfectly curious",
              description: "Scored 100% on a quiz",
              icon: "target",
            },
          ]
        : []),
      ...(attempts.length >= 5
        ? [
            {
              name: "Finding your rhythm",
              description: "Completed five quizzes",
              icon: "flame",
            },
          ]
        : []),
    ],
  });
});
api.get("/activity", requireAuth, async (req, res) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .catch(1)
    .parse(req.query.page);
  const filter = { userId: String(req.user._id), status: "completed" };
  const [items, total] = await Promise.all([
    Attempt.find(filter)
      .sort({ completedAt: -1, _id: -1 })
      .skip((page - 1) * 12)
      .limit(12)
      .select("title quizId category score accuracy completedAt elapsedMs")
      .lean(),
    Attempt.countDocuments(filter),
  ]);
  res.json({
    items: items.map((attempt) => ({ ...attempt, id: id(attempt) })),
    total,
    page,
    pages: Math.ceil(total / 12),
  });
});
api.get("/leaderboard", async (req, res) => {
  const period = z
    .enum(["week", "month", "all"])
    .catch("week")
    .parse(req.query.period);
  const rows = await publicStandings(period);
  res.json({
    items: rows
      .slice(0, 100)
      .map((row, index) => ({ ...row, rank: index + 1 })),
  });
});
api.get("/competitions", async (_req, res) => {
  const rooms = await Competition.find({
    visibility: "public",
    seedKey: { $exists: false },
    status: { $ne: "CANCELLED" },
  })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({
    items: await Promise.all(
      rooms.map(async (c) => ({
        ...(await competitionState(c)),
        sample: !!c.seedKey,
        leaderboard: undefined,
      })),
    ),
  });
});
api.post("/competitions/join", requireAuth, async (req, res) => {
  const { code } = z
    .object({
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{6}$/),
    })
    .parse(req.body);
  const c = await joinCompetition(code, req.user, req.body);
  res.json(await competitionState(c, String(req.user._id)));
});
api.get("/competitions/by-code/:code", requireAuth, async (req, res) => {
  const code = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/)
    .parse(req.params.code);
  const c = await Competition.findOne({ code });
  if (!c) throw new HttpError(404, "Room code not found.");
  res.json(await competitionState(c, id(req.user)));
});
export async function accessibleCompetition(
  competitionId: string,
  userId?: string,
  role?: string,
) {
  const c = await Competition.findById(competitionId);
  if (
    !c ||
    (c.visibility === "private" &&
      role !== "SUPER_ADMIN" &&
      c.hostId !== userId &&
      !(await Participant.exists({
        competitionId,
        userId,
        disqualified: false,
      })))
  )
    throw new HttpError(404, "Competition not found.");
  return c;
}
api.get("/competitions/:id", async (req, res) =>
  res.json(
    await competitionState(
      await accessibleCompetition(
        String(req.params.id),
        req.user ? String(req.user._id) : undefined,
        req.user?.role,
      ),
      req.user ? String(req.user._id) : undefined,
    ),
  ),
);
api.post("/competitions/:id/answer", requireAuth, async (req, res) =>
  res.json(
    await submitCompetition(
      String(req.params.id),
      String(req.user._id),
      answerSchema.parse(req.body),
    ),
  ),
);
api.get("/plans", async (_req, res) =>
  res.json({
    items: await Plan.find().sort({ participantLimit: 1 }).lean(),
    billingEnabled: false,
  }),
);
api.post("/billing/checkout", requireAuth, (_req, _res) => {
  throw new HttpError(
    503,
    "Paid plans are not available yet. Free features remain available.",
  );
});
api.post("/reports", requireAuth, async (req, res) => {
  const data = z
    .object({
      targetId: z.string().max(100),
      reason: z.string().trim().min(10).max(2000),
    })
    .parse(req.body);
  await Report.create({ ...data, userId: String(req.user._id) });
  res.status(201).json({ ok: true });
});
api.post("/challenges", requireAuth, async (req, res) => {
  const { quizId } = z
    .object({ quizId: z.string().length(24) })
    .parse(req.body);
  const q = await Quiz.findOne({
    _id: quizId,
    status: "published",
    visibility: "public",
  });
  if (!q) throw new HttpError(404, "Quiz not found.");
  const challenge = await Challenge.create({
    creatorId: String(req.user._id),
    quizId,
    code: randomBytes(12).toString("hex"),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.status(201).json({ id: id(challenge), code: challenge.code });
});
api.get("/challenges", requireAuth, async (req, res) =>
  res.json({
    items: await Challenge.find({
      $or: [
        { creatorId: String(req.user._id) },
        { acceptedBy: String(req.user._id) },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  }),
);
api.get("/challenges/:code", requireAuth, async (req, res) => {
  const c = await Challenge.findOne({ code: req.params.code });
  if (!c) throw new HttpError(404, "Challenge not found.");
  const mine = [c.creatorId, c.acceptedBy].includes(String(req.user._id));
  if (c.acceptedBy && !mine)
    throw new HttpError(403, "This challenge has already been accepted.");
  const q = await Quiz.findById(c.quizId);
  const creator = await User.findById(c.creatorId);
  res.json({
    id: id(c),
    code: c.code,
    quizId: c.quizId,
    title: q?.title,
    creator: creator?.displayName,
    creatorId: c.creatorId,
    acceptedBy: c.acceptedBy,
    expiresAt: c.expiresAt,
    status: c.status,
    ...(mine
      ? {
          results: await Attempt.find({
            _id: {
              $in: [c.creatorAttemptId, c.friendAttemptId].filter(Boolean),
            },
            status: "completed",
          })
            .select("userId title score accuracy elapsedMs")
            .lean(),
        }
      : {}),
  });
});
api.post("/challenges/:code/accept", requireAuth, async (req, res) => {
  const userId = String(req.user._id);
  const c = await Challenge.findOneAndUpdate(
    {
      code: req.params.code,
      expiresAt: { $gt: new Date() },
      $or: [{ acceptedBy: { $exists: false } }, { acceptedBy: userId }],
      creatorId: { $ne: userId },
    },
    { $set: { acceptedBy: userId, status: "accepted" } },
    { new: true },
  );
  if (!c) throw new HttpError(409, "This challenge is expired or unavailable.");
  res.json({ ok: true });
});
api.post("/challenges/:code/play", requireAuth, async (req, res) => {
  const c = await Challenge.findOne({
    code: req.params.code,
    expiresAt: { $gt: new Date() },
  });
  const userId = String(req.user._id);
  if (!c || ![c.creatorId, c.acceptedBy].includes(userId))
    throw new HttpError(403, "Accept this challenge before playing.");
  const field = c.creatorId === userId ? "creatorAttemptId" : "friendAttemptId";
  if (c[field])
    return res.json(serializeAttempt(await ownedAttempt(userId, c[field])));
  const a = await startAttempt(userId, c.quizId, req.body);
  await Challenge.updateOne(
    { _id: c._id, [field]: { $exists: false } },
    { $set: { [field]: id(a) } },
  );
  res.json(serializeAttempt(a));
});
