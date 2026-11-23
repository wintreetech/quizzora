import mongoose from "mongoose";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { config } from "./config.js";
let embedded: MongoMemoryServer | undefined;
async function initializeDevelopmentReplica(uri: string) {
  // A persisted replica member must keep its advertised address across restarts.
  // Also repair earlier development databases whose member used a random port.
  const memberHost = new URL(uri).host;
  let lastError: unknown;
  for (let retry = 0; retry < 60; retry++) {
    const client = new mongoose.mongo.MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 1500 });
    try {
      await client.connect();
      const admin = client.db("admin"), local = client.db("local");
      const existing = await local.collection<any>("system.replset").findOne({});
      if (!existing) await admin.command({ replSetInitiate: { _id: "quizora-rs", members: [{ _id: 0, host: memberHost }] } });
      else if (existing._id !== "quizora-rs" || existing.members.length !== 1) throw new Error("The embedded database must be a single-member quizora-rs development replica. Use DATABASE_URL for an external cluster.");
      else if (existing.members[0].host !== memberHost) await admin.command({ replSetReconfig: { ...existing, version: existing.version + 1, members: [{ ...existing.members[0], host: memberHost }] }, force: true });
      if ((await admin.command({ hello: 1 })).isWritablePrimary) return;
    } catch (error) { lastError = error; }
    finally { await client.close(); }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Could not initialize the persisted development replica.", { cause: lastError });
}
export async function connectDatabase() {
  let uri = config.database;
  if (!uri) {
    if (config.production) throw new Error("DATABASE_URL is required");
    const dbPath = resolve(process.cwd(), ".data/mongo");
    await mkdir(dbPath, { recursive: true });
    embedded = await MongoMemoryServer.create({
      instance: { dbPath, replSet: "quizora-rs", storageEngine: "wiredTiger", port: Number(process.env.DEV_MONGO_PORT || 57017), portGeneration: false },
      binary: {
        version: "7.0.24",
        downloadDir: resolve(process.cwd(), ".cache/mongodb"),
      },
    });
    uri = embedded.getUri();
    try { await initializeDevelopmentReplica(uri); } catch (error) { await embedded.stop({ doCleanup: false }); throw error; }
    uri += "?replicaSet=quizora-rs";
    console.info("Development MongoDB started. Data persists in .data/mongo.");
  }
  await mongoose.connect(uri, {
    dbName: process.env.DATABASE_NAME || "quizora",
  });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (config.coins && !hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "The coin economy requires a MongoDB replica set (Atlas is supported) for atomic transactions.",
    );
}
export async function closeDatabase() {
  await mongoose.disconnect();
  await embedded?.stop({ doCleanup: false });
}
