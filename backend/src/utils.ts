import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { Question } from "./shared/schemas.js";
const scrypt = promisify(scryptCallback);
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const ensure = (
  condition: unknown,
  status: number,
  message: string,
): asserts condition => {
  if (!condition) throw new HttpError(status, message);
};
export const token = () => randomBytes(32).toString("hex");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hex] = stored.split(":");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return hex?.length === 128 && timingSafeEqual(key, Buffer.from(hex, "hex"));
}
export function publicQuestion(q: Question) {
  const { correct, acceptedText, explanation, ...safe } = q;
  return safe;
}
export function isCorrect(
  q: Question,
  answer: { selected: number[]; text?: string },
) {
  if (q.type === "text") {
    const norm = (s: string) =>
      s
        .normalize("NFKC")
        .trim()
        .toLocaleLowerCase("en-US")
        .replace(/\s+/g, " ");
    return (q.acceptedText || []).some(
      (s) => norm(s) === norm(answer.text || ""),
    );
  }
  const a = [...new Set(answer.selected)].sort();
  const b = [...q.correct].sort();
  return (
    a.length === answer.selected.length &&
    a.length === b.length &&
    a.every((v, i) => v === b[i])
  );
}
const locks = new Map<string, Promise<unknown>>();
export async function locked<T>(
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(run);
  locks.set(key, next);
  try {
    return await next;
  } finally {
    if (locks.get(key) === next) locks.delete(key);
  }
}
export const rankSort = {
  score: -1,
  correctCount: -1,
  elapsedMs: 1,
  userId: 1,
} as const;
export const id = (doc: any) => String(doc._id);
export const safeUser = (u: any) => ({
  id: id(u),
  displayName: u.displayName,
  username: u.username,
  email: u.email,
  role: u.role,
  bio: u.bio,
  visibility: u.visibility,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
  deletionRequestedAt: u.deletionRequestedAt,
  onboarding: u.onboarding
    ? {
        required: !!u.onboarding.required,
        version: u.onboarding.version,
        step: u.onboarding.step || 0,
        status: u.onboarding.status,
      }
    : { required: false, version: 1, step: 0, status: "not_required" },
});
