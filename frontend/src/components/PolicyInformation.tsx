import { Link } from "react-router-dom";
import { Icon } from "../lib";

const information = {
  refunds: {
    title: "Refund policy",
    introduction:
      "A clear explanation of coin purchases, entry refunds and payment reviews.",
    sections: [
      [
        "Quiz entry coins",
        "You can reconnect to an existing paid attempt without another entry charge. If a verified platform failure prevented the quiz from launching, support can review the attempt and restore eligible entry coins once. Incorrect answers, completed play, losing and voluntary exits do not qualify for an entry-coin refund.",
      ],
      [
        "Canceled competitions and tournaments",
        "A host cancellation restores qualifying competition entry coins once. If a tournament round is canceled, the qualifying tournament pass is restored once. Repeated requests do not create additional refunds.",
      ],
      [
        "Coin purchase payments",
        "Your checkout review shows the purchase amount, currency and coin allocation before you pay. Purchased coins are credited only after payment verification. For a pending payment or a payment-refund request, contact support with the order reference from your wallet or purchase page. A refund of quiz entry coins is a wallet credit, not a cash withdrawal.",
      ],
      [
        "Payment reversals",
        "Verified payment refunds or chargebacks reverse the corresponding purchased coins. If those coins have already been spent, the wallet may have a payment review hold until the reversal is resolved. Your wallet records the resulting transactions.",
      ],
      [
        "Request a review",
        "Include your account username, quiz or order reference, and a description of what happened. Never send card numbers, CVV codes or passwords. Support contact information is available on the Help page when configured by the platform operator.",
      ],
    ],
  },
  cookies: {
    title: "Cookies & browser storage",
    introduction: "How Quizora remembers your session and your preferences.",
    sections: [
      [
        "Your sign-in session",
        "Quizora uses an HttpOnly session cookie to keep you signed in. The browser sends this cookie with account requests; page scripts cannot read it. Session records expire after seven days, and signing out revokes the current session.",
      ],
      [
        "Your preferences",
        "Browser storage remembers your saved quiz bookmarks, light or dark theme, and sidebar preference. These preferences belong to this browser. Authentication secrets are not stored in local storage.",
      ],
      [
        "Payments",
        "When checkout is available, payment details are entered on the payment provider's hosted page. That provider may use its own session cookies under its own policies. Quizora does not store your card number or CVV.",
      ],
      [
        "Your controls",
        "You can manage cookies and site storage through your browser settings. Blocking or clearing the session cookie signs you out or prevents account features from working. Clearing local storage removes this browser's saved bookmarks and display preferences; it does not delete your account, server-side results or wallet history.",
      ],
    ],
  },
};

export function PolicyNavigation({ current }: { current: string }) {
  return (
    <nav className="legal-page-navigation" aria-label="Legal information">
      {[
        ["terms", "Terms & conditions"],
        ["privacy", "Privacy policy"],
        ["refunds", "Refund policy"],
        ["cookies", "Cookies & storage"],
      ].map(([type, title]) => (
        <Link
          key={type}
          to={`/legal/${type}`}
          aria-current={current === type ? "page" : undefined}
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}

export default function PolicyInformation({
  type,
}: {
  type: "refunds" | "cookies";
}) {
  const policy = information[type];
  return (
    <article className="legal-page panel">
      <PolicyNavigation current={type} />
      <span className="eyebrow">CLEAR EXPECTATIONS. GOOD COMPANY.</span>
      <h1>{policy.title}</h1>
      <p>{policy.introduction}</p>
      {policy.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <Link className="text-btn" to="/help">
        Help & contact
        <Icon name="ArrowRight" size={16} />
      </Link>
    </article>
  );
}
