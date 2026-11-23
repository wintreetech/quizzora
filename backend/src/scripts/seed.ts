import { connectDatabase, closeDatabase } from "../database.js";
import { seed } from "../seed.js";
await connectDatabase();
await seed();
console.info("Idempotent seed complete.");
await closeDatabase();
