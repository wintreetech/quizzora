import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  Spinner,
  ErrorNote,
  copy,
  Modal,
  duration,
  categoryIcons,
  SpendConfirmation,
  participationKey,
  clearParticipationKey,
} from "../lib";
import { EditorialCover } from "../components/BrandArtwork";
import type { Quiz, Attempt, Question } from "../types";
export function QuizDetail() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { user, auth, toast } = useApp();
  const client = useQueryClient();
  const { data: access } = useQuery({
    queryKey: ["quiz-access", id, user?.id],
    queryFn: () => api(`/quizzes/${id}/access`),
    staleTime: 0,
  });
  const [spend, setSpend] = useState<any>(null),
    [preview, setPreview] = useState<any>(null);
  const {
    data: q,
    isPending,
    error,
  } = useQuery({
    queryKey: ["quiz", id],
    queryFn: () => api<Quiz>(`/quizzes/${id}`),
  });
  const [busy, setBusy] = useState(false),
    [errorText, setError] = useState(""),
    [report, setReport] = useState(false);
  async function start() {
    if (!user)
      return auth("login", () => {
        void startSignedIn();
      });
    await startSignedIn();
  }
  async function startSignedIn(consent?: any) {
    setBusy(true);
    try {
      if (!consent) {
        const quote = await api(`/quizzes/${id}/access`);
        if (quote.charge > 0) {
          setSpend(quote);
          return;
        }
      }
      const attempt = await api<Attempt>(
        `/quizzes/${id}/attempts`,
        "POST",
        consent || { requestKey: participationKey(`quiz:${id}`) },
      );
      clearParticipationKey(`quiz:${id}`);
      client.invalidateQueries({ queryKey: ["wallet"] });
      client.invalidateQueries({ queryKey: ["wallet-history"] });
      client.invalidateQueries({ queryKey: ["quiz-access"] });
      navigate(`/play/${attempt.id}`);
    } catch (e) {
      setError((e as Error).message);
      if (consent) throw e;
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <Spinner />;
  if (error || !q)
    return <ErrorNote message={error?.message || "Quiz unavailable."} />;
  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        <Icon name="ArrowRight" className="back-arrow" size={16} /> Back to
        discovering
      </Link>
      <div className="quiz-detail-grid">
        <div className="detail-cover">
          <EditorialCover kind={q.cover} />
          <span className="detail-cover-caption">
            A GOOD QUESTION CHANGES EVERYTHING.
          </span>
        </div>
        <div className="quiz-detail-info">
          <span className="eyebrow">
            {q.category.toUpperCase()} <span>◈</span>{" "}
            {q.pricing?.coinPrice ? "PREMIUM QUIZ" : "FREE INTRODUCTION"}
          </span>
          <h1>{q.title}</h1>
          <p className="detail-description">{q.description}</p>
          <div className="quiz-access-panel">
            <div>
              <span>
                {access?.resumeAttemptId
                  ? "YOUR ACTIVE ATTEMPT"
                  : access?.remainingIncludedAttempts
                    ? "INCLUDED IN YOUR ACCESS"
                    : "OFFICIAL ENTRY"}
              </span>
              <strong>
                <Icon
                  name={q.pricing?.coinPrice ? "Coins" : "Sparkles"}
                  size={26}
                />
                {access?.resumeAttemptId
                  ? "Resume · no new charge"
                  : access?.remainingIncludedAttempts
                    ? `${access.remainingIncludedAttempts} included attempts left`
                    : q.pricing?.coinPrice
                      ? `${q.pricing.coinPrice} coins`
                      : "Free entry"}
              </strong>
            </div>
            <span>
              {q.pricing?.coinPrice
                ? `${q.pricing.includedAttempts} official attempt${q.pricing.includedAttempts === 1 ? "" : "s"} included. New purchases require confirmation.`
                : "A complete introduction. No coins needed."}
            </span>
          </div>
          <div className="detail-stats">
            <span>
              <Icon name="BookOpen" />
              <b>{q.questionCount}</b> questions
            </span>
            <span>
              <Icon name="Clock" />
              <b>{q.duration}</b> minutes
            </span>
            <span>
              <Icon name="Target" />
              <b>{q.difficulty}</b> difficulty
            </span>
          </div>
          <div className="play-rules">
            <h3>A fair game. Every time.</h3>
            <p>
              <Icon name="CheckCircle2" size={17} /> 100 points for each correct
              answer.
            </p>
            <p>
              <Icon name="CheckCircle2" size={17} /> One timed question at a
              time. Your answers lock in.
            </p>
            <p>
              <Icon name="CheckCircle2" size={17} /> Multiple-answer questions
              need every correct choice.
            </p>
            <p>
              <Icon name="CheckCircle2" size={17} /> See your results and
              explanations when you finish.
            </p>
          </div>
          {errorText && <ErrorNote message={errorText} />}
          <button
            className="btn primary full large"
            onClick={start}
            disabled={busy || access?.available === false}
          >
            {busy ? (
              <Spinner small />
            ) : (
              <>
                <Icon name="Play" size={21} />{" "}
                {access?.resumeAttemptId
                  ? "Resume your attempt"
                  : access?.remainingIncludedAttempts
                    ? "Use an included attempt"
                    : q.pricing?.coinPrice
                      ? `Start premium quiz · ${q.pricing.coinPrice} coins`
                      : "Let’s see what you know"}{" "}
                <Icon name="ArrowRight" size={18} />
              </>
            )}
          </button>
          {q.pricing?.accessType === "FREE_PREVIEW_THEN_PAID" && (
            <button
              className="btn outline full"
              onClick={async () => {
                try {
                  setPreview(await api(`/quizzes/${id}/preview`));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Icon name="Eye" size={19} />
              Try the unscored preview
            </button>
          )}
          <p className="entry-policy-note">
            {q.pricing?.coinPrice
              ? "No automatic retry charge. Existing paid attempts can be resumed. Only verified platform launch failures are eligible for entry refunds."
              : "Play the full quiz free. Premium entry coins, when applicable, never change scoring."}
          </p>
          <button
            className="btn outline full"
            onClick={async () => {
              if (!user) return auth("login");
              try {
                const c = await api("/challenges", "POST", { quizId: id });
                const url = `${window.location.origin}/challenge/${c.code}`;
                navigate(`/challenge/${c.code}`);
                await copy(url);
                toast("Challenge link copied. Send it to your rival.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <Icon name="Users" size={17} /> Challenge a friend
          </button>
          <div className="quiz-eligibility">
            <span>
              <Icon name="Shield" size={14} /> For curious minds aged 18+
            </span>
            <button
              className="text-btn"
              onClick={() => (user ? setReport(true) : auth("login"))}
            >
              Report a problem
            </button>
          </div>
        </div>
      </div>
      {spend && (
        <SpendConfirmation
          title={q.title}
          coinPrice={spend.charge}
          version={spend.pricing.version}
          includedAttempts={spend.pricing.includedAttempts}
          requestKey={participationKey(`quiz:${id}`)}
          close={() => setSpend(null)}
          confirm={startSignedIn}
        />
      )}
      {preview && (
        <Modal
          title="Unscored quiz preview"
          close={() => setPreview(null)}
          wide
        >
          <span className="eyebrow">A TASTE OF THE EXPERIENCE · NO SCORE</span>
          <h2>{preview.title}</h2>
          <p className="muted">
            Try these sample questions. Answer keys and explanations are
            reserved for completed official attempts.
          </p>
          {preview.questions.map((q: Question) => (
            <div className="preview-question" key={q.id}>
              <h3>{q.prompt}</h3>
              <div>
                {q.options.map((o, i) => (
                  <span key={i}>
                    {String.fromCharCode(65 + i)} · {o}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="quiz-access-panel">
            <strong>
              Unlock the complete quiz for {preview.pricing.coinPrice} coins.
            </strong>
            <span>An official attempt requires separate confirmation.</span>
          </div>
          <button
            className="btn primary full"
            onClick={() => {
              setPreview(null);
              void start();
            }}
          >
            View official entry <Icon name="ArrowRight" size={19} />
          </button>
        </Modal>
      )}
      <div className="detail-note">
        <Icon name="Sparkles" size={22} />
        <p>
          Take a breath. Trust your instincts. You probably know more than you
          think.
        </p>
      </div>
      {report && (
        <Modal title="Report this quiz" close={() => setReport(false)}>
          <h2>Help keep things good.</h2>
          <p className="muted">Tell us what needs a closer look.</p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/reports", "POST", {
                  targetId: id,
                  reason: new FormData(e.currentTarget).get("reason"),
                });
                toast("Report saved for the moderation team.");
                setReport(false);
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <label>
              What’s the issue?
              <textarea
                name="reason"
                required
                minLength={10}
                maxLength={2000}
                rows={5}
              />
            </label>
            <button className="btn primary">
              Submit report <Icon name="Send" size={17} />
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function QuestionChoices({
  question,
  selected,
  setSelected,
  text,
  setText,
  disabled = false,
}: {
  question: Question;
  selected: number[];
  setSelected: (n: number[]) => void;
  text: string;
  setText: (s: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {question.image && (
        <img
          className="question-image"
          src={question.image}
          alt="Question illustration"
        />
      )}
      <h2 className="question-prompt">{question.prompt}</h2>
      <p className="question-instruction">
        {question.type === "multiple"
          ? "A few things can be true. Select all correct answers."
          : question.type === "text"
            ? "Type your answer. Case and extra spaces don’t matter."
            : "Trust your instincts. Choose one answer."}
      </p>
      {question.type === "text" ? (
        <input
          className="text-answer"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={200}
          placeholder="Your answer…"
          aria-label="Your answer"
        />
      ) : (
        <div className="answer-grid">
          {question.options.map((option, i) => (
            <button
              key={`${question.id}-${i}`}
              disabled={disabled}
              className={`answer-option ${selected.includes(i) ? "selected" : ""}`}
              onClick={() =>
                setSelected(
                  question.type === "multiple"
                    ? selected.includes(i)
                      ? selected.filter((n) => n !== i)
                      : [...selected, i]
                    : [i],
                )
              }
              aria-pressed={selected.includes(i)}
            >
              <span className="option-letter">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{option}</span>
              <span className="option-check">
                {selected.includes(i) && <Icon name="Check" size={17} />}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
export function QuizPlayer() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { user, auth } = useApp(),
    client = useQueryClient();
  const {
    data: a,
    isPending,
    error,
  } = useQuery({
    queryKey: ["attempt", id],
    queryFn: () => api<Attempt>(`/attempts/${id}`),
    enabled: !!user,
    retry: false,
  });
  const [selected, setSelected] = useState<number[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [now, setNow] = useState(Date.now()),
    [offset, setOffset] = useState(0),
    [end, setEnd] = useState(false),
    [endError, setEndError] = useState("");
  const advancing = useRef(false);
  useEffect(() => {
    if (a?.status === "active")
      void api(`/attempts/${id}/launched`, "POST").catch(() => {});
  }, [id, a?.status]);
  useEffect(() => {
    if (a) {
      setOffset(a.serverTime - Date.now());
      setSelected([]);
      setText("");
      setErr("");
      if (a.status !== "active")
        navigate(`/results/${a.id}`, { replace: true });
    }
  }, [a?.index, a?.status]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remaining = a
    ? Math.max(
        0,
        Math.ceil((new Date(a.deadline).getTime() - now - offset) / 1000),
      )
    : 0;
  async function send(expired = false) {
    if (!a || advancing.current) return;
    advancing.current = true;
    setBusy(true);
    setErr("");
    try {
      const result = await api<Attempt>(
        `/attempts/${id}/${expired ? "advance" : "answer"}`,
        "POST",
        expired ? {} : { questionId: a.question!.id, selected, text },
      );
      client.setQueryData(["attempt", id], result);
    } catch (e) {
      const error = e as Error;
      setErr(error.message);
      if (error.message.includes("deadline")) {
        await client.invalidateQueries({ queryKey: ["attempt", id] });
      }
    } finally {
      advancing.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (a?.status === "active" && remaining === 0 && !advancing.current) {
      const t = setTimeout(() => send(true), 300);
      return () => clearTimeout(t);
    }
  }, [remaining, a?.index, a?.status]);
  if (!user)
    return (
      <div className="page-gate">
        <Icon name="Lock" size={32} />
        <h1>Your next question is waiting.</h1>
        <button className="btn primary" onClick={() => auth("login")}>
          Sign in to play
        </button>
      </div>
    );
  if (isPending) return <Spinner />;
  if (error || !a)
    return <ErrorNote message={error?.message || "Attempt not found."} />;
  if (!a.question) return <Spinner />;
  return (
    <div className="player-wrap">
      <div className="player-top">
        <Link to="/" className="brand mini-brand">
          <span className="brand-mark">
            q<em>✦</em>
          </span>
          <span>In your element.</span>
        </Link>
        <button className="text-btn subtle" onClick={() => setEnd(true)}>
          Finish early <Icon name="X" size={16} />
        </button>
      </div>
      <div className="player-progress">
        <span style={{ width: `${(a.index / a.total) * 100}%` }} />
      </div>
      <div className="question-meta">
        <span className="eyebrow">
          QUESTION {String(a.index + 1).padStart(2, "0")}{" "}
          <span className="muted">/ {String(a.total).padStart(2, "0")}</span>
        </span>
        <span className={`question-timer ${remaining <= 5 ? "urgent" : ""}`}>
          <Icon name="Clock" size={18} />
          {remaining}
          <small>SEC</small>
        </span>
      </div>
      <span className="player-quiz-title">{a.title}</span>
      <QuestionChoices
        key={a.question.id}
        question={a.question}
        selected={selected}
        setSelected={setSelected}
        text={text}
        setText={setText}
        disabled={busy || remaining === 0}
      />
      {err && <ErrorNote message={err} />}
      <div className="player-bottom">
        <p>
          <Icon name="Lock" size={14} /> Your answer is final once you lock it
          in.
        </p>
        <button
          className="btn primary large"
          disabled={
            busy || remaining === 0 || (!selected.length && !text.trim())
          }
          onClick={() => send()}
        >
          {busy ? <Spinner small /> : "Lock in my answer"}
          <Icon name="ArrowRight" size={18} />
        </button>
      </div>
      <p className="player-fair">
        <Icon name="Shield" size={14} /> Fair play, powered by server-verified
        timing and scoring.
      </p>
      {end && (
        <Modal title="Finish your quiz?" close={() => !busy && setEnd(false)}>
          <div className="modal-symbol">
            <Icon name="Flag" size={28} />
          </div>
          <h2>Call it a round?</h2>
          <p className="muted">
            Your recorded answers will count. Any remaining questions will score
            zero.
          </p>
          {endError && <ErrorNote message={endError} />}
          <button
            className="btn primary full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setEndError("");
              try {
                const result = await api<Attempt>(`/attempts/${id}/finish`, "POST");
                client.setQueryData(["attempt", id], result);
                navigate(`/results/${id}`);
              } catch (error) {
                setEndError((error as Error).message);
              } finally { setBusy(false); }
            }}
          >
            Finish & see my result <Icon name="ArrowRight" size={17} />
          </button>
          <button className="btn outline full" disabled={busy} onClick={() => setEnd(false)}>
            Keep going
          </button>
        </Modal>
      )}
    </div>
  );
}
export function Results() {
  const { id } = useParams(),
    { user, auth, toast } = useApp(),
    navigate = useNavigate();
  const {
    data: a,
    isPending,
    error,
  } = useQuery({
    queryKey: ["attempt", id],
    queryFn: () => api<Attempt>(`/attempts/${id}`),
    enabled: !!user,
  });
  const { data: replay } = useQuery({
    queryKey: ["quiz-access", a?.quizId, user?.id, "replay"],
    queryFn: () => api(`/quizzes/${a!.quizId}/access`),
    staleTime: 0,
    enabled: !!user && !!a && a.status !== "active",
  });
  if (!user)
    return (
      <div className="page-gate">
        <h1>A result worth coming back for.</h1>
        <button className="btn primary" onClick={() => auth("login")}>
          Sign in to view
        </button>
      </div>
    );
  if (isPending) return <Spinner />;
  if (error || !a)
    return <ErrorNote message={error?.message || "Result not found."} />;
  if (a.status === "active")
    return (
      <div className="page-gate">
        <h1>There’s still more to discover.</h1>
        <Link to={`/play/${id}`} className="btn primary">
          Continue your quiz
        </Link>
      </div>
    );
  if (a.status === "platform_failure")
    return (
      <div className="page-gate">
        <h1>Your entry coins were restored.</h1>
        <p>
          This failed launch has been closed. Check your wallet for the refund
          record.
        </p>
        <Link to="/wallet" className="btn primary">
          View wallet
        </Link>
      </div>
    );
  return (
    <div className="results-page">
      <div className="results-summary">
        <div className="result-medal">
          <Icon name={a.accuracy >= 80 ? "Trophy" : "Sparkles"} size={43} />
          <span>✦</span>
        </div>
        <span className="eyebrow">ANOTHER QUESTION. A LITTLE WISER.</span>
        <h1>
          {a.accuracy === 100
            ? "A perfect little moment."
            : a.accuracy >= 60
              ? "Look at that bright mind."
              : "Curiosity looks good on you."}
        </h1>
        <p>{a.title}</p>
        <div className="result-stats">
          <div>
            <strong>
              {a.score}
              <small> pts</small>
            </strong>
            <span>Total score</span>
          </div>
          <div>
            <strong>
              {a.accuracy}
              <small>%</small>
            </strong>
            <span>Accuracy</span>
          </div>
          <div>
            <strong>
              {a.correctCount}
              <small> / {a.total}</small>
            </strong>
            <span>Correct answers</span>
          </div>
          <div>
            <strong>{duration(a.elapsedMs)}</strong>
            <span>Time taken</span>
          </div>
        </div>
        <div className="result-buttons">
          <button
            className="btn primary"
            onClick={() => navigate(`/quiz/${a.quizId}`)}
          >
            {replay
              ? replay.charge > 0
                ? `Replay — ${replay.charge} coins`
                : replay.remainingIncludedAttempts
                  ? "Use included replay"
                  : "Replay for free"
              : "Review replay price"}{" "}
            <Icon name="RotateCcw" size={16} />
          </button>
          <button
            className="btn outline"
            onClick={async () => {
              try {
                await copy(
                  `I scored ${a.score} points with ${a.accuracy}% accuracy on “${a.title}”! Try it: ${window.location.origin}/quiz/${a.quizId}`,
                );
                toast("Result copied. Go spread a little curiosity.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <Icon name="Copy" size={16} /> Share my result
          </button>
          <Link className="text-btn" to="/">
            Find my next quiz <Icon name="ArrowRight" size={16} />
          </Link>
        </div>
      </div>
      <div className="section-heading review-heading">
        <div>
          <h2>The aha behind the answers</h2>
          <p>A good question deserves a good explanation.</p>
        </div>
        <span className="count-pill">{a.total} questions</span>
      </div>
      <div className="answer-review">
        {a.review?.map((q, i) => (
          <details
            key={q.id}
            className={`review-item ${q.submitted?.correct ? "is-correct" : "is-incorrect"}`}
          >
            <summary>
              <span className="review-result">
                <Icon name={q.submitted?.correct ? "Check" : "X"} size={18} />
              </span>
              <span>
                <small>
                  QUESTION {i + 1} ·{" "}
                  {q.submitted?.correct
                    ? "CORRECT"
                    : q.submitted
                      ? "INCORRECT"
                      : "UNANSWERED"}
                </small>
                <b>{q.prompt}</b>
              </span>
              <Icon name="ChevronDown" size={18} />
            </summary>
            <div className="review-content">
              <p>
                <b>Your answer:</b>{" "}
                {q.submitted
                  ? q.type === "text"
                    ? q.submitted.text
                    : q.submitted.selected.map((n) => q.options[n]).join(", ")
                  : "No answer submitted"}
              </p>
              <p>
                <b>Correct answer:</b>{" "}
                {q.type === "text"
                  ? q.acceptedText?.join(" / ")
                  : q.correct?.map((n) => q.options[n]).join(", ")}
              </p>
              <div className="explanation">
                <Icon name="Sparkles" size={17} />
                <span>{q.explanation}</span>
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
