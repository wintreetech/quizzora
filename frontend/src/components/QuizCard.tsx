import { Link } from "react-router-dom";
import type { Quiz } from "../types";
import { Icon, useApp } from "../lib";
import { EditorialCover } from "./BrandArtwork";
export default function QuizCard({ quiz }: { quiz: Quiz }) {
  const { saved, save } = useApp();
  const selected = saved.includes(quiz.id);
  return (
    <article className="quiz-card">
      <Link
        to={`/quiz/${quiz.id}`}
        className="quiz-cover"
        aria-label={`View ${quiz.title}`}
      >
        <EditorialCover kind={quiz.cover} />
        <span className={`difficulty ${quiz.difficulty.toLowerCase()}`}>
          <i />
          {quiz.difficulty}
        </span>
        <span className="cover-play">
          <Icon name="ArrowUpRight" size={22} />
        </span>
      </Link>
      <button
        className={`bookmark-button ${selected ? "selected" : ""}`}
        onClick={() => save(quiz.id)}
        aria-label={selected ? `Unsave ${quiz.title}` : `Save ${quiz.title}`}
        aria-pressed={selected}
      >
        <Icon name="Bookmark" size={17} />
      </button>
      <div className="quiz-card-body">
        <span className="quiz-category">{quiz.category}</span>
        <Link to={`/quiz/${quiz.id}`}>
          <h3>{quiz.title}</h3>
        </Link>
        <p>{quiz.description}</p>
        <div className="quiz-card-meta">
          <span>
            <Icon name="BookOpen" size={14} />
            {quiz.questionCount} questions
          </span>
          <i />
          <span>
            <Icon name="Clock" size={14} />
            {quiz.duration} min
          </span>
          <span
            className={`quiz-price ${quiz.pricing?.coinPrice ? "premium" : "free"}`}
          >
            <Icon
              name={quiz.pricing?.coinPrice ? "Coins" : "Sparkles"}
              size={17}
            />
            {quiz.pricing?.coinPrice
              ? `${quiz.pricing.coinPrice} coins`
              : "Free entry"}{" "}
            <Icon name="ArrowUpRight" size={17} />
          </span>
        </div>
      </div>
    </article>
  );
}
