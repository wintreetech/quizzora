import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  categoryIcons,
  Spinner,
  ErrorNote,
  Empty,
  Modal,
  date,
} from "../lib";
import type { Quiz, Room } from "../types";
import QuizCard from "../components/QuizCard";
import { EditorialCover } from "../components/BrandArtwork";
import { CoinSymbol, useWallet, coinNumber } from "./Economy";
import { LandingGuide } from "./HowItWorks";
export default function Discover({ library = false }: { library?: boolean }) {
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState("All quizzes"),
    [difficulty, setDifficulty] = useState(""),
    [accessType, setAccessType] = useState("all"),
    [sort, setSort] = useState("featured"),
    [filters, setFilters] = useState(false),
    [page, setPage] = useState(1);
  const { user, auth, join, saved } = useApp();
  const { data: configuration } = useQuery({ queryKey: ["config"], queryFn: () => api("/config") });
  const cats: string[] = ["All quizzes", ...(configuration?.categories || Object.keys(categoryIcons))];
  const { data: wallet } = useWallet();
  const navigate = useNavigate();
  const search = params.get("q") || "";
  useEffect(() => {
    setCategory(params.get("category") || "All quizzes");
    setDifficulty("");
    setAccessType(params.get("access") === "free" ? "free" : "all");
  }, [search, library, params.get("category")]);
  useEffect(() => {
    setPage(1);
  }, [category, difficulty, accessType, search, sort]);
  const { data, isPending, error } = useQuery({
    queryKey: [
      "quizzes",
      category,
      difficulty,
      accessType,
      search,
      sort,
      page,
      library,
      library ? saved.join(",") : "",
    ],
    queryFn: () =>
      api<{ items: Quiz[]; total: number; pages: number }>(
        `/quizzes?limit=${library ? 24 : 8}&page=${page}&sort=${sort}&access=${accessType}${library ? `&ids=${saved.slice(0, 200).join(",")}` : ""}${category !== "All quizzes" ? `&category=${encodeURIComponent(category)}` : ""}${difficulty ? `&difficulty=${difficulty}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`,
      ),
  });
  const { data: events } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api<{ items: Room[] }>("/competitions"),
  });
  const { data: leaders } = useQuery({
    queryKey: ["leaderboard-preview"],
    queryFn: () => api("/leaderboard?period=week"),
  });
  const items = data?.items;
  const first = data?.items[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">
            <i />
            {library
              ? "A COLLECTION THAT’S ALL YOU"
              : "THE HOME OF KNOWLEDGE COMPETITIONS"}
          </div>
          <h1>
            {library
              ? "Good finds. Kept close."
              : user
                ? `Your move, ${user.displayName.split(" ")[0]}.`
                : "Good to know. Great to play."}
          </h1>
          <p>
            {library
              ? "All the quizzes you’ve saved for a curious moment."
              : "A sharper mind. A worthy challenge. A very good time."}
          </p>
        </div>
        <Link to="/live" className="btn outline heading-cta">
          <span className="status-dot" /> Explore competitions{" "}
          <Icon name="ArrowUpRight" size={16} />
        </Link>
      </div>
      {!library && (
        <div className="hero-grid">
          <section className="discovery-hero">
            <div className="hero-content">
              <span className="hero-kicker">
                A FRESH WAY TO FEED YOUR CURIOSITY
              </span>
              <h2>
                Little questions.
                <br />
                <em>Big discoveries.</em>
              </h2>
              <p>
                Short quizzes. New discoveries. Your next personal best.
                Start free, earn points and badges, and learn from every answer.
              </p>
              <button
                className="btn primary"
                disabled={!first}
                onClick={() => { setAccessType("free"); document.getElementById("quiz-list")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }}
              >
                Start playing
              </button>
              <div className="hero-footnote">
                <Icon name="Shield" size={18} /> 18+ minds. Real knowledge. Fair
                play.
              </div>
            </div>
            {first && <Link className="hero-featured-quiz" to={`/quiz/${first.id}`}><span className="hero-featured-label">A GOOD PLACE TO START</span><EditorialCover kind={first.cover} /><div><span>{first.category} · {first.difficulty}</span><h3>{first.title}</h3><p>{first.questionCount} questions · {first.duration} minutes</p><b>{first.pricing?.coinPrice ? `${first.pricing.coinPrice} coins` : "Free to play"}<Icon name="Play" size={17} /></b></div></Link>}
          </section>
          <section className="join-hero">
            <div className="join-hero-top">
              <span className="line-icon">
                <CoinSymbol size={32} />
              </span>
              <span className="join-hero-badge">YOUR PLAY, YOUR PACE</span>
            </div>
            {user ? (
              <div className="wallet-card-balance">
                {wallet ? coinNumber(wallet.balance) : "—"}
                <small>coins available</small>
              </div>
            ) : (
              <h2>
                One wallet.
                <br />
                More possibilities.
              </h2>
            )}
            <p>
              Play free introductions. Unlock premium rounds with virtual coins.
              Your knowledge earns the score.
            </p>
            <Link to="/store" className="btn join-hero-button">
              Explore the coin store
            </Link>
            <span className="wallet-card-note">
              No expiry. No transfers. No cash value.
            </span>
          </section>
        </div>
      )}
      {!library && (
        <section className="home-plans-strip">
          <div>
            <span className="eyebrow">MORE WAYS TO PLAY</span>
            <h3>Your coins. Your amount.</h3>
          </div>
          <div className="home-coin-slider-link">
            <span className="mini-range" aria-hidden="true" />
            Choose $10–$500 or €10–€500. See exactly what you receive.
          </div>
          <Link to="/store" className="btn dark">
            Explore coin store
          </Link>
        </section>
      )}
      <div className="discovery-columns">
        <div className="discovery-main">
          <section className="category-section">
            <div className="section-heading">
              <div>
                <h2>
                  Follow your curiosity <span>✦</span>
                </h2>
                <p>Find your thing. Or discover something new.</p>
              </div>
              <button
                className="text-btn categories-more"
                onClick={() => setFilters(true)}
              >
                All categories <Icon name="ArrowRight" size={16} />
              </button>
            </div>
            <div
              className="category-tabs"
              role="group"
              aria-label="Quiz category"
            >
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`category-tab ${category === c ? "active" : ""}`}
                >
                  {c === "All quizzes" ? (
                    <Icon name="Compass" size={17} />
                  ) : (
                    <Icon name={categoryIcons[c] || "BookOpen"} size={17} />
                  )}
                  <span>{c}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="quiz-section" id="quiz-list">
            <div className="quiz-list-heading">
              <div className="quiz-heading-title">
                <h2>
                  {library
                    ? "Saved for later"
                    : search
                      ? `Results for “${search}”`
                      : category === "All quizzes"
                        ? "Your next great brain break"
                        : `${category}, with a twist`}
                </h2>
                <span className="count-pill">
                  {data?.total ?? "—"}
                </span>
                {search && (
                  <button
                    className="icon-btn"
                    aria-label="Clear search"
                    onClick={() => setParams({})}
                  >
                    <Icon name="X" size={15} />
                  </button>
                )}
              </div>
              <div className="quiz-controls">
                <button
                  className={`filter-btn ${difficulty ? "has-filter" : ""}`}
                  onClick={() => setFilters(true)}
                >
                  <Icon name="SlidersHorizontal" size={15} />
                  <span>Filters</span>
                  {difficulty && <i />}
                </button>
                <label className="sort-control">
                  <span>Sort:</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort quizzes"
                  >
                    <option value="featured">Handpicked</option>
                    <option value="newest">Newest first</option>
                    <option value="quickest">Quickest first</option>
                  </select>
                  <Icon name="ChevronDown" size={13} />
                </label>
              </div>
            </div>
            {isPending ? (
              <div className="loading-quizzes">
                {Array.from({ length: 4 }, (_, i) => (
                  <div className="skeleton-card" key={i}>
                    <div />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="server-error">
                <ErrorNote message={error.message} />
                <p>
                  Check that the API is running, then refresh to discover your
                  next quiz.
                </p>
                <button
                  className="btn outline"
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              </div>
            ) : !items?.length ? (
              <Empty
                icon={library ? "Bookmark" : "Search"}
                title={
                  library
                    ? "Your next great find belongs here."
                    : "No matches, just yet."
                }
                description={
                  library
                    ? "Tap the bookmark on any quiz to save it for later."
                    : "Try a different category or loosen up those filters."
                }
              >
                <button
                  className="btn primary"
                  onClick={() => {
                    setCategory("All quizzes");
                    setDifficulty("");
                    setParams({});
                    if (library) navigate("/");
                  }}
                >
                  Explore quizzes <Icon name="ArrowRight" size={16} />
                </button>
              </Empty>
            ) : (
              <div className="quiz-grid">
                {items.map((q) => (
                  <QuizCard key={q.id} quiz={q} />
                ))}
              </div>
            )}
            {data && data.pages > 1 && (
              <div className="pagination">
                <span>
                  Page {page} of {data.pages}
                </span>
                <div>
                  <button
                    className="btn outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <Icon name="ChevronLeft" size={16} /> Previous
                  </button>
                  <button
                    className="btn outline"
                    disabled={page === data.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next <Icon name="ChevronRight" size={16} />
                  </button>
                </div>
              </div>
            )}
          </section>
          <section className="host-banner">
            <div className="host-banner-icon">
              <Icon name="Zap" size={25} />
            </div>
            <div>
              <span className="eyebrow">YOUR PEOPLE. YOUR COMPETITION.</span>
              <h3>Good at bringing people together?</h3>
              <p>Create a quiz night they’ll keep talking about.</p>
            </div>
            <button
              className="btn outline"
              onClick={() => (user ? navigate("/organizer") : auth("register"))}
            >
              Meet your host era <Icon name="ArrowUpRight" size={16} />
            </button>
            <span className="banner-decoration">✷</span>
          </section>
        </div>
        <aside className="discovery-rail">
          <section className="rail-card coming-up">
            <div className="rail-heading">
              <h3>
                <span className="status-dot" /> On the horizon
              </h3>
              <Link to="/live" aria-label="See all competitions">
                <Icon name="ArrowUpRight" size={17} />
              </Link>
            </div>
            <p className="rail-subtitle">Make a little room for competition.</p>
            {events?.items
              .filter((c) => ["SCHEDULED", "LOBBY", "LIVE"].includes(c.status))
              .slice(0, 2)
              .map((c) => (
                <div className="event-preview" key={c.id}>
                  <div className="event-preview-art">
                    <Icon name="Clapperboard" size={30} />
                    <span>
                      {c.sample
                        ? "A TASTE OF WHAT’S NEXT"
                        : c.status === "LIVE"
                          ? "LIVE NOW"
                          : "YOUR NEXT GAME NIGHT"}
                    </span>
                  </div>
                  <span className="event-category">
                    {c.sample ? "SAMPLE EVENT" : "OPEN COMPETITION"}
                  </span>
                  <h4>{c.title}</h4>
                  <div className="event-details">
                    <span>
                      <Icon name="Calendar" size={13} />
                      {date(c.startsAt || new Date().toISOString())}
                    </span>
                    <span>
                      <Icon name="Users" size={13} />
                      {c.participantCount}/{c.capacity} spots
                    </span>
                  </div>
                  <Link to={`/live/${c.id}`} className="event-link">
                    {c.sample ? "Take a look inside" : "View competition"}
                    <Icon name="ArrowRight" size={15} />
                  </Link>
                </div>
              ))}
            {!events?.items.length && (
              <p className="small-empty">
                A little quiet here. Host the next great quiz night.
              </p>
            )}
          </section>
          <section className="rail-card leaderboard-preview">
            <div className="rail-heading">
              <h3>
                <Icon name="Trophy" size={17} /> The bright side
              </h3>
              <span className="small-label">THIS WEEK</span>
            </div>
            <p className="rail-subtitle">
              A little friendly competition looks good.
            </p>
            {leaders?.items?.length ? (
              <div className="mini-leaders">
                {leaders.items.slice(0, 3).map((p: any, i: number) => (
                  <div key={p.userId}>
                    <span className="mini-rank">{i + 1}</span>
                    <span className="avatar tiny-avatar">
                      {p.displayName.slice(0, 2)}
                    </span>
                    <b>{p.displayName}</b>
                    <span>{p.score} pts</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="leaderboard-empty">
                <div className="podium">
                  <span>2</span>
                  <span>
                    <Icon name="Trophy" size={25} />
                  </span>
                  <span>3</span>
                </div>
                <h4>The top spot has your name on it.</h4>
                <p>Play a quiz. Make your mark.</p>
              </div>
            )}
            <Link to="/leaderboard" className="rail-bottom-link">
              Explore the leaderboard <Icon name="ArrowRight" size={15} />
            </Link>
          </section>
          <section className="curiosity-note">
            <span className="curiosity-star">✷</span>
            <span className="eyebrow">A THOUGHT TO TAKE WITH YOU</span>
            <blockquote>
              “The important thing is not to stop questioning.”
            </blockquote>
            <span className="quote-credit">
              A little reminder to stay curious.
            </span>
          </section>
        </aside>
      </div>
      {!library && <LandingGuide />}
      {filters && (
        <Modal title="Find your kind of quiz" close={() => setFilters(false)}>
          <span className="eyebrow">LESS SCROLLING. MORE AHA.</span>
          <h2>Find your kind of quiz.</h2>
          <div className="form-stack">
            <label>
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {cats.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              A little challenge?
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="">Any difficulty</option>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </label>
            <label>
              Entry type
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value)}
              >
                <option value="all">All quizzes</option>
                <option value="free">Free discovery</option>
                <option value="premium">Premium coin entry</option>
              </select>
            </label>
            <div className="filter-explainer">
              <Icon name="Sparkles" size={18} />
              <p>
                Discover free introductions or choose a premium round. Every
                coin entry shows its price before you confirm.
              </p>
            </div>
            <button
              className="btn primary full"
              onClick={() => setFilters(false)}
            >
              Show my quizzes <Icon name="ArrowRight" size={17} />
            </button>
            <button
              className="text-btn center"
              onClick={() => {
                setCategory("All quizzes");
                setDifficulty("");
                setAccessType("all");
              }}
            >
              Reset filters
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
