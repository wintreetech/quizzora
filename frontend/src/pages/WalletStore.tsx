import { useEffect, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, Icon, Modal, Spinner, ErrorNote, useApp, participationKey, clearParticipationKey, ApiError } from "../lib";
import { coinNumber, money, useWallet } from "./Economy";

export function CoinStore() {
  const { user, auth, toast } = useApp(), { data: wallet } = useWallet(), client = useQueryClient();
  const [params] = useSearchParams();
  const [amount, setAmount] = useState(25), [quotedAmount, setQuotedAmount] = useState(25), [input, setInput] = useState("25"), [currency, setCurrency] = useState("USD");
  const [selected, setSelected] = useState<any>(null), [busy, setBusy] = useState(false), [paymentError, setPaymentError] = useState("");
  const options = useQuery({ queryKey: ["coin-purchase-options"], queryFn: () => api("/coin-purchase/options"), staleTime: 0 });
  const pricing = useQuery({ queryKey: ["budget-quote", quotedAmount, currency, options.data?.version], queryFn: () => api(`/coin-purchase/quote?amountMinor=${quotedAmount * 100}&currency=${currency}`), enabled: !!options.data, staleTime: 0 });
  const quote = pricing.data, quoting = amount !== quotedAmount || pricing.isFetching;
  const available = options.data?.checkoutAvailable && options.data?.currencies.find((item: any) => item.code === currency)?.checkoutAvailable;
  const minimum = (options.data?.minAmountMinor || 1000) / 100, maximum = (options.data?.maxAmountMinor || 50000) / 100;
  useEffect(() => { const timer = setTimeout(() => setQuotedAmount(amount), 160); return () => clearTimeout(timer); }, [amount]);
  useEffect(() => { if (user) void api("/analytics/event", "POST", { kind: "STORE_VIEW", targetId: "budget-store" }).catch(() => {}); }, [user?.id]);
  function choose(value: number) { const next = Math.max(minimum, Math.min(maximum, Math.round(value))); setAmount(next); setInput(String(next)); }
  function review() { if (!quote || quoting || !available) return; if (!user) return auth("login", () => setSelected(quote)); setPaymentError(""); setSelected(quote); }
  async function buy() {
    if (!selected || !user) return;
    setBusy(true); setPaymentError("");
    try {
      const result = await api("/coin-purchase/checkout", "POST", { purchaseKind: "budget", confirmed: true, coins: selected.coins, currency: selected.currency, amountMinor: selected.amountMinor, pricingVersion: selected.pricingVersion, requestKey: participationKey(`purchase:${user.id}:${selected.productId}`) });
      if (!result.forwardUrl) { window.location.assign(`/purchase/${result.orderId}`); return; }
      const action = new URL(result.forwardUrl);
      if (!["https://sandbox.transactworld.com", "https://secure.transactworld.com"].includes(action.origin)) throw new Error("The payment destination could not be verified.");
      const returnTo = params.get("returnTo");
      if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) sessionStorage.setItem(`quizora-return:${result.orderId}`, returnTo);
      const form = document.createElement("form"); form.method = "POST"; form.action = action.href;
      for (const [name, value] of Object.entries(result.paymentData)) { const field = document.createElement("input"); field.type = "hidden"; field.name = name; field.value = String(value); form.appendChild(field); }
      document.body.appendChild(form); form.submit();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) { clearParticipationKey(`purchase:${user.id}:${selected.productId}`); setSelected(null); await client.invalidateQueries({ queryKey: ["budget-quote"] }); toast("The price changed. Please review your updated total."); }
      else setPaymentError((error as Error).message);
      setBusy(false);
    }
  }
  return <div className="wallet-store">
    <div className="store-breadcrumb"><Link to="/">Explore</Link><span>/</span><span>Coin store</span></div>
    <header className="store-heading"><div><span className="eyebrow">A LITTLE MORE POSSIBILITY</span><h1>Make room for<br /><em>your next challenge.</em></h1><p>Choose your budget. See your coins. Keep every purchase on your terms.</p></div><Link to="/wallet" className="store-wallet"><Icon name="Wallet" size={23} /><span>Your balance<strong>{wallet ? coinNumber(wallet.balance) : "—"} <small>coins</small></strong></span></Link></header>
    {options.isPending ? <Spinner /> : options.error ? <div className="panel"><ErrorNote message={options.error.message} /><button className="btn outline" onClick={() => void options.refetch()}>Retry store</button></div> : <div className="store-purchase-grid">
      <section className="budget-panel">
        <div className="budget-section-heading"><span className="store-step">1</span><div><h2>Choose your currency</h2><p>Pay in USD or EUR. Your exact total stays clear.</p></div></div>
        <div className="currency-choice" role="group" aria-label="Purchase currency">
          {[["USD", "$", "US dollar"], ["EUR", "€", "Euro"]].map(([code, symbol, label]) => <button key={code} type="button" aria-pressed={currency === code} onClick={() => setCurrency(code)} className={currency === code ? "selected" : ""}><span>{symbol}</span><div><b>{code}</b><small>{label}</small></div><Icon name={currency === code ? "CheckCircle2" : "Globe"} size={20} /></button>)}
        </div>
        <div className="budget-section-heading budget-second"><span className="store-step">2</span><div><h2>Set your purchase amount</h2><p>Anything from {money(minimum * 100, currency)} to {money(maximum * 100, currency)}.</p></div></div>
        <div className="budget-amount"><span>{currency === "USD" ? "$" : "€"}</span><label><span className="sr-only">Purchase amount</span><input type="number" min={minimum} max={maximum} step={1} inputMode="numeric" value={input} onChange={(event) => setInput(event.target.value)} onBlur={() => choose(Number.isFinite(Number(input)) ? Number(input) : minimum)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); choose(Number.isFinite(Number(input)) ? Number(input) : minimum); } }} /></label><small>{currency}</small></div>
        <label htmlFor="budget-slider" className="sr-only">Choose purchase amount</label>
        <input id="budget-slider" type="range" min={minimum} max={maximum} step={1} value={amount} aria-valuetext={`${money(amount * 100, currency)}${quote && !quoting ? ` for ${coinNumber(quote.coins)} coins` : ""}`} onChange={(event) => choose(Number(event.target.value))} className="budget-slider" style={{ "--range-fill": `${(amount - minimum) / (maximum - minimum) * 100}%` } as CSSProperties} />
        <div className="budget-range-labels"><span>{money(minimum * 100, currency)}</span><span>{money(maximum * 100, currency)}</span></div>
        <div className="budget-adjust"><span>Fine-tune your amount</span><div><button aria-label="Reduce purchase by 1" disabled={amount <= minimum} onClick={() => choose(amount - 1)}>−</button><button aria-label="Increase purchase by 1" disabled={amount >= maximum} onClick={() => choose(amount + 1)}>+</button></div></div>
        <div className="currency-reference"><Icon name="Globe" size={20} /><div><b>{currency === "EUR" ? "Same wallet. A different currency." : "A clear rate, without the guesswork."}</b>{quote?.conversion ? <p>€1 = ${quote.conversion.eurUsd.toFixed(4)} · ECB reference, {quote.conversion.referenceDate}. Your selection is approximately {money(quote.conversion.otherAmountMinor, quote.conversion.otherCurrency)}. Whole-coin totals round down. This reference is informational; your bank may apply its own conversion charges.</p> : <p>{options.data.coinsPerUsd} coins per US dollar. EUR coin totals use the current available currency reference. If the reference is unavailable, USD purchases remain available when checkout is connected.</p>}</div></div>
      </section>
      <aside className="topup-receipt" aria-label="Purchase summary"><span className="receipt-kicker">YOUR WALLET TOP-UP</span><div className="receipt-coins"><span className="receipt-symbol"><Icon name="Coins" size={32} /></span><span>You receive</span><strong aria-live="polite">{quoting ? <Spinner small /> : quote ? coinNumber(quote.coins) : "—"}</strong><small>Quizora coins</small></div>
        <div className="receipt-lines"><div><span>Purchase amount</span><b>{money(amount * 100, currency)}</b></div><div><span>Currency</span><b>{currency}</b></div><div><span>After purchase</span><b>{quote && !quoting ? coinNumber((wallet?.balance || 0) + Math.max(0, quote.coins - (wallet?.reversalHold || 0))) : "—"} coins</b></div></div>
        <div className="receipt-total"><span>Total to pay</span><strong>{money(amount * 100, currency)}</strong></div>
        {pricing.error && <><ErrorNote message={pricing.error.message} /><button className="text-btn full" onClick={() => void pricing.refetch()}>Retry quote</button></>}
        <button className="btn primary full receipt-buy" onClick={review} disabled={quoting || !quote || !!pricing.error || !available}>Review purchase<Icon name="Lock" size={17} /></button>
        {!available && <div className="store-payment-paused"><p>Coin purchases are temporarily unavailable. Your balance is unchanged.</p><Link to="/?access=free#quiz-list">Explore free quizzes</Link></div>}
        {!!wallet?.reversalHold && <p className="receipt-note">New credits first offset your payment review hold.</p>}
        <p className="receipt-note"><Icon name="Shield" size={15} /> Secure hosted payment. Every purchase needs your confirmation.</p>
      </aside>
    </div>}
    <section className="store-benefits">{[["Compass", "More ways to explore", "Use coins for premium quiz entries. Free quizzes are always a good place to start."], ["Clock", "Keep them for your next round", "Your coins do not expire. Top up when it works for you, with no subscription."], ["CheckCircle2", "Every detail in one place", "Your wallet records purchases, entries and eligible refunds. Scores are earned through answers."]].map(([icon, title, text]) => <article key={title}><Icon name={icon as any} size={25} /><h3>{title}</h3><p>{text}</p></article>)}</section>
    <p className="store-legal">For adults 18+. Coins are non-transferable digital access credits with no cash redemption. Payment never changes your score.</p>
    {selected && <Modal title="Confirm coin purchase" close={() => !busy && setSelected(null)}><span className="eyebrow">YOUR PURCHASE, CLEARLY</span><h2>A little more room to play.</h2><div className="spend-quote"><span>Wallet top-up</span><strong>{coinNumber(selected.coins)} <small>coins</small></strong><div><span>Total payable</span><b>{money(selected.amountMinor, selected.currency)}</b></div><div><span>Currency</span><b>{selected.currency}</b></div></div><p className="purchase-policy">This is a one-time purchase. Coins arrive after verified payment. They never expire and cannot be transferred or exchanged for cash.</p>{paymentError && <ErrorNote message={paymentError} />}<button className="btn primary full" disabled={busy || !available} onClick={buy}>{busy ? <Spinner small /> : `Continue to pay ${money(selected.amountMinor, selected.currency)}`}</button></Modal>}
  </div>;
}
