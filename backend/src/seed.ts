import { Quiz, Plan, Competition } from "./models.js";
import { seedQuizzes } from "./seed-data.js";
import { libraryQuizzes } from "./library-data.js";
import { quizSchema } from "./shared/schemas.js";
import { defaultQuizPricing } from "./services/pricing.js";
export async function seed() {
  for (const source of [...seedQuizzes, ...libraryQuizzes]) {
    const data = quizSchema.parse({
      ...source,
      visibility: "public",
      status: "published",
    });
    await Quiz.updateOne(
      { seedKey: source.seedKey },
      {
        $setOnInsert: {
          ...data,
          seedKey: source.seedKey,
          ownerId: "platform",
          version: 1,
          slug: source.seedKey,
          pricing: defaultQuizPricing(source),
        },
      },
      { upsert: true },
    );
  }
  for (const p of [
    {
      key: "player",
      name: "Free player",
      quizLimit: 0,
      participantLimit: 0,
      features: [
        "Selected free discovery quizzes",
        "Live competitions",
        "Saved results & rankings",
        "Private friend challenges",
      ],
    },
    {
      key: "organizer",
      name: "Free organizer",
      quizLimit: 10,
      participantLimit: 25,
      features: [
        "10 published quizzes",
        "25 participants per room",
        "Live host controls",
        "CSV results export",
      ],
    },
    {
      key: "pro",
      name: "Pro organizer",
      quizLimit: 100,
      participantLimit: 100,
      features: [
        "Higher hosting limits",
        "Advanced reporting",
        "Private events",
        "Priority support",
      ],
    },
  ])
    await Plan.updateOne(
      { key: p.key },
      { $setOnInsert: { ...p, billingEnabled: false } },
      { upsert: true },
    );
  const quiz = await Quiz.findOne({ seedKey: "cinema" });
  if (quiz)
    await Competition.updateOne(
      { seedKey: "opening-night" },
      {
        $setOnInsert: {
          seedKey: "opening-night",
          title: "The Friday night film club",
          description:
            "A sample event to show what’s possible. Create your own room to host a competition.",
          quizId: String(quiz._id),
          hostId: "platform",
          code: "FILM26",
          visibility: "public",
          status: "SCHEDULED",
          capacity: 25,
          startsAt: new Date(Date.now() + 86400000),
          snapshot: quiz.questions,
          index: 0,
          sequence: 0,
        },
      },
      { upsert: true },
    );
}
