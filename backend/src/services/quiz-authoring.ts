import { Quiz, Plan, Audit, PricingHistory } from "../models.js";
import { quizSchema } from "../shared/schemas.js";
import { freePricing, getQuizPricing, pricingSchema } from "./pricing.js";
import { validateQuizCategory } from "./categories.js";
import { atomic } from "./wallet.js";
import { HttpError, locked } from "../utils.js";
function requestedPricing(user: any, input: any) {
  if (input.pricing === undefined) return undefined;
  if (user.role !== "SUPER_ADMIN")
    throw new HttpError(403, "Quiz pricing is managed by an administrator.");
  const price = pricingSchema.parse(input.pricing);
  if (
    !["FREE", "PAID_PER_ATTEMPT", "FREE_PREVIEW_THEN_PAID"].includes(
      price.accessType,
    )
  )
    throw new HttpError(400, "Choose a valid quiz access mode.");
  return price;
}
export async function writeQuiz(user: any, input: any, quizId?: string) {
  const data = quizSchema.parse(input),
    requested = requestedPricing(user, input),
    userId = String(user._id);
  await validateQuizCategory(data.category);
  return locked(`quiz-limit:${userId}`, () =>
    atomic(async (session) => {
      let quiz = quizId ? await Quiz.findById(quizId).session(session) : null;
      if (
        quizId &&
        (!quiz || (quiz.ownerId !== userId && user.role !== "SUPER_ADMIN"))
      )
        throw new HttpError(404, "Quiz not found.");
      if (!quiz) {
        const plan = await Plan.findOne({ key: "organizer" }).session(session);
        if (
          user.role !== "SUPER_ADMIN" &&
          (await Quiz.countDocuments({
            ownerId: userId,
            status: { $ne: "archived" },
          }).session(session)) >= (plan?.quizLimit ?? 10)
        )
          throw new HttpError(
            403,
            "Your free organizer quiz limit has been reached.",
          );
        quiz = new Quiz({
          ...data,
          ownerId: userId,
          slug: `quiz-${crypto.randomUUID()}`,
          version: 1,
          pricing: {
            ...(requested || freePricing),
            version: 1,
            publishedBy: userId,
            publishedAt: new Date(),
          },
        });
      } else {
        Object.assign(quiz, data);
        quiz.version++;
        if (requested) {
          const current = pricingSchema.safeParse(quiz.pricing);
          if (
            !getQuizPricing(quiz).configured ||
            !current.success ||
            JSON.stringify(current.data) !== JSON.stringify(requested)
          ) {
            quiz.pricing = {
              ...requested,
              version:
                (Number.isSafeInteger(quiz.pricing?.version) &&
                quiz.pricing.version >= 0
                  ? quiz.pricing.version
                  : 0) + 1,
              publishedBy: userId,
              publishedAt: new Date(),
            };
            quiz.pricingDraft = null;
          }
        }
      }
      if (quiz.status === "published" && !getQuizPricing(quiz).configured)
        throw new HttpError(
          400,
          "Set valid Free or Paid quiz pricing before publishing.",
        );
      await quiz.save({ session });
      if (quiz.pricing?.publishedBy === userId)
        await PricingHistory.updateOne(
          {
            targetType: "quiz",
            targetId: String(quiz._id),
            version: quiz.pricing.version,
          },
          { $setOnInsert: { pricing: quiz.pricing, actorId: userId } },
          { upsert: true, session },
        );
      await Audit.create(
        [
          {
            actorId: userId,
            action: quizId ? "quiz.update" : "quiz.create",
            targetId: String(quiz._id),
            details: {
              version: quiz.version,
              status: quiz.status,
              pricing: quiz.pricing,
            },
          },
        ],
        { session },
      );
      return quiz;
    }),
  );
}
