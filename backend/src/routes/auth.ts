import { Router } from "express";
import { z } from "zod";
import { registrationSchema } from "../shared/schemas.js";
import { User, Session, AuthToken, Audit } from "../models.js";
import { config } from "../config.js";
import {
  hashPassword,
  verifyPassword,
  hash,
  token,
  HttpError,
  safeUser,
} from "../utils.js";
import { createSession, cookieOptions, requireAuth } from "../auth.js";
import { mailConfigured, sendMail } from "../mail.js";
import { ensureWallet } from "../services/wallet.js";
export const auth = Router();
auth.get("/me", (req, res) =>
  res.json({
    user: req.user ? safeUser(req.user) : null,
    registrationEnabled: config.registration,
    organizerRegistrationEnabled: config.organizers,
  }),
);
auth.post("/register", async (req, res) => {
  if (!config.registration)
    throw new HttpError(403, "Registration is currently closed.");
  const data = registrationSchema.parse(req.body);
  if (data.organizer && !config.organizers)
    throw new HttpError(403, "Organizer registration is currently closed.");
  const user = await User.create({
    ...data,
    passwordHash: await hashPassword(data.password),
    role: data.organizer ? "ORGANIZER" : "PLAYER",
    adultConfirmedAt: new Date(),
    onboarding: { required: true, version: 1, step: 0, status: "pending" },
  });
  await ensureWallet(String(user._id));
  await createSession(String(user._id), res);
  await Audit.create({
    actorId: String(user._id),
    action: "account.register",
    targetId: String(user._id),
  });
  res.status(201).json({ user: safeUser(user) });
});
auth.post("/login", async (req, res) => {
  const data = z
    .object({ email: z.email().toLowerCase(), password: z.string().max(128) })
    .parse(req.body);
  const user = await User.findOne({ email: data.email }).select(
    "+passwordHash",
  );
  if (
    !user ||
    !(await verifyPassword(data.password, user.passwordHash)) ||
    user.suspended
  )
    throw new HttpError(401, "The email or password is incorrect.");
  if (req.sessionHash) await Session.deleteOne({ tokenHash: req.sessionHash });
  await createSession(String(user._id), res);
  res.json({ user: safeUser(user) });
});
auth.patch("/onboarding", requireAuth, async (req, res) => {
  const data = z
    .object({
      version: z.literal(1),
      step: z.number().int().min(0).max(4),
      status: z.enum(["in_progress", "completed", "skipped"]),
    })
    .parse(req.body);
  const finished = ["completed", "skipped"].includes(data.status);
  await User.updateOne(
    { _id: req.user._id },
    {
      $set: {
        onboarding: {
          ...data,
          required: !finished,
          ...(finished ? { finishedAt: new Date() } : {}),
        },
      },
    },
  );
  res.json({ onboarding: { ...data, required: !finished } });
});
auth.post("/logout", async (req, res) => {
  if (req.sessionHash) await Session.deleteOne({ tokenHash: req.sessionHash });
  res.clearCookie("quizora_session", cookieOptions).json({ ok: true });
});
auth.post("/organizer-access", requireAuth, async (req, res) => {
  if (!config.organizers)
    throw new HttpError(
      403,
      "Organizer access is currently managed by the platform administrator.",
    );
  if (req.user.role === "PLAYER") {
    req.user.role = "ORGANIZER";
    await req.user.save();
    await Audit.create({
      actorId: String(req.user._id),
      action: "account.organizer_enabled",
      targetId: String(req.user._id),
    });
  }
  res.json({ user: safeUser(req.user) });
});
auth.patch("/profile", requireAuth, async (req, res) => {
  const data = z
    .object({
      displayName: z.string().trim().min(2).max(60),
      bio: z.string().max(300),
      visibility: z.enum(["public", "private"]),
    })
    .parse(req.body);
  Object.assign(req.user, data);
  await req.user.save();
  res.json({ user: safeUser(req.user) });
});
auth.post("/deletion-request", requireAuth, async (req, res) => {
  req.user.deletionRequestedAt = new Date();
  await req.user.save();
  await Session.deleteMany({ userId: req.user._id });
  await Audit.create({
    actorId: String(req.user._id),
    action: "account.deletion_requested",
    targetId: String(req.user._id),
  });
  res.clearCookie("quizora_session", cookieOptions).json({ ok: true });
});
auth.post("/forgot-password", async (req, res) => {
  const { email } = z
    .object({ email: z.email().toLowerCase() })
    .parse(req.body);
  if (!mailConfigured())
    throw new HttpError(
      503,
      "Password recovery requires email delivery to be configured by the platform operator.",
    );
  const user = await User.findOne({ email });
  if (user) {
    const raw = token();
    await AuthToken.deleteMany({ userId: user._id, kind: "reset" });
    await AuthToken.create({
      tokenHash: hash(raw),
      userId: user._id,
      kind: "reset",
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
    await sendMail(
      email,
      "Reset your Quizora password",
      `Reset your password within 30 minutes: ${config.origin}/reset-password?token=${raw}`,
    );
  }
  res.json({
    message: "If an account exists, a password reset email has been sent.",
  });
});
auth.post("/reset-password", async (req, res) => {
  const data = z
    .object({
      token: z.string().length(64),
      password: z.string().min(12).max(128),
    })
    .parse(req.body);
  const reset = await AuthToken.findOneAndDelete({
    tokenHash: hash(data.token),
    kind: "reset",
    expiresAt: { $gt: new Date() },
  });
  if (!reset)
    throw new HttpError(400, "This reset link is invalid or has expired.");
  await User.updateOne(
    { _id: reset.userId },
    { $set: { passwordHash: await hashPassword(data.password) } },
  );
  await Session.deleteMany({ userId: reset.userId });
  res.json({ ok: true });
});
auth.post("/send-verification", async (req, res) => {
  if (!req.user) throw new HttpError(401, "Sign in to continue.");
  if (!mailConfigured())
    throw new HttpError(503, "Email delivery has not been configured.");
  const raw = token();
  await AuthToken.deleteMany({ userId: req.user._id, kind: "verify" });
  await AuthToken.create({
    tokenHash: hash(raw),
    userId: req.user._id,
    kind: "verify",
    expiresAt: new Date(Date.now() + 86400000),
  });
  await sendMail(
    req.user.email,
    "Verify your Quizora email",
    `Verify your email: ${config.origin}/verify-email?token=${raw}`,
  );
  res.json({ ok: true });
});
auth.post("/verify-email", async (req, res) => {
  const { token: raw } = z
    .object({ token: z.string().length(64) })
    .parse(req.body);
  const verification = await AuthToken.findOneAndDelete({
    tokenHash: hash(raw),
    kind: "verify",
    expiresAt: { $gt: new Date() },
  });
  if (!verification)
    throw new HttpError(
      400,
      "This verification link is invalid or has expired.",
    );
  await User.updateOne(
    { _id: verification.userId },
    { $set: { emailVerified: true } },
  );
  res.json({ ok: true });
});
