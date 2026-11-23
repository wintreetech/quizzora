import { Attempt } from "../models.js";
export async function publicStandings(
  period: "week" | "month" | "all" = "all",
) {
  const match: any = { status: "completed" };
  if (period !== "all")
    match.completedAt = {
      $gte: new Date(Date.now() - (period === "week" ? 7 : 30) * 86400000),
    };
  return Attempt.aggregate([
    { $match: match },
    { $sort: { score: -1, correctCount: -1, elapsedMs: 1, _id: 1 } },
    {
      $group: {
        _id: { userId: "$userId", quizId: "$quizId" },
        score: { $first: "$score" },
        correctCount: { $first: "$correctCount" },
        accuracy: { $first: "$accuracy" },
        elapsedMs: { $first: "$elapsedMs" },
      },
    },
    {
      $group: {
        _id: "$_id.userId",
        score: { $sum: "$score" },
        correctCount: { $sum: "$correctCount" },
        accuracy: { $avg: "$accuracy" },
        elapsedMs: { $sum: "$elapsedMs" },
        quizzes: { $sum: 1 },
      },
    },
    {
      $set: {
        userObjectId: {
          $convert: {
            input: "$_id",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "userObjectId",
        foreignField: "_id",
        as: "profile",
      },
    },
    { $unwind: "$profile" },
    { $match: { "profile.visibility": "public", "profile.suspended": false } },
    { $sort: { score: -1, correctCount: -1, elapsedMs: 1, _id: 1 } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        displayName: "$profile.displayName",
        username: "$profile.username",
        score: 1,
        accuracy: { $round: ["$accuracy", 0] },
        quizzes: 1,
      },
    },
  ]);
}
