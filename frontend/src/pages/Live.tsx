import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import {
  api,
  API,
  Icon,
  useApp,
  Spinner,
  ErrorNote,
  Empty,
  copy,
  date,
  Modal,
  SpendConfirmation,
  participationKey,
  clearParticipationKey,
} from "../lib";
import type { Room } from "../types";
import { QuestionChoices } from "./Quiz";
export function Live() {
  const { join, user, auth } = useApp(),
    navigate = useNavigate();
  const { data, isPending, error } = useQuery({
    queryKey: ["competitions"],
    queryFn: () => api<{ items: Room[] }>("/competitions"),
    refetchInterval: 10000,
  });
  const [filter, setFilter] = useState("All events");
  const items = data?.items.filter(
    (c) =>
      filter === "All events" ||
      (filter === "Live now"
        ? c.status === "LIVE"
        : filter === "Upcoming"
          ? ["SCHEDULED", "LOBBY"].includes(c.status)
          : c.status === "COMPLETED"),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />A LITTLE FRIENDLY RIVALRY
          </span>
          <h1>Good minds think together.</h1>
          <p>
            Make an evening of it. Find your people. Bring your best answers.
          </p>
        </div>
        <button className="btn primary" onClick={join}>
          <Icon name="Plus" size={17} /> Join with a code
        </button>
      </div>
      <section className="live-page-banner">
        <div>
          <span className="hero-kicker">✦ MADE FOR REAL-TIME AHA MOMENTS</span>
          <h2>
            Same questions.
            <br />A whole new competition.
          </h2>
          <p>Play together, wherever together happens to be.</p>
          <button
            className="btn light"
            onClick={() => (user ? navigate("/organizer") : auth("register"))}
          >
            Host your own quiz night <Icon name="ArrowUpRight" size={17} />
          </button>
        </div>
        <div className="live-banner-art">
          <Icon name="Radio" size={85} />
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span>✦</span>
        </div>
      </section>
      <div className="tab-row">
        {["All events", "Live now", "Upcoming", "Completed"].map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={filter === t ? "active" : ""}
          >
            {t}
            {t === "Live now" && <span className="status-dot" />}
          </button>
        ))}
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : !items?.length ? (
        <Empty
          icon="Radio"
          title="A room full of possibility."
          description="There aren’t any events here yet. Yours could be the next one."
        >
          <button className="btn primary" onClick={join}>
            Join with a code <Icon name="ArrowRight" size={17} />
          </button>
        </Empty>
      ) : (
        <div className="event-grid">
          {items.map((c) => (
            <article className="event-card" key={c.id}>
              <div className="event-card-art">
                <Icon name={c.sample ? "Clapperboard" : "Radio"} size={50} />
                <span className={`state-label ${c.status.toLowerCase()}`}>
                  <i />
                  {c.status === "LOBBY" ? "ROOM OPEN" : c.status}
                </span>
                <b>
                  GREAT MINDS.
                  <br />
                  GOOD TIMES.
                </b>
                <span className="event-art-star">✷</span>
              </div>
              <div className="event-card-body">
                <span className="price-pill">
                  <Icon
                    name={c.pricing?.coinPrice ? "Coins" : "Sparkles"}
                    size={18}
                  />
                  {c.pricing?.coinPrice
                    ? `${c.pricing.coinPrice} coins · one entry`
                    : "Free event entry"}
                </span>
                {c.sample && (
                  <span className="eyebrow">
                    SAMPLE EVENT · EXPLORE THE FORMAT
                  </span>
                )}
                <h3>{c.title}</h3>
                <p>
                  {c.description ||
                    "Your host has a great set of questions waiting. Come put your knowledge to the test."}
                </p>
                <div className="event-card-stats">
                  <span>
                    <Icon name="Users" size={16} />
                    {c.participantCount} / {c.capacity} players
                  </span>
                  <span>
                    <Icon name="BookOpen" size={16} />
                    {c.total} questions
                  </span>
                </div>
                {c.startsAt && (
                  <div className="event-schedule">
                    <Icon name="Calendar" size={15} />
                    {date(c.startsAt)}
                  </div>
                )}
                <Link className="btn outline full" to={`/live/${c.id}`}>
                  {c.status === "COMPLETED"
                    ? "See the results"
                    : c.sample
                      ? "Explore sample room"
                      : "Enter the room"}
                  <Icon name="ArrowUpRight" size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
export function LiveRoom() {
  const [spend, setSpend] = useState(false);
  const { id } = useParams(),
    { user, auth, toast } = useApp(),
    client = useQueryClient(),
    navigate = useNavigate();
  const {
    data: room,
    isPending,
    error,
  } = useQuery({
    queryKey: ["room", id],
    queryFn: () => api<Room>(`/competitions/${id}`),
    refetchInterval: 3000,
  });
  const [connected, setConnected] = useState(false),
    [selected, setSelected] = useState<number[]>([]),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [now, setNow] = useState(Date.now()),
    [offset, setOffset] = useState(0),
    [confirm, setConfirm] = useState("");
  useEffect(() => {
    if (room) setOffset(room.serverTime - Date.now());
  }, [room?.serverTime]);
  useEffect(() => {
    setSelected([]);
    setText("");
    setErr("");
  }, [room?.question?.id]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!user || !room || (!room.joined && !room.isHost)) return;
    const socket = io(API || window.location.origin, { withCredentials: true });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:subscribe", id);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));
    socket.on("room:state", (state: Room) => {
      client.setQueryData(["room", id], (old: Room | undefined) =>
        old && old.sequence > state.sequence ? old : state,
      );
    });
    socket.on("room:removed", ({ message }: { message: string }) => {
      setErr(message);
      void client.invalidateQueries({ queryKey: ["room", id] });
    });
    return () => {
      socket.disconnect();
      setConnected(false);
    };
  }, [id, user?.id, room?.joined, room?.isHost]);
  async function control(action: string) {
    setBusy(true);
    try {
      const state = await api(`/organizer/competitions/${id}/control`, "POST", {
        action,
      });
      client.setQueryData(["room", id], state);
      setConfirm("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function joinRoom(consent?: any) {
    if (!user) return auth("login");
    if (room?.pricing.coinPrice && !consent?.confirmed) {
      if (!room.paidEntriesEnabled) {
        setErr(
          "Coin-entry events are not open yet. No coins have been charged.",
        );
        return;
      }
      setSpend(true);
      return;
    }
    setBusy(true);
    try {
      await api("/competitions/join", "POST", {
        code: room!.code,
        ...(consent?.confirmed ? consent : {}),
      });
      clearParticipationKey(`room:${id}`);
      client.invalidateQueries({ queryKey: ["wallet"] });
      await client.invalidateQueries({ queryKey: ["room", id] });
    } catch (e) {
      setErr((e as Error).message);
      if (consent?.confirmed) throw e;
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <Spinner />;
  if (error || !room)
    return <ErrorNote message={error?.message || "Room unavailable."} />;
  const remaining = Math.max(
    0,
    Math.ceil((new Date(room.deadline).getTime() - now - offset) / 1000),
  );
  const sample = room.hostId === "platform";
  return (
    <>
      <Link className="back-link" to="/live">
        <Icon name="ChevronLeft" size={16} /> All competitions
      </Link>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />
            {sample
              ? "A PREVIEW OF YOUR NEXT QUIZ NIGHT"
              : room.status === "LIVE"
                ? "YOUR CURIOUS MOMENT, LIVE"
                : "A GREAT QUIZ STARTS WITH GOOD COMPANY"}
          </span>
          <h1>{room.title}</h1>
          <p>{room.description}</p>
        </div>
        <span className={`connection-status ${connected ? "connected" : ""}`}>
          <i />
          {connected
            ? "Connected live"
            : room.joined || room.isHost
              ? "Syncing via server"
              : "Room preview"}
        </span>
      </div>
      {sample && (
        <div className="info-note">
          <Icon name="Sparkles" size={19} />
          <span>
            This is a sample room. Start your own competition to invite friends
            and host a live quiz.
          </span>
          <button
            className="text-btn"
            onClick={() => (user ? navigate("/organizer") : auth("register"))}
          >
            Create your room <Icon name="ArrowUpRight" size={16} />
          </button>
        </div>
      )}
      {err && <ErrorNote message={err} />}
      <div className="room-grid">
        <section className="room-main">
          {["SCHEDULED", "LOBBY"].includes(room.status) ? (
            <div className="room-lobby">
              <div className="lobby-symbol">
                <Icon name="Radio" size={48} />
                <span className="lobby-ring" />
              </div>
              <span className="eyebrow">
                {room.joined
                  ? "YOU’RE IN GOOD COMPANY"
                  : "GATHER YOUR BRIGHTEST MINDS"}
              </span>
              <h2>
                {room.joined
                  ? "You’re in. Get comfortable."
                  : "The next great quiz night starts here."}
              </h2>
              <p>
                {room.joined
                  ? "Your host will start the competition when everyone is ready. Keep this page open."
                  : "Share the code. Bring your people. Let a little friendly competition begin."}
              </p>
              <div className="room-code">
                <span>ROOM CODE</span>
                <button
                  onClick={async () => {
                    try {
                      await copy(room.code);
                      toast("Room code copied.");
                    } catch (e) {
                      toast((e as Error).message);
                    }
                  }}
                >
                  {room.code}
                  <Icon name="Copy" size={19} />
                </button>
              </div>
              {!room.joined && !room.isHost && !sample && (
                <button
                  className="btn primary"
                  onClick={joinRoom}
                  disabled={busy}
                >
                  Take my place <Icon name="ArrowRight" size={17} />
                </button>
              )}
              {room.startsAt && (
                <div className="lobby-schedule">
                  <Icon name="Calendar" size={15} /> Scheduled for{" "}
                  {date(room.startsAt)}
                </div>
              )}
              <div className="lobby-facts">
                <span>
                  <Icon
                    name={room.pricing?.coinPrice ? "Coins" : "Sparkles"}
                    size={19}
                  />
                  {room.pricing?.coinPrice
                    ? `${room.pricing.coinPrice} coins · one entry`
                    : "Free entry"}
                </span>
                <span>
                  <Icon name="BookOpen" size={16} />
                  {room.total} questions
                </span>
                <span>
                  <Icon name="Users" size={16} />
                  {room.capacity} players max
                </span>
                <span>
                  <Icon name="Shield" size={16} />
                  Fair scoring
                </span>
              </div>
            </div>
          ) : room.status === "LIVE" && room.question ? (
            <div className="live-question">
              <div className="question-meta">
                <span className="eyebrow">
                  QUESTION {room.index + 1} / {room.total}
                </span>
                <span
                  className={`question-timer ${remaining <= 5 ? "urgent" : ""}`}
                >
                  <Icon name="Clock" size={17} />
                  {remaining}
                  <small>SEC</small>
                </span>
              </div>
              <QuestionChoices
                question={room.question}
                selected={selected}
                setSelected={setSelected}
                text={text}
                setText={setText}
                disabled={
                  busy || room.submitted || remaining === 0 || !room.joined
                }
              />
              {room.submitted ? (
                <div className="submission-confirm">
                  <Icon name="CheckCircle2" size={23} />
                  <div>
                    <b>Locked in. Nice work.</b>
                    <p>The next question will appear automatically.</p>
                  </div>
                </div>
              ) : room.joined ? (
                <button
                  className="btn primary full"
                  disabled={
                    busy ||
                    remaining === 0 ||
                    (!selected.length && !text.trim())
                  }
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`/competitions/${id}/answer`, "POST", {
                        questionId: room.question!.id,
                        selected,
                        text,
                      });
                      await client.invalidateQueries({
                        queryKey: ["room", id],
                      });
                    } catch (e) {
                      setErr((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Lock in my answer <Icon name="ArrowRight" size={17} />
                </button>
              ) : (
                <div className="info-note">
                  {room.isHost
                    ? "You’re hosting this round. Participants are answering now."
                    : "Registration has closed. Enjoy the live standings."}
                </div>
              )}
            </div>
          ) : room.status === "PAUSED" ? (
            <Empty
              icon="Pause"
              title="A little pause in the action."
              description="Your host will resume shortly. Your answers are safe."
            />
          ) : room.status === "COMPLETED" ? (
            <div className="room-finished">
              <div className="result-medal">
                <Icon name="Trophy" size={42} />
              </div>
              <span className="eyebrow">THAT’S A ROUND WELL PLAYED</span>
              <h2>Good questions. Great company.</h2>
              <p>
                The final standings are in. Thanks for bringing your curious
                side.
              </p>
              <Link className="btn primary" to="/live">
                Find the next competition <Icon name="ArrowRight" size={17} />
              </Link>
            </div>
          ) : (
            <Empty
              icon="Flag"
              title="This room has closed."
              description="The host canceled this competition. Your next great quiz is still out there."
            />
          )}
        </section>
        <aside className="room-side">
          {(room.isHost || user?.role === "SUPER_ADMIN") && (
            <div className="panel host-controls">
              <span className="eyebrow">YOUR HOST SEAT</span>
              <h3>Set the pace.</h3>
              <div className="host-control-buttons">
                {["SCHEDULED", "LOBBY"].includes(room.status) && (
                  <button
                    className="btn primary full"
                    onClick={() => control("start")}
                    disabled={busy}
                  >
                    <Icon name="Play" size={17} /> Start competition
                  </button>
                )}
                {room.status === "LIVE" && (
                  <button
                    className="btn outline full"
                    onClick={() => control("pause")}
                    disabled={busy}
                  >
                    <Icon name="Pause" size={17} /> Pause round
                  </button>
                )}
                {room.status === "PAUSED" && (
                  <button
                    className="btn primary full"
                    onClick={() => control("resume")}
                    disabled={busy}
                  >
                    <Icon name="Play" size={17} /> Resume competition
                  </button>
                )}
                {["LIVE", "PAUSED"].includes(room.status) && (
                  <button
                    className="btn outline full"
                    onClick={() => setConfirm("end")}
                  >
                    <Icon name="Square" size={16} /> End competition
                  </button>
                )}
                {!["COMPLETED", "CANCELLED"].includes(room.status) && (
                  <button
                    className="text-btn danger"
                    onClick={() => setConfirm("cancel")}
                  >
                    Cancel competition
                  </button>
                )}
                {room.status === "COMPLETED" && (
                  <a
                    className="btn outline full"
                    href={`${API}/api/organizer/competitions/${id}/export`}
                  >
                    <Icon name="Download" size={17} /> Export results
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="panel room-standings">
            <div className="rail-heading">
              <h3>
                <Icon
                  name={room.status === "COMPLETED" ? "Trophy" : "Users"}
                  size={18}
                />
                {room.status === "COMPLETED"
                  ? "Final standings"
                  : "In good company"}
              </h3>
              <span className="count-pill">{room.participantCount}</span>
            </div>
            {!room.leaderboard?.length ? (
              <Empty
                icon="Users"
                title="The room is yours."
                description="Share your code and invite a little friendly rivalry."
              />
            ) : (
              <div className="room-participants">
                {room.leaderboard.map((p) => (
                  <div key={p.userId}>
                    <span className="participant-rank">{p.rank}</span>
                    <span className="avatar tiny-avatar">
                      {p.displayName.slice(0, 2)}
                    </span>
                    <div>
                      <b>
                        {p.displayName}
                        {p.userId === user?.id && <small> YOU</small>}
                      </b>
                      <span>@{p.username}</span>
                    </div>
                    <strong>
                      {p.score}
                      <small> pts</small>
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="room-integrity">
            <Icon name="Shield" size={16} /> Same questions. Server-timed
            rounds. 100 points per correct answer.
          </p>
        </aside>
      </div>
      {spend && (
        <SpendConfirmation
          title={room.title}
          coinPrice={room.pricing.coinPrice}
          version={room.pricing.version}
          requestKey={participationKey(`room:${id}`)}
          confirm={joinRoom}
          close={() => setSpend(false)}
          event
        />
      )}
      {confirm && (
        <Modal title="Confirm competition action" close={() => setConfirm("")}>
          <h2>
            {confirm === "end" ? "Call it a competition?" : "Close this room?"}
          </h2>
          <p className="muted">
            {confirm === "end"
              ? "Submitted answers will determine the final standings. Remaining questions will not be played."
              : "Everyone in the room will see that this competition was canceled."}
          </p>
          <button
            className="btn primary full"
            disabled={busy}
            onClick={() => control(confirm)}
          >
            Confirm {confirm === "end" ? "end" : "cancellation"}
          </button>
          <button className="btn outline full" onClick={() => setConfirm("")}>
            Keep the room open
          </button>
        </Modal>
      )}
    </>
  );
}
