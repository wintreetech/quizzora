import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, Icon, Modal, ErrorNote } from "../lib";
import type { User } from "../types";
const steps = [
  {
    icon: "Sparkles",
    label: "WELCOME",
    title: "Your next great round starts here.",
    description:
      "Welcome to Quizora. Explore what interests you, challenge what you know, and play at your own pace. A few quick pointers will get you ready.",
  },
  {
    icon: "Compass",
    label: "FIND YOUR CHALLENGE",
    title: "Follow what makes you curious.",
    description:
      "Browse subjects, difficulty and entry type. Free quizzes are a complete way to play. Premium quizzes show their coin cost, and eligible previews let you try a sample first.",
  },
  {
    icon: "Coins",
    label: "CHOOSE YOUR COINS",
    title: "Top up on your terms.",
    description:
      "Choose a purchase amount from 10 to 500 in USD or EUR. The store shows your exact coin total and payment currency before you confirm. There are no subscriptions or automatic renewals.",
  },
  {
    icon: "Play",
    label: "CONFIRM & PLAY",
    title: "You are always in control.",
    description:
      "Choose an answer before the timer ends, then lock it in. Each correct answer earns 100 points; incorrect or late answers earn zero. Multiple-answer questions need the exact correct set. Try this practice question. It will not change your score or wallet.",
  },
  {
    icon: "Wallet",
    label: "KEEP THE FULL PICTURE",
    title: "Every coin has a clear record.",
    description:
      "Open Overview to resume a round, review results, read explanations and see earned badges. Points and badges reward your knowledge; playing does not award spendable coins. Your wallet records coin purchases and entries. Help has answers and a replay of this guide.",
  },
];
export function OnboardingTour({
  user,
  replay,
  done,
}: {
  user: User | null;
  replay: boolean;
  done: () => void;
}) {
  const [index, setIndex] = useState(
      replay ? 0 : Math.min(4, user?.onboarding?.step || 0),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [demoCoins, setDemoCoins] = useState(25),
    [practice, setPractice] = useState<string | null>(null);
  const client = useQueryClient(),
    step = steps[index];
  async function save(
    next: number,
    status: "in_progress" | "completed" | "skipped",
  ) {
    if (!user || replay) return;
    const result = await api("/auth/onboarding", "PATCH", {
      version: 1,
      step: next,
      status,
    });
    client.setQueryData(["me"], (old: any) =>
      old
        ? { ...old, user: { ...old.user, onboarding: result.onboarding } }
        : old,
    );
  }
  async function move(next: number) {
    setBusy(true);
    setError("");
    try {
      await save(next, "in_progress");
      setIndex(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish(status: "completed" | "skipped") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await save(index, status);
      done();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Your Quizora guide" close={() => void finish("skipped")} wide>
      <div className="onboarding-tour">
        <div className="tour-topline">
          <span className="eyebrow">
            {user
              ? `HELLO, ${user.displayName.split(" ")[0].toUpperCase()}`
              : "YOUR QUIZORA GUIDE"}
          </span>
          <span>
            {index + 1} / {steps.length}
          </span>
        </div>
        <div
          className={`tour-visual tour-visual-${index}`}
          aria-hidden={index !== 2 && index !== 3}
        >
          {index === 0 ? (
            <>
              <div className="tour-orbit" />
              <div className="tour-main-symbol">
                <Icon name="Sparkles" size={65} />
              </div>
              <span className="tour-float float-one">
                <Icon name="BookOpen" />
                Discover
              </span>
              <span className="tour-float float-two">
                <Icon name="Trophy" />
                Challenge
              </span>
            </>
          ) : index === 1 ? (
            <div className="tour-discovery-demo">
              <div>
                <Icon name="Globe" size={31} />
                <b>A world to discover</b>
                <span>Free entry</span>
              </div>
              <div>
                <Icon name="Atom" size={31} />
                <b>A deeper curiosity</b>
                <span>Review coin entry</span>
              </div>
            </div>
          ) : index === 2 ? (
            <div className="tour-slider-demo">
              <span>CHOOSE YOUR PURCHASE AMOUNT</span>
              <strong>
                ${demoCoins.toLocaleString()} <small>USD</small>
              </strong>
              <label className="sr-only" htmlFor="tour-coin-slider">
                Try choosing a purchase amount
              </label>
              <input
                id="tour-coin-slider"
                type="range"
                min={10}
                max={500}
                step={1}
                value={demoCoins}
                onChange={(e) => setDemoCoins(Number(e.target.value))}
              />
            </div>
          ) : index === 3 ? (
            <div className="tour-play-demo">
              <strong>Which planet is called the Red Planet?</strong>
              <div className="practice-options">{["Mars", "Venus"].map((answer) => <button key={answer} className={`btn outline ${practice === answer ? "chosen" : ""}`} aria-pressed={practice === answer} onClick={() => setPractice(answer)}>{answer}</button>)}</div>
              <span role="status">{practice ? practice === "Mars" ? "Correct · 100 practice points. Iron oxide gives Mars its red colour." : "Zero practice points. Mars is correct: iron oxide gives it a red colour." : "Choose an answer · practice only"}</span>
            </div>
          ) : (
            <div className="tour-wallet-demo">
              <div>
                <Icon name="Wallet" />
                <b>Your wallet</b>
                <Icon name="CheckCircle2" />
              </div>
              <span>
                <Icon name="Plus" size={16} />
                Coin purchases
                <Icon name="Check" size={16} />
              </span>
              <span>
                <Icon name="Play" size={16} />
                Quiz entries
                <Icon name="Check" size={16} />
              </span>
              <span>
                <Icon name="RotateCcw" size={16} />
                Eligible refunds
                <Icon name="Check" size={16} />
              </span>
            </div>
          )}
        </div>
        <span className="tour-step-label">{step.label}</span>
        <h2>{step.title}</h2>
        <p className="tour-description">{step.description}</p>
        {index === 4 && user?.role === "ORGANIZER" && (
          <p className="tour-creator-note">
            <Icon name="Briefcase" size={18} />
            Your Creator studio also lets you create quizzes and host rooms.
          </p>
        )}
        {error && <ErrorNote message={error} />}
        <div
          className="tour-progress"
          aria-label={`Guide progress: step ${index + 1} of ${steps.length}`}
        >
          {steps.map((s, i) => (
            <span key={s.label} className={i <= index ? "complete" : ""} />
          ))}
        </div>
        <div className="tour-actions">
          <button
            className="text-btn"
            disabled={busy}
            onClick={() => void finish("skipped")}
          >
            Skip tour
          </button>
          <div>
            {index > 0 && (
              <button
                className="btn outline"
                disabled={busy}
                onClick={() => void move(index - 1)}
              >
                Back
              </button>
            )}
            <button
              className="btn primary"
              disabled={busy}
              onClick={() =>
                void (index === 4 ? finish("completed") : move(index + 1))
              }
            >
              {busy ? "Saving…" : index === 4 ? "Start exploring" : "Next"}
              <Icon name="ArrowRight" size={18} />
            </button>
          </div>
        </div>
        {error && (
          <button className="text-btn" onClick={done}>
            Continue without saving
          </button>
        )}
        <p className="tour-replay-note">
          You can replay this guide any time from Help & FAQs.
        </p>
      </div>
    </Modal>
  );
}
