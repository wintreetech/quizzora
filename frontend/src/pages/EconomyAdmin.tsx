import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  Icon,
  Spinner,
  ErrorNote,
  Empty,
  Modal,
  useApp,
  date,
  newRequestKey,
} from "../lib";
import { money, coinNumber, CoinSymbol } from "./Economy";
export const economySections = [
  "Wallets & Coins",
  "Coin Packages",
  "Quiz Pricing",
  "Competition Pricing",
  "Tournament Pricing",
  "Payments",
  "Pending Recovery",
  "Analytics",
];
export function EconomyDashboard() {
  const {
    data: d,
    isPending,
    error,
  } = useQuery({
    queryKey: ["economy-analytics"],
    queryFn: () => api("/admin/economy/analytics"),
  });
  if (isPending) return <Spinner />;
  if (error) return <ErrorNote message={error.message} />;
  const total = (type: string) =>
      d.journal.find((r: any) => r._id === type)?.coins || 0,
    consumed = -(
      total("QUIZ_ENTRY") +
      total("COMPETITION_ENTRY") +
      total("TOURNAMENT_PASS")
    );
  return (
    <>
      <div className="economy-overview-heading">
        <div>
          <span className="eyebrow">THE BUSINESS, IN PLAIN SIGHT</span>
          <h2>Your coin economy.</h2>
        </div>
        <span className="analytics-period">Live database totals</span>
      </div>
      <div className="stat-grid economy-stat-grid">
        {[
          ["Coins", "Outstanding coins", coinNumber(d.outstandingCoins)],
          ["CreditCard", "Coins purchased", coinNumber(total("COIN_PURCHASE"))],
          ["Zap", "Coins consumed", coinNumber(consumed)],
          ["BookOpen", "Premium attempts", coinNumber(d.premiumEntries)],
        ].map(([icon, label, value]: any) => (
          <div className="stat-card" key={label}>
            <span className="stat-icon">
              <Icon name={icon} />
            </span>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>
              {label === "Coins consumed"
                ? "Digital access usage · not revenue"
                : "From the immutable wallet ledger"}
            </small>
          </div>
        ))}
      </div>
      <div className="finance-dashboard-grid">
        <section className="panel verified-revenue">
          <span className="eyebrow">GATEWAY-VERIFIED MONEY ONLY</span>
          <h3>Revenue, without the guesswork.</h3>
          {!d.revenue.length ? (
            <div className="zero-revenue">
              <strong>No verified revenue yet.</strong>
              <p>
                Support coin grants and internal coin spending never appear as
                monetary revenue.
              </p>
            </div>
          ) : (
            d.revenue.map((r: any) => (
              <div className="currency-revenue" key={r._id}>
                <span>
                  {r._id} · {r.payments} verified payments
                </span>
                <strong>{money(r.netMinor, r._id)}</strong>
                <small>
                  {money(r.grossMinor, r._id)} gross ·{" "}
                  {money(r.refundedMinor || 0, r._id)} reversed
                </small>
              </div>
            ))
          )}
        </section>
        <section className="panel">
          <span className="eyebrow">THE PARTICIPATION PICTURE</span>
          <div className="analytics-key-values">
            <div>
              <span>Paid competition entries</span>
              <b>{d.paidCompetitionEntries}</b>
            </div>
            <div>
              <span>Successful payments</span>
              <b>{d.status.find((s: any) => s._id === "PAID")?.count || 0}</b>
            </div>
            <div>
              <span>Pending payments</span>
              <b>
                {d.status.find((s: any) => s._id === "PENDING")?.count || 0}
              </b>
            </div>
            <div>
              <span>Coin store visitors</span>
              <b>{d.storeVisitors}</b>
            </div>
            <div>
              <span>Store-to-purchase conversion</span>
              <b>
                {d.storeConversion === null
                  ? "No data yet"
                  : `${d.storeConversion}%`}
              </b>
            </div>
            <div>
              <span>Repeat purchasers</span>
              <b>{d.repeatPurchasers}</b>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
export function EconomyAdmin({ section }: { section: string }) {
  const { toast } = useApp(),
    client = useQueryClient();
  const [search, setSearch] = useState(""),
    [dialog, setDialog] = useState<{ type: string; item: any } | null>(null);
  const kind =
    section === "Quiz Pricing"
      ? "quiz"
      : section === "Competition Pricing"
        ? "competition"
        : "tournament";
  const path =
    section === "Wallets & Coins"
      ? `wallets?q=${encodeURIComponent(search)}`
      : section === "Coin Packages"
        ? "packages"
        : section.endsWith("Pricing")
          ? `pricing/${kind}`
          : section === "Analytics"
            ? "analytics"
            : "payments";
  const {
    data: d,
    isPending,
    error,
  } = useQuery({
    queryKey: ["economy-admin", section, search],
    queryFn: () => api(`/admin/economy/${path}`),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ["economy-admin"] });
    client.invalidateQueries({ queryKey: ["economy-analytics"] });
    client.invalidateQueries({ queryKey: ["wallet"] });
    client.invalidateQueries({ queryKey: ["quizzes"] });
  };
  if (isPending) return <Spinner />;
  if (error) return <ErrorNote message={error.message} />;
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">MONETIZATION CONTROL</span>
          <h2>
            {section === "Wallets & Coins"
              ? "Every balance. Every movement."
              : section === "Coin Packages"
                ? "The coin collection, your way."
                : section.endsWith("Pricing")
                  ? "A considered price for a great experience."
                  : section === "Analytics"
                    ? "A business you can understand."
                    : "Real payments. Real verification."}
          </h2>
          <p>
            {section.endsWith("Pricing")
              ? "Draft a price, review the details, then publish. Existing paid entries keep their agreed price."
              : section === "Wallets & Coins"
                ? "Adjust coins through a recorded ledger entry. No direct balance overrides."
                : section === "Coin Packages"
                  ? "Set coin allocations for new purchases. USD and EUR totals are calculated by the server."
                  : "All amounts come from the database. No fabricated success or revenue."}
          </p>
        </div>
        {section === "Wallets & Coins" && (
          <label className="inline-search">
            <Icon name="Search" size={19} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Username or exact email"
              aria-label="Search wallets"
            />
          </label>
        )}
      </div>
      {section === "Wallets & Coins" && (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Available coins</th>
                <th>Review hold</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((u: any) => (
                <tr key={u.userId}>
                  <td>
                    <b>{u.displayName}</b>
                    <small>
                      @{u.username} · {u.email}
                    </small>
                  </td>
                  <td>
                    <span className="table-coin-balance">
                      <CoinSymbol size={22} />
                      {coinNumber(u.balance)}
                    </span>
                  </td>
                  <td>{u.reversalHold ? `${u.reversalHold} coins` : "None"}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="text-btn"
                        onClick={() => setDialog({ type: "adjust", item: u })}
                      >
                        Adjust coins <Icon name="Plus" size={18} />
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => setDialog({ type: "account", item: u })}
                      >
                        View account <Icon name="ArrowUpRight" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section === "Coin Packages" && (
        <>
          <StorePricing />
          <details className="legacy-price-points"><summary>Previous price points · existing orders only</summary>
          <div className="activation-notice">
            <Icon name="Shield" size={22} />
            <p>
              These previous price points are retained for historical orders. New purchases use the amount-based store pricing above.
            </p>
          </div>
          <p className="info-note">
            Editing these entries does not change new store quotes. Existing orders keep their confirmed amounts.
          </p>
          <div className="admin-package-grid">
            {d.items.map((p: any) => (
              <article className="panel admin-package" key={p.id}>
                <span className={`badge ${p.active ? "published" : "draft"}`}>
                  {p.active ? "Active package" : "Not for sale"}
                </span>
                <h3>{p.name}</h3>
                <div className="admin-package-total">
                  <CoinSymbol size={28} />
                  <strong>{coinNumber(p.coins + p.bonusCoins)}</strong>
                  <span>coins</span>
                </div>
                <p>{p.description}</p>
                <div>
                  <strong>{money(p.amountMinor, p.currency)}</strong>
                  <span>Version {p.version}</span>
                </div>
                <button
                  className="btn outline full"
                  onClick={() => setDialog({ type: "package", item: p })}
                >
                  Manage package <Icon name="ArrowUpRight" size={18} />
                </button>
              </article>
            ))}
          </div>
          </details>
        </>
      )}
      {section.endsWith("Pricing") && (
        <>
          {kind !== "quiz" && !d.paidEntriesEnabled && (
            <div className="activation-notice">
              <Icon name="Lock" size={21} />
              <p>
                Coin-entry events remain closed until merchant approval and
                paid-event activation. You can review pricing drafts here.
              </p>
            </div>
          )}
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Content</th>
                  <th>Published entry</th>
                  <th>Draft recommendation</th>
                  <th>Version</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {d.items.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.title}</b>
                      <small>
                        {p.category || kind} · {p.status || "Registration open"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`price-pill ${p.pricing.coinPrice ? "premium" : ""}`}
                      >
                        <Icon
                          name={p.pricing.coinPrice ? "Coins" : "Sparkles"}
                          size={17}
                        />
                        {p.pricing.coinPrice
                          ? `${p.pricing.coinPrice} coins`
                          : "Free"}
                      </span>
                      <small>
                        {p.pricing.includedAttempts} included attempt(s)
                      </small>
                    </td>
                    <td>
                      {p.draft
                        ? `${p.draft.coinPrice} coins · not published`
                        : "No pending changes"}
                    </td>
                    <td>v{p.pricing.version}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="text-btn"
                          disabled={!!p.tournamentId}
                          onClick={() =>
                            setDialog({ type: "price", item: { ...p, kind } })
                          }
                        >
                          {p.tournamentId
                            ? "Included in tournament"
                            : "Manage pricing"}
                          <Icon name="ArrowUpRight" size={18} />
                        </button>
                        <button
                          className="icon-btn"
                          title="Pricing history"
                          aria-label={`Pricing history for ${p.title}`}
                          onClick={() =>
                            setDialog({ type: "history", item: { ...p, kind } })
                          }
                        >
                          <Icon name="Clock" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {["Payments", "Pending Recovery"].includes(section) && (
        <>
          <div className="gateway-readiness panel">
            <div>
              <Icon name="CreditCard" size={26} />
              <h3>TransactWorld</h3>
              <span className="badge">
                {d.gateway.environment} ·{" "}
                {d.gateway.ready ? "Ready" : "Awaiting setup"}
              </span>
              <button
                className="btn primary"
                onClick={() => setDialog({ type: "gateway", item: d.gateway })}
              >
                Connect merchant
              </button>
              <button
                className="btn outline"
                onClick={async () => {
                  try {
                    const result = await api(
                      "/admin/economy/gateway/check",
                      "POST",
                    );
                    toast(
                      result.authenticated
                        ? "Merchant API authentication verified. Check the remaining readiness items."
                        : "Merchant authentication is incomplete.",
                    );
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                Check gateway connection
              </button>
            </div>
            {d.gateway.issues.length > 0 && (
              <ul>
                {d.gateway.issues.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
            <p>
              A successful customer return never credits coins by itself. Only
              authenticated Inquiry confirmation fulfills the immutable order.
            </p>
          </div>
          {!d.items.filter(
            (p: any) =>
              section !== "Pending Recovery" || p.status === "PENDING",
          ).length ? (
            <Empty
              icon="CreditCard"
              title="A clear view of every purchase."
              description={
                section === "Pending Recovery"
                  ? "No pending orders need investigation."
                  : "Coin purchases will appear here when checkout opens."
              }
            />
          ) : (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Account</th>
                    <th>Total</th>
                    <th>Coins</th>
                    <th>Status</th>
                    <th>Recovery</th>
                  </tr>
                </thead>
                <tbody>
                  {d.items
                    .filter(
                      (p: any) =>
                        section !== "Pending Recovery" ||
                        p.status === "PENDING",
                    )
                    .map((p: any) => (
                      <tr key={p.id}>
                        <td>
                          <b>{p.packageName}</b>
                          <small title={p.merchantRef}>
                            {p.merchantRef.slice(0, 20)}…
                          </small>
                          <small>{date(p.createdAt)}</small>
                        </td>
                        <td>
                          <code>{p.userId.slice(-8)}</code>
                        </td>
                        <td>{money(p.amountMinor, p.currency)}</td>
                        <td>{coinNumber(p.coins)}</td>
                        <td>
                          <span className="badge">{p.status}</span>
                        </td>
                        <td>
                          <button
                            className="text-btn"
                            onClick={() =>
                              setDialog({ type: "verify", item: p })
                            }
                          >
                            Verify with gateway{" "}
                            <Icon name="RotateCcw" size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {section === "Analytics" && (
        <>
          <EconomyDashboard />
          <div className="finance-dashboard-grid">
            <section className="panel">
              <h3>Coin economy by movement.</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Movement</th>
                      <th>Entries</th>
                      <th>Coins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.journal.map((r: any) => (
                      <tr key={r._id}>
                        <td>{r._id.replaceAll("_", " ")}</td>
                        <td>{r.count}</td>
                        <td>{coinNumber(r.coins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!d.journal.length && (
                <p className="muted">No wallet movements yet.</p>
              )}
            </section>
            <section className="panel">
              <h3>Purchase conversion.</h3>
              <div className="analytics-key-values">
                <div>
                  <span>Registered accounts</span>
                  <b>{d.registeredUsers}</b>
                </div>
                <div>
                  <span>Unsuspended accounts</span>
                  <b>{d.activeUsers}</b>
                </div>
                <div>
                  <span>New accounts · last 30 days</span>
                  <b>{d.newUsers}</b>
                </div>
                <div>
                  <span>Premium view-to-entry</span>
                  <b>
                    {d.premiumConversion === null
                      ? "No data yet"
                      : `${d.premiumConversion}%`}
                  </b>
                </div>
                <div>
                  <span>Repeat purchasers</span>
                  <b>{d.repeatPurchasers}</b>
                </div>
              </div>
              <p className="analytics-method">
                Visitors are distinct signed-in accounts recorded within the
                retained 90-day event window. Conversion compares those visitors
                with actual purchasers or paid-entry players. No visitor data
                means unavailable, not an invented percentage.
              </p>
            </section>
          </div>
          <section className="panel revenue-table">
            <h3>Verified revenue by date & currency.</h3>
            {!d.revenueByDate.length ? (
              <p className="muted">No gateway-verified payment data yet.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Currency</th>
                      <th>Gross</th>
                      <th>Reversals</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.revenueByDate.map((r: any) => (
                      <tr key={r._id.date + r._id.currency}>
                        <td>{r._id.date}</td>
                        <td>{r._id.currency}</td>
                        <td>{money(r.amountMinor, r._id.currency)}</td>
                        <td>{money(r.refundedMinor, r._id.currency)}</td>
                        <td>
                          {money(
                            r.amountMinor - r.refundedMinor,
                            r._id.currency,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel revenue-table">
            <h3>Most purchased quizzes.</h3>
            {!d.popular.length ? (
              <p className="muted">Paid quiz entries will appear here.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Quiz</th>
                      <th>Paid entries</th>
                      <th>Coins used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.popular.map((q: any) => (
                      <tr key={q._id}>
                        <td>{q.title}</td>
                        <td>{q.entries}</td>
                        <td>{coinNumber(q.coins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="panel revenue-table">
            <h3>Most purchased coin packages.</h3>
            {!d.packages.length ? (
              <p className="muted">
                Package rankings appear after verified purchases.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Purchases</th>
                      <th>Coins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.packages.map((p: any) => (
                      <tr key={p._id}>
                        <td>{p._id}</td>
                        <td>{p.purchases}</td>
                        <td>{coinNumber(p.coins)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="fairness-note">{d.note}</p>
        </>
      )}
      {dialog?.type === "gateway" && (
        <ConnectGateway
          initial={dialog.item}
          close={() => setDialog(null)}
          done={() => {
            refresh();
            client.invalidateQueries({ queryKey: ["coin-purchase-options"] });
            client.invalidateQueries({ queryKey: ["coin-packages"] });
            setDialog(null);
            toast("Merchant API connection verified and saved.");
          }}
        />
      )}
      {dialog?.type === "adjust" && (
        <AdjustWallet
          user={dialog.item}
          close={() => setDialog(null)}
          done={() => {
            refresh();
            setDialog(null);
            toast(
              "Coin adjustment recorded in the wallet ledger and audit log.",
            );
          }}
        />
      )}
      {dialog?.type === "package" && (
        <PackageEditor
          initial={dialog.item}
          close={() => setDialog(null)}
          done={() => {
            refresh();
            setDialog(null);
            toast(
              "Coin package saved. Existing orders keep their agreed price.",
            );
          }}
        />
      )}
      {dialog?.type === "price" && (
        <PriceEditor
          item={dialog.item}
          close={() => setDialog(null)}
          done={() => {
            refresh();
            setDialog(null);
            toast(
              "Pricing saved. Published changes apply to new entries only.",
            );
          }}
        />
      )}
      {dialog?.type === "verify" && (
        <VerifyPayment
          item={dialog.item}
          close={() => setDialog(null)}
          done={() => {
            refresh();
            setDialog(null);
            toast("TransactWorld verification completed.");
          }}
        />
      )}
      {dialog?.type === "account" && (
        <AccountDetail
          userId={dialog.item.userId}
          close={() => setDialog(null)}
        />
      )}{" "}
      {dialog?.type === "history" && (
        <PricingVersions item={dialog.item} close={() => setDialog(null)} />
      )}
    </>
  );
}
function StorePricing() {
  const client = useQueryClient(), { toast } = useApp();
  const query = useQuery({ queryKey: ["store-pricing-admin"], queryFn: () => api("/admin/economy/store-pricing") });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  if (query.isPending) return <Spinner />;
  if (query.error) return <ErrorNote message={query.error.message} />;
  return <form className="panel store-pricing-form" key={query.data.version} onSubmit={async (event) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      await api("/admin/economy/store-pricing", "PUT", { coinsPerUsd: Number(form.get("coinsPerUsd")), expectedVersion: query.data.version, confirmed: true, reason: form.get("reason") });
      await client.invalidateQueries({ queryKey: ["store-pricing-admin"] });
      await client.invalidateQueries({ queryKey: ["coin-purchase-options"] });
      await client.invalidateQueries({ queryKey: ["budget-quote"] });
      toast("Store pricing updated. Existing orders retain their confirmed totals.");
    } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }}><span className="eyebrow">STORE PRICING · VERSION {query.data.version}</span><h2>One clear coin rate.</h2><p>Customers choose 10–500 in USD or EUR. EUR coin allocations use the dated ECB currency reference. New orders are validated by the server. Old discount curves are no longer available for new purchases.</p><label>Coins per US dollar<input type="number" name="coinsPerUsd" min={1} max={10000} required defaultValue={query.data.coinsPerUsd} /></label><label>Reason for pricing change<input name="reason" minLength={10} maxLength={500} required /></label><label className="check-label"><input type="checkbox" required />I confirm this rate should apply to new purchases.</label>{error && <ErrorNote message={error} />}<button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Publish store pricing"}</button></form>;
}
function ConnectGateway({
  initial,
  close,
  done,
}: {
  initial: any;
  close: () => void;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title="Connect TransactWorld merchant"
      close={() => !busy && close()}
    >
      <span className="eyebrow">
        MERCHANT API CONNECTION · {initial.environment}
      </span>
      <h2>Connect your payment account.</h2>
      <p className="muted">
        Use your TransactWorld merchant login and assigned partner ID. The
        member ID and secure key already stay on the backend.
      </p>
      <details className="merchant-setup-help">
        <summary>Where do I find these details?</summary>
        <p>Use your TransactWorld onboarding information. The merchant login is your payment-provider username, not your Quizora email. Partner ID is assigned by TransactWorld and is different from Member ID.</p>
        <p>If you do not have them, ask your merchant account manager: “Please provide my merchant API username and assigned Partner ID, and confirm access to AuthToken and transaction Inquiry for this environment.”</p>
        <p>No provider password or card details belong in this form. A successful connection check does not prove a real payment has settled.</p>
      </details>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const form = new FormData(e.currentTarget);
          try {
            await api("/admin/economy/gateway/connect", "POST", {
              merchantUsername: form.get("merchantUsername"),
              partnerId: form.get("partnerId"),
              reason: form.get("reason"),
              confirmed: true,
            });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Merchant login name
          <input
            name="merchantUsername"
            autoComplete="off"
            required
            maxLength={100}
            defaultValue={initial.identity?.merchantUsername || ""}
          />
        </label>
        <label>
          Partner ID
          <input
            name="partnerId"
            inputMode="numeric"
            pattern="[0-9]{1,20}"
            required
            maxLength={20}
            defaultValue={initial.identity?.partnerId || ""}
          />
        </label>
        <label>
          Reason for connection change
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={2}
            defaultValue="Connect merchant API for verified coin purchases"
          />
        </label>
        <label className="check-label">
          <input type="checkbox" required />I confirm these details belong to
          the merchant account for this platform.
        </label>
        <p className="purchase-policy">
          The server verifies these details with TransactWorld before saving.
          This check does not charge a card. A rejected connection keeps
          checkout paused.
        </p>
        {error && <ErrorNote message={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy ? <Spinner small /> : "Verify and connect merchant"}
          <Icon name="ArrowRight" size={18} />
        </button>
      </form>
    </Modal>
  );
}
function AdjustWallet({
  user,
  close,
  done,
}: {
  user: any;
  close: () => void;
  done: () => void;
}) {
  const [mode, setMode] = useState("credit"),
    [amount, setAmount] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const key = useRef(newRequestKey());
  const after =
    mode === "target"
      ? amount
      : mode === "debit"
        ? user.balance - amount
        : user.balance + Math.max(0, amount - (user.reversalHold || 0));
  const movement =
    mode === "target"
      ? amount -
        user.balance +
        (amount > user.balance ? user.reversalHold || 0 : 0)
      : mode === "debit"
        ? -amount
        : amount;
  const holdAfter = Math.max(
    0,
    (user.reversalHold || 0) - Math.max(0, movement),
  );
  return (
    <Modal title="Review coin adjustment" close={close}>
      <span className="eyebrow">A RECORDED SUPPORT ACTION</span>
      <h2>Adjust coins with a clear reason.</h2>
      <p className="muted">
        {user.displayName} · @{user.username}
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api(`/admin/economy/wallets/${user.userId}/adjust`, "POST", {
              mode,
              amount,
              expectedBalance: user.balance,
              expectedReversalHold: user.reversalHold || 0,
              reason: new FormData(e.currentTarget).get("reason"),
              requestKey: key.current,
              confirmed: true,
            });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Adjustment type
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="credit">Add support coins</option>
            <option value="debit">Deduct coins</option>
            <option value="target">
              Set a target through a ledger adjustment
            </option>
          </select>
        </label>
        <label>
          {mode === "target" ? "Target available balance" : "Number of coins"}
          <input
            type="number"
            min={0}
            max={1000000}
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <div className="adjustment-preview">
          <div>
            <span>Current balance</span>
            <b>{coinNumber(user.balance)} coins</b>
          </div>
          <div>
            <span>Resulting balance</span>
            <strong>{coinNumber(after)} coins</strong>
          </div>
          <div>
            <span>Ledger movement</span>
            <b>
              {movement > 0 ? "+" : ""}
              {movement} coins
            </b>
          </div>
        </div>
        {!!user.reversalHold && (
          <p className="info-note">
            Payment review hold: {user.reversalHold} coins. This adjustment
            leaves {holdAfter} held coins. Credits clear the hold before
            increasing the available balance.
          </p>
        )}
        <label>
          Reason for this adjustment
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={500}
            rows={3}
            placeholder="Explain the support case or correction"
          />
        </label>
        <p className="purchase-policy">
          Support grants do not count as purchases or monetary revenue. This
          action cannot fabricate a successful gateway payment.
        </p>
        <label className="check-label">
          <input type="checkbox" required />I reviewed the account, reason, and
          resulting balance.
        </label>
        {error && <ErrorNote message={error} />}
        <button
          className="btn primary full"
          disabled={busy || after < 0 || amount < 0}
        >
          {busy ? <Spinner small /> : "Confirm ledger adjustment"}
          <Icon name="Check" size={19} />
        </button>
      </form>
    </Modal>
  );
}
function PackageEditor({
  initial,
  close,
  done,
}: {
  initial: any;
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Configure coin package" close={close} wide>
      <span className="eyebrow">A CLEAR OFFER. AN HONEST PRICE.</span>
      <h2>Build your coin package.</h2>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            amount = String(f.get("amount") || "");
          if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) {
            setError("Use a price with at most two decimal places.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            await api(
              initial.id
                ? `/admin/economy/packages/${initial.id}`
                : "/admin/economy/packages",
              initial.id ? "PUT" : "POST",
              {
                name: f.get("name"),
                description: f.get("description"),
                coins: Number(f.get("coins")),
                bonusCoins: Number(f.get("bonus")),
                amountMinor: amount ? Math.round(Number(amount) * 100) : null,
                currency: String(f.get("currency") || "").toUpperCase() || null,
                displayOrder: Number(f.get("order")),
                active: f.get("active") === "on",
              },
            );
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Package name
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={initial.name}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={300}
            rows={2}
            defaultValue={initial.description}
          />
        </label>
        <div className="form-columns">
          <label>
            Base coins
            <input
              name="coins"
              required
              type="number"
              min={1}
              max={1000000}
              defaultValue={initial.coins}
            />
          </label>
          <label>
            Promotional bonus coins
            <input
              name="bonus"
              required
              type="number"
              min={0}
              max={100000}
              defaultValue={initial.bonusCoins}
            />
          </label>
        </div>
        <div className="form-columns">
          <label>
            Exact payable price
            <input
              name="amount"
              inputMode="decimal"
              defaultValue={
                initial.amountMinor === null
                  ? ""
                  : (initial.amountMinor / 100).toFixed(2)
              }
              placeholder="Set the merchant’s real price"
            />
          </label>
          <label>
            Merchant currency
            <input
              name="currency"
              maxLength={3}
              pattern="[A-Za-z]{3}"
              defaultValue={initial.currency || ""}
              placeholder="Approved 3-letter currency"
            />
          </label>
        </div>
        <label>
          Display order
          <input
            name="order"
            type="number"
            min={0}
            max={100}
            required
            defaultValue={initial.displayOrder}
          />
        </label>
        <label className="check-label">
          <input
            name="active"
            type="checkbox"
            defaultChecked={initial.active}
          />
          Publish this package for sale after merchant setup is ready.
        </label>
        <p className="purchase-policy">
          No real-money price is filled in automatically. All advertised bonus
          coins must be included in the confirmed package total. Changes never
          alter an existing payment order.
        </p>
        {error && <ErrorNote message={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy ? <Spinner small /> : "Save coin package"}
          <Icon name="Check" size={19} />
        </button>
      </form>
    </Modal>
  );
}
function PriceEditor({
  item,
  close,
  done,
}: {
  item: any;
  close: () => void;
  done: () => void;
}) {
  const initial = item.draft || item.pricing;
  const [mode, setMode] = useState(initial.accessType),
    [price, setPrice] = useState(initial.coinPrice),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Review access pricing" close={close} wide>
      <span className="eyebrow">VERSIONED PRICING · NEW ENTRIES ONLY</span>
      <h2>{item.title}</h2>
      <p className="muted">
        Current published version {item.pricing.version}. Paid entry snapshots
        remain unchanged.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget),
            publish =
              (e.nativeEvent as SubmitEvent).submitter?.getAttribute(
                "value",
              ) === "publish";
          setBusy(true);
          setError("");
          try {
            await api(`/admin/economy/pricing/${item.kind}/${item.id}`, "PUT", {
              pricing: {
                accessType: mode,
                coinPrice: mode === "FREE" ? 0 : price,
                includedAttempts:
                  item.kind === "quiz" ? Number(f.get("attempts")) : 1,
                previewQuestions:
                  mode === "FREE_PREVIEW_THEN_PAID"
                    ? Number(f.get("preview"))
                    : 0,
                available: f.get("available") === "on",
              },
              publish,
              confirmed: true,
            });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Access product
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              if (e.target.value !== "FREE" && price === 0) setPrice(25);
            }}
          >
            <option value="FREE">Free full access</option>
            {item.kind === "quiz" ? (
              <>
                <option value="PAID_PER_ATTEMPT">
                  Coin-priced official attempt
                </option>
                <option value="FREE_PREVIEW_THEN_PAID">
                  Free sample preview, paid official attempt
                </option>
              </>
            ) : (
              <option
                value={
                  item.kind === "competition"
                    ? "COMPETITION_ENTRY"
                    : "TOURNAMENT_PASS"
                }
              >
                {item.kind === "competition"
                  ? "One-time competition entry"
                  : "One-time pass for every scheduled round"}
              </option>
            )}
          </select>
        </label>
        <label>
          Coin price
          <input
            type="number"
            min={mode === "FREE" ? 0 : 1}
            max={100000}
            required
            value={mode === "FREE" ? 0 : price}
            disabled={mode === "FREE"}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        {item.kind === "quiz" && (
          <label>
            Included official attempts
            <input
              name="attempts"
              type="number"
              min={1}
              max={10}
              required
              defaultValue={initial.includedAttempts || 1}
            />
          </label>
        )}
        {mode === "FREE_PREVIEW_THEN_PAID" && (
          <label>
            Unscored sample questions
            <select name="preview" defaultValue={initial.previewQuestions || 1}>
              <option value={1}>One question</option>
              <option value={2}>Two questions</option>
            </select>
          </label>
        )}
        <label className="check-label">
          <input
            name="available"
            type="checkbox"
            defaultChecked={initial.available !== false}
          />
          Accept new entries under this access product.
        </label>
        <div className="pricing-confirmation">
          <strong>
            {mode === "FREE" ? "Free full access" : `${price} coins`}
          </strong>
          <p>
            {item.kind === "tournament"
              ? "One pass covers all scheduled rounds. No additional round charge."
              : item.kind === "competition"
                ? "Charge each participant once for the same room entry."
                : "A new official attempt requires confirmation unless an included attempt remains."}
          </p>
        </div>
        <label className="check-label">
          <input type="checkbox" required />I reviewed the price, included
          access, and publication impact.
        </label>
        {error && <ErrorNote message={error} />}
        <div className="result-buttons">
          <button className="btn outline" value="draft" disabled={busy}>
            Save unpublished draft
          </button>
          <button className="btn primary" value="publish" disabled={busy}>
            {busy ? <Spinner small /> : "Publish reviewed pricing"}
            <Icon name="Check" size={19} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function VerifyPayment({
  item,
  close,
  done,
}: {
  item: any;
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Verify payment with TransactWorld" close={close}>
      <span className="eyebrow">INDEPENDENT GATEWAY VERIFICATION</span>
      <h2>Check the payment. Keep the record.</h2>
      <p className="muted">
        {item.packageName} · {money(item.amountMinor, item.currency)} ·{" "}
        {item.coins} coins
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api(`/admin/economy/payments/${item.id}/verify`, "POST", {
              providerPaymentId: f.get("paymentId") || undefined,
              reason: f.get("reason"),
            });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Gateway payment ID
          <input
            name="paymentId"
            defaultValue={item.providerPaymentId || ""}
            pattern="[0-9]{1,32}"
            placeholder="Optional; otherwise verify by order reference"
            readOnly={!!item.providerPaymentId}
          />
        </label>
        <label>
          Investigation reason
          <textarea
            name="reason"
            rows={3}
            required
            minLength={10}
            maxLength={500}
          />
        </label>
        <div className="purchase-policy">
          The backend will query TransactWorld and match the order reference,
          exact amount, currency, and captured status. This action cannot
          manually mark the order successful. If verification remains
          unavailable, use a separately audited support coin adjustment; it will
          not count as revenue.
        </div>
        {error && <ErrorNote message={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy ? <Spinner small /> : "Verify payment with gateway"}
          <Icon name="RotateCcw" size={19} />
        </button>
      </form>
    </Modal>
  );
}
function PricingVersions({ item, close }: { item: any; close: () => void }) {
  const { data, isPending } = useQuery({
    queryKey: ["price-history", item.kind, item.id],
    queryFn: () =>
      api(`/admin/economy/pricing/${item.kind}/${item.id}/history`),
  });
  return (
    <Modal title="Pricing history" close={close} wide>
      <span className="eyebrow">THE PUBLISHED RECORD</span>
      <h2>{item.title}</h2>
      {isPending ? (
        <Spinner />
      ) : !data?.items.length ? (
        <Empty
          icon="Clock"
          title="No published price changes yet."
          description="Legacy free access is preserved until a reviewed price is published."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Published</th>
                <th>Coins</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p: any) => (
                <tr key={p._id}>
                  <td>v{p.version}</td>
                  <td>{date(p.createdAt)}</td>
                  <td>{p.pricing.coinPrice}</td>
                  <td>{p.pricing.accessType.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
function AccountDetail({
  userId,
  close,
}: {
  userId: string;
  close: () => void;
}) {
  const {
    data: d,
    isPending,
    error,
  } = useQuery({
    queryKey: ["admin-account", userId],
    queryFn: () => api(`/admin/economy/users/${userId}`),
  });
  const [tab, setTab] = useState("Wallet"),
    [refund, setRefund] = useState<any>(null),
    [refundError, setRefundError] = useState("");
  const client = useQueryClient();
  return (
    <Modal title="Account and wallet detail" close={close} wide>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : (
        <>
          <span className="eyebrow">A COMPLETE ACCOUNT VIEW</span>
          <h2>{d.user.displayName}</h2>
          <p className="muted">
            @{d.user.username} · {d.user.email}
          </p>
          <div className="account-wallet-summary">
            <CoinSymbol size={35} />
            <strong>{coinNumber(d.wallet.balance)}</strong>
            <span>available coins</span>
          </div>
          <div className="tab-row">
            {[
              "Wallet",
              "Purchases",
              "Quiz history",
              "Participation",
              "Audit",
            ].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="account-detail-list">
            {(tab === "Wallet"
              ? d.transactions
              : tab === "Purchases"
                ? d.purchases
                : tab === "Quiz history"
                  ? d.attempts
                  : tab === "Participation"
                    ? d.participations
                    : d.audit
            ).map((r: any) => (
              <div key={r._id || r.id}>
                <b>
                  {r.reason ||
                    r.packageName ||
                    r.title ||
                    r.action ||
                    `Competition ${r.competitionId?.slice(-8)}`}
                </b>
                <span>{r.type || r.status || r.action}</span>
                <small>
                  {r.amount !== undefined
                    ? `${r.amount > 0 ? "+" : ""}${r.amount} coins`
                    : r.score !== undefined
                      ? `${r.score} points`
                      : r.coins
                        ? `${r.coins} coins`
                        : ""}{" "}
                  · {date(r.createdAt)}
                </small>
                {tab === "Quiz history" &&
                  r.billing?.coinPrice > 0 &&
                  r.status !== "platform_failure" && (
                    <button
                      className="text-btn"
                      onClick={() => {
                        setRefund(r);
                        setRefundError("");
                      }}
                    >
                      Review launch failure refund
                    </button>
                  )}
              </div>
            ))}
          </div>
          {refund && (
            <form
              className="form-stack refund-review"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                try {
                  await api(
                    `/admin/economy/attempts/${refund._id}/refund`,
                    "POST",
                    { confirmed: true, reason: form.get("reason") },
                  );
                  setRefund(null);
                  await client.invalidateQueries({
                    queryKey: ["admin-account", userId],
                  });
                  await client.invalidateQueries({
                    queryKey: ["economy-analytics"],
                  });
                  await client.invalidateQueries({
                    queryKey: ["economy-admin"],
                  });
                } catch (e) {
                  setRefundError((e as Error).message);
                }
              }}
            >
              <h3>Verify failed launch: {refund.title}</h3>
              <p>
                Refund {refund.billing.coinPrice} coins only after confirming a
                platform incident prevented launch. Loaded, played, voluntarily
                finished attempts and used bundles are rejected by the server.
              </p>
              <label>
                Incident evidence and reason
                <textarea
                  name="reason"
                  required
                  minLength={20}
                  maxLength={1000}
                  rows={3}
                />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" required />I verified the platform
                incident and the original paid entry.
              </label>
              {refundError && <ErrorNote message={refundError} />}
              <button className="btn primary">
                Confirm eligible coin refund
              </button>
              <button
                className="btn outline"
                type="button"
                onClick={() => setRefund(null)}
              >
                Cancel review
              </button>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
