import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, Icon, useApp, ErrorNote, Empty } from "../lib";
import type { Quiz } from "../types";
import QuizCard from "./QuizCard";

export default function QuizCatalogue({
  library = false,
  compact = false,
}: {
  library?: boolean;
  compact?: boolean;
}) {
  const [params, setParams] = useSearchParams(),
    { user, saved } = useApp();
  const [term, setTerm] = useState(params.get("q") || "");
  useEffect(() => setTerm(params.get("q") || ""), [params.get("q")]);
  const tab =
    params.get("tab") ||
    (params.get("access") === "free"
      ? "free"
      : ["paid", "premium"].includes(params.get("access") || "")
        ? "paid"
        : "all");
  const search = params.get("q") || "",
    category = params.get("category") || "",
    difficulty = params.get("difficulty") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const sort =
    tab === "new"
      ? "newest"
      : tab === "popular"
        ? "popular"
        : params.get("sort") || "featured";
  const access = tab === "free" ? "free" : tab === "paid" ? "paid" : "all";
  function update(values: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    next.delete("page");
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setParams(next, { preventScrollReset: true });
  }
  const query = new URLSearchParams({
    page: String(page),
    limit: compact ? "6" : "8",
    sort,
    access,
  });
  if (category) query.set("category", category);
  if (difficulty) query.set("difficulty", difficulty);
  if (search) query.set("q", search);
  if (library) query.set("ids", saved.join(","));
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["quizzes", query.toString(), user?.id || "guest", library],
    queryFn: () => api(`/quizzes?${query}`),
    staleTime: 0,
  });
  const active = !!(
    search ||
    category ||
    difficulty ||
    tab !== "all" ||
    params.get("sort")
  );
  return (
    <section
      className={`quiz-catalogue ${compact ? "catalogue-compact" : ""}`}
      id="quiz-list"
      aria-label={library ? "Saved quizzes" : "Quiz discovery"}
    >
      <div className="catalogue-title">
        <div>
          <span className="eyebrow">
            {library ? "YOUR COLLECTION" : "FIND YOUR NEXT GOOD QUESTION"}
          </span>
          <h2>
            {library ? "Saved for a curious moment" : "Explore quizzes"}
            <span className="catalogue-count" aria-live="polite">
              {data?.total ?? "—"}
            </span>
          </h2>
        </div>
        {active && (
          <button
            className="text-btn"
            onClick={() => {
              setParams({});
              setTerm("");
            }}
          >
            Reset filters
          </button>
        )}
      </div>
      <div
        className="catalogue-tabs"
        role="group"
        aria-label="Quiz access and discovery"
      >
        {[
          ["all", "All"],
          ["free", "Free"],
          ["paid", "Paid"],
          ...(data?.popularityAvailable || tab === "popular"
            ? [["popular", "Popular"]]
            : []),
          ["new", "New"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            className={tab === value ? "active" : ""}
            onClick={() => update({ tab: value, access: null, sort: null })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="catalogue-filters">
        <form
          className="catalogue-search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: term.trim() });
          }}
        >
          <Icon name="Search" size={19} />
          <input
            aria-label="Search quiz catalogue"
            placeholder="Search a subject or a quiz"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
          <button type="submit" aria-label="Apply quiz search">
            <Icon name="ArrowRight" size={18} />
          </button>
        </form>
        <label className="sr-only" htmlFor="catalogue-category">
          Quiz category
        </label>
        <select
          id="catalogue-category"
          value={category}
          onChange={(event) => update({ category: event.target.value })}
        >
          <option value="">All categories</option>
          {(data?.categories || []).map((value: string) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="catalogue-difficulty">
          Quiz difficulty
        </label>
        <select
          id="catalogue-difficulty"
          value={difficulty}
          onChange={(event) => update({ difficulty: event.target.value })}
        >
          <option value="">All levels</option>
          <option value="Easy">Beginner</option>
          <option value="Medium">Intermediate</option>
          <option value="Hard">Advanced</option>
        </select>
        <label className="sr-only" htmlFor="catalogue-sort">
          Sort quizzes
        </label>
        <select
          id="catalogue-sort"
          value={sort}
          onChange={(event) =>
            update({
              sort: event.target.value,
              tab: ["new", "popular"].includes(tab) ? "all" : tab,
            })
          }
        >
          <option value="featured">Recommended</option>
          <option value="newest">Newest first</option>
          <option value="quickest">Quickest first</option>
          {data?.popularityAvailable && (
            <option value="popular">Most played</option>
          )}
        </select>
      </div>
      {(category || difficulty || search) && (
        <p className="catalogue-applied">
          Showing{" "}
          {access === "all"
            ? "all entry types"
            : access === "free"
              ? "free entries"
              : "paid entries"}
          {category ? ` in ${category}` : ""}
          {difficulty ? ` · ${difficulty} level` : ""}
          {search ? ` matching “${search}”` : ""}. Filters apply across every
          page.
        </p>
      )}
      {tab === "popular" && (
        <p className="catalogue-applied">
          Ordered by the number of distinct players who completed a round.
        </p>
      )}
      {isPending ? (
        <div className="catalogue-grid" aria-label="Loading quizzes">
          {Array.from({ length: compact ? 6 : 8 }, (_, index) => (
            <div className="catalogue-skeleton" key={index} />
          ))}
        </div>
      ) : error ? (
        <div className="panel">
          <ErrorNote message={error.message} />
          <button className="btn outline" onClick={() => void refetch()}>
            Retry quizzes
          </button>
        </div>
      ) : !data?.items.length ? (
        <Empty
          icon={library ? "Bookmark" : "Search"}
          title={
            library
              ? "Keep a good find for later."
              : "No quizzes match these filters."
          }
          description={
            library
              ? "Save a quiz from Explore and it will appear here."
              : "Try another subject, or reset your filters to see every available quiz."
          }
        >
          <button
            className="btn primary"
            onClick={() => {
              setParams({});
              setTerm("");
            }}
          >
            Show all quizzes
          </button>
        </Empty>
      ) : (
        <div className="catalogue-grid">
          {data.items.map((quiz: Quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      )}
      {!!data?.total && (
        <div className="catalogue-pagination">
          <span>
            Showing {(data.page - 1) * data.limit + 1}–
            {Math.min(data.page * data.limit, data.total)} of {data.total}{" "}
            quizzes
          </span>
          <div>
            <button
              className="btn outline"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
            >
              Previous
            </button>
            <span>
              Page {data.page} of {data.pages}
            </span>
            <button
              className="btn outline"
              disabled={page >= data.pages}
              onClick={() => update({ page: String(page + 1) })}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
