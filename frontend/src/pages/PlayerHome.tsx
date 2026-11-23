import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  Spinner,
  ErrorNote,
  Empty,
  date,
  duration,
} from "../lib";
import { Gate } from "./Player";
import { useWallet, coinNumber } from "./Economy";
import QuizCatalogue from "../components/QuizCatalogue";
import PlayerAchievements from "../components/PlayerAchievements";

export function PlayerHome() {
  const { user } = useApp(),
    { data: wallet } = useWallet();
  const query = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => api("/dashboard"),
    enabled: !!user,
    staleTime: 0,
  });
  const history = useQuery({
    queryKey: ["wallet-history", user?.id, "preview"],
    queryFn: () => api("/wallet/history?page=1"),
    enabled: !!user,
    staleTime: 0,
  });
  if (!user) return <Gate />;
  if (query.isPending) return <Spinner />;
  if (query.error) return <ErrorNote message={query.error.message} />;
  const data = query.data;
  return (
    <div className="player-home">
      <header className="player-welcome">
        <div>
          <span className="eyebrow">YOUR DAILY DOSE OF DISCOVERY</span>
          <h1>Good to see you, {user.displayName.split(" ")[0]}.</h1>
          <p>A fresh subject, a personal best, or just five minutes for you.</p>
          <a href="#quiz-list" className="btn primary">
            Explore quizzes
            <Icon name="Compass" size={18} />
          </a>
        </div>
        <div className="player-progress-ring">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="49" />
            <circle
              cx="60"
              cy="60"
              r="49"
              pathLength="100"
              strokeDasharray={`${data.accuracy} 100`}
            />
          </svg>
          <div>
            <strong>{data.accuracy}%</strong>
            <span>average accuracy</span>
          </div>
          <small>
            {data.total
              ? "Every round is a little progress."
              : "Your first round starts your story."}
          </small>
        </div>
      </header>
      <section
        className="player-quick-stats"
        aria-label="Your real player statistics"
      >
        {[
          ["BookOpen", "Quizzes played", data.total, "Completed solo rounds"],
          [
            "Coins",
            "Available coins",
            wallet ? coinNumber(wallet.balance) : "—",
            "Your current wallet balance",
          ],
          [
            "Target",
            "Best accuracy",
            `${data.bestAccuracy || 0}%`,
            "Across completed rounds",
          ],
          [
            "Trophy",
            "Leaderboard rank",
            data.rank ? `#${data.rank}` : "—",
            "All-time public standings",
          ],
        ].map(([icon, label, value, note]) => (
          <article className="stat-card player-stat" key={label as string}>
            <span className="player-stat-icon">
              <Icon name={icon as any} size={20} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>
      {data.active?.length > 0 && (
        <section className="player-continue">
          <div className="section-heading">
            <div>
              <span className="eyebrow">PICK UP YOUR ROUND</span>
              <h2>Continue playing</h2>
            </div>
            <span>Timers continue while you are away.</span>
          </div>
          <div className="continue-grid">
            {data.active.slice(0, 3).map((attempt: any) => (
              <Link key={attempt.id} to={`/play/${attempt.id}`}>
                <span className="continue-icon">
                  <Icon name="Play" size={21} />
                </span>
                <div>
                  <b>{attempt.title}</b>
                  <span>
                    {attempt.answered} of {attempt.total} questions answered ·
                    no new entry charge
                  </span>
                </div>
                <Icon name="ChevronRight" size={19} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="player-content-grid">
        <div className="player-main-column">
          <QuizCatalogue compact />
          <section className="player-recent">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ONE ROUND AT A TIME</span>
                <h2>Your recent activity</h2>
              </div>
              <Link to="/activity" className="text-btn">
                View all activity
              </Link>
            </div>
            {data.attempts.length ? (
              <div className="activity-preview">
                {data.attempts.slice(0, 4).map((attempt: any) => (
                  <Link key={attempt.id} to={`/results/${attempt.id}`}>
                    <span className="activity-mark">
                      <Icon name="CheckCircle2" size={22} />
                    </span>
                    <div>
                      <b>{attempt.title}</b>
                      <span>
                        {attempt.category} · {date(attempt.completedAt)}
                      </span>
                    </div>
                    <strong>
                      {attempt.accuracy}%<small>{attempt.score} points</small>
                    </strong>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                icon="BookOpen"
                title="Your first good result belongs here."
                description="Complete a quiz to see your score and answer explanations."
              />
            )}
          </section>
        </div>
        <aside className="player-side-column">
          <section className="player-wallet-preview">
            <div>
              <Icon name="Wallet" size={23} />
              <span>YOUR WALLET</span>
              <Link to="/wallet" aria-label="Open your wallet">
                <Icon name="ArrowUpRight" size={18} />
              </Link>
            </div>
            <strong>
              {wallet ? coinNumber(wallet.balance) : "—"}
              <small>coins available</small>
            </strong>
            <p>Coins unlock paid quiz entries. Your answers earn your score.</p>
            <Link className="btn full" to="/store">
              Get coins
              <Icon name="Plus" size={17} />
            </Link>
            <small>Free quizzes need no coins. No subscription.</small>
          </section>
          <section className="player-transactions">
            <div className="section-heading">
              <h3>Recent transactions</h3>
              <Link to="/wallet" className="text-btn">
                View all
              </Link>
            </div>
            {history.error ? (
              <ErrorNote message={history.error.message} />
            ) : history.isPending ? (
              <Spinner small />
            ) : history.data?.items.length ? (
              history.data.items.slice(0, 4).map((entry: any) => (
                <div key={entry._id}>
                  <span className="transaction-icon">
                    <Icon
                      name={entry.amount > 0 ? "ArrowDownLeft" : "Play"}
                      size={17}
                    />
                  </span>
                  <div>
                    <b>{entry.type.replaceAll("_", " ").toLowerCase()}</b>
                    <small>{date(entry.createdAt)}</small>
                  </div>
                  <strong className={entry.amount > 0 ? "credit" : ""}>
                    {entry.amount > 0 ? "+" : ""}
                    {coinNumber(entry.amount)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="player-side-empty">
                Your purchases, entries and refunds will appear here. You can
                start with a free quiz.
              </p>
            )}
          </section>
          <section className="player-category-progress">
            <h3>Your growing knowledge</h3>
            {data.categories.length ? (
              data.categories.slice(0, 5).map((category: any) => (
                <div key={category.category}>
                  <span>
                    {category.category}
                    <b>{category.accuracy}%</b>
                  </span>
                  <div>
                    <i style={{ width: `${category.accuracy}%` }} />
                  </div>
                  <small>
                    {category.attempts} completed{" "}
                    {category.attempts === 1 ? "round" : "rounds"}
                  </small>
                </div>
              ))
            ) : (
              <p className="player-side-empty">
                Play a subject you love. Your category progress will grow with
                every completed round.
              </p>
            )}
            <Link to="/help" className="text-btn">
              How scoring works
              <Icon name="LifeBuoy" size={16} />
            </Link>
          </section>
          <Link to="/leaderboard" className="player-leaderboard-link">
            <Icon name="Trophy" size={27} />
            <div>
              <b>A little friendly competition.</b>
              <span>See the real player standings</span>
            </div>
            <Icon name="ChevronRight" size={18} />
          </Link>
        </aside>
      </div>
      <PlayerAchievements data={data} compact />
    </div>
  );
}

export function PlayerActivity() {
  const { user } = useApp(),
    [params, setParams] = useSearchParams(),
    page = Math.max(1, Number(params.get("page")) || 1);
  const query = useQuery({
    queryKey: ["activity", user?.id, page],
    queryFn: () => api(`/activity?page=${page}`),
    enabled: !!user,
    staleTime: 0,
  });
  if (!user) return <Gate title="Your progress, all in one place." />;
  return (
    <div className="player-activity-page">
      <ActivityProgress userId={user.id} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROGRESS WORTH COMING BACK TO</span>
          <h1>My activity</h1>
          <p>
            Your completed solo rounds, real scores and answer explanations.
          </p>
        </div>
        <Link className="btn primary" to="/">
          Explore quizzes
        </Link>
      </div>
      {query.isPending ? (
        <Spinner />
      ) : query.error ? (
        <ErrorNote message={query.error.message} />
      ) : query.data.items.length ? (
        <>
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Completed</th>
                  <th>Score</th>
                  <th>Accuracy</th>
                  <th>Time</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((attempt: any) => (
                  <tr key={attempt.id}>
                    <td>
                      <b>{attempt.title}</b>
                      <small>{attempt.category}</small>
                    </td>
                    <td>{date(attempt.completedAt)}</td>
                    <td>{attempt.score} points</td>
                    <td>{attempt.accuracy}%</td>
                    <td>{duration(attempt.elapsedMs)}</td>
                    <td>
                      <Link className="text-btn" to={`/results/${attempt.id}`}>
                        View result
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="catalogue-pagination">
            <span>{query.data.total} completed rounds</span>
            <div>
              <button
                className="btn outline"
                disabled={page === 1}
                onClick={() => setParams({ page: String(page - 1) })}
              >
                Previous
              </button>
              <span>
                Page {page} of {query.data.pages}
              </span>
              <button
                className="btn outline"
                disabled={page >= query.data.pages}
                onClick={() => setParams({ page: String(page + 1) })}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <Empty
          icon="BookOpen"
          title="Your first round is the beginning."
          description="Play a quiz to save its result and start tracking your progress."
        >
          <Link to="/?access=free" className="btn primary">
            Find a free quiz
          </Link>
        </Empty>
      )}
    </div>
  );
}

function ActivityProgress({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["dashboard", userId],
    queryFn: () => api("/dashboard"),
    staleTime: 0,
  });
  if (!data?.total) return null;
  return (
    <section
      className="activity-progress-summary"
      aria-label="Your progress over time"
    >
      <div className="activity-lifetime-stats">
        {[
          ["Highest score", `${data.best} points`],
          ["Total score", `${data.points} points`],
          ["Average accuracy", `${data.accuracy}%`],
          ["Competitions joined", data.competitions],
        ].map(([label, value]) => (
          <div key={label as string}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="activity-trend">
        <div>
          <h2>A little sharper each time.</h2>
          <p>
            Your last {Math.min(10, data.attempts.length)} completed rounds,
            oldest to newest.
          </p>
        </div>
        <div className="activity-trend-bars">
          {data.attempts
            .slice(0, 10)
            .reverse()
            .map((attempt: any) => (
              <Link
                to={`/results/${attempt.id}`}
                key={attempt.id}
                aria-label={`${attempt.title}: ${attempt.accuracy}% accuracy`}
              >
                <span>{attempt.accuracy}%</span>
                <div>
                  <i style={{ height: `${attempt.accuracy}%` }} />
                </div>
                <small>
                  {new Date(attempt.completedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </small>
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
