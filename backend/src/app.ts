import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { config } from "./config.js";
import { sessionMiddleware } from "./auth.js";
import { HttpError } from "./utils.js";
import { auth } from "./routes/auth.js";
import { api } from "./routes/api.js";
import { organizer } from "./routes/organizer.js";
import { admin } from "./routes/admin.js";
import { tournaments } from "./routes/tournaments.js";
import { economy, economyAdmin, gatewayCallbacks } from "./routes/economy.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.production) app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.origin, credentials: true }));
  app.use(
    "/api/payments/transactworld",
    rateLimit({
      windowMs: 60000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    gatewayCallbacks,
  );
  app.use(express.json({ limit: "512kb" }));
  app.use(cookieParser());
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      message: {
        message: "Too many requests. Please wait a moment and retry.",
      },
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers["x-quizora"] !== "1" ||
        (req.headers.origin && req.headers.origin !== config.origin))
    )
      return next(new HttpError(403, "Request origin validation failed."));
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
    }),
  );
  app.use("/api", sessionMiddleware);
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 80,
      skip: (req) =>
        ["GET", "HEAD", "OPTIONS"].includes(req.method) ||
        req.path === "/onboarding",
      message: {
        message:
          "Too many account sign-in requests. Please wait before trying again.",
      },
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    auth,
  );
  app.use("/api/tournaments", tournaments);
  app.use("/api/admin/economy", economyAdmin);
  app.use("/api", economy);
  app.use("/api/organizer", organizer);
  app.use("/api/admin", admin);
  app.use("/api", api);
  app.use((_req, _res, next) =>
    next(new HttpError(404, "Endpoint not found.")),
  );
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof ZodError)
        return res.status(400).json({
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      if (error.code === 11000)
        return res.status(409).json({
          message:
            "This record already exists. Try another username or email, or refresh your attempt.",
        });
      if (error.name === "CastError")
        return res.status(404).json({ message: "Record not found." });
      if (error.name === "VersionError")
        return res
          .status(409)
          .json({ message: "This record changed. Refresh and try again." });
      const status =
        error instanceof HttpError
          ? error.status
          : error.status === 400 || error.status === 413
            ? error.status
            : 500;
      if (status === 500)
        console.error("Request failed:", error.name, error.message);
      res.status(status).json({
        message:
          status === 500
            ? "Something went wrong. Please try again."
            : error.message,
      });
    },
  );
  return app;
}
