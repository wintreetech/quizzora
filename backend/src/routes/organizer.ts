import { Router } from "express";
import { z } from "zod";
import { quizSchema, questionSchema } from "../shared/schemas.js";
import { allow } from "../auth.js";
import {
  Quiz,
  Competition,
  Participant,
  Attempt,
  Audit,
  Plan,
} from "../models.js";
import { id, HttpError, rankSort, locked } from "../utils.js";
import { quizSummary } from "./api.js";
import {
  createCompetition,
  competitionState,
  controlCompetition,
  broadcast,
} from "../services/competitions.js";
export const organizer = Router();
organizer.use(allow("ORGANIZER", "SUPER_ADMIN"));
organizer.post("/validate-questions", (req, res) => {
  res.json(
    z
      .object({ questions: z.array(questionSchema).min(1).max(100) })
      .parse(req.body),
  );
});
const ownedQuiz = async (quizId: string, user: any) => {
  const q = await Quiz.findById(quizId);
  if (!q || (q.ownerId !== String(user._id) && user.role !== "SUPER_ADMIN"))
    throw new HttpError(404, "Quiz not found.");
  return q;
};
organizer.get("/overview", async (req, res) => {
  const userId = String(req.user._id);
  const quizzes = await Quiz.find({ ownerId: userId }).lean();
  const events = await Competition.find({ hostId: userId }).sort({
    createdAt: -1,
  });
  const participants = await Participant.countDocuments({
    competitionId: { $in: events.map(id) },
  });
  const attempts = await Attempt.find({
    quizId: { $in: quizzes.map(id) },
    status: "completed",
  }).select("score accuracy");
  res.json({
    quizzes: quizzes.length,
    published: quizzes.filter((q) => q.status === "published").length,
    events: events.length,
    participants,
    attempts: attempts.length,
    averageAccuracy: attempts.length
      ? Math.round(
          attempts.reduce((n, a) => n + a.accuracy, 0) / attempts.length,
        )
      : 0,
    competitions: await Promise.all(
      events.map((c) => competitionState(c, userId)),
    ),
  });
});
organizer.get("/quizzes", async (req, res) =>
  res.json({
    items: (
      await Quiz.find({ ownerId: String(req.user._id) }).sort({ createdAt: -1 })
    ).map(quizSummary),
  }),
);
organizer.get("/quizzes/:id", async (req, res) => {
  const q = await ownedQuiz(String(req.params.id), req.user);
  res.json({ ...quizSummary(q), questions: q.questions });
});
organizer.post("/quizzes", async (req, res) => {
  const data = quizSchema.parse(req.body);
  const userId = String(req.user._id);
  const q = await locked(`quiz-limit:${userId}`, async () => {
    const plan = await Plan.findOne({ key: "organizer" });
    if (
      (await Quiz.countDocuments({
        ownerId: userId,
        status: { $ne: "archived" },
      })) >= (plan?.quizLimit ?? 10)
    )
      throw new HttpError(
        403,
        "Your free organizer quiz limit has been reached.",
      );
    return Quiz.create({
      ...data,
      ownerId: userId,
      slug: `quiz-${crypto.randomUUID()}`,
      version: 1,
    });
  });
  await Audit.create({
    actorId: userId,
    action: "quiz.create",
    targetId: id(q),
  });
  res.status(201).json(quizSummary(q));
});
organizer.put("/quizzes/:id", async (req, res) => {
  const data = quizSchema.parse(req.body);
  const q = await ownedQuiz(String(req.params.id), req.user);
  Object.assign(q, data);
  q.version++;
  await q.save();
  await Audit.create({
    actorId: String(req.user._id),
    action: "quiz.update",
    targetId: id(q),
    details: { version: q.version, status: q.status },
  });
  res.json(quizSummary(q));
});
organizer.post("/quizzes/:id/duplicate", async (req, res) => {
  const q = await ownedQuiz(String(req.params.id), req.user);
  const copy = await locked(`quiz-limit:${req.user._id}`, async () => {
    const plan = await Plan.findOne({ key: "organizer" });
    const count = await Quiz.countDocuments({
      ownerId: String(req.user._id),
      status: { $ne: "archived" },
    });
    if (count >= (plan?.quizLimit ?? 10))
      throw new HttpError(403, "Your quiz limit has been reached.");
    return Quiz.create({
      title: `${q.title} (copy)`.slice(0, 120),
      description: q.description,
      category: q.category,
      difficulty: q.difficulty,
      cover: q.cover,
      visibility: q.visibility,
      status: "draft",
      questions: q.questions,
      ownerId: String(req.user._id),
      slug: `quiz-${crypto.randomUUID()}`,
      version: 1,
    });
  });
  res.status(201).json(quizSummary(copy));
});
organizer.post("/competitions", async (req, res) => {
  const plan = await Plan.findOne({ key: "organizer" });
  const data = z
    .object({
      title: z.string().trim().min(3).max(120),
      description: z.string().max(1000).default(""),
      quizId: z.string().length(24),
      visibility: z.enum(["public", "private"]),
      capacity: z
        .number()
        .int()
        .min(2)
        .max(plan?.participantLimit ?? 25),
      startsAt: z.iso.datetime().optional(),
    })
    .parse(req.body);
  res
    .status(201)
    .json(
      await competitionState(
        await createCompetition(req.user, data),
        String(req.user._id),
      ),
    );
});
organizer.post("/competitions/:id/control", async (req, res) => {
  const { action } = z
    .object({ action: z.enum(["start", "pause", "resume", "end", "cancel"]) })
    .parse(req.body);
  res.json(
    await competitionState(
      await controlCompetition(String(req.params.id), req.user, action),
      String(req.user._id),
    ),
  );
});
organizer.post("/competitions/:id/remove", async (req, res) => {
  const { userId, reason } = z
    .object({
      userId: z.string().length(24),
      reason: z.string().trim().min(10).max(500),
    })
    .parse(req.body);
  const c = await Competition.findOne({
    _id: req.params.id,
    hostId: String(req.user._id),
  });
  if (!c) throw new HttpError(404, "Competition not found.");
  await Participant.updateOne(
    { competitionId: id(c), userId },
    { $set: { disqualified: true } },
  );
  await Audit.create({
    actorId: String(req.user._id),
    action: "competition.disqualify",
    targetId: id(c),
    details: { userId, reason },
  });
  await broadcast(id(c));
  res.json({ ok: true });
});
organizer.get("/competitions/:id/export", async (req, res) => {
  const c = await Competition.findById(req.params.id);
  if (
    !c ||
    (c.hostId !== String(req.user._id) && req.user.role !== "SUPER_ADMIN")
  )
    throw new HttpError(404, "Competition not found.");
  const rows = await Participant.find({ competitionId: id(c) })
    .sort(rankSort)
    .lean();
  const escape = (s: any) =>
    `"${String(s)
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""')}"`;
  res
    .type("text/csv")
    .attachment("competition-results.csv")
    .send(
      [
        "Rank,Username,Score,Correct,Time_ms,Disqualified",
        ...rows.map((p, i) =>
          [
            i + 1,
            p.username,
            p.score,
            p.correctCount,
            p.elapsedMs,
            p.disqualified,
          ]
            .map(escape)
            .join(","),
        ),
      ].join("\r\n"),
    );
});
