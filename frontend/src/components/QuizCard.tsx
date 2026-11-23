import { Link } from "react-router-dom";
import type { Quiz, Pricing } from "../types";
import { Icon, useApp, categoryIcons } from "../lib";
export const quizPricingReady = (pricing: Pricing) =>
  pricing?.configured === true;
export function QuizEntryBadge({ pricing }: { pricing: Pricing }) {
  const ready = quizPricingReady(pricing),
    paid = ready && pricing.coinPrice > 0;
  return (
    <span
      className={`quiz-price ${!ready ? "review" : paid ? "premium" : "free"}`}
    >
      <Icon
        name={!ready ? "AlertCircle" : paid ? "Coins" : "CheckCircle2"}
        size={16}
      />
      {!ready
        ? "Pricing under review"
        : paid
          ? `${pricing.coinPrice.toLocaleString()} coins`
          : "Free"}
    </span>
  );
}
export default function QuizCard({ quiz }: { quiz: Quiz }) {
  const { saved, save } = useApp(),
    selected = saved.includes(quiz.id);
  const ready = quizPricingReady(quiz.pricing),
    active = quiz.progress?.status === "active";
  const level =
    (
      { Easy: "Beginner", Medium: "Intermediate", Hard: "Advanced" } as Record<
        string,
        string
      >
    )[quiz.difficulty] || quiz.difficulty;
  return (
    <article
      className={`quiz-card player-quiz-card quiz-tone-${quiz.cover}`}
      data-quiz-id={quiz.id}
    >
      <div className="quiz-card-art">
        <Link
          to={`/quiz/${quiz.id}`}
          aria-label={`View ${quiz.title}`}
          className="quiz-category-mark"
        >
          <Icon name={categoryIcons[quiz.category] || "BookOpen"} size={30} />
          <span>{quiz.category}</span>
        </Link>
        <button
          className={`bookmark-button quiz-save ${selected ? "selected" : ""}`}
          aria-label={selected ? `Unsave ${quiz.title}` : `Save ${quiz.title}`}
          aria-pressed={selected}
          onClick={() => save(quiz.id)}
        >
          <Icon name="Bookmark" size={19} />
        </button>
        <span className={`quiz-level level-${quiz.difficulty.toLowerCase()}`}>
          <span />
          {level}
        </span>
        <span className="quiz-art-motif" aria-hidden="true" />
      </div>
      <div className="quiz-card-body">
        <Link to={`/quiz/${quiz.id}`}>
          <h3>{quiz.title}</h3>
        </Link>
        <p>{quiz.description}</p>
        <div className="quiz-card-facts">
          <span>
            <Icon name="BookOpen" size={15} />
            {quiz.questionCount} questions
          </span>
          <span>
            <Icon name="Clock" size={15} />
            About {quiz.duration} min
          </span>
        </div>
        {active && (
          <div className="quiz-saved-progress">
            <span>
              In progress{" "}
              <b>
                {quiz.progress!.answered}/{quiz.progress!.total}
              </b>
            </span>
            <div>
              <i
                style={{
                  width: `${(quiz.progress!.answered / quiz.progress!.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
        {quiz.progress?.status === "completed" && (
          <span className="quiz-last-result">
            <Icon name="CheckCircle2" size={14} />
            Last accuracy: {quiz.progress.accuracy}%
          </span>
        )}
        {!!quiz.players && (
          <span className="quiz-last-result">
            {quiz.players} {quiz.players === 1 ? "player has" : "players have"}{" "}
            completed this quiz
          </span>
        )}
        <div className="quiz-card-entry">
          <QuizEntryBadge pricing={quiz.pricing} />
          {active ? (
            <Link
              to={`/play/${quiz.progress!.attemptId}`}
              className="quiz-play-link"
            >
              Continue
              <Icon name="Play" size={15} />
            </Link>
          ) : ready && quiz.pricing.available ? (
            <Link to={`/quiz/${quiz.id}`} className="quiz-play-link">
              Play quiz
              <Icon name="Play" size={15} />
            </Link>
          ) : (
            <span className="quiz-entry-paused">Entry paused</span>
          )}
        </div>
      </div>
    </article>
  );
}
