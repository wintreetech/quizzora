import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  api,
  Icon,
  useApp,
  Spinner,
  Empty,
  ErrorNote,
  Modal,
  date,
} from "../lib";
import { Gate } from "./Player";
import { QuestionBank } from "./Organizer";
import AdminQuizManagement from "../components/AdminQuizManagement";
import {
  EconomyAdmin,
  EconomyDashboard,
  economySections,
} from "./EconomyAdmin";
export function Admin() {
  const { user, toast } = useApp(),
    client = useQueryClient();
  const [search, setSearch] = useState(""),
    [action, setAction] = useState<{ type: string; item: any } | null>(null),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  const can = user?.role === "SUPER_ADMIN";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const section = params.get("section") || "Overview";
  const tab = [
    "Overview",
    "Users",
    "Quizzes",
    "Competitions",
    "Tournaments",
    "Organizers",
    "Admin Management",
    "Question Bank",
    "Categories",
    "Reports",
    "Audit logs",
    "Plans",
    "Settings",
    ...economySections,
  ].includes(section)
    ? section
    : "Overview";
  const economyTab = economySections.includes(tab);
  const resource: Record<string, string> = {
    Overview: "overview",
    Users: `users?q=${encodeURIComponent(search)}`,
    Quizzes: "quizzes",
    Competitions: "competitions",
    Tournaments: "tournaments",
    Organizers: `users?group=organizers&q=${encodeURIComponent(search)}`,
    "Admin Management": `users?group=admins&q=${encodeURIComponent(search)}`,
    "Question Bank": "quizzes",
    Categories: "categories",
    Reports: "reports",
    "Audit logs": "audit",
    Plans: "plans",
    Settings: "settings",
    ...Object.fromEntries(economySections.map((s) => [s, "economy"])),
  };
  const { data, isPending, error } = useQuery({
    queryKey: ["admin", tab, search],
    queryFn: () => api(`/admin/${resource[tab]}`),
    enabled: can && !economyTab && tab !== "Quizzes",
  });
  if (!user) return <Gate title="A little oversight. A better platform." />;
  if (!can)
    return (
      <Empty
        icon="Shield"
        title="The platform owner’s space."
        description="Your account does not have access to administration tools."
      />
    );
  async function mutate(path: string, method: string, body: any) {
    setBusy(true);
    setErr("");
    try {
      await api(path, method, body);
      await client.invalidateQueries({ queryKey: ["admin"] });
      setAction(null);
      toast("Change recorded. Audit log updated.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            <i />
            GOOD PLATFORMS NEED THOUGHTFUL OVERSIGHT
          </span>
          <h1>A clear view of everything.</h1>
          <p>
            Keep the questions good, the competition fair, and your community in
            good hands.
          </p>
        </div>
        <span className="admin-access">
          <Icon name="Shield" size={15} /> Super administrator
        </span>
      </div>
      <div className="admin-navigation">
        <div className="admin-quick-links">
          {["Overview", "Quizzes", "Users", "Payments"].map((t) => (
            <button
              key={t}
              className={`btn ${tab === t ? "primary" : "outline"}`}
              onClick={() => {
                setParams({ section: t });
                setErr("");
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <label>
          Admin section
          <select
            value={tab}
            onChange={(e) => {
              setParams({ section: e.target.value });
              setErr("");
            }}
          >
            {[
              ["Overview", ["Overview", "Analytics"]],
              ["Content", ["Quizzes", "Question Bank", "Categories"]],
              ["People", ["Users", "Organizers", "Admin Management"]],
              [
                "Coin economy",
                ["Wallets & Coins", "Coin Packages", "Quiz Pricing"],
              ],
              [
                "Events",
                [
                  "Competitions",
                  "Competition Pricing",
                  "Tournaments",
                  "Tournament Pricing",
                ],
              ],
              ["Payments", ["Payments", "Pending Recovery"]],
              ["Platform", ["Reports", "Audit logs", "Plans", "Settings"]],
            ].map(([label, sections]) => (
              <optgroup key={label as string} label={label as string}>
                {(sections as string[])
                  .filter((section) => Object.hasOwn(resource, section))
                  .map((section) => (
                    <option key={section} value={section}>
                      {section === "Coin Packages" ? "Store pricing" : section}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {err && !action && <ErrorNote message={err} />}{" "}
      {economyTab ? (
        <EconomyAdmin section={tab} />
      ) : tab === "Quizzes" ? (
        <AdminQuizManagement />
      ) : isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorNote message={error.message} />
      ) : (
        <>
          {tab === "Overview" && (
            <>
              <EconomyDashboard />
              <div className="stat-grid">
                {[
                  ["Users", "Registered users", data?.users],
                  ["Briefcase", "Organizers", data?.organizers],
                  ["BookOpen", "Published quizzes", data?.quizzes],
                  ["CheckCircle2", "Completed attempts", data?.attempts],
                  ["Radio", "Live competitions", data?.live],
                  ["Flag", "Total competitions", data?.competitions],
                  ["Shield", "Open reports", data?.reports],
                  ["Users", "Friend challenges", data?.challenges],
                ].map(([icon, label, value]: any) => (
                  <div className="stat-card" key={label}>
                    <span className="stat-icon">
                      <Icon name={icon} />
                    </span>
                    <span>{label}</span>
                    <strong>{value ?? 0}</strong>
                    <small>From your platform database</small>
                  </div>
                ))}
              </div>
              <div className="info-note">
                <Icon name="Shield" size={20} />
                <p>
                  Payments require a verified merchant connection.
                  Administrative actions are recorded in the audit log.
                </p>
              </div>
            </>
          )}
          {["Users", "Organizers", "Admin Management"].includes(tab) && (
            <>
              <div className="section-heading">
                <h2>The people behind the curiosity.</h2>
                <label className="inline-search">
                  <Icon name="Search" size={17} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search username…"
                    aria-label="Search users"
                  />
                </label>
              </div>
              <div className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.items.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.displayName}</b>
                          <small>
                            @{u.username} · {u.email}
                          </small>
                          {u.deletionRequestedAt && (
                            <small className="danger">
                              Deletion requested {date(u.deletionRequestedAt)}
                            </small>
                          )}
                        </td>
                        <td>
                          <span className="badge">
                            {u.role.replace("_", " ")}
                          </span>
                        </td>
                        <td>{u.suspended ? "Suspended" : "Active"}</td>
                        <td>{date(u.createdAt)}</td>
                        <td>
                          <button
                            className="text-btn"
                            disabled={u.id === user.id}
                            onClick={() => setAction({ type: "user", item: u })}
                          >
                            Manage access <Icon name="ArrowUpRight" size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {tab === "Question Bank" && (
            <QuestionBank
              quizzes={data?.items || []}
              edit={(id) => navigate(`/organizer?edit=${id}`)}
            />
          )}
          {tab === "Categories" && (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total quizzes</th>
                    <th>Published quizzes</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((c: any) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td>{c.quizzes}</td>
                      <td>{c.published}</td>
                      <td>
                        <Link
                          className="text-btn"
                          to={`/?category=${encodeURIComponent(c.name)}`}
                        >
                          Explore category
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "Tournaments" && (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tournament</th>
                    <th>Registration closes</th>
                    <th>Rounds</th>
                    <th>Capacity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((t: any) => (
                    <tr key={t._id}>
                      <td>
                        <b>{t.title}</b>
                        <small>{t.status || "Scheduled"}</small>
                      </td>
                      <td>{date(t.registrationClosesAt)}</td>
                      <td>{t.roundIds.length}</td>
                      <td>{t.capacity}</td>
                      <td>
                        <Link className="text-btn" to={`/tournaments/${t._id}`}>
                          Inspect tournament
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "Competitions" && (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Competition</th>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Capacity</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((c: any) => (
                    <tr key={c._id}>
                      <td>
                        <b>{c.title}</b>
                        <small>{date(c.createdAt)}</small>
                      </td>
                      <td>
                        <span className="badge">{c.status}</span>
                      </td>
                      <td>
                        <code>{c.code}</code>
                      </td>
                      <td>{c.capacity}</td>
                      <td>
                        <Link className="text-btn" to={`/live/${c._id}`}>
                          Inspect room <Icon name="ArrowUpRight" size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "Reports" &&
            (data?.items.length ? (
              <div className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Target</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r: any) => (
                      <tr key={r._id}>
                        <td className="report-reason">
                          <b>{r.reason}</b>
                          <small>{date(r.createdAt)}</small>
                        </td>
                        <td>
                          <code>{r.targetId.slice(-8)}</code>
                        </td>
                        <td>
                          <span className="badge">{r.status}</span>
                        </td>
                        <td>
                          <select
                            className="form-input"
                            aria-label="Report status"
                            value={r.status}
                            onChange={(e) =>
                              mutate(`/admin/reports/${r._id}`, "PATCH", {
                                status: e.target.value,
                              })
                            }
                          >
                            <option>open</option>
                            <option>resolved</option>
                            <option>dismissed</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                icon="Shield"
                title="A good kind of quiet."
                description="No reports to review. Keep making room for good questions."
              />
            ))}
          {tab === "Audit logs" && (
            <div className="panel table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((a: any) => (
                    <tr key={a._id}>
                      <td>
                        <b>{a.action}</b>
                        {a.details && (
                          <details className="audit-details">
                            <summary>View details</summary>
                            <pre>{JSON.stringify(a.details, null, 2)}</pre>
                          </details>
                        )}
                      </td>
                      <td>
                        <code>
                          {a.actorId === "provisioning-cli"
                            ? a.actorId
                            : a.actorId.slice(-8)}
                        </code>
                      </td>
                      <td>
                        <code>{a.targetId.slice(-8)}</code>
                      </td>
                      <td>{date(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === "Plans" && (
            <>
              <div className="info-note">
                <Icon name="Lock" size={18} />
                <p>
                  Plan limits are configurable. Payment processing remains
                  disabled. Capacity values have not been load-tested.
                </p>
              </div>
              <div className="pricing-grid admin-plans">
                {data?.items.map((p: any) => (
                  <form
                    className="panel form-stack"
                    key={p._id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      mutate(`/admin/plans/${p._id}`, "PATCH", {
                        name: f.get("name"),
                        quizLimit: Number(f.get("quizLimit")),
                        participantLimit: Number(f.get("participantLimit")),
                      });
                    }}
                  >
                    <span className="eyebrow">{p.key.toUpperCase()}</span>
                    <label>
                      Plan name
                      <input
                        name="name"
                        required
                        minLength={2}
                        defaultValue={p.name}
                      />
                    </label>
                    <label>
                      Quiz limit
                      <input
                        name="quizLimit"
                        type="number"
                        min={0}
                        max={1000}
                        required
                        defaultValue={p.quizLimit}
                      />
                    </label>
                    <label>
                      Participant limit
                      <input
                        name="participantLimit"
                        type="number"
                        min={0}
                        max={1000}
                        required
                        defaultValue={p.participantLimit}
                      />
                    </label>
                    <button className="btn outline" disabled={busy}>
                      Save limits <Icon name="Check" size={16} />
                    </button>
                  </form>
                ))}
              </div>
            </>
          )}
          {tab === "Settings" && (
            <form
              className="panel form-stack admin-settings"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                mutate("/admin/settings", "PUT", {
                  supportEmail: f.get("supportEmail"),
                  announcement: f.get("announcement"),
                });
              }}
            >
              <h2>The little details people see.</h2>
              <label>
                Public support email
                <input
                  type="email"
                  name="supportEmail"
                  defaultValue={
                    data?.items.find((i: any) => i.key === "public")?.value
                      ?.supportEmail || ""
                  }
                  placeholder="Your configured support address"
                />
              </label>
              <label>
                Public announcement
                <textarea
                  rows={3}
                  name="announcement"
                  maxLength={300}
                  defaultValue={
                    data?.items.find((i: any) => i.key === "public")?.value
                      ?.announcement || ""
                  }
                />
              </label>
              <p className="field-note">
                Infrastructure secrets and security flags are configured through
                server environment variables.
              </p>
              <button className="btn primary" disabled={busy}>
                Save platform details <Icon name="Check" size={16} />
              </button>
            </form>
          )}
        </>
      )}
      {action && (
        <Modal
          title={
            action.type === "user"
              ? "Manage account access"
              : "Review quiz content"
          }
          close={() => {
            setAction(null);
            setErr("");
          }}
        >
          <span className="eyebrow">A THOUGHTFUL CHANGE</span>
          <h2>
            {action.type === "user"
              ? "The right access for the right person."
              : "Keep the good questions coming."}
          </h2>
          <p className="muted">
            {action.type === "user"
              ? `${action.item.displayName} · @${action.item.username}`
              : action.item.title}
          </p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (action.type === "user")
                mutate(`/admin/users/${action.item.id}`, "PATCH", {
                  role: f.get("role"),
                  suspended: f.get("suspended") === "true",
                  confirm: true,
                });
              else
                mutate(`/admin/quizzes/${action.item.id}`, "PATCH", {
                  status: f.get("status"),
                  reason: f.get("reason"),
                });
            }}
          >
            {action.type === "user" ? (
              <>
                <label>
                  Platform role
                  <select name="role" defaultValue={action.item.role}>
                    {["PLAYER", "ORGANIZER", "MODERATOR", "SUPER_ADMIN"].map(
                      (r) => (
                        <option key={r}>{r}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Account status
                  <select
                    name="suspended"
                    defaultValue={String(action.item.suspended)}
                  >
                    <option value="false">Active</option>
                    <option value="true">Suspended</option>
                  </select>
                </label>
                <div className="info-note">
                  <Icon name="Shield" size={18} />
                  <p>
                    This changes server permissions and ends all existing
                    sessions for this account. The change will be audited.
                  </p>
                </div>
                <label className="check-label">
                  <input type="checkbox" required /> I confirm this account
                  should receive the selected access.
                </label>
              </>
            ) : (
              <>
                <label>
                  Publication status
                  <select name="status" defaultValue={action.item.status}>
                    <option value="published">Published</option>
                    <option value="draft">Hidden draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>
                  Reason for this action
                  <textarea
                    name="reason"
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                  />
                </label>
              </>
            )}
            {err && <ErrorNote message={err} />}
            <button className="btn primary full" disabled={busy}>
              {busy ? <Spinner small /> : "Confirm & save change"}
              <Icon name="Check" size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
