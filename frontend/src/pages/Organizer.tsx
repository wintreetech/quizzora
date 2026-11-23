import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  Icon,
  useApp,
  Spinner,
  ErrorNote,
  Empty,
  Modal,
  date,
  API,
  newRequestKey,
} from "../lib";
import { Gate } from "./Player";
import type { Quiz, Question } from "../types";
const newQuestion = (): Question => ({
  id: newRequestKey(),
  type: "single",
  prompt: "",
  options: ["", "", "", ""],
  correct: [0],
  explanation: "",
  seconds: 25,
});
const initialQuiz = {
  title: "",
  description: "",
  category: "General Knowledge",
  difficulty: "Medium",
  cover: "space",
  visibility: "public",
  status: "draft",
  questions: [newQuestion()],
};
export function Organizer() {
  const [params, setParams] = useSearchParams();
  const { user, toast } = useApp(),
    client = useQueryClient(),
    navigate = useNavigate();
  const [tab, setTab] = useState("Overview"),
    [editing, setEditing] = useState<string | undefined | null>(null),
    [hosting, setHosting] = useState(false),
    [busy, setBusy] = useState(false);
  const can = user?.role === "ORGANIZER" || user?.role === "SUPER_ADMIN";
  useEffect(() => {
    const id = params.get("edit");
    if (id && /^[a-f0-9]{24}$/.test(id) && can) setEditing(id);
  }, [params.get("edit"), can]);
  useEffect(() => {
    const section = params.get("section");
    if (!section) setTab("Overview");
    else if (
      [
        "Overview",
        "My quizzes",
        "Question bank",
        "Competitions",
        "Reports",
        "Subscription",
      ].includes(section)
    )
      setTab(section);
  }, [params.get("section")]);
  const {
    data: overview,
    isPending,
    error,
  } = useQuery({
    queryKey: ["organizer"],
    queryFn: () => api("/organizer/overview"),
    enabled: can,
  });
  const { data: quizzes } = useQuery({
    queryKey: ["owned-quizzes"],
    queryFn: () => api<{ items: Quiz[] }>("/organizer/quizzes"),
    enabled: can,
  });
  if (!user) return <Gate title="Your next great quiz night starts here." />;
  if (!can)
    return (
      <Empty
        icon="Lock"
        title="A seat for the host."
        description="Turn your ideas into a quiz night. Enable creator tools to make questions and bring people together."
      >
        <button
          className="btn primary"
          onClick={async () => {
            try {
              await api("/auth/organizer-access", "POST");
              await client.invalidateQueries({ queryKey: ["me"] });
              toast("Your host era starts here. Creator tools enabled.");
            } catch (e) {
              toast((e as Error).message);
            }
          }}
        >
          Enable creator tools <Icon name="ArrowUpRight" size={17} />
        </button>
      </Empty>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />
            THE IDEAS ARE YOURS. THE TOOLS ARE HERE.
          </span>
          <h1>Your creator studio.</h1>
          <p>
            Make good questions. Gather good people. Host something worth
            remembering.
          </p>
        </div>
        <div className="heading-buttons">
          <button className="btn outline" onClick={() => setHosting(true)}>
            <Icon name="Radio" size={17} /> Host a competition
          </button>
          <button className="btn primary" onClick={() => setEditing(undefined)}>
            <Icon name="Plus" size={17} /> Create quiz
          </button>
        </div>
      </div>
      <div className="tab-row management-tabs">
        {[
          "Overview",
          "My quizzes",
          "Question bank",
          "Competitions",
          "Reports",
          "Subscription",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              setTab(t);
              setParams({ section: t });
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : (
        <>
          {tab === "Overview" && (
            <>
              <div className="stat-grid">
                {[
                  ["BookOpen", "Quizzes created", overview?.quizzes],
                  ["CheckCircle2", "Published quizzes", overview?.published],
                  ["Radio", "Events hosted", overview?.events],
                  ["Users", "Participants reached", overview?.participants],
                ].map(([icon, label, value]: any) => (
                  <div className="stat-card" key={label}>
                    <span className="stat-icon">
                      <Icon name={icon} />
                    </span>
                    <span>{label}</span>
                    <strong>{value || 0}</strong>
                    <small>A little progress, well made.</small>
                  </div>
                ))}
              </div>
              <div className="studio-welcome panel">
                <span className="studio-star">✷</span>
                <div>
                  <span className="eyebrow">
                    A GREAT QUIZ STARTS WITH A LITTLE IDEA
                  </span>
                  <h2>What will you bring people together for?</h2>
                  <p>
                    A movie night, a team social, or a friendly rivalry. Start
                    with a few good questions.
                  </p>
                  <button
                    className="btn primary"
                    onClick={() => setEditing(undefined)}
                  >
                    Make my first question{" "}
                    <Icon name="ArrowUpRight" size={17} />
                  </button>
                </div>
              </div>
              <h2 className="block-heading">Your recent creations</h2>
            </>
          )}
          {["My quizzes", "Overview"].includes(tab) &&
            (quizzes?.items.length ? (
              <div className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Quiz</th>
                      <th>Status</th>
                      <th>Questions</th>
                      <th>Visibility</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.items.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <b>{q.title}</b>
                          <small>
                            {q.category} · {q.difficulty}
                          </small>
                        </td>
                        <td>
                          <span className={`badge ${q.status}`}>
                            {q.status}
                          </span>
                        </td>
                        <td>{q.questionCount}</td>
                        <td>{q.visibility}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="text-btn"
                              onClick={() => setEditing(q.id)}
                            >
                              Edit <Icon name="ArrowUpRight" size={14} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Duplicate quiz"
                              aria-label={`Duplicate ${q.title}`}
                              onClick={async () => {
                                try {
                                  const c = await api(
                                    `/organizer/quizzes/${q.id}/duplicate`,
                                    "POST",
                                  );
                                  client.invalidateQueries({
                                    queryKey: ["owned-quizzes"],
                                  });
                                  setEditing(c.id);
                                  toast("A fresh copy, ready for your ideas.");
                                } catch (e) {
                                  toast((e as Error).message);
                                }
                              }}
                            >
                              <Icon name="Copy" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                icon="BookOpen"
                title="Your next great question starts here."
                description="Create a draft, add your questions, and publish when it feels right."
              >
                <button
                  className="btn primary"
                  onClick={() => setEditing(undefined)}
                >
                  Create my first quiz <Icon name="Plus" size={17} />
                </button>
              </Empty>
            ))}
          {tab === "Question bank" && (
            <QuestionBank quizzes={quizzes?.items || []} edit={setEditing} />
          )}{" "}
          {["Competitions", "Reports"].includes(tab) && (
            <>
              <div className="section-heading">
                <div>
                  <h2>
                    {tab === "Reports"
                      ? "The story behind the competition."
                      : "Your people, in one place."}
                  </h2>
                  <p>
                    {tab === "Reports"
                      ? `${overview?.attempts || 0} solo completions · ${overview?.averageAccuracy || 0}% average accuracy across your quizzes`
                      : "Open a room and share a code. The good questions are on you."}
                  </p>
                </div>
                {tab === "Competitions" && (
                  <button
                    className="btn primary"
                    onClick={() => setHosting(true)}
                  >
                    Open a room <Icon name="Plus" size={16} />
                  </button>
                )}
              </div>
              {overview?.competitions.length ? (
                <div className="panel table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Competition</th>
                        <th>Code</th>
                        <th>Status</th>
                        <th>Players</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {overview.competitions.map((c: any) => (
                        <tr key={c.id}>
                          <td>
                            <b>{c.title}</b>
                            <small>
                              {c.startsAt
                                ? date(c.startsAt)
                                : "Start when you’re ready"}
                            </small>
                          </td>
                          <td>
                            <code>{c.code}</code>
                          </td>
                          <td>
                            <span className="badge">{c.status}</span>
                          </td>
                          <td>
                            {c.participantCount}/{c.capacity}
                          </td>
                          <td>
                            {tab === "Reports" ? (
                              <a
                                className="text-btn"
                                href={`${API}/api/organizer/competitions/${c.id}/export`}
                              >
                                <Icon name="Download" size={15} /> Export CSV
                              </a>
                            ) : (
                              <Link className="text-btn" to={`/live/${c.id}`}>
                                Host room <Icon name="ArrowUpRight" size={15} />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  icon="Radio"
                  title="A little quiet, for now."
                  description="Your hosted competitions and their verified results will appear here."
                />
              )}
            </>
          )}
          {tab === "Subscription" && (
            <div className="panel membership-panel">
              <span className="eyebrow">YOUR ROOM TO CREATE</span>
              <h2>Free to bring people together.</h2>
              <p>
                Your free organizer plan includes quiz creation, small live
                competitions, and results exports. Paid upgrades are not
                currently available.
              </p>
              <Link className="btn outline" to="/hosting">
                Explore memberships <Icon name="ArrowUpRight" size={16} />
              </Link>
            </div>
          )}
        </>
      )}
      {editing !== null && (
        <QuizBuilder
          quizId={editing}
          close={() => setEditing(null)}
          done={() => {
            setEditing(null);
            setTab("My quizzes");
            client.invalidateQueries({ queryKey: ["owned-quizzes"] });
            client.invalidateQueries({ queryKey: ["organizer"] });
            client.invalidateQueries({ queryKey: ["quizzes"] });
          }}
        />
      )}
      {hosting && (
        <HostModal
          close={() => setHosting(false)}
          done={(id) => {
            setHosting(false);
            navigate(`/live/${id}`);
          }}
        />
      )}
    </>
  );
}
export function QuizBuilder({
  quizId,
  close,
  done,
}: {
  quizId?: string;
  close: () => void;
  done: () => void;
}) {
  const { toast } = useApp();
  const {
    data: existing,
    isPending,
    error,
  } = useQuery({
    queryKey: ["edit-quiz", quizId],
    queryFn: () => api(`/organizer/quizzes/${quizId}`),
    enabled: !!quizId,
  });
  if (quizId && isPending)
    return (
      <Modal title="Load quiz" close={close}>
        <Spinner />
      </Modal>
    );
  if (error)
    return (
      <Modal title="Quiz unavailable" close={close}>
        <ErrorNote message={error.message} />
      </Modal>
    );
  return (
    <BuilderForm
      initial={existing || initialQuiz}
      quizId={quizId}
      close={close}
      done={() => {
        toast("Your quiz is saved. A good question is a good start.");
        done();
      }}
    />
  );
}
function BuilderForm({
  initial,
  quizId,
  close,
  done,
}: {
  initial: any;
  quizId?: string;
  close: () => void;
  done: () => void;
}) {
  const { user } = useApp();
  const isAdmin = user?.role === "SUPER_ADMIN";
  const [quiz, setQuiz] = useState<any>(() => ({
      ...structuredClone(initial),
      pricing: initial.pricing || {
        accessType: "FREE",
        coinPrice: 0,
        includedAttempts: 1,
        previewQuestions: 0,
        available: true,
      },
    })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(false);
  const { data: configuration } = useQuery({
    queryKey: ["config"],
    queryFn: () => api("/config"),
  });
  function updateQuestion(index: number, data: Partial<Question>) {
    setQuiz((v: any) => ({
      ...v,
      questions: v.questions.map((q: Question, i: number) =>
        i === index ? { ...q, ...data } : q,
      ),
    }));
  }
  async function importCsv(file: File) {
    if (file.size > 256000) {
      setError("Please keep CSV imports below 256 KB.");
      return;
    }
    try {
      const rows = parseCSV(await file.text());
      const header = rows.shift()?.map((s) => s.trim().toLowerCase()) || [];
      const parsed = rows
        .filter((r) => r.some(Boolean))
        .map((r) => {
          const get = (key: string) => r[header.indexOf(key)] || "";
          return {
            id: newRequestKey(),
            prompt: get("prompt"),
            type: get("type") || "single",
            options: get("options").split("|"),
            correct: get("correct")
              .split("|")
              .map((v) => Number(v) - 1),
            explanation: get("explanation"),
            seconds: Number(get("seconds") || 25),
          };
        });
      await api("/organizer/validate-questions", "POST", { questions: parsed });
      setQuiz((v: any) => ({
        ...v,
        questions: [
          ...v.questions.filter((q: Question) => q.prompt.trim()),
          ...parsed,
        ],
      }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title={quizId ? "Edit your quiz" : "Create a quiz"}
      close={close}
      wide
    >
      <div className="builder-heading">
        <div>
          <span className="eyebrow">A LITTLE IDEA. A GREAT QUIZ.</span>
          <h2>
            {quizId
              ? "Make a good thing better."
              : "What’s on your curious mind?"}
          </h2>
        </div>
        <span className="badge">{quiz.status}</span>
      </div>
      <form
        className="form-stack builder-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            await api(
              quizId ? `/organizer/quizzes/${quizId}` : "/organizer/quizzes",
              quizId ? "PUT" : "POST",
              isAdmin ? quiz : { ...quiz, pricing: undefined },
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
          Give your quiz a name
          <input
            required
            minLength={3}
            maxLength={120}
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            placeholder="Something that makes people curious"
          />
        </label>
        <label>
          A little introduction
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={3}
            value={quiz.description}
            onChange={(e) => setQuiz({ ...quiz, description: e.target.value })}
            placeholder="What’s in store for your players?"
          />
        </label>
        <div className="form-columns">
          <label>
            Category
            <select
              value={quiz.category}
              onChange={(e) => setQuiz({ ...quiz, category: e.target.value })}
            >
              {(configuration?.categories || ["General Knowledge"]).map(
                (c: string) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Difficulty
            <select
              value={quiz.difficulty}
              onChange={(e) => setQuiz({ ...quiz, difficulty: e.target.value })}
            >
              <option>Easy</option>
              <option>Medium</option>
              <option>Hard</option>
            </select>
          </label>
        </div>
        <div className="form-columns">
          <label>
            Cover artwork
            <select
              value={quiz.cover}
              onChange={(e) => setQuiz({ ...quiz, cover: e.target.value })}
            >
              {[
                "space",
                "cinema",
                "tech",
                "world",
                "music",
                "sport",
                "history",
                "business",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Visibility
            <select
              value={quiz.visibility}
              onChange={(e) => setQuiz({ ...quiz, visibility: e.target.value })}
            >
              <option value="public">Public</option>
              <option value="private">Private — host only</option>
            </select>
          </label>
        </div>
        {isAdmin && (
          <fieldset className="quiz-author-pricing">
            <legend>Quiz entry pricing</legend>
            <div className="form-columns">
              <label>
                Access mode
                <select
                  value={
                    quiz.pricing.accessType === "UNCONFIGURED"
                      ? ""
                      : quiz.pricing.accessType
                  }
                  required
                  onChange={(e) =>
                    setQuiz({
                      ...quiz,
                      pricing: {
                        ...quiz.pricing,
                        accessType: e.target.value,
                        coinPrice:
                          e.target.value === "FREE"
                            ? 0
                            : Math.max(1, quiz.pricing.coinPrice),
                        previewQuestions:
                          e.target.value === "FREE_PREVIEW_THEN_PAID" ? 1 : 0,
                      },
                    })
                  }
                >
                  <option value="" disabled>
                    Choose entry pricing
                  </option>
                  <option value="FREE">Free</option>
                  <option value="PAID_PER_ATTEMPT">Paid per attempt</option>
                  <option value="FREE_PREVIEW_THEN_PAID">
                    Free preview, paid attempt
                  </option>
                </select>
              </label>
              <label>
                Entry price in coins
                <input
                  type="number"
                  required
                  min={quiz.pricing.accessType === "FREE" ? 0 : 1}
                  max={100000}
                  step={1}
                  disabled={quiz.pricing.accessType === "FREE"}
                  value={quiz.pricing.coinPrice}
                  onChange={(e) =>
                    setQuiz({
                      ...quiz,
                      pricing: {
                        ...quiz.pricing,
                        coinPrice: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Included attempts
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  step={1}
                  value={quiz.pricing.includedAttempts}
                  onChange={(e) =>
                    setQuiz({
                      ...quiz,
                      pricing: {
                        ...quiz.pricing,
                        includedAttempts: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              {quiz.pricing.accessType === "FREE_PREVIEW_THEN_PAID" && (
                <label>
                  Preview questions
                  <input
                    type="number"
                    min={1}
                    max={2}
                    required
                    value={quiz.pricing.previewQuestions}
                    onChange={(e) =>
                      setQuiz({
                        ...quiz,
                        pricing: {
                          ...quiz.pricing,
                          previewQuestions: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              )}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={quiz.pricing.available}
                onChange={(e) =>
                  setQuiz({
                    ...quiz,
                    pricing: { ...quiz.pricing, available: e.target.checked },
                  })
                }
              />
              Allow new entries
            </label>
            <p className="muted">
              Publishing saves a versioned entry price. Existing paid attempts
              keep their original access.
            </p>
          </fieldset>
        )}
        <div className="builder-divider">
          <h3>
            The good questions{" "}
            <span className="count-pill">{quiz.questions.length}</span>
          </h3>
          <label className="csv-upload">
            <Icon name="Download" size={15} /> Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                if (e.target.files?.[0]) void importCsv(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <p className="csv-hint">
          CSV columns: prompt, options, correct, explanation, type, seconds.
          Separate options and correct answer numbers with |. Answers start at
          1.
        </p>
        {quiz.questions.map((q: Question, index: number) => (
          <fieldset className="question-editor" key={q.id}>
            <legend>QUESTION {String(index + 1).padStart(2, "0")}</legend>
            <div className="question-editor-tools">
              <button
                type="button"
                className="icon-btn"
                disabled={index === 0}
                aria-label={`Move question ${index + 1} up`}
                onClick={() => {
                  const qs = [...quiz.questions];
                  [qs[index - 1], qs[index]] = [qs[index], qs[index - 1]];
                  setQuiz({ ...quiz, questions: qs });
                }}
              >
                <Icon name="ChevronUp" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={index === quiz.questions.length - 1}
                aria-label={`Move question ${index + 1} down`}
                onClick={() => {
                  const qs = [...quiz.questions];
                  [qs[index + 1], qs[index]] = [qs[index], qs[index + 1]];
                  setQuiz({ ...quiz, questions: qs });
                }}
              >
                <Icon name="ChevronDown" size={16} />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                disabled={quiz.questions.length === 1}
                aria-label={`Delete question ${index + 1}`}
                onClick={() =>
                  setQuiz({
                    ...quiz,
                    questions: quiz.questions.filter(
                      (_: Question, i: number) => i !== index,
                    ),
                  })
                }
              >
                <Icon name="Trash2" size={15} />
              </button>
            </div>
            <label>
              Question
              <textarea
                required
                minLength={5}
                maxLength={1000}
                rows={2}
                value={q.prompt}
                onChange={(e) =>
                  updateQuestion(index, { prompt: e.target.value })
                }
                placeholder="Ask something worth knowing"
              />
            </label>
            <div className="form-columns">
              <label>
                Answer format
                <select
                  value={q.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    updateQuestion(index, {
                      type,
                      correct: [0],
                      ...(type === "boolean"
                        ? { options: ["True", "False"] }
                        : type === "text"
                          ? { options: [], correct: [], acceptedText: [""] }
                          : { options: ["", "", "", ""] }),
                    });
                  }}
                >
                  <option value="single">Single correct choice</option>
                  <option value="multiple">Multiple correct choices</option>
                  <option value="boolean">True or false</option>
                  <option value="text">Text answer</option>
                  <option value="image">Image with single choice</option>
                </select>
              </label>
              <label>
                Seconds to answer
                <input
                  type="number"
                  required
                  min={10}
                  max={180}
                  value={q.seconds}
                  onChange={(e) =>
                    updateQuestion(index, { seconds: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            {q.type === "image" && (
              <label>
                HTTPS image URL
                <input
                  type="url"
                  required
                  value={q.image || ""}
                  onChange={(e) =>
                    updateQuestion(index, { image: e.target.value })
                  }
                  placeholder="https://…"
                />
              </label>
            )}
            {q.type === "text" ? (
              <label>
                Accepted answers — one per line
                <textarea
                  required
                  value={q.acceptedText?.join("\n") || ""}
                  onChange={(e) =>
                    updateQuestion(index, {
                      acceptedText: e.target.value.split("\n"),
                    })
                  }
                  placeholder="Case-insensitive; extra whitespace is ignored"
                />
              </label>
            ) : (
              <div className="editor-answers">
                <span>
                  Mark the correct{" "}
                  {q.type === "multiple" ? "answers" : "answer"}.
                </span>
                {q.options.map((option, i) => (
                  <label className="editor-option" key={i}>
                    <input
                      type={q.type === "multiple" ? "checkbox" : "radio"}
                      name={`correct-${q.id}`}
                      checked={q.correct?.includes(i) || false}
                      aria-label={`Option ${i + 1} is correct for question ${index + 1}`}
                      onChange={() =>
                        updateQuestion(index, {
                          correct:
                            q.type === "multiple"
                              ? q.correct?.includes(i)
                                ? q.correct.filter((n) => n !== i)
                                : [...(q.correct || []), i]
                              : [i],
                        })
                      }
                    />
                    <span>{String.fromCharCode(65 + i)}</span>
                    <input
                      aria-label={`Option ${i + 1} for question ${index + 1}`}
                      required
                      maxLength={300}
                      value={option}
                      disabled={q.type === "boolean"}
                      onChange={(e) =>
                        updateQuestion(index, {
                          options: q.options.map((v, n) =>
                            n === i ? e.target.value : v,
                          ),
                        })
                      }
                    />
                    {q.options.length > 2 && (
                      <button
                        className="icon-btn"
                        type="button"
                        aria-label={`Remove option ${i + 1}`}
                        onClick={() =>
                          updateQuestion(index, {
                            options: q.options.filter((_, n) => n !== i),
                            correct: (q.correct || [])
                              .filter((n) => n !== i)
                              .map((n) => (n > i ? n - 1 : n)),
                          })
                        }
                      >
                        <Icon name="X" size={14} />
                      </button>
                    )}
                  </label>
                ))}
                {q.options.length < 8 && q.type !== "boolean" && (
                  <button
                    className="text-btn"
                    type="button"
                    onClick={() =>
                      updateQuestion(index, { options: [...q.options, ""] })
                    }
                  >
                    <Icon name="Plus" size={13} /> Add an option
                  </button>
                )}
              </div>
            )}
            <label>
              The aha behind the answer
              <textarea
                maxLength={2000}
                rows={2}
                value={q.explanation}
                onChange={(e) =>
                  updateQuestion(index, { explanation: e.target.value })
                }
                placeholder="Give your players a little insight"
              />
            </label>
          </fieldset>
        ))}
        <button
          className="btn outline full"
          type="button"
          disabled={quiz.questions.length >= 100}
          onClick={() =>
            setQuiz({ ...quiz, questions: [...quiz.questions, newQuestion()] })
          }
        >
          <Icon name="Plus" size={16} /> One more good question
        </button>
        {error && <ErrorNote message={error} />}
        <div className="builder-footer">
          <label>
            Status
            <select
              value={quiz.status}
              onChange={(e) => setQuiz({ ...quiz, status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button
            type="button"
            className="btn outline"
            onClick={() => setPreview(!preview)}
          >
            <Icon name="Eye" size={16} /> {preview ? "Hide" : "Preview"}
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <Spinner small />
            ) : (
              <>
                <Icon name="Check" size={17} /> Save{" "}
                {quiz.status === "published" ? "& publish" : "quiz"}
              </>
            )}
          </button>
        </div>
        {preview && (
          <div className="preview-panel">
            <span className="eyebrow">
              HOST PREVIEW · ANSWERS VISIBLE ONLY TO YOU
            </span>
            <h2>{quiz.title || "Your quiz title"}</h2>
            {quiz.questions.map((q: Question, i: number) => (
              <div key={q.id}>
                <h3>
                  {i + 1}. {q.prompt || "Your question goes here"}
                </h3>
                <p>
                  {q.type === "text"
                    ? q.acceptedText?.join(" / ")
                    : q.options
                        .filter((_, n) => q.correct?.includes(n))
                        .join(" / ")}
                </p>
                <small>{q.seconds} seconds · 100 points</small>
              </div>
            ))}
          </div>
        )}
      </form>
    </Modal>
  );
}
function parseCSV(source: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted field.");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
export function QuestionBank({
  quizzes,
  edit,
}: {
  quizzes: Quiz[];
  edit: (id: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const { data, isPending } = useQuery({
    queryKey: ["bank", selected],
    queryFn: () => api(`/organizer/quizzes/${selected}`),
    enabled: !!selected,
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>Keep your good questions close.</h2>
          <p>Browse question sets available to your account.</p>
        </div>
        <select
          className="form-input bank-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          aria-label="Select a quiz"
        >
          <option value="">Choose an available quiz</option>
          {quizzes.map((q) => (
            <option value={q.id} key={q.id}>
              {q.title}
            </option>
          ))}
        </select>
      </div>
      {!selected ? (
        <Empty
          icon="BookOpen"
          title="Every good question deserves a home."
          description="Select one of your quizzes to browse its questions and answer keys."
        />
      ) : isPending ? (
        <Spinner />
      ) : (
        <div className="bank-list">
          {data?.questions.map((q: Question, i: number) => (
            <div className="panel" key={q.id}>
              <span className="eyebrow">
                {i + 1} · {q.type.toUpperCase()} · {q.seconds} SEC
              </span>
              <h3>{q.prompt}</h3>
              <p>
                {q.type === "text"
                  ? q.acceptedText?.join(", ")
                  : q.correct?.map((n) => q.options[n]).join(", ")}
              </p>
              <small>{q.explanation}</small>
            </div>
          ))}
          <button className="btn primary" onClick={() => edit(selected)}>
            Edit this question set <Icon name="ArrowUpRight" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
export function HostModal({
  close,
  done,
}: {
  close: () => void;
  done: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["host-quizzes"],
    queryFn: () => api("/quizzes?limit=24"),
  });
  const { data: owned } = useQuery({
    queryKey: ["owned-quizzes"],
    queryFn: () => api("/organizer/quizzes"),
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const quizzes = [...(owned?.items || []), ...(data?.items || [])].filter(
    (q: Quiz, i: number, all: Quiz[]) =>
      q.status === "published" && all.findIndex((x) => x.id === q.id) === i,
  );
  return (
    <Modal title="Host a competition" close={close}>
      <div className="modal-symbol">
        <Icon name="Radio" size={27} />
      </div>
      <span className="eyebrow">YOUR PEOPLE. YOUR ROOM.</span>
      <h2>Make a night of it.</h2>
      <p className="muted">
        Pick a quiz, open a room, and bring your favorite minds together.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            const starts = f.get("startsAt") as string;
            const c = await api("/organizer/competitions", "POST", {
              title: f.get("title"),
              description: f.get("description"),
              quizId: f.get("quizId"),
              visibility: f.get("visibility"),
              capacity: Number(f.get("capacity")),
              ...(starts ? { startsAt: new Date(starts).toISOString() } : {}),
            });
            done(c.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Competition name
          <input
            required
            minLength={3}
            maxLength={120}
            name="title"
            placeholder="The Thursday night think-in"
          />
        </label>
        <label>
          A little about your event
          <textarea
            name="description"
            maxLength={1000}
            rows={2}
            placeholder="Set the mood for a good time"
          />
        </label>
        <label>
          Choose a published quiz
          <select required name="quizId">
            <option value="">Find your question set</option>
            {quizzes.map((q: Quiz) => (
              <option key={q.id} value={q.id}>
                {q.title} · {q.questionCount} questions
              </option>
            ))}
          </select>
        </label>
        <div className="form-columns">
          <label>
            Room visibility
            <select name="visibility">
              <option value="public">Public — anyone can discover</option>
              <option value="private">Private — invitation code only</option>
            </select>
          </label>
          <label>
            Player limit
            <input
              type="number"
              name="capacity"
              required
              min={2}
              max={25}
              defaultValue={25}
            />
          </label>
        </div>
        <label>
          Schedule it?{" "}
          <span className="field-note">
            Optional. Leave blank to start when you’re ready.
          </span>
          <input type="datetime-local" name="startsAt" />
        </label>
        {error && <ErrorNote message={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy ? <Spinner small /> : "Open my room"}
          <Icon name="ArrowRight" size={17} />
        </button>
      </form>
    </Modal>
  );
}
