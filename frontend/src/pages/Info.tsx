import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, Icon, useApp, Spinner, ErrorNote } from "../lib";
export function Pricing() {
  const { user, auth } = useApp();
  const { data, isPending, error } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api("/plans"),
  });
  return (
    <>
      <div className="center-heading">
        <span className="page-eyebrow">
          <i />
          MORE ROOM FOR GOOD QUESTIONS
        </span>
        <h1>
          Big on curiosity.
          <br />
          Easy to get started.
        </h1>
        <p>
          Start hosting for free. Player coin entries have their own clearly
          displayed prices.
        </p>
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : (
        <div className="pricing-grid">
          {data?.items.map((p: any, i: number) => (
            <section
              key={p.key}
              className={`pricing-card ${p.key === "organizer" ? "featured" : ""}`}
            >
              <span className="plan-icon">
                <Icon
                  name={i === 0 ? "Compass" : i === 1 ? "Radio" : "Sparkles"}
                  size={25}
                />
              </span>
              {p.key === "organizer" && (
                <span className="popular-plan">FOR THE PEOPLE PERSON</span>
              )}
              <h2>{p.name}</h2>
              <p>
                {p.key === "player"
                  ? "A curious moment, whenever you need one."
                  : p.key === "organizer"
                    ? "Everything you need for your next quiz night."
                    : "A little more room for bigger ideas."}
              </p>
              <div className="plan-price">
                <strong>{p.key === "pro" ? "Coming soon" : "Free"}</strong>
                <span>
                  {p.key === "pro"
                    ? "More ways to bring people together"
                    : "No card. No subscription."}
                </span>
              </div>
              <div className="plan-features">
                {p.features.map((f: string) => (
                  <span key={f}>
                    <Icon name="Check" size={17} />
                    {f}
                  </span>
                ))}
              </div>
              {p.key === "pro" ? (
                <Link to="/help" className="btn outline full">
                  Explore what’s possible <Icon name="ArrowUpRight" size={16} />
                </Link>
              ) : user ? (
                <Link
                  to={
                    p.key === "organizer" && user.role !== "PLAYER"
                      ? "/organizer"
                      : "/"
                  }
                  className="btn primary full"
                >
                  Make yourself at home <Icon name="ArrowRight" size={16} />
                </Link>
              ) : (
                <button
                  className={`btn full ${p.key === "organizer" ? "primary" : "outline"}`}
                  onClick={() => auth("register")}
                >
                  Start something good <Icon name="ArrowRight" size={16} />
                </button>
              )}
            </section>
          ))}
        </div>
      )}
      <div className="pricing-note">
        <Icon name="Shield" size={20} />
        <p>
          These are hosting plans. Premium player entries use coins from the
          coin store. Recurring hosting subscriptions are not available yet. No
          wagers, betting, or cash prizes.
        </p>
      </div>
      <HowItWorks />
    </>
  );
}
function HowItWorks() {
  return (
    <section className="how-it-works">
      <div className="center-heading">
        <span className="eyebrow">LESS SETUP. MORE AHA.</span>
        <h2>Three steps to a good time.</h2>
      </div>
      <div>
        {[
          {
            n: "01",
            icon: "Compass",
            title: "Follow your curiosity.",
            text: "Pick a subject you love. Or one you know nothing about. There’s no wrong place to start.",
          },
          {
            n: "02",
            icon: "Zap",
            title: "Find your flow.",
            text: "Play a quick solo round or gather your favorite people for a live competition.",
          },
          {
            n: "03",
            icon: "Trophy",
            title: "Take a little pride.",
            text: "See your results, discover the explanations, and find your next bright moment.",
          },
        ].map((s: any) => (
          <article key={s.n}>
            <span className="step-number">{s.n}</span>
            <Icon name={s.icon} size={28} />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
const faqs = [
  [
    "What is Quizora?",
    "A place for adults to enjoy general knowledge, entertainment trivia, and friendly competition. Play solo, challenge a friend, or host a live quiz with your people.",
  ],
  [
    "Is it free to play?",
    "Selected introductory quizzes are free. Premium quizzes display their coin price before you confirm an attempt. Each paid replay requires another confirmation unless your purchase includes extra attempts. Coin packages are available when merchant checkout is configured.",
  ],
  [
    "What can I do with coins?",
    "Coins unlock digital quiz entertainment and approved event entries. They are non-transferable, do not expire, have no cash redemption value, and never improve your score. Your wallet lists every purchase, entry, refund, and support adjustment.",
  ],
  [
    "When are entry coins refunded?",
    "Reconnect to the same paid attempt without another charge. Contact support if a platform failure prevented launch; an administrator can review and refund an eligible failed launch once. Wrong answers, completed play, and voluntary abandonment are not refundable. Canceled paid competitions restore their entry coins; cancellation of a tournament round restores the full pass price once.",
  ],
  [
    "Who can join?",
    "Quizora is for adults aged 18 and above. Confirm your age eligibility when you create your account.",
  ],
  [
    "How does scoring work?",
    "Each correct answer earns 100 points. Incorrect or unanswered questions earn zero. Multiple-answer questions require the exact correct set. Scores and deadlines are checked by the server.",
  ],
  [
    "Can I host a quiz night?",
    "Choose an organizer account when registering. Create and publish a quiz in Creator studio, then open a competition. Share its six-character code and start when your guests are ready.",
  ],
  [
    "What if I disconnect?",
    "Live rooms reconnect and synchronize with the server. Deadlines continue while you’re disconnected. Reopen the room to recover its current state.",
  ],
  [
    "Can I challenge a friend privately?",
    "Open a public quiz and select Challenge a friend. Share the link. Your friend needs an account to accept. Invitations expire after seven days.",
  ],
  [
    "How are ties broken?",
    "Competition standings use points, correct answers, cumulative answer time, and a stable user ID. Solo leaderboards count your best completed result per quiz.",
  ],
  [
    "Are there cash prizes or wagers?",
    "No. Quizora does not offer betting, staking, cash-out, or real-money prizes. The competition is for the fun of it.",
  ],
  [
    "How do I manage privacy or report content?",
    "Use Report a problem on any quiz detail page. In Settings, you can set a private profile, update your details, and request account deletion.",
  ],
];
export function Help() {
  const { tour } = useApp();
  const { data } = useQuery({
    queryKey: ["config"],
    queryFn: () => api("/config"),
  });
  const [search, setSearch] = useState("");
  return (
    <div className="help-page">
      <div className="center-heading">
        <span className="page-eyebrow">
          <i />A FEW ANSWERS OF OUR OWN
        </span>
        <h1>Curious about something?</h1>
        <button className="btn outline replay-tour-button" onClick={tour}>
          <Icon name="Play" size={18} />
          Take the product tour
        </button>
        <p>A little help, so you can get back to the good questions.</p>
        <Link to="/how-it-works" className="text-btn">Read How Quizora Works</Link>
        <label className="help-search">
          <Icon name="Search" size={19} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find an answer…"
            aria-label="Search frequently asked questions"
          />
        </label>
      </div>
      <div className="faq-list">
        {faqs
          .filter(([q, a]) =>
            `${q} ${a}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Icon name="Plus" size={19} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
      </div>
      <div className="contact-card">
        <span className="empty-icon">
          <Icon name="Mail" size={25} />
        </span>
        <div>
          <h3>Still have a question?</h3>
          <p>
            {data?.supportEmail
              ? "The platform team would like to hear from you."
              : "Support contact details will be available here when the platform opens to the public."}
          </p>
        </div>
        {data?.supportEmail && (
          <a className="btn primary" href={`mailto:${data.supportEmail}`}>
            Get in touch <Icon name="ArrowUpRight" size={16} />
          </a>
        )}
      </div>
      <HowItWorks />
    </div>
  );
}
export function Legal() {
  const { type } = useParams();
  return (
    <article className="legal-page panel">
      <span className="eyebrow">CLEAR EXPECTATIONS. GOOD COMPANY.</span>
      <h1>
        {type === "privacy"
          ? "Your curiosity. Your privacy."
          : "A fair place to play."}
      </h1>
      <p className="info-note">
        Pre-launch policy draft. Operator details, support contact,
        jurisdiction, and retention periods must be completed before public
        launch.
      </p>
      {type === "privacy" ? (
        <>
          <h2>What the platform stores</h2>
          <p>
            Your account, password hash, age eligibility confirmation, profile
            preferences, quiz answers, competition participation, and activity
            needed to provide and protect the service. Wallet ledger entries,
            coin purchase orders, and payment references support fulfillment and
            financial investigation. Card numbers and CVV are handled by
            TransactWorld and are never stored by Quizora.
          </p>
          <h2>What others see</h2>
          <p>
            Public standings show your chosen name, username, scores, and
            performance. Your email and authentication details remain private.
            Choose a private profile in Settings to leave public solo standings.
          </p>
          <h2>Sessions and preferences</h2>
          <p>
            An HttpOnly session cookie keeps you signed in. Browser storage
            saves quiz bookmarks, theme, and sidebar preferences. Authentication
            secrets are never saved in local storage.
          </p>
          <h2>Your choices</h2>
          <p>
            Edit your profile or request deletion in Settings. Deletion requests
            require operator review; submitting a request does not immediately
            erase records.
          </p>
          <h2>Email providers</h2>
          <p>
            Verification and recovery emails are available when the operator
            configures delivery. Provider details and retention periods must be
            listed in the final policy.
          </p>
        </>
      ) : (
        <>
          <h2>Adults only</h2>
          <p>
            You must be at least 18. This platform is for adult entertainment
            and professional interest trivia.
          </p>
          <h2>Keep it fair</h2>
          <p>
            Use your own account. Do not automate answers, exploit
            vulnerabilities, interfere with competitions, or impersonate others.
            Hosts may remove disruptive players with recorded reasons.
          </p>
          <h2>Scoring and availability</h2>
          <p>
            Correct answers earn 100 points by default. The server enforces
            timing and saves results. Network interruptions do not extend
            deadlines. Availability and perfect cheating prevention are not
            guaranteed.
          </p>
          <h2>Your content</h2>
          <p>
            Publish only content you have permission to use. Do not upload
            unlawful, abusive, or infringing material. Report content using a
            quiz’s detail page.
          </p>
          <h2>No wagering</h2>
          <p>
            No bets, stakes, cash-out, or real-money prizes. Coins are
            non-transferable access credits with no cash redemption value. They
            do not expire. Each premium entry displays the coin fee and requires
            confirmation. Price changes apply to new purchases; existing
            purchased entries retain their agreed terms.
          </p>
          <h2>Purchases, recovery, and refunds</h2>
          <p>
            Package checkout displays the full amount and currency before
            purchase. Coins are delivered only after independent gateway
            verification. Pending payments can be investigated with their order
            reference. Reconnect to an existing paid attempt without another
            charge. Verified platform launch failures and host cancellations
            restore qualifying entry coins once. Voluntary abandonment,
            incorrect answers, and losing an event do not qualify. A verified
            gateway reversal removes the corresponding purchased coins and can
            restrict spending until any reversal hold is resolved. Contact
            support about payment refund requests; entry-coin refunds do not
            create cash withdrawals.
          </p>
        </>
      )}
      <Link className="text-btn" to="/help">
        Find a little help <Icon name="ArrowRight" size={16} />
      </Link>
    </article>
  );
}
export function ResetPassword() {
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    { auth } = useApp();
  return (
    <div className="panel reset-page">
      <span className="eyebrow">A FRESH START</span>
      <h1>
        {success ? "You’re ready to come back." : "Let’s make it yours again."}
      </h1>
      {success ? (
        <>
          <p>Your password has been updated. Previous sessions have ended.</p>
          <button className="btn primary" onClick={() => auth("login")}>
            Sign in <Icon name="ArrowRight" size={17} />
          </button>
        </>
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("/auth/reset-password", "POST", {
                token: new URLSearchParams(window.location.search).get("token"),
                password: new FormData(e.currentTarget).get("password"),
              });
              setSuccess(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            New password
            <input
              type="password"
              name="password"
              minLength={12}
              maxLength={128}
              required
              placeholder="At least 12 characters"
            />
          </label>
          {error && <ErrorNote message={error} />}
          <button className="btn primary">
            Set new password <Icon name="ArrowRight" size={17} />
          </button>
        </form>
      )}
    </div>
  );
}
export function VerifyEmail() {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="panel reset-page">
      <span className="eyebrow">A LITTLE PEACE OF MIND</span>
      <h1>Your email. Confirmed by you.</h1>
      <p>Confirm this address belongs to you.</p>
      {status && <p className="info-note">{status}</p>}
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/auth/verify-email", "POST", {
              token: new URLSearchParams(window.location.search).get("token"),
            });
            setStatus("Email verified. You’re all set.");
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Verify my email <Icon name="Check" size={17} />
      </button>
    </div>
  );
}
export function NotFound() {
  return (
    <div className="page-gate">
      <span className="gate-illustration">?</span>
      <span className="eyebrow">A QUESTION WITHOUT AN ANSWER</span>
      <h1>This page took a curious turn.</h1>
      <p>Let’s find you something good instead.</p>
      <Link className="btn primary" to="/">
        Back to discovering <Icon name="ArrowRight" size={17} />
      </Link>
    </div>
  );
}
