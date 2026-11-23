import { Settings, Audit } from "../models.js";
import { atomic } from "./wallet.js";
let identity: {
  merchantUsername?: string;
  partnerId?: string;
  memberId?: string;
  environment?: string;
} = {};
export const hasVerifiedMerchantIdentity = () =>
  !!identity.merchantUsername &&
  !!identity.partnerId &&
  identity.memberId === process.env.MEMBER_ID &&
  identity.environment ===
    (process.env.TW_ENVIRONMENT === "live" ? "live" : "sandbox");
export const merchantIdentity = () => {
  const bound =
    identity.memberId === process.env.MEMBER_ID &&
    identity.environment ===
      (process.env.TW_ENVIRONMENT === "live" ? "live" : "sandbox");
  return {
    merchantUsername:
      (bound && identity.merchantUsername) ||
      process.env.TW_MERCHANT_USERNAME ||
      "",
    partnerId: (bound && identity.partnerId) || process.env.TW_PARTNER_ID || "",
  };
};
export async function loadMerchantIdentity() {
  const stored = await Settings.findOne({
    key: "transactworld-merchant-identity",
  });
  identity = stored?.value || {};
}
export async function saveMerchantIdentity(
  actorId: string,
  data: { merchantUsername: string; partnerId: string; reason: string },
) {
  const value = {
    merchantUsername: data.merchantUsername,
    partnerId: data.partnerId,
    memberId: process.env.MEMBER_ID,
    environment: process.env.TW_ENVIRONMENT === "live" ? "live" : "sandbox",
  };
  await atomic(async (session) => {
    await Settings.updateOne(
      { key: "transactworld-merchant-identity" },
      { $set: { value } },
      { upsert: true, session },
    );
    await Audit.create(
      [
        {
          actorId,
          action: "payment.merchant_identity_verified",
          targetId: "transactworld",
          details: {
            reason: data.reason,
            fields: ["merchantUsername", "partnerId"],
            verifiedWithGateway: true,
          },
        },
      ],
      { session },
    );
  });
  identity = value;
}
