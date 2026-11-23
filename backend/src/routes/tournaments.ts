import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  Tournament,
  TournamentMember,
  Competition,
  Participant,
} from "../models.js";
import { requireAuth, allow } from "../auth.js";
import { HttpError, id, locked } from "../utils.js";
import { atomic, ledger } from "../services/wallet.js";
import { getPricing, checkConsent } from "../services/pricing.js";
import { config } from "../config.js";
import {
  createCompetition,
  joinCompetition,
} from "../services/competitions.js";
export const tournaments = Router();
async function view(t: any, userId?: string) {
  const rounds = await Competition.find({ _id: { $in: t.roundIds } }).lean();
  const members = await TournamentMember.find({ tournamentId: id(t) }).lean();
  const results = await Participant.find({
    competitionId: { $in: t.roundIds },
    disqualified: false,
  }).lean();
  const standings = members
    .map((m) => {
      const rows = results.filter(
        (r) =>
          r.userId === m.userId &&
          rounds.some(
            (c) => id(c) === r.competitionId && c.status === "COMPLETED",
          ),
      );
      return {
        userId: m.userId,
        displayName: m.displayName,
        username: m.username,
        score: rows.reduce((n, r) => n + r.score, 0),
        correctCount: rows.reduce((n, r) => n + r.correctCount, 0),
        elapsedMs: rows.reduce((n, r) => n + r.elapsedMs, 0),
        rounds: rows.length,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.correctCount - a.correctCount ||
        a.elapsedMs - b.elapsedMs ||
        a.userId.localeCompare(b.userId),
    );
  return {
    id: id(t),
    title: t.title,
    description: t.description,
    capacity: t.capacity,
    visibility: t.visibility,
    registrationClosesAt: t.registrationClosesAt,
    participantCount: members.length,
    joined: members.some((m) => m.userId === userId),
    isHost: t.hostId === userId,
    pricing: getPricing(t),
    paidEntriesEnabled: config.paidCompetitions,
    code: t.hostId === userId ? t.code : undefined,
    status:
      t.status === "CANCELLED"
        ? "CANCELLED"
        : rounds.every((r) => r.status === "COMPLETED")
          ? "COMPLETED"
          : rounds.some((r) =>
                ["LIVE", "PAUSED", "COMPLETED"].includes(r.status),
              )
            ? "IN_PROGRESS"
            : "REGISTRATION_OPEN",
    rounds: t.roundIds.map((rid: string) => {
      const c = rounds.find((r) => id(r) === rid);
      return c
        ? { id: rid, title: c.title, status: c.status, startsAt: c.startsAt }
        : null;
    }),
    standings: standings.map((s, i) => ({ ...s, rank: i + 1 })),
  };
}
tournaments.get("/", async (req, res) => {
  const rows = await Tournament.find({ visibility: "public" })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json({
    items: await Promise.all(
      rows.map((t) => view(t, req.user ? String(req.user._id) : undefined)),
    ),
  });
});
tournaments.post("/", allow("ORGANIZER", "SUPER_ADMIN"), async (req, res) => {
  const data = z
    .object({
      title: z.string().trim().min(3).max(120),
      description: z.string().max(1000),
      visibility: z.enum(["public", "private"]),
      capacity: z.number().int().min(2).max(25),
      registrationClosesAt: z.iso.datetime(),
      rounds: z
        .array(
          z.object({
            quizId: z.string().length(24),
            startsAt: z.iso.datetime(),
          }),
        )
        .min(2)
        .max(5),
    })
    .parse(req.body);
  if (
    new Date(data.registrationClosesAt).getTime() <= Date.now() ||
    data.rounds.some(
      (r, i) =>
        new Date(r.startsAt) <= new Date(data.registrationClosesAt) ||
        (i > 0 &&
          new Date(r.startsAt) <= new Date(data.rounds[i - 1].startsAt)),
    )
  )
    throw new HttpError(
      400,
      "Registration must close in the future, before sequentially scheduled rounds.",
    );
  const created: any[] = [];
  try {
    for (const [i, r] of data.rounds.entries())
      created.push(
        await createCompetition(req.user, {
          title: `${data.title} · Round ${i + 1}`,
          description: data.description,
          quizId: r.quizId,
          startsAt: r.startsAt,
          visibility: "private",
          capacity: data.capacity,
        }),
      );
    const t = await Tournament.create({
      ...data,
      hostId: String(req.user._id),
      code: randomBytes(12).toString("hex"),
      roundIds: created.map(id),
    });
    await Competition.updateMany(
      { _id: { $in: t.roundIds } },
      { $set: { tournamentId: id(t) } },
    );
    res.status(201).json(await view(t, String(req.user._id)));
  } catch (e) {
    await Competition.deleteMany({ _id: { $in: created.map(id) } });
    throw e;
  }
});
tournaments.get("/:id", async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  const userId = req.user ? String(req.user._id) : undefined;
  if (
    !t ||
    (t.visibility === "private" &&
      t.hostId !== userId &&
      t.code !== req.query.code &&
      !(await TournamentMember.exists({ tournamentId: id(t), userId })))
  )
    throw new HttpError(404, "Tournament not found.");
  res.json(await view(t, userId));
});
tournaments.post("/:id/join", requireAuth, async (req, res) => {
  const result = await locked(`tournament:${req.params.id}`, async () =>
    atomic(async (session) => {
      const t = await Tournament.findById(req.params.id).session(session);
      const userId = String(req.user._id);
      if (!t || (t.visibility === "private" && t.code !== req.body.code))
        throw new HttpError(404, "Tournament invitation is invalid.");
      const existing = await TournamentMember.findOne({
        tournamentId: id(t),
        userId,
      }).session(session);
      if (existing) return t;
      const rounds = await Competition.find({
        _id: { $in: t.roundIds },
      }).session(session);
      if (
        t.registrationClosesAt.getTime() < Date.now() ||
        rounds.some((r) => !["SCHEDULED", "LOBBY"].includes(r.status))
      )
        throw new HttpError(409, "Tournament registration is closed.");
      if (
        (await TournamentMember.countDocuments({ tournamentId: id(t) }).session(
          session,
        )) >= t.capacity
      )
        throw new HttpError(409, "This tournament is full.");
      const pricing = getPricing(t);
      if (!pricing.available || t.status === "CANCELLED")
        throw new HttpError(409, "Tournament registration is unavailable.");
      let billing: any = { ...pricing };
      if (pricing.coinPrice) {
        if (!config.coins || !config.paidCompetitions)
          throw new HttpError(
            503,
            "Coin-entry events are awaiting merchant approval and activation.",
          );
        checkConsent(pricing, req.body);
        const entry = await ledger(session, {
          userId,
          amount: -pricing.coinPrice,
          type: "TOURNAMENT_PASS",
          reference: `tournament:${t._id}:${userId}`,
          targetId: id(t),
          reason: `${t.title} · all ${rounds.length} scheduled rounds`,
        });
        billing = { ...pricing, transactionId: id(entry), paidAt: new Date() };
      }
      for (const c of rounds) {
        const member = await Participant.findOne({
          competitionId: id(c),
          userId,
        }).session(session);
        if (!member) {
          if (
            (await Participant.countDocuments({ competitionId: id(c) }).session(
              session,
            )) >= c.capacity
          )
            throw new HttpError(
              409,
              "A tournament round is full. No entry coins were charged.",
            );
          await Participant.create(
            [
              {
                competitionId: id(c),
                userId,
                displayName: req.user.displayName,
                username: req.user.username,
                billing: { coinPrice: 0, coveredByTournament: id(t) },
              },
            ],
            { session },
          );
        }
        c.sequence++;
        await c.save({ session });
      }
      await TournamentMember.updateOne(
        { tournamentId: id(t), userId },
        {
          $setOnInsert: {
            displayName: req.user.displayName,
            username: req.user.username,
            billing,
          },
        },
        { upsert: true, session },
      );
      t.markModified("roundIds");
      await t.save({ session });
      return t;
    }),
  );
  res.json(await view(result, id(req.user)));
});
