import mongoose from "mongoose";
import { Attempt, Quiz, Entitlement, Audit } from "../models.js";
import { atomic, ledger, refundEntry } from "./wallet.js";
import { getQuizPricing, checkConsent } from "./pricing.js";
import { config } from "../config.js";
import { HttpError, locked, isCorrect, publicQuestion } from "../utils.js";
import type { Question } from "../shared/schemas.js";
export const serializeAttempt = (a: any) => ({
  id: String(a._id),
  quizId: a.quizId,
  title: a.title,
  status: a.status,
  index: a.index,
  total: a.snapshot.length,
  deadline: a.deadline,
  serverTime: Date.now(),
  score: a.score,
  correctCount: a.correctCount,
  accuracy: a.accuracy,
  elapsedMs: a.elapsedMs,
  billing: a.billing || { coinPrice: 0, accessType: "FREE", version: 0 },
  question:
    a.status === "active" ? publicQuestion(a.snapshot[a.index]) : undefined,
  review:
    a.status === "completed"
      ? a.snapshot.map((q: Question) => ({
          ...q,
          submitted: a.answers.find((v: any) => v.questionId === q.id) || null,
        }))
      : undefined,
});
async function finish(a: any) {
  a.status = "completed";
  a.completedAt = new Date();
  a.elapsedMs = Date.now() - a.startedAt.getTime();
  a.correctCount = a.answers.filter((x: any) => x.correct).length;
  a.score = a.correctCount * 100;
  a.accuracy = Math.round((a.correctCount / a.snapshot.length) * 100);
  await a.save();
  return a;
}
async function synchronize(a: any) {
  let changed = false;
  while (a.status === "active" && a.deadline.getTime() <= Date.now()) {
    const priorDeadline = a.deadline;
    a.index++;
    changed = true;
    if (a.index >= a.snapshot.length) return finish(a);
    a.questionStartedAt = priorDeadline;
    a.deadline = new Date(
      priorDeadline.getTime() + a.snapshot[a.index].seconds * 1000,
    );
  }
  if (changed) await a.save();
  return a;
}
export async function startAttempt(
  userId: string,
  quizId: string,
  consent?: any,
) {
  return locked(`start:${userId}:${quizId}`, async () => {
    if (consent?.requestKey) {
      const prior = await Attempt.findOne({
        userId,
        requestKey: consent.requestKey,
      });
      if (prior) {
        if (prior.quizId !== quizId)
          throw new HttpError(
            409,
            "This participation key belongs to another quiz.",
          );
        return prior;
      }
    }
    const existing = await Attempt.findOne({
      userId,
      quizId,
      status: "active",
    });
    if (existing) return existing;
    const attemptId = new mongoose.Types.ObjectId();
    return atomic(async (session) => {
      const q = await Quiz.findById(quizId).session(session);
      if (
        !q ||
        q.status !== "published" ||
        (q.visibility !== "public" && q.ownerId !== userId)
      )
        throw new HttpError(404, "This quiz is not available.");
      const pricing = getQuizPricing(q);
      const entitlement = await Entitlement.findOne({
        userId,
        quizId,
        remainingAttempts: { $gt: 0 },
      })
        .sort({ createdAt: 1 })
        .session(session);
      if (!pricing.available && !entitlement)
        throw new HttpError(
          409,
          "This quiz is not currently accepting new attempts.",
        );
      let billing: any = {
        ...pricing,
        coinPrice: entitlement ? 0 : pricing.coinPrice,
      };
      if (pricing.coinPrice > 0 && !entitlement) {
        if (!config.coins || !config.paidQuizzes)
          throw new HttpError(
            503,
            "Premium entries are not available right now.",
          );
        checkConsent(pricing, consent);
        const transaction = await ledger(session, {
          userId,
          amount: -pricing.coinPrice,
          type: "QUIZ_ENTRY",
          reference: `quiz:${userId}:${consent.requestKey}`,
          targetId: String(attemptId),
          reason: `${q.title} · ${pricing.includedAttempts} attempt${pricing.includedAttempts === 1 ? "" : "s"}`,
        });
        billing = {
          ...pricing,
          transactionId: String(transaction._id),
          paidAt: new Date(),
        };
        if (pricing.includedAttempts > 1)
          await Entitlement.create(
            [
              {
                userId,
                quizId,
                purchaseAttemptId: String(attemptId),
                remainingAttempts: pricing.includedAttempts - 1,
                pricing,
                transactionId: String(transaction._id),
              },
            ],
            { session },
          );
      }
      if (entitlement) {
        entitlement.remainingAttempts--;
        await entitlement.save({ session });
        billing = {
          ...entitlement.pricing,
          coinPrice: 0,
          coveredBy: entitlement.transactionId,
        };
      }
      const [attempt] = await Attempt.create(
        [
          {
            _id: attemptId,
            userId,
            quizId,
            title: q.title,
            category: q.category,
            version: q.version,
            snapshot: q.questions,
            answers: [],
            startedAt: new Date(),
            questionStartedAt: new Date(),
            deadline: new Date(Date.now() + q.questions[0].seconds * 1000),
            billing,
            requestKey: consent?.requestKey,
            entitlementId: entitlement ? String(entitlement._id) : undefined,
          },
        ],
        { session },
      );
      return attempt;
    });
  });
}
export async function quizAccess(userId: string | undefined, quiz: any) {
  const pricing = getQuizPricing(quiz);
  const attempt = userId
    ? await Attempt.findOne({
        userId,
        quizId: String(quiz._id),
        status: "active",
      }).select("_id billing")
    : null;
  const entitlement = userId
    ? await Entitlement.findOne({
        userId,
        quizId: String(quiz._id),
        remainingAttempts: { $gt: 0 },
      }).sort({ createdAt: 1 })
    : null;
  return {
    pricing,
    charge: attempt || entitlement ? 0 : pricing.coinPrice,
    remainingIncludedAttempts: entitlement?.remainingAttempts || 0,
    resumeAttemptId: attempt ? String(attempt._id) : null,
    available: !!attempt || !!entitlement || pricing.available,
    paidQuizzesEnabled: config.paidQuizzes,
  };
}
export async function refundFailedAttempt(
  actorId: string,
  attemptId: string,
  reason: string,
) {
  return locked(`attempt:${attemptId}`, () =>
    atomic(async (session) => {
      const a = await Attempt.findById(attemptId).session(session);
      if (!a) throw new HttpError(404, "Attempt not found.");
      if (a.answers.length || a.launchAcknowledgedAt || a.voluntarilyFinished)
        throw new HttpError(
          409,
          "Only a verified launch failure with no submitted answers is eligible. Played, completed or voluntarily finished attempts are not refundable.",
        );
      const entry = await refundEntry(
        session,
        a.billing,
        a.userId,
        "QUIZ_ENTRY_REFUND",
        attemptId,
        reason,
      );
      if (!entry)
        throw new HttpError(409, "This attempt has no paid entry to refund.");
      const entitlement = await Entitlement.findOne({
        purchaseAttemptId: attemptId,
      }).session(session);
      if (
        entitlement &&
        entitlement.remainingAttempts !== a.billing.includedAttempts - 1
      )
        throw new HttpError(
          409,
          "Included attempts have already been used; a full launch refund is unavailable.",
        );
      if (entitlement) {
        entitlement.remainingAttempts = 0;
        await entitlement.save({ session });
      }
      a.status = "platform_failure";
      await a.save({ session });
      await Audit.create(
        [
          {
            actorId,
            action: "attempt.launch_refund",
            targetId: attemptId,
            details: { reason, transactionId: String(entry._id) },
          },
        ],
        { session },
      );
      return entry;
    }),
  );
}
async function loadOwned(userId: string, attemptId: string) {
  const a = await Attempt.findOne({ _id: attemptId, userId });
  if (!a) throw new HttpError(404, "Attempt not found.");
  return a;
}
export async function ownedAttempt(userId: string, attemptId: string) {
  return locked(`attempt:${attemptId}`, async () =>
    synchronize(await loadOwned(userId, attemptId)),
  );
}
export async function advanceAttempt(
  userId: string,
  attemptId: string,
  answer?: { questionId: string; selected: number[]; text?: string },
) {
  return locked(`attempt:${attemptId}`, async () => {
    const a = await loadOwned(userId, attemptId);
    if (!answer) return synchronize(a);
    if (a.status !== "active")
      throw new HttpError(409, "This attempt has already finished.");
    if (Date.now() >= a.deadline.getTime()) {
      await synchronize(a);
      throw new HttpError(410, "The answer deadline has passed.");
    }
    const q = a.snapshot[a.index] as Question;
    const now = Date.now();
    if (answer.questionId !== q.id)
      throw new HttpError(
        409,
        "This question has already been submitted or is not current.",
      );
    a.answers.push({
      ...answer,
      correct: isCorrect(q, answer),
      answeredAt: new Date(),
      elapsedMs: now - a.questionStartedAt.getTime(),
    });
    a.index++;
    if (a.index >= a.snapshot.length) return finish(a);
    a.questionStartedAt = new Date();
    a.deadline = new Date(Date.now() + a.snapshot[a.index].seconds * 1000);
    await a.save();
    return a;
  });
}
export async function finishAttempt(userId: string, attemptId: string) {
  return locked(`attempt:${attemptId}`, async () => {
    const a = await loadOwned(userId, attemptId);
    if (a.status !== "active") return a;
    a.voluntarilyFinished = true;
    return finish(a);
  });
}
export async function acknowledgeAttempt(userId: string, attemptId: string) {
  await Attempt.updateOne(
    {
      _id: attemptId,
      userId,
      status: "active",
      launchAcknowledgedAt: { $exists: false },
    },
    { $set: { launchAcknowledgedAt: new Date() } },
  );
}
export async function tickAttempts() {
  const rows = await Attempt.find({
    status: "active",
    deadline: { $lte: new Date() },
  })
    .select("_id userId")
    .limit(100);
  for (const a of rows) await ownedAttempt(a.userId, String(a._id));
}
