import { CoinPackage } from "../models.js";
import { hash, HttpError } from "../utils.js";
export const coinQuantityLimits = { min: 100, max: 10000, step: 50 };
export async function coinPricing(currency?: string) {
  const packs = await CoinPackage.find({
    active: true,
    amountMinor: { $gt: 0 },
    currency: { $ne: null },
  })
    .sort({ displayOrder: 1 })
    .lean();
  const selected =
    currency ||
    (packs.some((p) => p.currency === "USD") ? "USD" : packs[0]?.currency);
  const anchors = packs
    .filter((p) => p.currency === selected)
    .map((p) => ({
      id: String(p._id),
      coins: p.coins + p.bonusCoins,
      amountMinor: p.amountMinor,
      version: p.version,
    }))
    .sort((a, b) => a.coins - b.coins);
  if (!anchors.length)
    throw new HttpError(503, "Coin pricing is temporarily unavailable.");
  if (
    anchors.some(
      (p, i) =>
        !Number.isSafeInteger(p.coins) ||
        p.coins < 1 ||
        !Number.isSafeInteger(p.amountMinor) ||
        p.amountMinor < 1 ||
        (i > 0 &&
          (p.coins <= anchors[i - 1].coins ||
            p.amountMinor <= anchors[i - 1].amountMinor)),
    )
  )
    throw new HttpError(503, "Coin pricing needs an administrator review.");
  const pricingVersion = hash(
    JSON.stringify({ currency: selected, anchors, ...coinQuantityLimits }),
  );
  return {
    currency: selected as string,
    anchors,
    pricingVersion,
    ...coinQuantityLimits,
  };
}
export async function quoteCoinPurchase(coins: number, currency?: string) {
  const pricing = await coinPricing(currency),
    { min, max, step, anchors } = pricing;
  if (
    !Number.isSafeInteger(coins) ||
    coins < min ||
    coins > max ||
    (coins - min) % step !== 0
  )
    throw new HttpError(400, `Choose ${min}–${max} coins in steps of ${step}.`);
  const divide = (n: number, d: number) =>
    Math.floor((n + Math.floor(d / 2)) / d);
  const upper = anchors.findIndex((a) => a.coins >= coins);
  let amountMinor: number;
  if (upper <= 0) {
    const a = upper === 0 ? anchors[0] : anchors[anchors.length - 1];
    amountMinor = divide(coins * a.amountMinor, a.coins);
  } else {
    const a = anchors[upper - 1],
      b = anchors[upper];
    amountMinor =
      a.amountMinor +
      divide(
        (coins - a.coins) * (b.amountMinor - a.amountMinor),
        b.coins - a.coins,
      );
  }
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 1 ||
    amountMinor > 100000000
  )
    throw new HttpError(400, "That purchase exceeds the supported limit.");
  const baseAmountMinor = divide(
      coins * anchors[0].amountMinor,
      anchors[0].coins,
    ),
    savingsMinor = Math.max(0, baseAmountMinor - amountMinor);
  return {
    coins,
    amountMinor,
    currency: pricing.currency,
    pricingVersion: pricing.pricingVersion,
    productId: `custom:${pricing.currency}:${coins}:${pricing.pricingVersion}`,
    min,
    max,
    step,
    baseAmountMinor,
    savingsMinor,
    savingsPercent: savingsMinor
      ? Math.floor((savingsMinor / baseAmountMinor) * 100)
      : 0,
    sourceVersions: anchors,
  };
}
