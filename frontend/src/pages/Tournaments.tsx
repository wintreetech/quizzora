import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useParams,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  Spinner,
  Empty,
  ErrorNote,
  Modal,
  date,
  copy,
  SpendConfirmation,
  participationKey,
  clearParticipationKey,
} from "../lib";
export function Tournaments() {
  const { user, auth } = useApp(),
    navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data, isPending, error } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => api("/tournaments"),
  });
  const can = user?.role === "ORGANIZER" || user?.role === "SUPER_ADMIN";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />A LITTLE MORE ROOM FOR RIVALRY
          </span>
          <h1>Great minds. More rounds.</h1>
          <p>
            One good quiz is just the beginning. Join a multi-round points
            tournament.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => (can ? setCreating(true) : auth("register"))}
        >
          <Icon name="Plus" size={17} /> Create a tournament
        </button>
      </div>
      <section className="tournament-banner">
        <div>
          <span className="eyebrow">PLAY THE LONG GAME</span>
          <h2>
            Every round.
            <br />
            Another chance to shine.
          </h2>
          <p>
            Scheduled rounds. Verified scores. One final standing.
            <br />
            No wagers or cash prizes. Just a little well-earned pride.
          </p>
        </div>
        <Icon name="Flag" size={95} />
        <span>✷</span>
      </section>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : !data?.items.length ? (
        <Empty
          icon="Flag"
          title="The next great rivalry is still to come."
          description="There aren’t any public tournaments yet. Get a few bright minds together and create the first."
        >
          <button
            className="btn outline"
            onClick={() => (can ? setCreating(true) : auth("register"))}
          >
            Bring people together <Icon name="ArrowUpRight" size={17} />
          </button>
        </Empty>
      ) : (
        <div className="event-grid">
          {data.items.map((t: any) => (
            <Link
              className="panel tournament-card"
              key={t.id}
              to={`/tournaments/${t.id}`}
            >
              <span className="empty-icon">
                <Icon name="Flag" size={27} />
              </span>
              <span className="eyebrow">{t.status.replaceAll("_", " ")}</span>
              <h3>{t.title}</h3>
              <p>{t.description}</p>
              <div>
                <span>
                  <Icon name="BookOpen" size={15} />
                  {t.rounds.length} rounds
                </span>
                <span>
                  <Icon name="Users" size={15} />
                  {t.participantCount}/{t.capacity}
                </span>
              </div>
              <b className="text-btn">
                Take a closer look <Icon name="ArrowRight" size={16} />
              </b>
            </Link>
          ))}
        </div>
      )}
      {creating && (
        <TournamentCreator
          close={() => setCreating(false)}
          done={(id) => {
            setCreating(false);
            navigate(`/tournaments/${id}`);
          }}
        />
      )}
    </>
  );
}
export function TournamentDetail() {
  const [spend, setSpend] = useState(false);
  const { id } = useParams(),
    [params] = useSearchParams(),
    client = useQueryClient(),
    { user, auth, toast } = useApp();
  const {
    data: t,
    isPending,
    error,
  } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () =>
      api(
        `/tournaments/${id}${params.get("code") ? `?code=${params.get("code")}` : ""}`,
      ),
    refetchInterval: 5000,
  });
  const [busy, setBusy] = useState(false);
  if (isPending) return <Spinner />;
  if (error || !t)
    return <ErrorNote message={error?.message || "Tournament unavailable."} />;
  return (
    <>
      <Link className="back-link" to="/tournaments">
        <Icon name="ChevronLeft" size={16} /> All tournaments
      </Link>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />
            {t.status.replaceAll("_", " ")}
          </span>
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
        {t.isHost ? (
          <button
            className="btn outline"
            onClick={async () => {
              try {
                await copy(
                  `${window.location.origin}/tournaments/${id}${t.visibility === "private" ? `?code=${t.code}` : ""}`,
                );
                toast("Tournament invitation copied.");
              } catch (e) {
                toast((e as Error).message);
              }
            }}
          >
            <Icon name="Copy" size={16} /> Share tournament
          </button>
        ) : (
          !t.joined &&
          t.status === "REGISTRATION_OPEN" && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                if (!user) return auth("login");
                if (t.pricing?.coinPrice) {
                  if (!t.paidEntriesEnabled) {
                    toast(
                      "Coin-entry tournaments are not open yet. No coins were charged.",
                    );
                    return;
                  }
                  setSpend(true);
                  return;
                }
                setBusy(true);
                try {
                  await api(`/tournaments/${id}/join`, "POST", {
                    code: params.get("code"),
                  });
                  client.invalidateQueries({ queryKey: ["tournament", id] });
                  toast("You’re in. A whole new rivalry awaits.");
                } catch (e) {
                  toast((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Count me in <Icon name="ArrowRight" size={17} />
            </button>
          )
        )}
      </div>
      <div className="tournament-summary">
        <span>
          <Icon name={t.pricing?.coinPrice ? "Coins" : "Sparkles"} size={21} />
          {t.pricing?.coinPrice
            ? `${t.pricing.coinPrice} coins · all rounds included`
            : "Free tournament pass"}
        </span>
        <span>
          <Icon name="Users" size={18} />
          {t.participantCount}/{t.capacity} curious minds
        </span>
        <span>
          <Icon name="BookOpen" size={18} />
          {t.rounds.length} rounds
        </span>
        <span>
          <Icon name="Clock" size={18} />
          Registration closes {date(t.registrationClosesAt)}
        </span>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>One good round after another.</h2>
              <p>Your host starts each round at its scheduled time.</p>
            </div>
          </div>
          <div className="tournament-rounds">
            {t.rounds.map((r: any, i: number) => (
              <div key={r.id}>
                <span className="round-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{r.title}</h3>
                  <p>
                    {date(r.startsAt)} · {r.status}
                  </p>
                </div>
                {(t.joined || t.isHost) && (
                  <Link className="text-btn" to={`/live/${r.id}`}>
                    {t.isHost ? "Host round" : "Open round"}
                    <Icon name="ArrowUpRight" size={16} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>The bigger picture.</h2>
              <p>Verified points from completed rounds.</p>
            </div>
          </div>
          {!t.standings.length ? (
            <Empty
              icon="Trophy"
              title="The story is still being written."
              description="Your tournament standings will appear as people register and complete rounds."
            />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Rounds</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {t.standings.map((s: any) => (
                    <tr key={s.userId}>
                      <td>{s.rank}</td>
                      <td>
                        <b>{s.displayName}</b>
                        <small>@{s.username}</small>
                      </td>
                      <td>
                        {s.rounds}/{t.rounds.length}
                      </td>
                      <td>{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <div className="fairness-note">
        <Icon name="Shield" size={18} />
        <p>
          Scores accumulate across completed rounds. Ties use correct answers,
          cumulative server-observed answer time, then a stable user ID.
          Registration closes before the first round starts.
        </p>
      </div>
      {spend && (
        <SpendConfirmation
          title={`${t.title} · all ${t.rounds.length} scheduled rounds`}
          coinPrice={t.pricing.coinPrice}
          version={t.pricing.version}
          requestKey={participationKey(`tournament:${id}`)}
          event
          close={() => setSpend(false)}
          confirm={async (consent) => {
            await api(`/tournaments/${id}/join`, "POST", {
              code: params.get("code"),
              ...consent,
            });
            clearParticipationKey(`tournament:${id}`);
            client.invalidateQueries({ queryKey: ["tournament", id] });
            client.invalidateQueries({ queryKey: ["wallet"] });
            toast(
              "Tournament pass confirmed. Every scheduled round is included.",
            );
          }}
        />
      )}
    </>
  );
}
function TournamentCreator({
  close,
  done,
}: {
  close: () => void;
  done: (id: string) => void;
}) {
  const { data } = useQuery({
    queryKey: ["tournament-quizzes"],
    queryFn: () => api("/quizzes?limit=24"),
  });
  const [rounds, setRounds] = useState(2),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Create a tournament" close={close} wide>
      <span className="eyebrow">THINK A LITTLE BIGGER</span>
      <h2>A few rounds. A great rivalry.</h2>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            const t = await api("/tournaments", "POST", {
              title: f.get("title"),
              description: f.get("description"),
              capacity: Number(f.get("capacity")),
              visibility: f.get("visibility"),
              registrationClosesAt: new Date(
                f.get("closes") as string,
              ).toISOString(),
              rounds: Array.from({ length: rounds }, (_, i) => ({
                quizId: f.get(`quiz-${i}`),
                startsAt: new Date(f.get(`date-${i}`) as string).toISOString(),
              })),
            });
            done(t.id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Tournament name
          <input
            name="title"
            minLength={3}
            maxLength={120}
            required
            placeholder="The weekend curiosity cup"
          />
        </label>
        <label>
          What’s in store?
          <textarea name="description" rows={2} maxLength={1000} />
        </label>
        <div className="form-columns">
          <label>
            Player limit
            <input
              type="number"
              min={2}
              max={25}
              defaultValue={25}
              name="capacity"
              required
            />
          </label>
          <label>
            Visibility
            <select name="visibility">
              <option value="public">Public</option>
              <option value="private">Private invitation</option>
            </select>
          </label>
        </div>
        <label>
          Registration closes
          <input type="datetime-local" name="closes" required />
        </label>
        {Array.from({ length: rounds }, (_, i) => (
          <fieldset className="question-editor" key={i}>
            <legend>ROUND {i + 1}</legend>
            <div className="form-columns">
              <label>
                Published quiz
                <select name={`quiz-${i}`} required>
                  <option value="">Choose a question set</option>
                  {data?.items.map((q: any) => (
                    <option value={q.id} key={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Scheduled start
                <input type="datetime-local" name={`date-${i}`} required />
              </label>
            </div>
          </fieldset>
        ))}
        {rounds < 5 && (
          <button
            type="button"
            className="text-btn"
            onClick={() => setRounds(rounds + 1)}
          >
            <Icon name="Plus" size={15} /> Add another round
          </button>
        )}
        {error && <ErrorNote message={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy ? <Spinner small /> : "Create my tournament"}
          <Icon name="ArrowRight" size={17} />
        </button>
      </form>
    </Modal>
  );
}
