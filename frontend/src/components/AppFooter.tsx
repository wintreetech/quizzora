import { Link } from "react-router-dom";
import { Icon } from "../lib";

const groups = [
  {
    title: "Explore",
    links: [
      ["Explore quizzes", "/"],
      ["Leaderboard", "/leaderboard"],
      ["Live competitions", "/live"],
      ["Tournaments", "/tournaments"],
    ],
  },
  {
    title: "Your account",
    links: [
      ["Dashboard", "/dashboard"],
      ["My activity", "/activity"],
      ["My wallet", "/wallet"],
      ["Saved quizzes", "/library"],
    ],
  },
  {
    title: "Help & resources",
    links: [
      ["How it works", "/how-it-works"],
      ["Help & contact", "/help"],
      ["Coin store", "/store"],
      ["Hosting plans", "/hosting"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms & conditions", "/legal/terms"],
      ["Privacy policy", "/legal/privacy"],
      ["Refund policy", "/legal/refunds"],
      ["Cookies & storage", "/legal/cookies"],
    ],
  },
];

export default function AppFooter() {
  return (
    <footer className="app-footer product-footer" aria-label="Quizora footer">
      <div className="product-footer-main">
        <div className="product-footer-brand">
          <Link to="/" className="footer-logo" aria-label="Quizora home">
            quizora<span>✦</span>
          </Link>
          <p>
            A little knowledge.
            <br />A lot to discover.
          </p>
          <span>
            Good questions. Real progress.
            <br />A little more you, every round.
          </span>
          <Link className="footer-guide-link" to="/how-it-works">
            Get to know Quizora
            <Icon name="ArrowUpRight" size={15} />
          </Link>
        </div>
        {groups.map((group) => (
          <nav
            className="product-footer-group"
            aria-label={`Footer ${group.title}`}
            key={group.title}
          >
            <h2>{group.title}</h2>
            <ul>
              {group.links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="product-footer-payments">
        <div className="footer-coin-note">
          <span>
            <Icon name="Coins" size={19} />
          </span>
          <p>
            <strong>Knowledge earns the score. Coins unlock access.</strong>
            <span>
              No subscription needed to play. Free quizzes are always a good
              place to start.
            </span>
          </p>
        </div>
        <div className="footer-card-networks">
          <div
            className="footer-payment-logos"
            role="group"
            aria-label="Card network logos"
          >
            <span className="footer-payment-card">
              <img
                src="/payment-brands/visa.svg"
                width="64"
                height="40"
                alt="Visa"
              />
            </span>
            <span className="footer-payment-card">
              <img
                src="/payment-brands/mastercard.svg"
                width="64"
                height="40"
                alt="Mastercard"
              />
            </span>
          </div>
          <Link to="/store">
            See checkout availability
            <Icon name="ArrowUpRight" size={13} />
          </Link>
        </div>
      </div>
      <div className="product-footer-bottom">
        <p>© {new Date().getFullYear()} Quizora. All rights reserved.</p>
        <div>
          <span className="age-badge">18+</span>
          <span>Made for curious minds.</span>
        </div>
      </div>
    </footer>
  );
}
