import mongoose from "mongoose";
import { connectDatabase, closeDatabase } from "../database.js";
import { seed } from "../seed.js";
import { migrateEconomy } from "../economy-migration.js";
import { launchCommercialProducts } from "../commerce-launch.js";
if (process.env.COMMERCE_LAUNCH_APPROVED !== "true")
  throw new Error(
    "Set COMMERCE_LAUNCH_APPROVED=true only after the owner approves initial pricing.",
  );
await connectDatabase();
try {
  for (const m of Object.values(mongoose.models)) await m.init();
  await seed();
  await migrateEconomy();
  console.info(JSON.stringify(await launchCommercialProducts(true)));
} finally {
  await closeDatabase();
}
