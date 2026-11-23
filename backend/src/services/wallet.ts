import mongoose, { type ClientSession } from "mongoose";
import { Wallet, WalletTransaction, Audit, User } from "../models.js";
import { HttpError, hash } from "../utils.js";
export const atomic = <T>(work: (session: ClientSession) => Promise<T>) =>
  mongoose.connection.transaction(work, {
    readPreference: "primary",
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  });
export async function ensureWallet(userId: string, session?: ClientSession) {
  await Wallet.updateOne(
    { userId },
    {
      $setOnInsert: {
        balance: 0,
        reversalHold: 0,
        sequence: 0,
        headHash: "GENESIS",
      },
    },
    { upsert: true, session },
  );
  return Wallet.findOne({ userId }).session(session || null);
}
export async function ledger(
  session: ClientSession,
  input: {
    userId: string;
    amount: number;
    type: string;
    reference: string;
    reason: string;
    actorId?: string;
    targetId?: string;
    allowHold?: boolean;
    requestHash?: string;
  },
) {
  if (
    !Number.isSafeInteger(input.amount) ||
    Math.abs(input.amount) > 1_000_000_000
  )
    throw new HttpError(400, "Invalid coin amount.");
  const existing = await WalletTransaction.findOne({
    reference: input.reference,
  }).session(session);
  if (existing) {
    if (
      existing.userId !== input.userId ||
      existing.amount !== input.amount ||
      (input.requestHash && existing.requestHash !== input.requestHash)
    )
      throw new HttpError(
        409,
        "That request key has already been used for a different operation.",
      );
    return existing;
  }
  const wallet = await ensureWallet(input.userId, session);
  if (!wallet) throw new HttpError(500, "Wallet unavailable.");
  let balance = wallet.balance,
    hold = wallet.reversalHold || 0;
  if (input.amount < 0) {
    if (!input.allowHold && (hold > 0 || balance < -input.amount))
      throw new HttpError(
        402,
        "You don’t have enough available coins. Top up your wallet to continue.",
      );
    const taken = Math.min(balance, -input.amount);
    balance -= taken;
    hold += -input.amount - taken;
  } else {
    const offset = Math.min(hold, input.amount);
    hold -= offset;
    balance += input.amount - offset;
  }
  if (!Number.isSafeInteger(balance) || balance > 1_000_000_000)
    throw new HttpError(409, "This operation exceeds the wallet limit.");
  const sequence = wallet.sequence + 1,
    previousHash = wallet.headHash;
  const digest = hash(
    JSON.stringify({
      userId: input.userId,
      reference: input.reference,
      type: input.type,
      amount: input.amount,
      balanceAfter: balance,
      reversalHoldAfter: hold,
      sequence,
      previousHash,
      reason: input.reason,
      actorId: input.actorId || null,
      targetId: input.targetId || null,
    }),
  );
  const [entry] = await WalletTransaction.create(
    [
      {
        ...input,
        balanceAfter: balance,
        reversalHoldAfter: hold,
        sequence,
        previousHash,
        hash: digest,
      },
    ],
    { session },
  );
  wallet.balance = balance;
  wallet.reversalHold = hold;
  wallet.sequence = sequence;
  wallet.headHash = digest;
  await wallet.save({ session });
  return entry;
}
export async function adjustWallet(
  actorId: string,
  userId: string,
  data: {
    mode: "credit" | "debit" | "target";
    amount: number;
    reason: string;
    requestKey: string;
    expectedBalance: number;
    expectedReversalHold?: number;
  },
) {
  return atomic(async (session) => {
    if (!(await User.exists({ _id: userId }).session(session)))
      throw new HttpError(404, "Account not found.");
    const reference = `admin:${userId}:${data.requestKey}`,
      requestHash = hash(JSON.stringify({ actorId, ...data }));
    const previous = await WalletTransaction.findOne({ reference }).session(
      session,
    );
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new HttpError(
          409,
          "This adjustment key was already used with different details.",
        );
      return previous;
    }
    const wallet = await ensureWallet(userId, session);
    if (
      wallet.balance !== data.expectedBalance ||
      wallet.reversalHold !== (data.expectedReversalHold || 0)
    )
      throw new HttpError(
        409,
        "The balance changed. Review the current balance before confirming.",
      );
    const amount =
      data.mode === "target"
        ? data.amount -
          wallet.balance +
          (data.amount > wallet.balance ? wallet.reversalHold : 0)
        : data.mode === "debit"
          ? -data.amount
          : data.amount;
    const entry = await ledger(session, {
      userId,
      amount,
      type: amount < 0 ? "ADMIN_DEBIT" : "ADMIN_CREDIT",
      reference,
      reason: data.reason,
      actorId,
      requestHash,
    });
    await Audit.create(
      [
        {
          actorId,
          action: "wallet.adjust",
          targetId: userId,
          details: {
            ...data,
            delta: amount,
            balanceAfter: entry.balanceAfter,
            transactionId: String(entry._id),
          },
        },
      ],
      { session },
    );
    return entry;
  });
}
export async function refundEntry(
  session: ClientSession,
  billing: any,
  userId: string,
  type: string,
  targetId: string,
  reason: string,
) {
  if (!billing?.transactionId || !billing.coinPrice) return null;
  return ledger(session, {
    userId,
    amount: billing.coinPrice,
    type,
    reference: `refund:${billing.transactionId}`,
    targetId,
    reason,
  });
}
