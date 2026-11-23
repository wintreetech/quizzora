import { CoinPackage, Quiz, User, Wallet, Settings } from "./models.js";
export async function migrateEconomy() {
  for (const [displayOrder, p] of [
    {
      key: "starter",
      name: "Starter",
      coins: 250,
      description: "A little fuel for your next great round.",
    },
    {
      key: "popular",
      name: "The regular",
      coins: 600,
      description: "For the mind that always wants one more question.",
    },
    {
      key: "pro",
      name: "Deep thinker",
      coins: 1500,
      description: "More room to explore the things you love.",
    },
    {
      key: "ultimate",
      name: "All in on curiosity",
      coins: 3500,
      description: "Make a little knowledge a very good habit.",
    },
  ].entries())
    await CoinPackage.updateOne(
      { key: p.key },
      {
        $setOnInsert: {
          ...p,
          displayOrder,
          bonusCoins: 0,
          amountMinor: null,
          currency: null,
          active: false,
          version: 1,
        },
      },
      { upsert: true },
    );
  // Existing content remains at its existing active price until an administrator
  // explicitly publishes a new version. This migration never rewrites purchases.
  const migration = await Settings.findOne({ key: "coin-economy-v1" });
  if (!migration) {
    const quizzes = await Quiz.find();
    for (const q of quizzes) {
      // Unknown customer prices are reviewed explicitly by the access migration.
      // Never manufacture a free published price for a quiz with no configuration.
      if (!q.pricingDraft) {
        const coinPrice =
          q.seedKey === "cosmic" || q.seedKey === "world"
            ? 0
            : q.difficulty === "Hard"
              ? 75
              : q.difficulty === "Easy"
                ? 25
                : 50;
        q.pricingDraft = {
          accessType: coinPrice ? "PAID_PER_ATTEMPT" : "FREE",
          coinPrice,
          includedAttempts: 1,
          previewQuestions: 0,
          available: true,
          suggested: true,
        };
      }
      await q.save();
    }
    await Settings.updateOne(
      { key: "coin-economy-v1" },
      { $setOnInsert: { value: { version: 1, migratedAt: new Date() } } },
      { upsert: true },
    );
  }
  const users = await User.find().select("_id");
  for (const u of users)
    await Wallet.updateOne(
      { userId: String(u._id) },
      {
        $setOnInsert: {
          balance: 0,
          reversalHold: 0,
          sequence: 0,
          headHash: "GENESIS",
        },
      },
      { upsert: true },
    );
}
