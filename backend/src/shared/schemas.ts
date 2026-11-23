import { z } from "zod";
export const categories = [
  "General Knowledge",
  "Technology",
  "Science",
  "Movies & TV",
  "Music",
  "Sports",
  "Geography",
  "History",
  "Business",
  "Pop Culture",
  "Lifestyle",
  "Mathematics & Logic",
  "Brain Teasers",
] as const;
export const roles = [
  "PLAYER",
  "ORGANIZER",
  "MODERATOR",
  "SUPER_ADMIN",
] as const;
export const registrationSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
  email: z.email().toLowerCase().max(254),
  password: z.string().min(12).max(128),
  adult: z.literal(true),
  organizer: z.boolean().optional(),
});
export const questionSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(["single", "multiple", "boolean", "text", "image"]),
    prompt: z.string().trim().min(5).max(1000),
    options: z.array(z.string().trim().min(1).max(300)).max(8),
    correct: z.array(z.number().int().min(0).max(7)).max(8),
    acceptedText: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    image: z.url().max(1000).optional(),
    explanation: z.string().max(2000),
    seconds: z.number().int().min(10).max(180),
  })
  .superRefine((q, c) => {
    const bad = (message: string) => c.addIssue({ code: "custom", message });
    if (q.type === "text") {
      if (!q.acceptedText?.length)
        bad("Text questions require accepted answers");
    } else {
      if (
        new Set(q.options.map((option) => option.toLocaleLowerCase())).size !==
        q.options.length
      )
        bad("Answer options must be distinct");
      if (
        q.options.length < 2 ||
        q.correct.length < 1 ||
        q.correct.some((i) => i >= q.options.length) ||
        new Set(q.correct).size !== q.correct.length
      )
        bad("Provide valid answer options and keys");
      if (q.type !== "multiple" && q.correct.length !== 1)
        bad("Select exactly one correct answer");
      if (
        q.type === "boolean" &&
        (q.options.length !== 2 ||
          q.options[0] !== "True" ||
          q.options[1] !== "False")
      )
        bad("True/false options must be True and False");
    }
    if (q.type === "image" && !q.image?.startsWith("https://"))
      bad("Image questions require an HTTPS image URL");
  });
export const quizSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(2000),
    category: z.string().trim().min(2).max(50),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    visibility: z.enum(["public", "private"]).default("public"),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    questions: z.array(questionSchema).min(1).max(100),
    cover: z
      .enum([
        "space",
        "cinema",
        "tech",
        "world",
        "music",
        "sport",
        "history",
        "business",
      ])
      .default("space"),
  })
  .superRefine((q, c) => {
    if (new Set(q.questions.map((x) => x.id)).size !== q.questions.length)
      c.addIssue({ code: "custom", message: "Question IDs must be unique" });
  });
export const answerSchema = z.object({
  questionId: z.string().min(1).max(100),
  selected: z.array(z.number().int().min(0).max(7)).max(8).default([]),
  text: z.string().max(200).optional(),
});
export type Question = z.infer<typeof questionSchema>;
export type QuizInput = z.infer<typeof quizSchema>;
export type Role = (typeof roles)[number];
export type PublicQuestion = Omit<
  Question,
  "correct" | "acceptedText" | "explanation"
>;
