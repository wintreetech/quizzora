import { z } from "zod";
import { Quiz, Attempt } from "../models.js";
import { Types } from "mongoose";

const integer = (path: string, minimum: number, maximum: number) => ({
  $let: {
    vars: {
      n: { $convert: { input: path, to: "double", onError: -1, onNull: -1 } },
    },
    in: {
      $and: [
        { $isNumber: path },
        { $gte: ["$$n", minimum] },
        { $lte: ["$$n", maximum] },
        { $eq: ["$$n", { $trunc: "$$n" }] },
      ],
    },
  },
});
export const validQuizPricingExpression = {
  $and: [
    {
      $in: [
        "$pricing.accessType",
        ["FREE", "FREE_PREVIEW_THEN_PAID", "PAID_PER_ATTEMPT"],
      ],
    },
    integer("$pricing.coinPrice", 0, 100000),
    integer("$pricing.version", 0, Number.MAX_SAFE_INTEGER),
    integer("$pricing.includedAttempts", 1, 10),
    integer("$pricing.previewQuestions", 0, 2),
    { $eq: [{ $type: "$pricing.available" }, "bool"] },
    {
      $or: [
        {
          $and: [
            { $eq: ["$pricing.accessType", "FREE"] },
            { $eq: ["$pricing.coinPrice", 0] },
          ],
        },
        {
          $and: [
            {
              $in: [
                "$pricing.accessType",
                ["FREE_PREVIEW_THEN_PAID", "PAID_PER_ATTEMPT"],
              ],
            },
            { $gt: ["$pricing.coinPrice", 0] },
          ],
        },
      ],
    },
    {
      $or: [
        { $eq: ["$pricing.accessType", "FREE_PREVIEW_THEN_PAID"] },
        { $eq: ["$pricing.previewQuestions", 0] },
      ],
    },
  ],
};
export const catalogueQuery = z.object({
  q: z.string().trim().max(100).default(""),
  category: z.string().max(50).optional(),
  ids: z.string().max(5000).optional(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
  access: z.enum(["all", "free", "paid", "premium"]).default("all"),
  sort: z
    .enum(["featured", "newest", "quickest", "popular"])
    .default("featured"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(24).default(8),
});
export async function discoverQuizzes(input: unknown, userId?: string) {
  const query = catalogueQuery.parse(input);
  const filter: any = { status: "published", visibility: "public" };
  if (query.ids !== undefined)
    filter._id = {
      $in: z
        .array(z.string().regex(/^[a-fA-F0-9]{24}$/))
        .max(200)
        .parse(query.ids ? query.ids.split(",") : [])
        .map((value) => new Types.ObjectId(value)),
    };
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }
  if (query.category) filter.category = query.category;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.access !== "all")
    filter.$expr = {
      $and: [
        validQuizPricingExpression,
        query.access === "free"
          ? { $eq: ["$pricing.accessType", "FREE"] }
          : { $gt: ["$pricing.coinPrice", 0] },
      ],
    };
  const sort: any =
    query.sort === "newest"
      ? { createdAt: -1, _id: -1 }
      : query.sort === "quickest"
        ? { totalSeconds: 1, _id: 1 }
        : query.sort === "popular"
          ? { players: -1, _id: 1 }
          : { _id: 1 };
  const pipeline: any[] = [
    { $match: filter },
    { $set: { totalSeconds: { $sum: "$questions.seconds" } } },
  ];
  if (query.sort === "popular")
    pipeline.push(
      {
        $lookup: {
          from: "attempts",
          let: { quizId: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                status: "completed",
                $expr: { $eq: ["$quizId", "$$quizId"] },
              },
            },
            { $group: { _id: "$userId" } },
            { $count: "players" },
          ],
          as: "popularity",
        },
      },
      {
        $set: {
          players: {
            $ifNull: [{ $arrayElemAt: ["$popularity.players", 0] }, 0],
          },
        },
      },
    );
  const [result] = await Quiz.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [
          { $sort: sort },
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
        ],
        count: [{ $count: "total" }],
      },
    },
  ]);
  const total = result.count[0]?.total || 0;
  const ids = result.items.map((row: any) => String(row._id));
  const progress =
    userId && ids.length
      ? await Attempt.aggregate([
          {
            $match: {
              userId,
              quizId: { $in: ids },
              status: { $in: ["active", "completed"] },
            },
          },
          { $sort: { updatedAt: -1, _id: -1 } },
          {
            $group: {
              _id: "$quizId",
              attemptId: { $first: { $toString: "$_id" } },
              status: { $first: "$status" },
              answered: { $first: "$index" },
              total: { $first: { $size: "$snapshot" } },
              accuracy: { $first: "$accuracy" },
            },
          },
        ])
      : [];
  const eligible = await Quiz.find({
    status: "published",
    visibility: "public",
  })
    .select("_id category")
    .lean();
  const popularityAvailable = !!(await Attempt.exists({
    quizId: { $in: eligible.map((row) => String(row._id)) },
    status: "completed",
  }));
  return {
    rows: result.items.map((row: any) => ({
      ...row,
      progress: progress.find((entry) => entry._id === String(row._id)) || null,
    })),
    total,
    page: query.page,
    pages: Math.ceil(total / query.limit),
    limit: query.limit,
    categories: [...new Set(eligible.map((row) => row.category))].sort(),
    popularityAvailable,
    query,
  };
}
