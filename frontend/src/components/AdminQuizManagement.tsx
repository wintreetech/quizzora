import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, Icon, Spinner, ErrorNote, Modal, useApp } from "../lib";
import { QuizBuilder } from "../pages/Organizer";
import { QuizEntryBadge } from "./QuizCard";
export default function AdminQuizManagement() {
  const client = useQueryClient(),
    { toast } = useApp();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [access, setAccess] = useState("all"),
    [page, setPage] = useState(1);
  const [editing, setEditing] = useState<string | null | undefined>(),
    [category, setCategory] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [moderate, setModerate] = useState<any>(null),
    [reason, setReason] = useState(""),
    [nextStatus, setNextStatus] = useState("draft");
  const query = new URLSearchParams({
    q: search,
    status,
    access,
    page: String(page),
    limit: "15",
  });
  const {
    data,
    isPending,
    error: loadError,
  } = useQuery({
    queryKey: ["admin", "quiz-management", query.toString()],
    queryFn: () => api(`/admin/quizzes?${query}`),
    staleTime: 0,
  });
  async function refresh() {
    await Promise.all(
      [
        "admin",
        "quizzes",
        "quiz",
        "quiz-access",
        "edit-quiz",
        "organizer",
        "config",
      ].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  }
  return (
    <section className="admin-quiz-management">
      <div className="section-heading">
        <div>
          <h2>Quiz management</h2>
          <p className="muted">
            Publish clear prices. Keep every quiz discoverable.
          </p>
        </div>
        <div className="admin-quiz-actions">
          <button
            className="btn outline"
            onClick={() => {
              setCategory(true);
              setError("");
            }}
          >
            Add category
          </button>
          <button className="btn primary" onClick={() => setEditing(null)}>
            <Icon name="Plus" size={17} />
            Create quiz
          </button>
        </div>
      </div>
      <div className="admin-content-counts">
        {[
          ["total", "Total quizzes"],
          ["published", "Published"],
          ["draft", "Drafts"],
          ["free", "Free"],
          ["paid", "Paid"],
          ["review", "Pricing review"],
        ].map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>{data?.counts[key] ?? "—"}</strong>
          </div>
        ))}
      </div>
      <div className="catalogue-filters admin-content-filters">
        <label className="catalogue-search">
          <Icon name="Search" size={18} />
          <input
            aria-label="Search managed quizzes"
            placeholder="Search quiz titles"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Filter quiz status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select
          aria-label="Filter entry pricing"
          value={access}
          onChange={(event) => {
            setAccess(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All entry types</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
          <option value="review">Needs pricing review</option>
        </select>
      </div>
      {isPending ? (
        <Spinner />
      ) : loadError ? (
        <ErrorNote message={loadError.message} />
      ) : (
        <>
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Status</th>
                  <th>Entry price</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((quiz: any) => (
                  <tr key={quiz.id}>
                    <td>
                      <b>{quiz.title}</b>
                      <small>
                        {quiz.questionCount} questions · {quiz.visibility}
                      </small>
                    </td>
                    <td>
                      <span className="badge">{quiz.status}</span>
                    </td>
                    <td>
                      <QuizEntryBadge pricing={quiz.pricing} />
                      <small>
                        {quiz.pricing.configured
                          ? `Price version ${quiz.pricing.version}`
                          : "New attempts blocked"}
                      </small>
                    </td>
                    <td>{quiz.category}</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="text-btn"
                          onClick={() => setEditing(quiz.id)}
                        >
                          Edit quiz & price
                        </button>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setModerate(quiz);
                            setNextStatus(quiz.status);
                            setReason("");
                            setError("");
                          }}
                        >
                          Review content
                        </button>
                        <Link to={`/quiz/${quiz.id}`} className="text-btn">
                          View quiz
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <p className="empty-copy">No quizzes match these filters.</p>
            )}
          </div>
          <div className="catalogue-pagination">
            <span>{data.total} matching quizzes</span>
            <div>
              <button
                className="btn outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(1, data.pages)}
              </span>
              <button
                className="btn outline"
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {editing !== undefined && (
        <QuizBuilder
          quizId={editing || undefined}
          close={() => setEditing(undefined)}
          done={() => {
            setEditing(undefined);
            void refresh();
          }}
        />
      )}
      {category && (
        <Modal title="Add quiz category" close={() => setCategory(false)}>
          <h2>A new subject to explore.</h2>
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api("/admin/categories", "POST", { name });
                await refresh();
                setCategory(false);
                setName("");
                toast(
                  "Category added. Create a published public quiz to make it discoverable.",
                );
              } catch (caught) {
                setError((caught as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Category name
              <input
                required
                minLength={2}
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            {error && <ErrorNote message={error} />}
            <button className="btn primary" disabled={busy}>
              Save category
            </button>
          </form>
        </Modal>
      )}
      {moderate && (
        <Modal title="Review quiz publication" close={() => setModerate(null)}>
          <h2>{moderate.title}</h2>
          <QuizEntryBadge pricing={moderate.pricing} />
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              try {
                await api(`/admin/quizzes/${moderate.id}`, "PATCH", {
                  status: nextStatus,
                  reason,
                });
                await refresh();
                setModerate(null);
                toast("Quiz publication updated.");
              } catch (caught) {
                setError((caught as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Publication status
              <select
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>
              Reason for this change
              <textarea
                required
                minLength={10}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <p className="muted">
              Only valid quizzes with explicit Free or Paid pricing can be
              published. Private quizzes stay out of public discovery.
            </p>
            {error && <ErrorNote message={error} />}
            <button className="btn primary" disabled={busy}>
              Save publication
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
