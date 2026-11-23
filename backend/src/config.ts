import "dotenv/config";
import { resolve } from "node:path";
import { config as dotenv } from "dotenv";
dotenv({ path: resolve(process.cwd(), ".env"), quiet: true });
export const config = {
  production: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 4000),
  origin: (process.env.APP_ORIGIN || "http://localhost:5173").trim().replace(/\/+$/, ""),
  database: process.env.DATABASE_URL,
  sameSite: (process.env.COOKIE_SAME_SITE || "lax") as
    "lax" | "none" | "strict",
  registration: process.env.PUBLIC_REGISTRATION_ENABLED !== "false",
  organizers: process.env.ORGANIZER_REGISTRATION_ENABLED !== "false",
  verify: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
  coins: process.env.COIN_SYSTEM_ENABLED !== "false",
  paidQuizzes: process.env.PAID_QUIZZES_ENABLED !== "false",
  paidCompetitions:
    process.env.PAID_COMPETITIONS_ENABLED === "true" &&
    process.env.PAID_EVENTS_MERCHANT_APPROVED === "true",
  payments: process.env.PAYMENTS_ENABLED === "true",
  apiUrl: (process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:4000").trim().replace(
    /\/+$/,
    "",
  ),
};
if (
  config.production &&
  (!config.database || !config.origin.startsWith("https://"))
)
  throw new Error("Production requires DATABASE_URL and an HTTPS APP_ORIGIN");
if (
  !["lax", "none", "strict"].includes(config.sameSite) ||
  (config.sameSite === "none" && !config.production)
)
  throw new Error("Invalid COOKIE_SAME_SITE; none requires production HTTPS");
if (process.env.BILLING_ENABLED === "true")
  throw new Error(
    "Recurring subscriptions are not implemented. Use PAYMENTS_ENABLED for one-time TransactWorld coin purchases; keep BILLING_ENABLED=false.",
  );
