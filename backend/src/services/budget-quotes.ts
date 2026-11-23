import { Settings } from "../models.js";
import { hash, HttpError } from "../utils.js";
import { exchangeRate, usableReference } from "./exchange-rates.js";
export const budgetLimits = { minAmountMinor: 1000, maxAmountMinor: 50000, stepAmountMinor: 100 };
export async function storePricing() {
  const stored = await Settings.findOne({ key: "coin-store-pricing-v2" }).lean<any>();
  const value = stored?.value || { coinsPerUsd: 20, version: 1 };
  if (!Number.isSafeInteger(value.coinsPerUsd) || value.coinsPerUsd < 1 || value.coinsPerUsd > 10000 || !Number.isSafeInteger(value.version))
    throw new HttpError(503, "Store pricing needs an administrator review.");
  return { coinsPerUsd: value.coinsPerUsd as number, version: value.version as number, ...budgetLimits };
}
export async function quoteBudget(amountMinor: number, currency: string) {
  const policy = await storePricing();
  if (!["USD", "EUR"].includes(currency)) throw new HttpError(400, "Choose USD or EUR.");
  if (!Number.isSafeInteger(amountMinor) || amountMinor < budgetLimits.minAmountMinor || amountMinor > budgetLimits.maxAmountMinor || amountMinor % budgetLimits.stepAmountMinor)
    throw new HttpError(400, "Choose an amount from 10 to 500 in whole currency units.");
  const cached = currency === "USD" ? await Settings.findOne({ key: "eur-usd-reference-v1" }).lean<any>() : null;
  const reference = currency === "EUR" ? await exchangeRate() : usableReference(cached?.value) ? cached.value : null;
  const rate = currency === "EUR" ? reference : null;
  // The scaled rate keeps coin allocation in integer arithmetic. This is retail
  // product pricing, not a currency exchange or a claim about bank settlement FX.
  const rateScale = rate ? Math.round(rate.eurUsd * 1000000) : 1000000;
  const coins = Math.floor(amountMinor * policy.coinsPerUsd * rateScale / 100000000);
  const pricingVersion = hash(JSON.stringify({ policy, currency, eurUsd: rate?.eurUsd, rateDate: rate?.date }));
  return {
    amountMinor, currency, coins, coinsPerUsd: policy.coinsPerUsd, pricingVersion,
    productId: `budget:${currency}:${amountMinor}:${pricingVersion}`,
    sourceVersions: { policyVersion: policy.version, coinsPerUsd: policy.coinsPerUsd, exchangeRate: rate },
    usdEquivalentMinor: Math.round(amountMinor * rateScale / 1000000),
    conversion: reference ? { eurUsd: reference.eurUsd, referenceDate: reference.date, source: reference.source, otherCurrency: currency === "USD" ? "EUR" : "USD", otherAmountMinor: currency === "USD" ? Math.round(amountMinor / reference.eurUsd) : Math.round(amountMinor * reference.eurUsd) } : null,
    ...budgetLimits,
  };
}
