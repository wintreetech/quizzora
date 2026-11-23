import { Quiz, PricingHistory, Audit } from "./models.js";
import { seedQuizzes } from "./seed-data.js";
import { libraryQuizzes } from "./library-data.js";
import { defaultQuizPricing, getQuizPricing } from "./services/pricing.js";
import { atomic } from "./services/wallet.js";

// Repeatable, guarded repair: known untouched platform seeds get the approved
// starter mix. Explicit customer/Admin prices and existing paid entries survive.
export async function migrateQuizAccess() {
  const sources = new Map(
    [...seedQuizzes, ...libraryQuizzes].map((source) => [
      source.seedKey,
      source,
    ]),
  );
  const rows = await Quiz.find().select("_id");
  let repaired = 0,
    review = 0;
  for (const row of rows) {
    const result = await atomic(async (session) => {
      const quiz = await Quiz.findById(row._id).session(session);
      if (!quiz) return;
      const source =
        quiz.ownerId === "platform" ? sources.get(quiz.seedKey) : undefined;
      const inferredLegacy =
        quiz.pricing?.version === 0 &&
        quiz.pricing?.coinPrice === 0 &&
        quiz.pricingDraft?.suggested === true &&
        !quiz.pricing?.publishedBy;
      const untouched = !quiz.pricing || inferredLegacy;
      if (
        source &&
        untouched &&
        !(await PricingHistory.exists({
          targetType: "quiz",
          targetId: String(quiz._id),
        }).session(session))
      ) {
        const before = quiz.pricing || null;
        quiz.pricing = {
          ...defaultQuizPricing(source),
          publishedAt: new Date(),
          publishedBy: "migration:quiz-access-v2",
        };
        quiz.pricingDraft = null;
        await quiz.save({ session });
        await PricingHistory.create(
          [
            {
              targetType: "quiz",
              targetId: String(quiz._id),
              version: quiz.pricing.version,
              pricing: quiz.pricing,
              actorId: "migration:quiz-access-v2",
            },
          ],
          { session },
        );
        await Audit.create(
          [
            {
              actorId: "migration:quiz-access-v2",
              action: "quiz.access_backfill",
              targetId: String(quiz._id),
              details: {
                before,
                after: quiz.pricing,
                reason:
                  "Explicit starter-library pricing; preserve published Admin prices.",
              },
            },
          ],
          { session },
        );
        return "repaired";
      } else if (!getQuizPricing(quiz).configured) return "review";
    });
    if (result === "repaired") repaired++;
    if (result === "review") review++;
  }
  return { repaired, review };
}
