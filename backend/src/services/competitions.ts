import {
  Competition,
  Participant,
  Response,
  Quiz,
  Audit,
  Tournament,
  TournamentMember,
} from "../models.js";
import { atomic, ledger, refundEntry } from "./wallet.js";
import { getPricing, checkConsent } from "./pricing.js";
import { config } from "../config.js";
import {
  HttpError,
  locked,
  isCorrect,
  publicQuestion,
  rankSort,
} from "../utils.js";
import { randomBytes } from "node:crypto";
import type { Question } from "../shared/schemas.js";
export let broadcast: (competitionId: string) => Promise<void> = async () => {};
export const setBroadcast = (fn: typeof broadcast) => {
  broadcast = fn;
};
export async function competitionState(c: any, userId?: string) {
  const participants = await Participant.find({
    competitionId: String(c._id),
    disqualified: false,
  })
    .sort(rankSort)
    .lean();
  const mine = userId
    ? participants.find((p) => p.userId === userId)
    : undefined;
  const response =
    userId && c.status === "LIVE"
      ? await Response.exists({
          competitionId: String(c._id),
          userId,
          questionId: c.snapshot[c.index]?.id,
        })
      : false;
  return {
    id: String(c._id),
    title: c.title,
    description: c.description,
    code: c.code,
    status: c.status,
    capacity: c.capacity,
    startsAt: c.startsAt,
    participantCount: participants.length,
    hostId: c.hostId,
    index: c.index,
    total: c.snapshot.length,
    deadline: c.deadline,
    serverTime: Date.now(),
    sequence: c.sequence,
    joined: !!mine,
    submitted: !!response,
    isHost: c.hostId === userId,
    pricing: getPricing(c),
    paidEntriesEnabled: config.paidCompetitions,
    billing: mine?.billing || null,
    question:
      c.status === "LIVE" ? publicQuestion(c.snapshot[c.index]) : undefined,
    leaderboard: participants.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      displayName: p.displayName,
      username: p.username,
      score: p.score,
      correctCount: p.correctCount,
      elapsedMs: p.elapsedMs,
    })),
  };
}
export async function createCompetition(user: any, data: any) {
  const quiz = await Quiz.findById(data.quizId);
  if (
    !quiz ||
    quiz.status !== "published" ||
    (quiz.ownerId !== String(user._id) && quiz.visibility !== "public")
  )
    throw new HttpError(404, "Published quiz not found.");
  const startsAt = data.startsAt ? new Date(data.startsAt) : undefined;
  return Competition.create({
    ...data,
    startsAt,
    hostId: String(user._id),
    snapshot: quiz.questions,
    code: randomBytes(4).toString("hex").slice(0, 6).toUpperCase(),
    status: startsAt ? "SCHEDULED" : "LOBBY",
  });
}
export async function joinCompetition(code: string, user: any, consent?: any) {
  const found = await Competition.findOne({ code }).select("_id");
  if (!found) throw new HttpError(404, "That room code was not found.");
  return locked(`competition:${found._id}`, async () => {
    const result = await atomic(async (session) => {
      const c = await Competition.findById(found._id).session(session);
      if (!c) throw new HttpError(404, "Room not found.");
      const userId = String(user._id),
        competitionId = String(c._id);
      const existing = await Participant.findOne({
        competitionId,
        userId,
      }).session(session);
      if (existing) {
        if (existing.disqualified)
          throw new HttpError(403, "You have been removed from this room.");
        return c;
      }
      if (!["SCHEDULED", "LOBBY"].includes(c.status))
        throw new HttpError(
          409,
          "Registration for this competition is closed.",
        );
      if (c.tournamentId)
        throw new HttpError(
          403,
          "Register through the tournament to access its included rounds.",
        );
      if (
        (await Participant.countDocuments({ competitionId }).session(
          session,
        )) >= c.capacity
      )
        throw new HttpError(409, "This competition is full.");
      const pricing = getPricing(c);
      if (!pricing.available)
        throw new HttpError(409, "Registration is unavailable.");
      let billing: any = { ...pricing };
      if (pricing.coinPrice) {
        if (!config.coins || !config.paidCompetitions)
          throw new HttpError(
            503,
            "Coin-entry events are awaiting merchant approval and activation.",
          );
        checkConsent(pricing, consent);
        const entry = await ledger(session, {
          userId,
          amount: -pricing.coinPrice,
          type: "COMPETITION_ENTRY",
          reference: `competition:${competitionId}:${userId}`,
          targetId: competitionId,
          reason: `${c.title} · competition entry`,
        });
        billing = {
          ...pricing,
          transactionId: String(entry._id),
          paidAt: new Date(),
        };
      }
      await Participant.create(
        [
          {
            competitionId,
            userId,
            displayName: user.displayName,
            username: user.username,
            billing,
          },
        ],
        { session },
      );
      c.sequence++;
      await c.save({ session });
      return c;
    });
    await broadcast(String(result._id));
    return result;
  });
}
export async function controlCompetition(
  competitionId: string,
  user: any,
  action: string,
) {
  return locked(`competition:${competitionId}`, async () => {
    if (action === "cancel") {
      const cancelled = await atomic(async (session) => {
        const c = await Competition.findById(competitionId).session(session);
        if (!c) throw new HttpError(404, "Competition not found.");
        if (c.hostId !== String(user._id) && user.role !== "SUPER_ADMIN")
          throw new HttpError(403, "Only the host can cancel this room.");
        if (c.status === "CANCELLED") return c;
        if (!["SCHEDULED", "LOBBY", "LIVE", "PAUSED"].includes(c.status))
          throw new HttpError(409, "A completed event cannot be canceled.");
        if (c.tournamentId) {
          await cancelTournamentInSession(
            session,
            c.tournamentId,
            String(user._id),
          );
          return Competition.findById(competitionId).session(session);
        }
        const members = await Participant.find({ competitionId }).session(
          session,
        );
        for (const m of members)
          await refundEntry(
            session,
            m.billing,
            m.userId,
            "COMPETITION_REFUND",
            competitionId,
            "Host canceled the competition. Entry coins restored.",
          );
        c.status = "CANCELLED";
        c.sequence++;
        await c.save({ session });
        await Audit.create(
          [
            {
              actorId: String(user._id),
              action: "competition.cancel",
              targetId: competitionId,
            },
          ],
          { session },
        );
        return c;
      });
      await broadcast(competitionId);
      if (cancelled?.tournamentId) {
        const t = await Tournament.findById(cancelled.tournamentId).select("roundIds");
        for (const roundId of t?.roundIds || []) if (String(roundId) !== competitionId) await broadcast(String(roundId));
      }
      return cancelled;
    }
    const c = await Competition.findById(competitionId);
    if (!c) throw new HttpError(404, "Competition not found.");
    if (c.hostId !== String(user._id) && user.role !== "SUPER_ADMIN")
      throw new HttpError(403, "Only the host can control this room.");
    if (action === "start" && ["LOBBY", "SCHEDULED"].includes(c.status)) {
      c.status = "LIVE";
      c.startedAt = new Date();
      c.deadline = new Date(Date.now() + c.snapshot[c.index].seconds * 1000);
    } else if (action === "pause" && c.status === "LIVE") {
      c.remainingMs = Math.max(0, c.deadline.getTime() - Date.now());
      c.status = "PAUSED";
    } else if (action === "resume" && c.status === "PAUSED") {
      c.status = "LIVE";
      c.deadline = new Date(Date.now() + c.remainingMs);
    } else if (action === "end" && ["LIVE", "PAUSED"].includes(c.status)) {
      c.status = "COMPLETED";
      c.completedAt = new Date();
    } else if (
      action === "cancel" &&
      ["SCHEDULED", "LOBBY", "LIVE", "PAUSED"].includes(c.status)
    ) {
      c.status = "CANCELLED";
    } else
      throw new HttpError(
        409,
        "This action is not valid in the current competition state.",
      );
    c.sequence++;
    await c.save();
    if (c.status === "COMPLETED") await finalizeCompetition(c);
    await Audit.create({
      actorId: String(user._id),
      action: `competition.${action}`,
      targetId: competitionId,
    });
    await broadcast(competitionId);
    return c;
  });
}
export async function cancelTournamentInSession(
  session: any,
  tournamentId: string,
  actorId: string,
) {
  const t = await Tournament.findById(tournamentId).session(session);
  if (!t) throw new HttpError(404, "Tournament not found.");
  const members = await TournamentMember.find({ tournamentId }).session(
    session,
  );
  for (const m of members)
    await refundEntry(
      session,
      m.billing,
      m.userId,
      "TOURNAMENT_REFUND",
      tournamentId,
      "A tournament round was canceled. Full pass coin price restored.",
    );
  await Competition.updateMany(
    {
      _id: { $in: t.roundIds },
      status: { $in: ["LOBBY", "SCHEDULED", "LIVE", "PAUSED"] },
    },
    { $set: { status: "CANCELLED" }, $inc: { sequence: 1 } },
    { session },
  );
  t.status = "CANCELLED";
  await t.save({ session });
  await Audit.create(
    [{ actorId, action: "tournament.cancel", targetId: tournamentId }],
    { session },
  );
}
export async function submitCompetition(
  competitionId: string,
  userId: string,
  answer: { questionId: string; selected: number[]; text?: string },
) {
  return locked(`competition:${competitionId}`, async () => {
    const c = await Competition.findById(competitionId);
    if (!c || c.status !== "LIVE")
      throw new HttpError(409, "This room is not accepting answers.");
    const p = await Participant.findOne({
      competitionId,
      userId,
      disqualified: false,
    });
    if (!p) throw new HttpError(403, "Join the room before answering.");
    const q = c.snapshot[c.index] as Question;
    if (answer.questionId !== q.id)
      throw new HttpError(409, "This question is no longer current.");
    if (Date.now() >= c.deadline.getTime())
      throw new HttpError(410, "The answer deadline has passed.");
    if (await Response.exists({ competitionId, userId, questionId: q.id }))
      throw new HttpError(409, "Your answer has already been recorded.");
    const elapsedMs = Math.max(
      0,
      Date.now() - (c.deadline.getTime() - q.seconds * 1000),
    );
    await Response.create({
      ...answer,
      competitionId,
      userId,
      correct: isCorrect(q, answer),
      elapsedMs,
    });
    await reconcileParticipant(competitionId, userId);
    c.sequence++;
    await c.save();
    await broadcast(competitionId);
    return { submitted: true };
  });
}
export async function reconcileParticipant(
  competitionId: string,
  userId: string,
  room?: any,
) {
  const rows = await Response.find({ competitionId, userId }).lean();
  const correct = rows.filter((r) => r.correct).length;
  const missed =
    room?.status === "COMPLETED"
      ? room.snapshot
          .slice(0, Math.min(room.index + 1, room.snapshot.length))
          .filter((q: Question) => !rows.some((r) => r.questionId === q.id))
          .reduce((n: number, q: Question) => n + q.seconds * 1000, 0)
      : 0;
  await Participant.updateOne(
    { competitionId, userId },
    {
      $set: {
        score: correct * 100,
        correctCount: correct,
        elapsedMs: rows.reduce((n, r) => n + (r.elapsedMs || 0), 0) + missed,
      },
    },
  );
}
export async function finalizeCompetition(c: any) {
  const users = await Participant.find({ competitionId: String(c._id) });
  for (const p of users) await reconcileParticipant(String(c._id), p.userId, c);
  c.resultsFinalized = true;
  await c.save();
}
export async function recoverFinalizations() {
  const rooms = await Competition.find({
    status: "COMPLETED",
    resultsFinalized: { $ne: true },
  }).limit(10);
  for (const room of rooms)
    await locked(`competition:${room._id}`, async () => {
      const c = await Competition.findById(room._id);
      if (!c || c.resultsFinalized) return;
      await finalizeCompetition(c);
      await broadcast(String(c._id));
    });
}
export async function tickCompetitions() {
  const rooms = await Competition.find({
    status: "LIVE",
    deadline: { $lte: new Date() },
  }).select("_id");
  for (const room of rooms)
    await locked(`competition:${room._id}`, async () => {
      const c = await Competition.findById(room._id);
      if (!c || c.status !== "LIVE" || c.deadline.getTime() > Date.now())
        return;
      while (c.status === "LIVE" && c.deadline.getTime() <= Date.now()) {
        const prior = c.deadline;
        c.index++;
        if (c.index >= c.snapshot.length) {
          c.status = "COMPLETED";
          c.completedAt = new Date();
        } else
          c.deadline = new Date(
            prior.getTime() + c.snapshot[c.index].seconds * 1000,
          );
      }
      c.sequence++;
      await c.save();
      if (c.status === "COMPLETED") await finalizeCompetition(c);
      await broadcast(String(c._id));
    });
}
