import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { io as socketClient } from "socket.io-client";
import { createApp } from "./app.js";
import { seed } from "./seed.js";
import { libraryQuizzes } from "./library-data.js";
import { seedQuizzes } from "./seed-data.js";
import { quizSchema, questionSchema } from "./shared/schemas.js";
import * as models from "./models.js";
import {
  Quiz,
  User,
  Attempt,
  Competition,
  Participant,
  Response,
  Session,
  AuthToken,
  Audit,
} from "./models.js";
import { isCorrect, hash, token, hashPassword } from "./utils.js";
import {
  advanceAttempt,
  startAttempt,
  tickAttempts,
} from "./services/attempts.js";
import {
  tickCompetitions,
  recoverFinalizations,
} from "./services/competitions.js";
import { setupRealtime } from "./realtime.js";
let mongo: MongoMemoryReplSet;
const app = createApp();
const player = request.agent(app),
  other = request.agent(app),
  host = request.agent(app),
  admin = request.agent(app);
const post = (agent: any, path: string, body: any = {}) =>
  agent.post(`/api${path}`).set("X-Quizora", "1").send(body);
const put = (agent: any, path: string, body: any) =>
  agent.put(`/api${path}`).set("X-Quizora", "1").send(body);
const patch = (agent: any, path: string, body: any) =>
  agent.patch(`/api${path}`).set("X-Quizora", "1").send(body);
const testPassword = token();
const resetPassword = token();
const account = (name: string, organizer = false) => ({
  displayName: `${name} Curious`,
  username: name,
  email: `${name}@example.test`,
  password: testPassword,
  adult: true,
  organizer,
});
let playerId: string,
  otherId: string,
  hostId: string,
  adminId: string,
  quizId: string,
  ownedId: string;
const questions = [
  {
    id: "first",
    type: "single",
    prompt: "Which number is an even number?",
    options: ["Three", "Four", "Five", "Seven"],
    correct: [1],
    explanation: "Four is divisible by two.",
    seconds: 10,
  },
  {
    id: "second",
    type: "multiple",
    prompt: "Select all the even numbers.",
    options: ["Two", "Three", "Four", "Five"],
    correct: [0, 2],
    explanation: "Two and four are even.",
    seconds: 10,
  },
];
const quizBody = {
  title: "A little test of curiosity",
  description: "A useful set of questions for testing fair play.",
  category: "General Knowledge",
  difficulty: "Easy",
  cover: "space",
  visibility: "public",
  status: "published",
  questions,
};
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: { version: "7.0.24", downloadDir: resolve(".cache/mongodb") },
  });
  await mongoose.connect(mongo.getUri(), { dbName: "isolated_quizora_tests" });
  await Promise.all(Object.values(models).map((m) => m.init()));
  await seed();
  const p = await post(player, "/auth/register", account("player"));
  expect(p.status).toBe(201);
  playerId = p.body.user.id;
  const o = await post(other, "/auth/register", account("other"));
  otherId = o.body.user.id;
  const h = await post(host, "/auth/register", account("host", true));
  hostId = h.body.user.id;
  const a = await post(admin, "/auth/register", account("admin"));
  adminId = a.body.user.id;
  await User.updateOne({ _id: adminId }, { $set: { role: "SUPER_ADMIN" } });
  quizId = String((await Quiz.findOne({ seedKey: "cosmic" }))!._id);
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
describe("Expanded library and catalogue recovery", () => {
  it("provisions review accounts only in an explicitly isolated non-payment database and preserves repeat runs", async () => {
    const provision = (database: string, enabled = "false") => new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", "src/scripts/client-accounts.ts"], {
        cwd: process.cwd(), timeout: 20000,
        env: { ...process.env, NODE_ENV: "test", DATABASE_URL: mongo.getUri(), DATABASE_NAME: database, REVIEW_PASSWORD: testPassword, PAYMENTS_ENABLED: enabled },
      });
      let stdout = "", stderr = "";
      child.stdout.on("data", (data) => { stdout += data; });
      child.stderr.on("data", (data) => { stderr += data; });
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
    expect((await provision("quizora")).status).toBe(1);
    expect((await provision("quizora_review_provision_tests", "true")).status).toBe(1);
    const before = await User.countDocuments();
    const first = await provision("quizora_review_provision_tests");
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).not.toContain(testPassword);
    const isolated = mongoose.connection.getClient().db("quizora_review_provision_tests");
    const users = await isolated.collection("users").find().sort({ email: 1 }).toArray();
    expect(users.map((u) => u.role).sort()).toEqual(["ORGANIZER", "PLAYER", "SUPER_ADMIN"]);
    expect(await isolated.collection("paymentorders").countDocuments()).toBe(0);
    expect(await isolated.collection("wallettransactions").countDocuments()).toBe(0);
    expect(await isolated.collection("quizzes").countDocuments({ seedKey: /^library-v1-/ })).toBe(30);
    expect((await provision("quizora_review_provision_tests")).status).toBe(0);
    expect(await isolated.collection("users").find().sort({ email: 1 }).toArray()).toEqual(users);
    expect(await User.countDocuments()).toBe(before);
  }, 60000);
  it("contains 120 original valid questions across ten categories and three difficulty levels", () => {
    expect(libraryQuizzes).toHaveLength(30);
    expect(new Set(libraryQuizzes.map((q) => q.category)).size).toBe(10);
    expect(libraryQuizzes.flatMap((q) => q.questions)).toHaveLength(120);
    const prompts = [...seedQuizzes, ...libraryQuizzes].flatMap((q) => q.questions.map((question) => question.prompt.trim().toLowerCase()));
    expect(new Set(prompts).size).toBe(prompts.length);
    for (const category of new Set(libraryQuizzes.map((q) => q.category)))
      expect(libraryQuizzes.filter((q) => q.category === category).map((q) => q.difficulty)).toEqual(["Easy", "Medium", "Hard"]);
    for (const quiz of libraryQuizzes) {
      expect(quizSchema.safeParse(quiz).success).toBe(true);
      expect(quiz.questions).toHaveLength(4);
      for (const question of quiz.questions) {
        expect(question.correct).toHaveLength(1);
        expect(question.explanation.length).toBeGreaterThan(20);
        expect(question.options[question.correct[0]]).toBeTruthy();
        expect(new Set(question.options).size).toBe(4);
        expect(isCorrect(question, { selected: question.correct })).toBe(true);
        expect(isCorrect(question, { selected: [(question.correct[0] + 1) % 4] })).toBe(false);
      }
    }
  });
  it("seeds repeatedly without replacing edited library data or creating duplicates", async () => {
    const key = libraryQuizzes[0].seedKey;
    const quiz = await Quiz.findOne({ seedKey: key });
    const before = await Quiz.countDocuments();
    await Quiz.updateOne({ _id: quiz!._id }, { $set: { title: "Client edited title", status: "draft", pricing: { coinPrice: 0, version: 7 } } });
    await seed();
    await seed();
    expect(await Quiz.countDocuments()).toBe(before);
    expect((await request(app).get("/api/competitions")).body.items.some((event: any) => event.sample)).toBe(false);
    const preserved = await Quiz.findById(quiz!._id);
    expect(preserved?.title).toBe("Client edited title");
    expect(preserved?.status).toBe("draft");
    expect(preserved?.pricing.version).toBe(7);
    await Quiz.updateOne({ _id: quiz!._id }, { $set: { title: libraryQuizzes[0].title, status: "published" } });
  });
  it("retrieves saved quizzes beyond the first catalogue page without exposing private or draft records", async () => {
    const target = await Quiz.findOne({ seedKey: libraryQuizzes[29].seedKey });
    const result = await request(app).get(`/api/quizzes?ids=${target!._id}`);
    expect(result.status).toBe(200);
    expect(result.body.total).toBe(1);
    expect(result.body.items[0].title).toBe(target!.title);
    expect(result.body.items[0].questions).toBeUndefined();
    expect((await request(app).get("/api/quizzes?ids=")).body.total).toBe(0);
    expect((await request(app).get("/api/quizzes?ids=invalid")).status).toBe(400);
    await Quiz.updateOne({ _id: target!._id }, { $set: { status: "draft" } });
    expect((await request(app).get(`/api/quizzes?ids=${target!._id}`)).body.total).toBe(0);
    await Quiz.updateOne({ _id: target!._id }, { $set: { status: "published", visibility: "private" } });
    expect((await request(app).get(`/api/quizzes?ids=${target!._id}`)).body.total).toBe(0);
    await Quiz.updateOne({ _id: target!._id }, { $set: { visibility: "public" } });
  });
  it("rejects duplicate answer labels that would make a single-choice question ambiguous", () => {
    expect(questionSchema.safeParse({ ...questions[0], options: ["Four", " four ", "Five", "Seven"] }).success).toBe(false);
  });
  it("lists owned active rounds for resume without leaking answer keys", async () => {
    const result = await post(player, `/quizzes/${quizId}/attempts`);
    expect(result.status).toBe(201);
    const dashboard = await player.get("/api/dashboard");
    const active = dashboard.body.active.find((a: any) => a.id === result.body.id);
    expect(active).toMatchObject({ title: "The universe is calling", total: 5 });
    expect(active.snapshot).toBeUndefined();
    expect((await other.get("/api/dashboard")).body.active).not.toContainEqual(expect.objectContaining({ id: active.id }));
    await post(player, `/attempts/${result.body.id}/finish`);
  });
});

describe("Accounts and server permissions", () => {
  it("requires age eligibility and a strong password", async () => {
    expect(
      (
        await post(request(app), "/auth/register", {
          ...account("underage"),
          adult: false,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(request(app), "/auth/register", {
          ...account("weakpass"),
          password: "short",
        })
      ).status,
    ).toBe(400);
  });
  it("ignores injected administrator privileges and protects password hashes", async () => {
    const r = await post(request(app), "/auth/register", {
      ...account("injection"),
      role: "SUPER_ADMIN",
      emailVerified: true,
    });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe("PLAYER");
    expect(r.body.user.emailVerified).toBe(false);
    expect(r.body.user.passwordHash).toBeUndefined();
    expect(r.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(
      (await User.findById(r.body.user.id).select("+passwordHash"))
        ?.passwordHash,
    ).not.toContain(testPassword);
  });
  it("enforces CSRF request headers and rejects foreign origins", async () => {
    expect((await player.post("/api/auth/logout")).status).toBe(403);
    expect(
      (
        await player
          .post("/api/auth/logout")
          .set("X-Quizora", "1")
          .set("Origin", "https://foreign.example")
      ).status,
    ).toBe(403);
  });
  it("rejects bad logins, rejects duplicate registration, and revokes logout sessions", async () => {
    const agent = request.agent(app);
    expect(
      (
        await post(agent, "/auth/login", {
          email: "player@example.test",
          password: "bad",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post(agent, "/auth/login", {
          email: "player@example.test",
          password: account("player").password,
        })
      ).status,
    ).toBe(200);
    expect((await post(agent, "/auth/logout")).status).toBe(200);
    expect((await agent.get("/api/dashboard")).status).toBe(401);
    expect(
      (await post(request(app), "/auth/register", account("player"))).status,
    ).toBe(409);
  });
  it("protects admin and organizer APIs from players", async () => {
    expect((await player.get("/api/admin/users")).status).toBe(403);
    expect((await post(player, "/organizer/quizzes", quizBody)).status).toBe(
      403,
    );
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
  });
  it("fails safely when email is unconfigured and rejects reset token replay", async () => {
    expect(
      (
        await post(player, "/auth/forgot-password", {
          email: "player@example.test",
        })
      ).status,
    ).toBe(503);
    const raw = token();
    await AuthToken.create({
      tokenHash: hash(raw),
      userId: otherId,
      kind: "reset",
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(
      (
        await post(other, "/auth/reset-password", {
          token: raw,
          password: resetPassword,
        })
      ).status,
    ).toBe(200);
    expect((await other.get("/api/dashboard")).status).toBe(401);
    expect(
      (
        await post(other, "/auth/reset-password", {
          token: raw,
          password: token(),
        })
      ).status,
    ).toBe(400);
    await post(other, "/auth/login", {
      email: "other@example.test",
      password: resetPassword,
    });
  });
});
describe("Quiz authoring and immutable versions", () => {
  it("validates answer sets and duplicate question IDs before publishing", async () => {
    expect(
      (
        await post(host, "/organizer/quizzes", {
          ...quizBody,
          questions: [{ ...questions[0], correct: [7] }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(host, "/organizer/quizzes", {
          ...quizBody,
          questions: [questions[0], questions[0]],
        })
      ).status,
    ).toBe(400);
  });
  it("creates a quiz and prevents cross-owner edits", async () => {
    const result = await post(host, "/organizer/quizzes", quizBody);
    expect(result.status).toBe(201);
    ownedId = result.body.id;
    await User.updateOne({ _id: otherId }, { $set: { role: "ORGANIZER" } });
    expect(
      (await put(other, `/organizer/quizzes/${ownedId}`, quizBody)).status,
    ).toBe(404);
    expect((await other.get(`/api/organizer/quizzes/${ownedId}`)).status).toBe(
      404,
    );
  });
  it("never exposes keys or question snapshots through public discovery", async () => {
    const list = await request(app).get("/api/quizzes");
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(8);
    for (const q of list.body.items) {
      expect(q.questions).toBeUndefined();
      expect(q.correct).toBeUndefined();
    }
    const detail = await request(app).get(`/api/quizzes/${ownedId}`);
    expect(detail.body.questions).toBeUndefined();
  });
  it("hides drafts and private quizzes from discovery and other users", async () => {
    const r = await post(host, "/organizer/quizzes", {
      ...quizBody,
      title: "A private draft",
      visibility: "private",
      status: "draft",
    });
    expect((await player.get(`/api/quizzes/${r.body.id}`)).status).toBe(404);
    expect((await post(player, `/quizzes/${r.body.id}/attempts`)).status).toBe(
      404,
    );
  });
});
describe("Authoritative quiz attempts", () => {
  it("serializes concurrent starts and preserves the original question version", async () => {
    const starts = await Promise.all([
      post(player, `/quizzes/${ownedId}/attempts`),
      post(player, `/quizzes/${ownedId}/attempts`),
    ]);
    expect(starts[0].body.id).toBe(starts[1].body.id);
    expect(starts[0].body.question.correct).toBeUndefined();
    expect(starts[0].body.review).toBeUndefined();
    const a = await Attempt.findById(starts[0].body.id);
    await put(host, `/organizer/quizzes/${ownedId}`, {
      ...quizBody,
      title: "An edited quiz",
      questions: [{ ...questions[0], correct: [2] }, questions[1]],
    });
    expect(a?.snapshot[0].correct).toEqual([1]);
    expect((await Quiz.findById(ownedId))?.version).toBe(2);
  });
  it("enforces attempt ownership, scores on the server, and rejects duplicate answers", async () => {
    const a = await Attempt.findOne({
      userId: playerId,
      quizId: ownedId,
      status: "active",
    });
    expect((await other.get(`/api/attempts/${a!._id}`)).status).toBe(404);
    expect(
      (
        await post(other, `/attempts/${a!._id}/answer`, {
          questionId: "first",
          selected: [1],
        })
      ).status,
    ).toBe(404);
    const first = await post(player, `/attempts/${a!._id}/answer`, {
      questionId: "first",
      selected: [1],
      score: 999999,
    });
    expect(first.status).toBe(200);
    expect(
      (
        await post(player, `/attempts/${a!._id}/answer`, {
          questionId: "first",
          selected: [1],
        })
      ).status,
    ).toBe(409);
    const final = await post(player, `/attempts/${a!._id}/answer`, {
      questionId: "second",
      selected: [0, 2],
      score: 999999,
    });
    expect(final.status).toBe(200);
    expect(final.body.score).toBe(200);
    expect(final.body.accuracy).toBe(100);
    expect(final.body.review[0].correct).toEqual([1]);
    expect(
      (
        await post(player, `/attempts/${a!._id}/answer`, {
          questionId: "second",
          selected: [0, 2],
        })
      ).status,
    ).toBe(409);
  });
  it("rejects late answers and advances expired questions on the server", async () => {
    const a = await startAttempt(playerId, quizId);
    await Attempt.updateOne(
      { _id: a._id },
      { $set: { deadline: new Date(Date.now() - 1000) } },
    );
    expect(
      (
        await post(player, `/attempts/${a._id}/answer`, {
          questionId: a.snapshot[0].id,
          selected: [1],
        })
      ).status,
    ).toBe(410);
    expect((await Attempt.findById(a._id))?.index).toBe(1);
    await Attempt.updateOne(
      { _id: a._id },
      { $set: { deadline: new Date(Date.now() - 1000000) } },
    );
    await tickAttempts();
    const finished = await Attempt.findById(a._id);
    expect(finished?.status).toBe("completed");
    expect(finished?.score).toBe(0);
  });
  it("scores exact multiple selections and normalized text without partial credit", () => {
    expect(isCorrect(questions[1] as any, { selected: [0, 2] })).toBe(true);
    expect(isCorrect(questions[1] as any, { selected: [0] })).toBe(false);
    expect(isCorrect(questions[1] as any, { selected: [0, 2, 2] })).toBe(false);
    expect(
      isCorrect(
        {
          ...questions[0],
          type: "text",
          acceptedText: ["Tim Berners-Lee"],
        } as any,
        { selected: [], text: "  TIM   Berners-Lee  " },
      ),
    ).toBe(true);
  });
  it("counts only one official best result per quiz on public leaderboards", async () => {
    const row = await Attempt.findOne({
      userId: playerId,
      quizId: ownedId,
      status: "completed",
    });
    const clone = row!.toObject();
    delete clone._id;
    delete clone.__v;
    await Attempt.create(clone);
    const board = await request(app).get("/api/leaderboard?period=all");
    expect(
      board.body.items.find((r: any) => r.userId === playerId)?.score,
    ).toBe(200);
    expect(board.body.items.every((r: any) => !("email" in r))).toBe(true);
  });
});
describe("Live rooms and multiplayer integrity", () => {
  let roomId: string, code: string;
  it("creates a room, validates codes, and enforces capacity under concurrency", async () => {
    const c = await post(host, "/organizer/competitions", {
      title: "A fair little competition",
      quizId: ownedId,
      capacity: 2,
      visibility: "public",
    });
    expect(c.status).toBe(201);
    roomId = c.body.id;
    code = c.body.code;
    expect(code).toMatch(/^[A-F0-9]{6}$/);
    expect(
      (await post(player, "/competitions/join", { code: "BAD" })).status,
    ).toBe(400);
    const joins = await Promise.all([
      post(player, "/competitions/join", { code }),
      post(other, "/competitions/join", { code }),
      post(admin, "/competitions/join", { code }),
    ]);
    expect(joins.filter((r) => r.status === 200)).toHaveLength(2);
    expect(joins.filter((r) => r.status === 409)).toHaveLength(1);
    expect(await Participant.countDocuments({ competitionId: roomId })).toBe(2);
  });
  it("rejects unauthorized host actions and invalid state transitions", async () => {
    expect(
      (
        await post(other, `/organizer/competitions/${roomId}/control`, {
          action: "start",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post(host, `/organizer/competitions/${roomId}/control`, {
          action: "resume",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post(host, `/organizer/competitions/${roomId}/control`, {
          action: "start",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(host, `/organizer/competitions/${roomId}/control`, {
          action: "start",
        })
      ).status,
    ).toBe(409);
    expect((await post(admin, "/competitions/join", { code })).status).toBe(
      409,
    );
  });
  it("records each response once and ignores spoofed scores", async () => {
    const member = await Participant.findOne({ competitionId: roomId });
    const agent =
      member?.userId === playerId
        ? player
        : member?.userId === otherId
          ? other
          : admin;
    const answer = { questionId: "first", selected: [2], score: 100000 };
    const results = await Promise.all([
      post(agent, `/competitions/${roomId}/answer`, answer),
      post(agent, `/competitions/${roomId}/answer`, answer),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await Response.countDocuments({
        competitionId: roomId,
        userId: member?.userId,
      }),
    ).toBe(1);
    expect((await Participant.findById(member?._id))?.score).toBe(100);
  });
  it("pauses submissions, resumes, expires rounds, and persists final standings", async () => {
    await post(host, `/organizer/competitions/${roomId}/control`, {
      action: "pause",
    });
    expect(
      (
        await post(player, `/competitions/${roomId}/answer`, {
          questionId: "first",
          selected: [2],
        })
      ).status,
    ).toBe(409);
    await post(host, `/organizer/competitions/${roomId}/control`, {
      action: "resume",
    });
    await Competition.updateOne(
      { _id: roomId },
      { $set: { deadline: new Date(Date.now() - 1) } },
    );
    await tickCompetitions();
    expect((await Competition.findById(roomId))?.index).toBe(1);
    await Competition.updateOne(
      { _id: roomId },
      { $set: { deadline: new Date(Date.now() - 1) } },
    );
    await tickCompetitions();
    const r = await player.get(`/api/competitions/${roomId}`);
    expect(r.body.status).toBe("COMPLETED");
    expect(r.body.leaderboard[0].score).toBe(100);
    await tickCompetitions();
    expect(await Response.countDocuments({ competitionId: roomId })).toBe(1);
    expect(
      (
        await post(host, `/organizer/competitions/${roomId}/control`, {
          action: "resume",
        })
      ).status,
    ).toBe(409);
  });
  it("keeps private rooms private and exports only to the host", async () => {
    const c = await post(host, "/organizer/competitions", {
      title: "A private little room",
      quizId: ownedId,
      capacity: 2,
      visibility: "private",
    });
    expect((await player.get(`/api/competitions/${c.body.id}`)).status).toBe(
      404,
    );
    expect((await admin.get(`/api/competitions/${c.body.id}`)).status).toBe(
      200,
    );
    expect(
      (await other.get(`/api/organizer/competitions/${roomId}/export`)).status,
    ).toBe(404);
    expect(
      (await host.get(`/api/organizer/competitions/${roomId}/export`)).headers[
        "content-type"
      ],
    ).toContain("text/csv");
  });
  it("authenticates sockets and synchronizes room state after reconnecting", async () => {
    const server = createServer(app);
    const realtime = setupRealtime(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number };
    const session = token();
    await Session.create({
      tokenHash: hash(session),
      userId: hostId,
      expiresAt: new Date(Date.now() + 60000),
    });
    const socket = socketClient(`http://127.0.0.1:${address.port}`, {
      transports: ["websocket"],
      extraHeaders: {
        Origin: "http://localhost:5173",
        Cookie: `quizora_session=${session}`,
      },
      autoConnect: false,
      reconnection: false,
    });
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
        socket.connect();
      });
      const state = await new Promise<any>((resolve) => {
        socket.once("room:state", resolve);
        socket.emit("room:subscribe", roomId);
      });
      expect(state.status).toBe("COMPLETED");
      socket.disconnect();
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
        socket.connect();
      });
      const restored = await new Promise<any>((resolve) => {
        socket.once("room:state", resolve);
        socket.emit("room:subscribe", roomId);
      });
      expect(restored.leaderboard).toEqual(state.leaderboard);
    } finally {
      socket.disconnect();
      await new Promise<void>((resolve) => realtime.close(() => resolve()));
      server.close();
    }
  }, 10000);
});
describe("Private challenges, tournament registration, and admin audit", () => {
  it("creates a shareable challenge, prevents third-party takeover, and checks expiry", async () => {
    const c = await post(player, "/challenges", { quizId });
    expect(c.status).toBe(201);
    expect(
      (await post(other, `/challenges/${c.body.code}/accept`)).status,
    ).toBe(200);
    expect(
      (await post(admin, `/challenges/${c.body.code}/accept`)).status,
    ).toBe(409);
    const play = await post(other, `/challenges/${c.body.code}/play`);
    expect(play.status).toBe(200);
    expect(play.body.question.correct).toBeUndefined();
    await models.Challenge.updateOne(
      { code: c.body.code },
      { $set: { expiresAt: new Date(Date.now() - 1) } },
    );
    expect((await post(other, `/challenges/${c.body.code}/play`)).status).toBe(
      403,
    );
  });
  it("creates scheduled multi-round events and registers participants in each round", async () => {
    const now = Date.now();
    const t = await post(host, "/tournaments", {
      title: "The curious cup",
      description: "Two rounds of fair questions.",
      capacity: 2,
      visibility: "public",
      registrationClosesAt: new Date(now + 60000).toISOString(),
      rounds: [
        { quizId: ownedId, startsAt: new Date(now + 120000).toISOString() },
        { quizId: ownedId, startsAt: new Date(now + 240000).toISOString() },
      ],
    });
    expect(t.status).toBe(201);
    expect(t.body.rounds).toHaveLength(2);
    expect((await post(player, `/tournaments/${t.body.id}/join`)).status).toBe(
      200,
    );
    const state = await player.get(`/api/tournaments/${t.body.id}`);
    expect(state.body.joined).toBe(true);
    expect(state.body.standings[0].score).toBe(0);
    for (const r of t.body.rounds)
      expect(
        await Participant.exists({ competitionId: r.id, userId: playerId }),
      ).toBeTruthy();
  });
  it("audits role and suspension changes and revokes affected sessions", async () => {
    const r = await patch(admin, `/admin/users/${otherId}`, {
      role: "MODERATOR",
      suspended: true,
      confirm: true,
    });
    expect(r.status).toBe(200);
    expect((await other.get("/api/dashboard")).status).toBe(401);
    expect(
      await Audit.exists({ targetId: otherId, action: "user.update" }),
    ).toBeTruthy();
    expect(
      (
        await patch(admin, `/admin/users/${adminId}`, {
          role: "PLAYER",
          confirm: true,
        })
      ).status,
    ).toBe(409);
  });
  it("moderates reported content without exposing private emails publicly", async () => {
    const r = await post(player, "/reports", {
      targetId: quizId,
      reason: "Please review this question explanation.",
    });
    expect(r.status).toBe(201);
    const reports = await admin.get("/api/admin/reports");
    expect(reports.body.items.length).toBeGreaterThan(0);
    expect(
      (
        await patch(admin, `/admin/quizzes/${ownedId}`, {
          status: "archived",
          reason: "Administrative content review.",
        })
      ).status,
    ).toBe(200);
    expect((await player.get(`/api/quizzes/${ownedId}`)).status).toBe(404);
  });
  it("keeps payment collection disabled", async () => {
    expect(
      (await post(player, "/billing/checkout", { amount: 1, plan: "pro" }))
        .status,
    ).toBe(503);
    expect((await player.get("/api/plans")).body.billingEnabled).toBe(false);
  });
  it("enables organizer tools through server policy without accepting admin roles", async () => {
    const result = await post(player, "/auth/organizer-access", {
      role: "SUPER_ADMIN",
    });
    expect(result.status).toBe(200);
    expect(result.body.user.role).toBe("ORGANIZER");
    expect(
      await Audit.exists({
        actorId: playerId,
        action: "account.organizer_enabled",
      }),
    ).toBeTruthy();
  });
  it("honors a configured zero quiz limit for creation and duplication", async () => {
    await models.Plan.updateOne(
      { key: "organizer" },
      { $set: { quizLimit: 0 } },
    );
    expect((await post(host, "/organizer/quizzes", quizBody)).status).toBe(403);
    expect(
      (await post(host, `/organizer/quizzes/${ownedId}/duplicate`)).status,
    ).toBe(403);
    await models.Plan.updateOne(
      { key: "organizer" },
      { $set: { quizLimit: 10 } },
    );
  });
  it("recovers interrupted finalization from the immutable response ledger", async () => {
    const c = await Competition.create({
      title: "Recovery check",
      hostId,
      quizId,
      code: "RECOV1",
      snapshot: questions,
      index: 2,
      status: "COMPLETED",
      resultsFinalized: false,
      completedAt: new Date(),
    });
    const participant = await Participant.create({
      competitionId: String(c._id),
      userId: playerId,
      displayName: "Player",
      username: "player",
      score: 9999,
    });
    await Response.create({
      competitionId: String(c._id),
      userId: playerId,
      questionId: "first",
      selected: [1],
      correct: true,
      elapsedMs: 500,
    });
    await recoverFinalizations();
    const saved = await Participant.findById(participant._id);
    expect(saved?.score).toBe(100);
    expect(saved?.elapsedMs).toBe(10500);
    expect((await Competition.findById(c._id))?.resultsFinalized).toBe(true);
    await recoverFinalizations();
    expect((await Participant.findById(participant._id))?.score).toBe(100);
  });
  it("catches up expired live schedules without extending time after downtime", async () => {
    const c = await Competition.create({
      title: "Deadline recovery",
      hostId,
      quizId,
      code: "RECOV2",
      snapshot: questions,
      index: 0,
      status: "LIVE",
      deadline: new Date(Date.now() - 30000),
    });
    await tickCompetitions();
    expect((await Competition.findById(c._id))?.status).toBe("COMPLETED");
  });
});
