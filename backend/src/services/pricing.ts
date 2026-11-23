import { z } from "zod";
import {
  Quiz,
  Competition,
  Tournament,
  PricingHistory,
  Audit,
} from "../models.js";
import { HttpError } from "../utils.js";
import { atomic } from "./wallet.js";
export const pricingSchema = z
  .object({
    accessType: z.enum([
      "FREE",
      "FREE_PREVIEW_THEN_PAID",
      "PAID_PER_ATTEMPT",
      "COMPETITION_ENTRY",
      "TOURNAMENT_PASS",
    ]),
    coinPrice: z.number().int().min(0).max(100000),
    includedAttempts: z.number().int().min(1).max(10).default(1),
    previewQuestions: z.number().int().min(0).max(2).default(0),
    available: z.boolean().default(true),
  })
  .superRefine((p, c) => {
    if (
      (p.accessType === "FREE" && p.coinPrice !== 0) ||
      (p.accessType !== "FREE" && p.coinPrice < 1)
    )
      c.addIssue({
        code: "custom",
        message:
          "Free access costs zero; paid access requires a positive coin price.",
      });
    if (p.accessType !== "FREE_PREVIEW_THEN_PAID" && p.previewQuestions)
      c.addIssue({
        code: "custom",
        message:
          "Sample previews are available only for preview-then-paid quizzes.",
      });
  });
export const freePricing = {
  accessType: "FREE",
  coinPrice: 0,
  includedAttempts: 1,
  previewQuestions: 0,
  available: true,
  version: 0,
};
export const getPricing = (doc: any) => ({
  ...freePricing,
  ...(doc.pricing || {}),
});
// Quiz access must be explicit. The event fallback above remains compatible with
// historical free rooms; it must never infer the price of a published quiz.
export function getQuizPricing(doc: any) {
  const raw = doc?.pricing;
  const parsed = pricingSchema.safeParse(raw);
  const configured =
    parsed.success &&
    raw &&
    ["FREE", "FREE_PREVIEW_THEN_PAID", "PAID_PER_ATTEMPT"].includes(
      raw.accessType,
    ) &&
    Number.isSafeInteger(raw.version) &&
    raw.version >= 0 &&
    Number.isSafeInteger(raw.includedAttempts) &&
    Number.isSafeInteger(raw.previewQuestions) &&
    typeof raw.available === "boolean";
  if (!configured)
    return {
      ...freePricing,
      accessType: "UNCONFIGURED",
      configured: false,
      available: false,
      issue: "Entry pricing needs administrator review.",
    };
  return { ...raw, ...parsed.data, version: raw.version, configured: true };
}
export function defaultQuizPricing(source: {
  seedKey?: string;
  difficulty?: string;
}) {
  const free =
    ["cosmic", "world"].includes(source.seedKey || "") ||
    (source.difficulty === "Easy" && source.seedKey?.startsWith("library-v1-"));
  return {
    ...freePricing,
    accessType: free ? "FREE" : "PAID_PER_ATTEMPT",
    coinPrice: free
      ? 0
      : source.difficulty === "Hard"
        ? 75
        : source.difficulty === "Easy"
          ? 25
          : source.seedKey?.startsWith("library-v1-")
            ? 25
            : 50,
    version: 1,
    publishedBy: "platform-seed:v2",
  };
}
export const modelFor = (kind: string) =>
  kind === "quiz"
    ? Quiz
    : kind === "competition"
      ? Competition
      : kind === "tournament"
        ? Tournament
        : null;
export async function savePricing(
  kind: string,
  targetId: string,
  actorId: string,
  data: unknown,
  publish: boolean,
) {
  const Model = modelFor(kind);
  if (!Model) throw new HttpError(404, "Pricing target not found.");
  const p = pricingSchema.parse(data);
  if (
    kind === "quiz" &&
    !["FREE", "FREE_PREVIEW_THEN_PAID", "PAID_PER_ATTEMPT"].includes(
      p.accessType,
    )
  )
    throw new HttpError(400, "Choose a quiz access mode.");
  if (
    kind !== "quiz" &&
    p.accessType !== "FREE" &&
    p.accessType !==
      (kind === "competition" ? "COMPETITION_ENTRY" : "TOURNAMENT_PASS")
  )
    throw new HttpError(400, "Invalid event access mode.");
  return atomic(async (session) => {
    const doc = await Model.findById(targetId).session(session);
    if (!doc) throw new HttpError(404, "Content not found.");
    if (doc.tournamentId)
      throw new HttpError(
        409,
        "Tournament rounds inherit the tournament pass; separate entry prices are not allowed.",
      );
    if (publish) {
      const version =
        (Number.isSafeInteger(doc.pricing?.version) && doc.pricing.version >= 0
          ? doc.pricing.version
          : 0) + 1;
      doc.pricing = {
        ...p,
        version,
        publishedAt: new Date(),
        publishedBy: actorId,
      };
      doc.pricingDraft = null;
      await PricingHistory.create(
        [
          {
            targetType: kind,
            targetId,
            version,
            pricing: doc.pricing,
            actorId,
          },
        ],
        { session },
      );
    } else
      doc.pricingDraft = { ...p, updatedBy: actorId, updatedAt: new Date() };
    await doc.save({ session });
    await Audit.create(
      [
        {
          actorId,
          action: publish ? "pricing.publish" : "pricing.draft",
          targetId,
          details: { kind, pricing: publish ? doc.pricing : doc.pricingDraft },
        },
      ],
      { session },
    );
    return {
      pricing: kind === "quiz" ? getQuizPricing(doc) : getPricing(doc),
      draft: doc.pricingDraft,
    };
  });
}
export function checkConsent(pricing: any, consent: any) {
  if (
    !consent?.confirmed ||
    consent.pricingVersion !== pricing.version ||
    consent.coinPrice !== pricing.coinPrice
  )
    throw new HttpError(
      409,
      "Review and confirm the current coin price before participating.",
    );
  if (
    typeof consent.requestKey !== "string" ||
    !/^[a-zA-Z0-9_-]{16,100}$/.test(consent.requestKey)
  )
    throw new HttpError(400, "A stable participation request key is required.");
}
