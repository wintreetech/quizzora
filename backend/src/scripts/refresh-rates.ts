import { connectDatabase, closeDatabase } from "../database.js";
import { exchangeRate } from "../services/exchange-rates.js";
import { Settings } from "../models.js";
await connectDatabase();
try {
  // Invalidate the fetch age only; a recent valid reference remains a safe
  // fallback if the official source is temporarily unavailable.
  await Settings.updateOne({ key: "eur-usd-reference-v1" }, { $set: { "value.fetchedAt": "1970-01-01T00:00:00.000Z" } });
  const rate = await exchangeRate();
  console.info(JSON.stringify({ source: rate.source, referenceDate: rate.date, eurUsd: rate.eurUsd }));
} finally { await closeDatabase(); }
