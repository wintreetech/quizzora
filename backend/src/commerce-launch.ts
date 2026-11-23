import { Audit, CoinPackage, Quiz, Settings } from "./models.js";
import { savePricing } from "./services/pricing.js";
export const launchPlans = [
  {
    key: "starter",
    name: "Starter",
    coins: 250,
    amountMinor: 299,
    description: "For a quick challenge and a fresh perspective.",
  },
  {
    key: "popular",
    name: "Explorer",
    coins: 600,
    amountMinor: 599,
    description: "For curious people with more than one favourite subject.",
  },
  {
    key: "pro",
    name: "Challenger",
    coins: 1500,
    amountMinor: 1299,
    description: "For your regular round and the occasional deep dive.",
  },
  {
    key: "ultimate",
    name: "Champion",
    coins: 3500,
    amountMinor: 2499,
    description: "Your biggest coin pack. More room to keep exploring.",
  },
];
// Explicit local-owner operation, separate from the safe legacy migration.
// The owner delegated initial launch pricing in this session. Never run this
// automatically in an existing deployment or overwrite later Admin edits.
export async function launchCommercialProducts(approved: boolean) {
  if (!approved)
    throw new Error("Owner approval is required to publish launch pricing.");
  if (await Settings.exists({ key: "owner-approved-commercial-launch-v1" }))
    return { alreadyApplied: true };
  const actorId = "operator:owner-approved-launch";
  for (const p of launchPlans) {
    await CoinPackage.updateOne(
      { key: p.key, amountMinor: null },
      {
        $set: { ...p, currency: "USD", active: true, bonusCoins: 0 },
        $inc: { version: 1 },
      },
    );
  }
  const quizzes = await Quiz.find({
    ownerId: "platform",
    status: "published",
    seedKey: { $in: ["cosmic", "cinema", "tech", "world", "music", "sports", "history", "business"] },
    "pricing.version": 0,
  });
  for (const q of quizzes) {
    if (q.pricingDraft?.suggested)
      await savePricing("quiz", String(q._id), actorId, q.pricingDraft, true);
  }
  await Audit.create({
    actorId,
    action: "commerce.owner_approved_launch",
    targetId: "initial-products",
    details: {
      currency: "USD",
      plans: launchPlans.map((p) => ({
        key: p.key,
        amountMinor: p.amountMinor,
        coins: p.coins,
      })),
      approval:
        "Owner explicitly delegated initial commercial pricing; later Admin changes remain authoritative.",
    },
  });
  await Settings.updateOne(
    { key: "owner-approved-commercial-launch-v1" },
    {
      $setOnInsert: {
        value: { appliedAt: new Date(), actorId, currency: "USD" },
      },
    },
    { upsert: true },
  );
  return {
    alreadyApplied: false,
    plans: launchPlans.map((p) => ({
      name: p.name,
      coins: p.coins,
      price: `USD ${(p.amountMinor / 100).toFixed(2)}`,
    })),
    quizzesReviewed: quizzes.length,
  };
}
