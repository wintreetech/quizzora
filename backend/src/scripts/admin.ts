import { connectDatabase, closeDatabase } from "../database.js";
import { User, Audit, Session } from "../models.js";
import { hashPassword } from "../utils.js";
import { registrationSchema } from "../shared/schemas.js";
const input = registrationSchema.parse({
  email: process.env.ADMIN_EMAIL,
  username: process.env.ADMIN_USERNAME,
  displayName: process.env.ADMIN_NAME || "Platform administrator",
  password: process.env.ADMIN_PASSWORD,
  adult: true,
});
await connectDatabase();
const existing = await User.findOne({ email: input.email });
if (existing) {
  existing.role = "SUPER_ADMIN";
  existing.passwordHash = await hashPassword(input.password);
  existing.emailVerified = true;
  await existing.save();
  await Session.deleteMany({ userId: existing._id });
  await Audit.create({
    actorId: "provisioning-cli",
    action: "admin.provision",
    targetId: String(existing._id),
  });
} else {
  const user = await User.create({
    ...input,
    role: "SUPER_ADMIN",
    passwordHash: await hashPassword(input.password),
    adultConfirmedAt: new Date(),
    emailVerified: true,
  });
  await Audit.create({
    actorId: "provisioning-cli",
    action: "admin.provision",
    targetId: String(user._id),
  });
}
console.info(
  "Administrator provisioned. Clear ADMIN_PASSWORD from your shell.",
);
await closeDatabase();
