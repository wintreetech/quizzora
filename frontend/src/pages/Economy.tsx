import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  Spinner,
  ErrorNote,
  Empty,
  date,
  clearParticipationKey,
} from "../lib";
import { Gate } from "./Player";
export function useWallet() {
  const { user } = useApp();
  return useQuery({
    queryKey: ["wallet"],
    queryFn: () => api("/wallet"),
    enabled: !!user,
    staleTime: 10000,
  });
}
export const money = (amount: number | null, currency: string | null) =>
  amount !== null && amount !== undefined && currency
    ? new Intl.NumberFormat("en", { style: "currency", currency }).format(
        amount / 100,
      )
    : "Not priced yet";
export const coinNumber = (n: number) => new Intl.NumberFormat("en").format(n);
export function CoinSymbol({ size = 28 }: { size?: number }) {
  return (
    <span
      className="coin-symbol"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span>q</span>
    </span>
  );
}
export { CoinStore } from "./WalletStore";
export function WalletPage() {
  const { user } = useApp(),
    { data: w, isPending, error } = useWallet();
  const [page, setPage] = useState(1);
  const { data: h } = useQuery({
    queryKey: ["wallet-history", page],
    queryFn: () => api(`/wallet/history?page=${page}`),
    enabled: !!user,
  });
  const { data: p } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => api("/payments"),
    enabled: !!user,
  });
  if (!user) return <Gate title="Your next great round starts here." />;
  const totals = (type: string) =>
    w?.totals?.find((t: any) => t._id === type)?.amount || 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">YOUR WALLET</span>
          <h1>Ready for your next move.</h1>
          <p>
            A clear view of every coin. Always separate from your quiz score.
          </p>
        </div>
        <Link className="btn primary" to="/store">
          <Icon name="Plus" size={20} /> Get coins
        </Link>
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : (
        <>
          <section className="wallet-overview">
            <div>
              <span>AVAILABLE TO EXPLORE</span>
              <div>
                <CoinSymbol size={55} />
                <strong>{coinNumber(w.balance)}</strong>
                <span>coins</span>
              </div>
              <p>No expiry. No transfers. Just your next great quiz.</p>
            </div>
            <div className="wallet-facts">
              <div>
                <span>Purchased coins</span>
                <b>{coinNumber(totals("COIN_PURCHASE"))}</b>
              </div>
              <div>
                <span>Spent on quizzes</span>
                <b>{coinNumber(-totals("QUIZ_ENTRY"))}</b>
              </div>
              <div>
                <span>Event & tournament entries</span>
                <b>
                  {coinNumber(
                    -totals("COMPETITION_ENTRY") - totals("TOURNAMENT_PASS"),
                  )}
                </b>
              </div>
              <div>
                <span>Entry coins refunded</span>
                <b>
                  {coinNumber(
                    totals("QUIZ_ENTRY_REFUND") +
                      totals("COMPETITION_REFUND") +
                      totals("TOURNAMENT_REFUND"),
                  )}
                </b>
              </div>
            </div>
          </section>
          {w.reversalHold > 0 && (
            <ErrorNote
              message={`Payment review hold: ${w.reversalHold} coins. New coin credits first offset this hold; no money is owed through this wallet. Contact support for a review.`}
            />
          )}
          <div className="section-heading">
            <div>
              <h2>Every coin has a story.</h2>
              <p>Your complete access and adjustment history.</p>
            </div>
            <span className="count-pill">{h?.total || 0} transactions</span>
          </div>
          {!h?.items.length ? (
            <Empty
              icon="Wallet"
              title="A fresh start, clearly recorded."
              description="Coin purchases, quiz entries, refunds, and support adjustments will appear here. Free quizzes are always a way in."
            >
              <Link className="btn outline" to="/">
                Explore the arena <Icon name="ArrowRight" size={19} />
              </Link>
            </Empty>
          ) : (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Date</th>
                    <th>Coins</th>
                    <th>Balance after</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {h.items.map((t: any) => (
                    <tr key={t._id}>
                      <td>
                        <b>{t.type.replaceAll("_", " ")}</b>
                        <small>{t.reason}</small>
                      </td>
                      <td>{date(t.createdAt)}</td>
                      <td
                        className={
                          t.amount > 0 ? "amount-credit" : "amount-debit"
                        }
                      >
                        {t.amount > 0 ? "+" : ""}
                        {coinNumber(t.amount)}
                      </td>
                      <td>{coinNumber(t.balanceAfter)}</td>
                      <td>
                        <code title={t.reference}>
                          {t.reference.slice(0, 19)}…
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {h?.total > 20 && (
            <div className="pagination">
              <span>Page {page}</span>
              <div>
                <button
                  className="btn outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn outline"
                  disabled={page * 20 >= h.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          <div className="section-heading purchase-history-heading">
            <div>
              <h2>Your coin purchases.</h2>
              <p>
                Gateway payment status and independently verified fulfillment.
              </p>
            </div>
          </div>
          {!p?.items.length ? (
            <Empty
              icon="CreditCard"
              title="No purchases yet."
              description="When you buy coins, you’ll find your order and payment status here."
            />
          ) : (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Coins</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((p: any) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.packageName}</b>
                        <small>{date(p.createdAt)}</small>
                      </td>
                      <td>{coinNumber(p.coins)}</td>
                      <td>{money(p.amountMinor, p.currency)}</td>
                      <td>
                        <span className="badge">
                          {p.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>
                        <Link className="text-btn" to={`/purchase/${p.id}`}>
                          View order <Icon name="ArrowUpRight" size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
export function PurchaseStatus() {
  const { id } = useParams(),
    { user, toast } = useApp(),
    client = useQueryClient();
  const {
    data: p,
    isPending,
    error,
  } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => api(`/payments/${id}`),
    enabled: !!user,
    refetchInterval: (query) =>
      query.state.data?.status === "PENDING" ? 5000 : false,
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (p && p.status !== "PENDING" && user)
      clearParticipationKey(`purchase:${user.id}:${p.packageId}`);
    if (p?.creditedAt) {
      client.invalidateQueries({ queryKey: ["wallet"] });
      client.invalidateQueries({ queryKey: ["wallet-history"] });
    }
  }, [p?.creditedAt, p?.status, user?.id]);
  if (!user) return <Gate title="Your purchase, kept private." />;
  if (isPending) return <Spinner />;
  if (error || !p)
    return <ErrorNote message={error?.message || "Order not found."} />;
  return (
    <div className="purchase-status panel">
      <div className={`purchase-status-icon ${p.creditedAt ? "paid" : ""}`}>
        <Icon
          name={
            p.creditedAt
              ? "CheckCircle2"
              : p.status === "FAILED"
                ? "X"
                : "Clock"
          }
          size={45}
        />
      </div>
      <span className="eyebrow">TRANSACTWORLD PURCHASE</span>
      <h1>
        {p.status === "REFUNDED"
          ? "This purchase was reversed."
          : p.status === "PARTIALLY_REFUNDED"
            ? "Your purchase was partly reversed."
            : p.creditedAt
              ? "More possibility. All yours."
              : p.status === "FAILED"
                ? "This payment didn’t go through."
                : "We’re checking your payment."}
      </h1>
      <p>
        {p.refundedMinor > 0
          ? `${money(p.refundedMinor, p.currency)} has been reversed by the payment partner. ${p.creditedAt ? `${coinNumber(p.refundedCoins)} corresponding coins were removed. Check your wallet for the full record.` : "No coins were delivered for this reversed order."}`
          : p.creditedAt
            ? `${coinNumber(p.coins)} coins were added. Your wallet history has the record.`
            : p.status === "FAILED"
              ? "No coins were added. If your bank shows a debit, keep this order reference and contact support for a payment review."
              : "Our payment partner has not confirmed this purchase yet. Your coins will appear as soon as verification finishes. Keep this order reference if you contact support."}
      </p>
      <div className="purchase-order-details">
        <div>
          <span>Package</span>
          <b>{p.packageName}</b>
        </div>
        <div>
          <span>Order total</span>
          <b>{money(p.amountMinor, p.currency)}</b>
        </div>
        <div>
          <span>Status</span>
          <span className="badge">{p.status}</span>
        </div>
        <div>
          <span>Order reference</span>
          <code>{p.merchantRef.slice(0, 24)}…</code>
        </div>
      </div>
      <div className="result-buttons">
        <Link
          className="btn primary"
          to={
            p.creditedAt
              ? sessionStorage.getItem(`quizora-return:${id}`) || "/wallet"
              : "/wallet"
          }
        >
          {p.creditedAt ? "Make your next move" : "Back to wallet"}
          <Icon name="ArrowRight" size={19} />
        </Link>
        {!p.creditedAt && (
          <button
            className="btn outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/payments/${id}/verify`, "POST");
                await client.invalidateQueries({ queryKey: ["purchase", id] });
                toast("The gateway status has been checked.");
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Check with TransactWorld <Icon name="RotateCcw" size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
