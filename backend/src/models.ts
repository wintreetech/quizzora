import mongoose, { Schema } from "mongoose";
const make = (
  name: string,
  fields: Record<string, unknown>,
  indexes: [Record<string, any>, Record<string, any>][] = [],
) => {
  const schema = new Schema<any>(fields as any, {
    timestamps: true,
    optimisticConcurrency: true,
  });
  for (const [key, options] of indexes) schema.index(key, options);
  if (name === "WalletTransaction") {
    for (const operation of [
      "updateOne",
      "updateMany",
      "findOneAndUpdate",
      "replaceOne",
      "deleteOne",
      "deleteMany",
      "findOneAndDelete",
    ])
      schema.pre(operation as any, function () {
        throw new Error("Wallet ledger entries are append-only.");
      });
    schema.pre("save", function () {
      if (!this.isNew) throw new Error("Wallet ledger entries are immutable.");
    });
  }
  return mongoose.model<any>(name, schema);
};
export const User = make("User", {
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  displayName: String,
  passwordHash: { type: String, select: false },
  role: {
    type: String,
    enum: ["PLAYER", "ORGANIZER", "MODERATOR", "SUPER_ADMIN"],
    default: "PLAYER",
  },
  adultConfirmedAt: Date,
  emailVerified: { type: Boolean, default: false },
  suspended: { type: Boolean, default: false },
  bio: { type: String, default: "" },
  visibility: { type: String, default: "public" },
  deletionRequestedAt: Date,
  onboarding: Schema.Types.Mixed,
});
export const Session = make(
  "Session",
  {
    tokenHash: { type: String, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    expiresAt: Date,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const AuthToken = make(
  "AuthToken",
  {
    tokenHash: { type: String, unique: true },
    userId: Schema.Types.ObjectId,
    kind: String,
    expiresAt: Date,
  },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Quiz = make(
  "Quiz",
  {
    title: String,
    slug: { type: String, unique: true },
    description: String,
    category: String,
    difficulty: String,
    cover: String,
    visibility: String,
    status: String,
    ownerId: String,
    version: { type: Number, default: 1 },
    questions: [Schema.Types.Mixed],
    seedKey: { type: String, unique: true, sparse: true },
    pricing: { type: Schema.Types.Mixed },
    pricingDraft: { type: Schema.Types.Mixed },
  },
  [[{ status: 1, visibility: 1, category: 1, createdAt: -1 }, {}]],
);
export const Attempt = make(
  "Attempt",
  {
    userId: String,
    quizId: String,
    title: String,
    category: String,
    version: Number,
    snapshot: [Schema.Types.Mixed],
    answers: [Schema.Types.Mixed],
    index: { type: Number, default: 0 },
    status: { type: String, default: "active" },
    startedAt: Date,
    questionStartedAt: Date,
    deadline: Date,
    completedAt: Date,
    launchAcknowledgedAt: Date,
    voluntarilyFinished: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    elapsedMs: Number,
    billing: Schema.Types.Mixed,
    requestKey: String,
    entitlementId: String,
  },
  [
    [
      { userId: 1, quizId: 1 },
      { unique: true, partialFilterExpression: { status: "active" } },
    ],
    [{ status: 1, score: -1, correctCount: -1, elapsedMs: 1, _id: 1 }, {}],
    [{ userId: 1, createdAt: -1 }, {}],
    [{ status: 1, deadline: 1 }, {}],
    [
      { userId: 1, requestKey: 1 },
      {
        unique: true,
        partialFilterExpression: { requestKey: { $type: "string" } },
      },
    ],
  ],
);
export const Competition = make(
  "Competition",
  {
    title: String,
    description: String,
    quizId: String,
    hostId: String,
    code: { type: String, unique: true },
    visibility: { type: String, default: "public" },
    status: { type: String, default: "LOBBY" },
    capacity: { type: Number, default: 25 },
    startsAt: Date,
    snapshot: [Schema.Types.Mixed],
    index: { type: Number, default: 0 },
    deadline: Date,
    remainingMs: Number,
    startedAt: Date,
    completedAt: Date,
    resultsFinalized: { type: Boolean, default: false },
    pricing: Schema.Types.Mixed,
    pricingDraft: Schema.Types.Mixed,
    tournamentId: String,
    sequence: { type: Number, default: 0 },
    seedKey: { type: String, unique: true, sparse: true },
  },
  [
    [{ status: 1, visibility: 1, startsAt: 1 }, {}],
    [{ status: 1, deadline: 1 }, {}],
  ],
);
export const Participant = make(
  "Participant",
  {
    competitionId: String,
    userId: String,
    displayName: String,
    username: String,
    score: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    elapsedMs: { type: Number, default: 0 },
    disqualified: { type: Boolean, default: false },
    billing: Schema.Types.Mixed,
  },
  [
    [{ competitionId: 1, userId: 1 }, { unique: true }],
    [
      {
        competitionId: 1,
        score: -1,
        correctCount: -1,
        elapsedMs: 1,
        userId: 1,
      },
      {},
    ],
  ],
);
export const Response = make(
  "Response",
  {
    competitionId: String,
    userId: String,
    questionId: String,
    selected: [Number],
    text: String,
    correct: Boolean,
    elapsedMs: Number,
  },
  [[{ competitionId: 1, userId: 1, questionId: 1 }, { unique: true }]],
);
export const Audit = make(
  "Audit",
  {
    actorId: String,
    action: String,
    targetId: String,
    details: Schema.Types.Mixed,
  },
  [[{ createdAt: -1 }, {}]],
);
export const Report = make(
  "Report",
  {
    userId: String,
    targetId: String,
    reason: String,
    status: { type: String, default: "open" },
  },
  [[{ status: 1, createdAt: -1 }, {}]],
);
export const Challenge = make(
  "Challenge",
  {
    creatorId: String,
    quizId: String,
    code: { type: String, unique: true },
    expiresAt: Date,
    acceptedBy: String,
    status: { type: String, default: "open" },
    creatorAttemptId: String,
    friendAttemptId: String,
  },
  [[{ creatorId: 1, createdAt: -1 }, {}]],
);
export const Plan = make("Plan", {
  key: { type: String, unique: true },
  name: String,
  quizLimit: Number,
  participantLimit: Number,
  features: [String],
  billingEnabled: { type: Boolean, default: false },
});
export const Settings = make("Settings", {
  key: { type: String, unique: true },
  value: Schema.Types.Mixed,
});
export const Tournament = make(
  "Tournament",
  {
    title: String,
    description: String,
    hostId: String,
    visibility: String,
    code: { type: String, unique: true },
    capacity: Number,
    roundIds: [String],
    registrationClosesAt: Date,
    status: String,
    pricing: Schema.Types.Mixed,
    pricingDraft: Schema.Types.Mixed,
  },
  [[{ visibility: 1, createdAt: -1 }, {}]],
);
export const TournamentMember = make(
  "TournamentMember",
  {
    tournamentId: String,
    userId: String,
    displayName: String,
    username: String,
    billing: Schema.Types.Mixed,
  },
  [[{ tournamentId: 1, userId: 1 }, { unique: true }]],
);
export const Wallet = make("Wallet", {
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, required: true, min: 0, default: 0 },
  reversalHold: { type: Number, default: 0, min: 0 },
  sequence: { type: Number, default: 0 },
  headHash: { type: String, default: "GENESIS" },
});
export const WalletTransaction = make(
  "WalletTransaction",
  {
    userId: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reversalHoldAfter: { type: Number, default: 0 },
    sequence: { type: Number, required: true },
    previousHash: String,
    hash: String,
    reason: String,
    actorId: String,
    targetId: String,
    requestHash: String,
  },
  [
    [{ userId: 1, sequence: 1 }, { unique: true }],
    [{ userId: 1, createdAt: -1 }, {}],
  ],
);
export const CoinPackage = make("CoinPackage", {
  key: { type: String, unique: true },
  name: String,
  description: String,
  coins: Number,
  bonusCoins: { type: Number, default: 0 },
  amountMinor: { type: Number, default: null },
  currency: { type: String, default: null },
  active: { type: Boolean, default: false },
  displayOrder: Number,
  version: { type: Number, default: 1 },
});
export const PaymentOrder = make(
  "PaymentOrder",
  {
    userId: String,
    packageId: String,
    packageSnapshot: Schema.Types.Mixed,
    coins: Number,
    amountMinor: Number,
    currency: String,
    merchantRef: { type: String, unique: true },
    providerPaymentId: { type: String, unique: true, sparse: true },
    provider: { type: String, default: "transactworld" },
    status: { type: String, default: "PENDING" },
    requestKey: String,
    creditedAt: Date,
    verifiedAt: Date,
    gatewayStatus: String,
    refundedMinor: { type: Number, default: 0 },
    reversedCoins: { type: Number, default: 0 },
    verifiedRefundMinor: { type: Number, default: 0 },
    verifiedChargebackMinor: { type: Number, default: 0 },
    checkoutExpiresAt: Date,
    lastCheckedAt: Date,
    lastVerificationError: String,
  },
  [
    [{ userId: 1, requestKey: 1 }, { unique: true }],
    [{ status: 1, lastCheckedAt: 1 }, {}],
  ],
);
export const PaymentEvent = make("PaymentEvent", {
  eventKey: { type: String, unique: true },
  orderId: String,
  kind: String,
  providerPaymentId: String,
  signedFields: Schema.Types.Mixed,
  processedAt: Date,
});
export const Entitlement = make(
  "Entitlement",
  {
    userId: String,
    quizId: String,
    purchaseAttemptId: { type: String, unique: true },
    remainingAttempts: Number,
    pricing: Schema.Types.Mixed,
    transactionId: String,
  },
  [[{ userId: 1, quizId: 1, remainingAttempts: 1 }, {}]],
);
export const PricingHistory = make(
  "PricingHistory",
  {
    targetType: String,
    targetId: String,
    version: Number,
    pricing: Schema.Types.Mixed,
    actorId: String,
  },
  [[{ targetType: 1, targetId: 1, version: 1 }, { unique: true }]],
);
export const AnalyticsEvent = make(
  "AnalyticsEvent",
  {
    userId: String,
    kind: String,
    targetId: String,
    day: String,
  },
  [
    [{ userId: 1, kind: 1, targetId: 1, day: 1 }, { unique: true }],
    [{ createdAt: 1 }, { expireAfterSeconds: 7776000 }],
  ],
);
