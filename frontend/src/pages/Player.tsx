import PlayerAchievements from "../components/PlayerAchievements";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  Spinner,
  Empty,
  ErrorNote,
  date,
  duration,
  copy,
  Modal,
  categoryIcons,
  SpendConfirmation,
  clearParticipationKey,
  participationKey,
} from "../lib";
import type { User } from "../types";
import { useWallet, coinNumber } from "./Economy";
export function Gate({
  title = "Your curious side, all in one place.",
}: {
  title?: string;
}) {
  const { auth } = useApp();
  return (
    <div className="page-gate">
      <span className="gate-illustration">✷</span>
      <span className="eyebrow">MAKE A LITTLE SPACE FOR YOU</span>
      <h1>{title}</h1>
      <p>
        Sign in to save your progress, find your people, and see how far your
        curiosity takes you.
      </p>
      <div>
        <button className="btn primary" onClick={() => auth("register")}>
          Create free account <Icon name="ArrowUpRight" size={17} />
        </button>
        <button className="btn outline" onClick={() => auth("login")}>
          I’m already part of the club
        </button>
      </div>
    </div>
  );
}
export function Achievements() {
  const { user } = useApp();
  const query = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => api("/dashboard"),
    enabled: !!user,
    staleTime: 0,
  });
  if (!user) return <Gate />;
  if (query.isPending) return <Spinner />;
  if (query.error) return <ErrorNote message={query.error.message} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EARNED THROUGH PLAY</span>
          <h1>Your achievements</h1>
          <p>Real milestones from your completed quizzes.</p>
        </div>
        <Link to="/" className="btn primary">
          Explore quizzes
        </Link>
      </div>
      <PlayerAchievements data={query.data} />
    </>
  );
}
export function Leaderboard() {
  const [period, setPeriod] = useState("week"),
    { user } = useApp();
  const { data, isPending, error } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => api(`/leaderboard?period=${period}`),
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />
            GREAT MINDS. FRIENDLY RIVALRIES.
          </span>
          <h1>A little knowledge goes a long way.</h1>
          <p>
            The curious minds making their mark. Your next round could put you
            here.
          </p>
        </div>
        <Link className="btn primary" to="/">
          Make my mark <Icon name="ArrowUpRight" size={17} />
        </Link>
      </div>
      <div className="leaderboard-hero">
        <div className="leaderboard-hero-icon">
          <Icon name="Trophy" size={65} />
        </div>
        <div>
          <span className="eyebrow">THE BRIGHT SIDE OF COMPETITION</span>
          <h2>
            Bring your curious side.
            <br />
            See how far it takes you.
          </h2>
          <p>
            Your best result per quiz counts. Every right answer earns 100
            points.
          </p>
        </div>
        <span className="leaderboard-spark">✷</span>
      </div>
      <div className="section-heading leaderboard-filter">
        <h2>The curious company you keep</h2>
        <div className="segmented">
          {[
            ["week", "This week"],
            ["month", "This month"],
            ["all", "All time"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={period === value ? "active" : ""}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : !data?.items.length ? (
        <Empty
          icon="Trophy"
          title="The top spot is wide open."
          description="No completed quizzes in this period yet. Go on, set the pace."
        >
          <Link className="btn primary" to="/">
            Play my first round <Icon name="ArrowRight" size={17} />
          </Link>
        </Empty>
      ) : (
        <div className="panel leaderboard-table table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Curious mind</th>
                <th>Quizzes</th>
                <th>Accuracy</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p: any) => (
                <tr
                  key={p.userId}
                  className={p.userId === user?.id ? "your-row" : ""}
                >
                  <td>
                    <span className={`rank-badge rank-${p.rank}`}>
                      {p.rank <= 3 ? <Icon name="Medal" size={21} /> : p.rank}
                      {p.rank <= 3 && <small>{p.rank}</small>}
                    </span>
                  </td>
                  <td>
                    <div className="leader-user">
                      <span className="avatar">
                        {p.displayName.slice(0, 2)}
                      </span>
                      <span>
                        <b>
                          {p.displayName}
                          {p.userId === user?.id && <em> YOU</em>}
                        </b>
                        <small>@{p.username}</small>
                      </span>
                    </div>
                  </td>
                  <td>{p.quizzes}</td>
                  <td>{p.accuracy}%</td>
                  <td>
                    <strong>{p.score.toLocaleString()}</strong>{" "}
                    <small>pts</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="fairness-note">
        <Icon name="Shield" size={19} />
        <p>
          Ranked by points, then correct answers, then total completion time,
          with a stable user ID tie-break. Only your best completed result per
          quiz counts. Private profiles stay off public standings.
        </p>
      </div>
    </>
  );
}
export function Settings() {
  const { user, auth, toast } = useApp(),
    client = useQueryClient();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [theme, setTheme] = useState(
      () => localStorage.getItem("quizora-theme") || "light",
    );
  if (!user) return <Gate title="A little space that’s yours." />;
  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />
            MAKE YOURSELF AT HOME
          </span>
          <h1>It’s the little things.</h1>
          <p>Your profile, your privacy, your kind of space.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="settings-profile">
            <span className="avatar large-avatar">
              {user.displayName.slice(0, 2)}
            </span>
            <div>
              <h3>{user.displayName}</h3>
              <p>
                @{user.username} · {user.role.toLowerCase().replace("_", " ")}
              </p>
            </div>
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                await api("/auth/profile", "PATCH", {
                  displayName: f.get("displayName"),
                  bio: f.get("bio"),
                  visibility: f.get("visibility"),
                });
                await client.invalidateQueries({ queryKey: ["me"] });
                toast("Looking like you. Profile updated.");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Display name
              <input
                name="displayName"
                required
                minLength={2}
                maxLength={60}
                defaultValue={user.displayName}
              />
            </label>
            <label>
              A little about you
              <textarea
                name="bio"
                maxLength={300}
                rows={3}
                defaultValue={user.bio}
                placeholder="Your favorite subjects. Your quiz-night personality."
              />
            </label>
            <label>
              Profile visibility
              <select name="visibility" defaultValue={user.visibility}>
                <option value="public">
                  Public — include me in the leaderboard
                </option>
                <option value="private">
                  Private — keep my results to myself
                </option>
              </select>
            </label>
            <label>
              Email address
              <input value={user.email} disabled />
              <span className="field-note">Your sign-in address.</span>
            </label>
            {error && <ErrorNote message={error} />}
            <button className="btn primary" disabled={busy}>
              {busy ? <Spinner small /> : "Save my changes"}
              <Icon name="Check" size={17} />
            </button>
          </form>
        </section>
        <div>
          <section className="panel settings-aside">
            <h3>Your kind of atmosphere.</h3>
            <p>A lighter day or a darker evening?</p>
            <div className="theme-options">
              {["light", "dark"].map((t) => (
                <button
                  key={t}
                  className={theme === t ? "active" : ""}
                  onClick={() => {
                    setTheme(t);
                    localStorage.setItem("quizora-theme", t);
                    document.documentElement.dataset.theme = t;
                  }}
                >
                  <Icon name={t === "light" ? "Sun" : "Moon"} size={23} />
                  {t === "light" ? "Light" : "Dark"}
                  {theme === t && <Icon name="Check" size={16} />}
                </button>
              ))}
            </div>
          </section>
          <section className="panel settings-aside">
            <h3>Account security.</h3>
            <p>
              {user.emailVerified
                ? "Your email address is verified."
                : "Verify your address to keep your account ready for everything."}
            </p>
            {!user.emailVerified && (
              <button
                className="btn outline full"
                onClick={async () => {
                  try {
                    await api("/auth/send-verification", "POST");
                    toast("Verification email sent. Check your inbox.");
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                <Icon name="Mail" size={16} /> Verify email
              </button>
            )}
            <button className="text-btn" onClick={() => auth("login")}>
              Password & recovery <Icon name="ArrowUpRight" size={15} />
            </button>
          </section>
          <section className="panel settings-aside danger-panel">
            <h3>A little time apart?</h3>
            <p>
              You can request account deletion. You’ll be signed out while your
              request is reviewed.
            </p>
            <button
              className="text-btn danger"
              onClick={() => setDeleting(true)}
            >
              Request account deletion <Icon name="ArrowUpRight" size={15} />
            </button>
          </section>
        </div>
      </div>
      {deleting && (
        <Modal
          title="Request account deletion"
          close={() => setDeleting(false)}
        >
          <h2>Ready to say goodbye?</h2>
          <p className="muted">
            Your deletion request will be recorded for the platform operator.
            All your active sessions will end immediately.
          </p>
          <button
            className="btn danger-btn full"
            onClick={async () => {
              try {
                await api("/auth/deletion-request", "POST");
                client.clear();
                setDeleting(false);
                toast("Your account deletion request has been recorded.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            Submit deletion request
          </button>
          <button
            className="btn outline full"
            onClick={() => setDeleting(false)}
          >
            Stay a little longer
          </button>
        </Modal>
      )}
    </div>
  );
}
export function Challenges() {
  const { user } = useApp();
  const { data, isPending, error } = useQuery({
    queryKey: ["challenges"],
    queryFn: () => api("/challenges"),
    enabled: !!user,
  });
  if (!user) return <Gate title="Every bright mind needs a rival." />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />A LITTLE FRIENDLY COMPETITION
          </span>
          <h1>Challenge accepted?</h1>
          <p>Same quiz. Your own pace. A little something to talk about.</p>
        </div>
        <Link className="btn primary" to="/">
          Find a quiz to share <Icon name="ArrowUpRight" size={17} />
        </Link>
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : data?.items.length ? (
        <div className="challenge-grid">
          {data.items.map((c: any) => (
            <Link
              className="panel challenge-card"
              to={`/challenge/${c.code}`}
              key={c._id}
            >
              <span className="empty-icon">
                <Icon name="Users" size={25} />
              </span>
              <span className="eyebrow">
                {new Date(c.expiresAt) < new Date()
                  ? "EXPIRED"
                  : c.status.toUpperCase()}
              </span>
              <h3>
                {c.creatorId === user.id
                  ? "Your invitation to a little rivalry."
                  : "Someone thinks they know more."}
              </h3>
              <p>Available until {date(c.expiresAt)}</p>
              <span className="text-btn">
                Open challenge <Icon name="ArrowUpRight" size={16} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          icon="Users"
          title="A little rivalry starts with a link."
          description="Open any quiz and choose Challenge a friend. We’ll make the invitation."
        >
          <Link className="btn primary" to="/">
            Find the perfect challenge <Icon name="ArrowRight" size={17} />
          </Link>
        </Empty>
      )}
    </>
  );
}
export function ChallengePage() {
  const { code } = useParams(),
    { user, auth, toast } = useApp(),
    navigate = useNavigate(),
    client = useQueryClient();
  const {
    data: c,
    isPending,
    error,
  } = useQuery({
    queryKey: ["challenge", code],
    queryFn: () => api(`/challenges/${code}`),
    enabled: !!user,
    retry: false,
    refetchInterval: 5000,
  });
  const [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<any>(null);
  if (!user) return <Gate title="A friend has a question for you." />;
  if (isPending) return <Spinner />;
  if (error || !c)
    return <ErrorNote message={error?.message || "Challenge unavailable."} />;
  const mine = c.creatorId === user.id,
    accepted = mine || c.acceptedBy === user.id,
    expired = new Date(c.expiresAt) < new Date();
  return (
    <div className="challenge-detail panel">
      <div className="challenge-emblem">
        <Icon name="Users" size={42} />
        <span>✦</span>
      </div>
      <span className="eyebrow">GOOD COMPANY. A LITTLE RIVALRY.</span>
      <h1>
        {mine
          ? "Your move, bright mind."
          : `${c.creator} thinks you’re up for it.`}
      </h1>
      <p>
        A private challenge on <b>{c.title}</b>. One recorded round per person.
        Highest score wins; quickest completion breaks a tie.
      </p>
      <div className="challenge-expiry">
        <Icon name="Clock" size={16} />
        {expired
          ? "This invitation has expired."
          : `Your invitation is good until ${date(c.expiresAt)}`}
      </div>
      {!expired && (
        <div className="result-buttons">
          {!accepted ? (
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/challenges/${code}/accept`, "POST");
                  await client.invalidateQueries({
                    queryKey: ["challenge", code],
                  });
                  toast("Challenge accepted. Bring your curious side.");
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Challenge accepted <Icon name="ArrowRight" size={17} />
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const access = await api(`/quizzes/${c.quizId}/access`);
                  if (
                    access.charge > 0 &&
                    !c.results?.some((r: any) => r.userId === user.id)
                  ) {
                    setQuote(access.pricing);
                    return;
                  }
                  const a = await api(`/challenges/${code}/play`, "POST");
                  navigate(
                    a.status === "active"
                      ? `/play/${a.id}`
                      : `/results/${a.id}`,
                  );
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Play my round <Icon name="Play" size={17} />
            </button>
          )}
          {mine && (
            <button
              className="btn outline"
              onClick={async () => {
                try {
                  await copy(window.location.href);
                  toast("Challenge link copied.");
                } catch (e) {
                  toast((e as Error).message);
                }
              }}
            >
              <Icon name="Copy" size={16} /> Copy invite link
            </button>
          )}
        </div>
      )}
      <div className="challenge-scores">
        {[c.creatorId, c.acceptedBy].map((uid, i) => {
          const r = c.results?.find((r: any) => r.userId === uid);
          return (
            <div key={i}>
              <span>
                {i === 0
                  ? `${c.creator} (host)`
                  : uid === user.id
                    ? "You"
                    : "Your challenger"}
              </span>
              <strong>{r ? `${r.score} pts` : "—"}</strong>
              <small>
                {r
                  ? `${r.accuracy}% accuracy · ${duration(r.elapsedMs)}`
                  : uid
                    ? "Their round is still ahead"
                    : "Waiting for a challenger"}
              </small>
            </div>
          );
        })}
      </div>
      {quote && (
        <SpendConfirmation
          requestKey={participationKey(`challenge-${code}`)}
          title={c.title}
          coinPrice={quote.coinPrice}
          version={quote.version}
          includedAttempts={quote.includedAttempts}
          close={() => setQuote(null)}
          confirm={async (consent) => {
            const a = await api(`/challenges/${code}/play`, "POST", consent);
            clearParticipationKey(`challenge-${code}`);
            await client.invalidateQueries({ queryKey: ["wallet"] });
            navigate(
              a.status === "active" ? `/play/${a.id}` : `/results/${a.id}`,
            );
          }}
        />
      )}
    </div>
  );
}
