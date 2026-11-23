import { Link } from "react-router-dom";
import { Icon, useApp } from "../lib";

export function PlaySteps() {
  return <section className="play-steps" aria-label="How Quizora works">
    {[
      ["Compass", "Choose a quiz", "Find a subject and level you like. Free quizzes need no coins; paid entries show their fee."],
      ["Play", "Play and score", "Answer before each timer ends. Every correct answer earns 100 points, checked by the server."],
      ["Medal", "Earn rewards and improve", "Collect achievement badges and personal bests. Read answer explanations and try a new subject."],
    ].map(([icon, title, text]) => <article key={title}><span className="play-step-icon"><Icon name={icon as "Compass" | "Play" | "Medal"} size={25} /></span><h3>{title}</h3><p>{text}</p></article>)}
  </section>;
}
export function LandingGuide() {
  return <section className="landing-guide">
    <div className="section-heading"><div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Curiosity in. Confidence out.</h2></div><Link to="/how-it-works" className="text-btn">How Quizora works</Link></div>
    <PlaySteps />
    <div className="landing-faq">
      <details><summary>Can I play for free?</summary><p>Yes. Choose Free discovery in the filters. You earn points and achievement badges through play. You do not need to buy coins to get started.</p></details>
      <details><summary>Are points and coins the same?</summary><p>Points measure your answers. Coins unlock paid quiz access and never improve your score. Quiz completion does not award spendable coins. There are no cash prizes or withdrawals.</p></details>
      <details><summary>Can I play with friends?</summary><p>Yes. Share a private challenge from a quiz, or join a live competition using the host's room code. Each player needs an account.</p></details>
    </div>
  </section>;
}
export default function HowQuizoraWorks() {
  const { tour } = useApp();
  return <div className="how-page">
    <section className="how-hero"><span className="eyebrow">YOUR FIRST ROUND, MADE SIMPLE</span><h1>A little curiosity.<br /><em>A lot to discover.</em></h1><p>Quizora is a quiz platform for adults 18+. Play on your own, challenge a friend, or join a hosted quiz night. Start with a free round and see where it takes you.</p><div className="how-actions"><Link to="/?access=free#quiz-list" className="btn primary">Find a free quiz</Link><button className="btn outline" onClick={tour}>Take the interactive tour</button></div></section>
    <PlaySteps />
    <div className="how-detail-grid">
      <section className="panel"><Icon name="Target" size={28} /><h2>Know how you score.</h2><p>Each correct answer earns 100 points. Incorrect, skipped or late answers earn zero. Select the exact set for multiple-answer questions. Each question shows its own time limit.</p><p>Results include your accuracy, score and an explanation for every question. Personal bests, category progress and earned badges appear in Overview.</p><Link to="/dashboard" className="text-btn">View my progress</Link></section>
      <section className="panel"><Icon name="Coins" size={28} /><h2>Keep coins simple.</h2><p>Free quizzes cost nothing. Premium entries display the coin fee and any included attempts before you confirm. Choose a purchase amount from 10 to 500 in USD or EUR. The store calculates your coin total, and EUR quotes show the dated currency reference.</p><p>Coins are access credits, separate from score points. They never expire, cannot be transferred, and have no cash redemption value. Reconnecting to the same paid attempt does not charge another entry.</p><Link to="/store" className="text-btn">Explore the coin store</Link></section>
      <section className="panel"><Icon name="Shield" size={28} /><h2>Stay in control.</h2><p>Review your chosen quantity, total and currency before paying. Payment uses secure hosted checkout, and coins arrive only after payment verification. If purchases are temporarily unavailable, you can keep playing free quizzes.</p><p>If a payment is interrupted, reopen its status from your wallet and check it again. Never pay a second time just because a return page was interrupted.</p><Link to="/wallet" className="text-btn">Open my wallet</Link></section>
      <section className="panel"><Icon name="LifeBuoy" size={28} /><h2>Pick up where you left off.</h2><p>Overview lists active solo rounds and recent results. Timers keep running while you are away, so resume promptly. Replay the welcome guide from Help whenever you need a refresher.</p><p>Organizers create and publish their own quizzes in Creator studio. Administrators manage content, users, pricing and payment setup in their separate workspace.</p><Link to="/help" className="text-btn">Find help and answers</Link></section>
    </div>
  </div>;
}

