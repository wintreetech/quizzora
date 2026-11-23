import { Settings } from "../models.js";
import { HttpError } from "../utils.js";
export const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
export type ExchangeRate = { eurUsd: number; date: string; fetchedAt: string; source: "ECB" };
const maximumAge = 7 * 86400000;
export function usableReference(rate: any, now = Date.now()): rate is ExchangeRate {
  const timestamp = typeof rate?.date === "string" ? Date.parse(`${rate.date}T00:00:00Z`) : NaN;
  return rate?.source === "ECB" && Number.isFinite(rate.eurUsd) && rate.eurUsd >= .1 && rate.eurUsd <= 10 && /^\d{4}-\d{2}-\d{2}$/.test(rate.date) && Number.isFinite(timestamp) && timestamp <= now + 86400000 && now - timestamp <= maximumAge && new Date(timestamp).toISOString().slice(0, 10) === rate.date;
}
export function parseEcbRate(xml: string, now = Date.now()): ExchangeRate {
  const date = /\btime=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  const usd = /\bcurrency=['"]USD['"]\s+rate=['"](\d+(?:\.\d+)?)['"]/.exec(xml)?.[1];
  const eurUsd = Number(usd);
  if (!usableReference({ eurUsd, date, source: "ECB" }, now))
    throw new HttpError(503, "The currency reference is unavailable. Please use USD or retry later.");
  return { eurUsd, date: date!, fetchedAt: new Date(now).toISOString(), source: "ECB" };
}
let pending: Promise<ExchangeRate> | undefined;
let retryAfter = 0;
export async function exchangeRate(): Promise<ExchangeRate> {
  const stored = await Settings.findOne({ key: "eur-usd-reference-v1" }).lean<any>();
  const saved = stored?.value as ExchangeRate | undefined;
  const fresh = usableReference(saved) && Date.now() - Date.parse(saved.fetchedAt) >= 0 && Date.now() - Date.parse(saved.fetchedAt) < 6 * 3600000;
  if (fresh) return saved;
  if (Date.now() < retryAfter) {
    if (usableReference(saved)) return saved;
    throw new HttpError(503, "EUR conversion is temporarily unavailable. Please use USD or retry later.");
  }
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetch(ECB_URL, { signal: AbortSignal.timeout(5000), redirect: "error" });
      if (!response.ok) throw new Error("Currency source unavailable");
      const xml = await response.text();
      if (xml.length > 200000) throw new Error("Invalid currency reference");
      const rate = parseEcbRate(xml);
      await Settings.updateOne({ key: "eur-usd-reference-v1" }, { $set: { value: rate } }, { upsert: true });
      return rate;
    } catch {
      retryAfter = Date.now() + 60000;
      if (usableReference(saved))
        return saved;
      throw new HttpError(503, "EUR conversion is temporarily unavailable. Please use USD or retry later.");
    } finally { pending = undefined; }
  })();
  return pending;
}
