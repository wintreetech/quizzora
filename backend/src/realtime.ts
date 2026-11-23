import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { config } from "./config.js";
import { userFromCookie } from "./auth.js";
import { Competition, Participant, Session, User } from "./models.js";
import { hash } from "./utils.js";
import { setBroadcast, competitionState } from "./services/competitions.js";
export function setupRealtime(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: config.origin, credentials: true },
    allowRequest: (req, cb) => cb(null, req.headers.origin === config.origin),
    connectionStateRecovery: {
      maxDisconnectionDuration: 120000,
      skipMiddlewares: false,
    },
    maxHttpBufferSize: 16384,
  });
  io.use(async (socket, next) => {
    try {
      const cookie = socket.request.headers.cookie || "";
      const raw = cookie
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("quizora_session="))
        ?.slice("quizora_session=".length);
      const user = await userFromCookie(raw);
      if (!user || (config.verify && !user.emailVerified))
        return next(new Error("Sign in to connect."));
      socket.data.userId = String(user._id);
      socket.data.sessionHash = hash(raw!);
      next();
    } catch {
      next(new Error("Authentication failed."));
    }
  });
  io.on("connection", (socket) => {
    let lastJoin = 0;
    socket.on("room:subscribe", async (roomId: unknown, ack?: Function) => {
      if (
        typeof roomId !== "string" ||
        !/^[a-f0-9]{24}$/.test(roomId) ||
        Date.now() - lastJoin < 500
      )
        return;
      lastJoin = Date.now();
      try {
        const c = await Competition.findById(roomId);
        if (
          !c ||
          (c.hostId !== socket.data.userId &&
            !(await Participant.exists({
              competitionId: roomId,
              userId: socket.data.userId,
              disqualified: false,
            })))
        )
          return ack?.({ error: "Join this room first." });
        for (const room of socket.rooms)
          if (room !== socket.id) socket.leave(room);
        await socket.join(roomId);
        socket.emit(
          "room:state",
          await competitionState(c, socket.data.userId),
        );
        ack?.({ ok: true });
      } catch {
        ack?.({ error: "Unable to synchronize room." });
      }
    });
  });
  setBroadcast(async (roomId) => {
    const c = await Competition.findById(roomId);
    if (!c) return;
    const sockets = await io.in(roomId).fetchSockets();
    for (const socket of sockets) {
      const valid = await Session.exists({
        tokenHash: socket.data.sessionHash,
        expiresAt: { $gt: new Date() },
      });
      const user = await User.findOne({
        _id: socket.data.userId,
        suspended: false,
      });
      if (!valid || !user) {
        socket.disconnect();
        continue;
      }
      if (
        c.hostId !== socket.data.userId &&
        !(await Participant.exists({
          competitionId: roomId,
          userId: socket.data.userId,
          disqualified: false,
        }))
      ) {
        socket.emit("room:removed", {
          message: "Your access to this room has ended.",
        });
        await socket.leave(roomId);
        continue;
      }
      socket.emit("room:state", await competitionState(c, socket.data.userId));
    }
  });
  return io;
}
