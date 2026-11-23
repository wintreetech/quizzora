import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  X,
  Check,
  AlertCircle,
  LoaderCircle,
  ArrowRight,
  Search,
  Trophy,
  Sparkles,
  Compass,
  LayoutDashboard,
  Radio,
  Flag,
  Bookmark,
  Medal,
  Settings,
  LifeBuoy,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Bell,
  Zap,
  Clock,
  Users,
  Play,
  Globe,
  Atom,
  Monitor,
  Clapperboard,
  Music,
  Dribbble,
  Landmark,
  Briefcase,
  SlidersHorizontal,
  ArrowUpRight,
  LogOut,
  UserRound,
  Target,
  Flame,
  Copy,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  Download,
  Shield,
  FileText,
  Calendar,
  Pause,
  Square,
  Send,
  Heart,
  BookOpen,
  ChartNoAxesCombined,
  MoreHorizontal,
  Link as LinkIcon,
  RotateCcw,
  Sun,
  Moon,
  ChevronUp,
  CheckCheck,
  Coins,
  Wallet,
  CreditCard,
  ArrowDownLeft,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { User } from "./types";
import { OnboardingTour } from "./components/OnboardingTour";
export const icons = {
  X,
  Check,
  AlertCircle,
  LoaderCircle,
  ArrowRight,
  Search,
  Trophy,
  Sparkles,
  Compass,
  LayoutDashboard,
  Radio,
  Flag,
  Bookmark,
  Medal,
  Settings,
  LifeBuoy,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Bell,
  Zap,
  Clock,
  Users,
  Play,
  Globe,
  Atom,
  Monitor,
  Clapperboard,
  Music,
  Dribbble,
  Landmark,
  Briefcase,
  SlidersHorizontal,
  ArrowUpRight,
  LogOut,
  UserRound,
  Target,
  Flame,
  Copy,
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  Download,
  Shield,
  FileText,
  Calendar,
  Pause,
  Square,
  Send,
  Heart,
  BookOpen,
  ChartNoAxesCombined,
  MoreHorizontal,
  LinkIcon,
  RotateCcw,
  Sun,
  Moon,
  ChevronUp,
  CheckCheck,
  Coins,
  Wallet,
  CreditCard,
  ArrowDownLeft,
};
export function Icon({
  name,
  size = 20,
  ...props
}: {
  name: keyof typeof icons;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const C = icons[name] || BookOpen;
  return <C size={size} strokeWidth={1.8} aria-hidden="true" {...props} />;
}
export const API = (import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Quizora": "1" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(
      "The server is not available. Please try again shortly.",
      res.status,
    );
  }
  if (!res.ok)
    throw new ApiError(
      data.message || "Unable to complete your request.",
      res.status,
    );
  return data;
}
export const query = (key: string, path: string) => ({
  queryKey: [key],
  queryFn: () => api(path),
});
export function newRequestKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function participationKey(target: string) {
  const name = `quizora-entry:${target}`;
  let key = sessionStorage.getItem(name);
  if (!key) {
    key = newRequestKey();
    sessionStorage.setItem(name, key);
  }
  return key;
}
export const clearParticipationKey = (target: string) =>
  sessionStorage.removeItem(`quizora-entry:${target}`);
export function SpendConfirmation({
  title,
  coinPrice,
  version,
  includedAttempts = 1,
  questionCount,
  requestKey,
  confirm,
  close,
  event = false,
}: {
  title: string;
  coinPrice: number;
  version: number;
  includedAttempts?: number;
  questionCount?: number;
  requestKey: string;
  confirm: (consent: any) => Promise<void>;
  close: () => void;
  event?: boolean;
}) {
  const { user } = useApp();
  const { data: w } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => api("/wallet"),
    enabled: !!user,
    staleTime: 0,
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const enough = w && w.balance >= coinPrice && !w.reversalHold;
  return (
    <Modal title="Confirm coin entry" close={close}>
      <div className="spend-symbol">
        <Icon name="Coins" size={34} />
      </div>
      <span className="eyebrow">YOUR COINS. YOUR CALL.</span>
      <h2>Make this your next round.</h2>
      <p className="muted">
        {title}
        {questionCount ? ` - ${questionCount} questions` : ""}
      </p>
      <div className="spend-quote">
        <span>
          {event
            ? "Entry pass"
            : `${includedAttempts} official ${includedAttempts === 1 ? "attempt" : "attempts"}`}
        </span>
        <strong>
          <Icon name="Coins" size={26} />
          {coinPrice.toLocaleString()} <small>coins</small>
        </strong>
        <div>
          <span>Your available balance</span>
          <b>{w ? w.balance.toLocaleString() : "—"} coins</b>
        </div>
        <div>
          <span>Balance after entry</span>
          <b>
            {w ? Math.max(0, w.balance - coinPrice).toLocaleString() : "—"}{" "}
            coins
          </b>
        </div>
      </div>
      <div className="purchase-policy">
        <Icon name="Shield" size={20} />
        <p>
          {event
            ? "One charge for this entry. Rejoining is included. Host cancellations restore the entry coins once."
            : "Refreshing or reconnecting to this attempt is included. A new attempt costs coins unless an included attempt remains. Verified launch failures can be restored or refunded."}{" "}
          Incorrect answers, losing, and voluntary exits are not refundable.
          Coins never affect scoring.
        </p>
      </div>
      {error && <ErrorNote message={error} />}{" "}
      {w && !enough ? (
        <>
          <p className="wallet-shortfall">
            {w.reversalHold
              ? "Your wallet has a payment review hold. Contact support."
              : `You need ${Math.max(0, coinPrice - w.balance)} more coins for this round.`}
          </p>
          {w.purchasesAvailable === false && !w.reversalHold && (
            <p className="muted">
              Coin purchases are currently unavailable. You can choose a free
              quiz while the merchant connection is completed.
            </p>
          )}
          <Link
            className="btn primary full"
            to={`/store?returnTo=${encodeURIComponent(window.location.pathname)}`}
            onClick={close}
          >
            Explore coin store <Icon name="ArrowRight" size={19} />
          </Link>
        </>
      ) : (
        <button
          className="btn primary full large"
          disabled={busy || !enough}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await confirm({
                confirmed: true,
                coinPrice,
                pricingVersion: version,
                requestKey,
              });
              close();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner small /> : `Confirm & spend ${coinPrice} coins`}
          <Icon name="ArrowRight" size={19} />
        </button>
      )}
      <button className="text-btn center full cancel-spend" onClick={close}>
        Not this round
      </button>
    </Modal>
  );
}
type ContextType = {
  user: User | null;
  loading: boolean;
  auth: (mode?: "login" | "register", after?: () => void) => void;
  toast: (message: string) => void;
  join: () => void;
  save: (id: string) => void;
  saved: string[];
  tour: () => void;
};
const Context = createContext<ContextType>(null!);
export const useApp = () => useContext(Context);
export function Provider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ user: User | null }>("/auth/me"),
    retry: 1,
  });
  const [authMode, setAuth] = useState<"login" | "register" | null>(null);
  const after = useRef<(() => void) | undefined>(undefined);
  const [join, setJoin] = useState(false);
  const [message, setMessage] = useState("");
  const [manualTour, setManualTour] = useState(false),
    [dismissedTourUser, setDismissedTourUser] = useState<string | null>(null);
  const afterTour = useRef<(() => void) | undefined>(undefined);
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("quizora-saved") || "[]",
      );
      return Array.isArray(stored)
        ? stored
            .filter(
              (id): id is string =>
                typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id),
            )
            .slice(-200)
        : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(""), 4500);
      return () => clearTimeout(t);
    }
  }, [message]);
  const value: ContextType = {
    user: data?.user || null,
    loading: isPending,
    auth: (mode = "login", cb) => {
      after.current = cb;
      setAuth(mode);
    },
    toast: setMessage,
    tour: () => setManualTour(true),
    join: () => {
      if (!data?.user) {
        after.current = () => setJoin(true);
        setAuth("login");
      } else setJoin(true);
    },
    saved,
    save: (id) => {
      if (!saved.includes(id) && saved.length >= 200) {
        setMessage(
          "Your collection is full. Unsave a quiz before adding another.",
        );
        return;
      }
      setSaved((prev) => {
        const next = prev.includes(id)
          ? prev.filter((s) => s !== id)
          : [...prev, id];
        localStorage.setItem("quizora-saved", JSON.stringify(next));
        return next;
      });
    },
  };
  return (
    <Context.Provider value={value}>
      {children}
      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuth}
          close={() => setAuth(null)}
          done={async () => {
            await client.invalidateQueries({ queryKey: ["me"] });
            setAuth(null);
            setMessage(
              authMode === "register"
                ? "Welcome to your curious side. You’re in!"
                : "Welcome back. Good to see you.",
            );
            const fresh = client.getQueryData<{ user: User | null }>(["me"]);
            const next =
              after.current ||
              (authMode === "register"
                ? () => navigate("/dashboard")
                : undefined);
            if (fresh?.user?.onboarding?.required) afterTour.current = next;
            else next?.();
            after.current = undefined;
          }}
        />
      )}
      {join && <JoinModal close={() => setJoin(false)} />}{" "}
      {!authMode &&
        !join &&
        (manualTour ||
          (data?.user?.onboarding?.required &&
            data.user.id !== dismissedTourUser)) && (
          <OnboardingTour
            key={data?.user?.id || "guest"}
            user={data?.user || null}
            replay={manualTour}
            done={() => {
              setManualTour(false);
              setDismissedTourUser(data?.user?.id || null);
              afterTour.current?.();
              afterTour.current = undefined;
            }}
          />
        )}
      {message && (
        <div className="toast" role="status">
          <Icon name="CheckCircle2" size={19} />
          {message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function Modal({
  children,
  title,
  close,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  close: () => void;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const closeAction = useRef(close);
  closeAction.current = close;
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("input, button, select")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAction.current();
      if (e.key === "Tab") {
        const els = Array.from(
          box.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select, textarea, a[href]",
          ) || [],
        ).filter(
          (element) =>
            element.getClientRects().length > 0 &&
            !element.hasAttribute("disabled") &&
            element.tabIndex >= 0,
        );
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={box}
      >
        <button
          className="icon-btn modal-close"
          aria-label="Close dialog"
          onClick={close}
        >
          <Icon name="X" />
        </button>
        {children}
      </div>
    </div>
  );
}
function AuthModal({
  mode,
  setMode,
  close,
  done,
}: {
  mode: "login" | "register";
  setMode: (v: "login" | "register") => void;
  close: () => void;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [forgot, setForgot] = useState(false),
    [show, setShow] = useState(false),
    [sent, setSent] = useState(false);
  const register = mode === "register";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (forgot) {
        const result = await api("/auth/forgot-password", "POST", {
          email: f.get("email"),
        });
        setError(result.message);
        setSent(true);
      } else {
        await api(`/auth/${mode}`, "POST", {
          email: f.get("email"),
          password: f.get("password"),
          ...(register
            ? {
                displayName: f.get("displayName"),
                username: f.get("username"),
                adult: f.get("adult") === "on",
                organizer: f.get("organizer") === "on",
              }
            : {}),
        });
        done();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        forgot
          ? "Reset password"
          : register
            ? "Create your account"
            : "Welcome back"
      }
      close={close}
    >
      <div className="modal-brand">
        <span className="brand-mark">
          q<em>✦</em>
        </span>
      </div>
      <span className="eyebrow">A PLACE FOR CURIOUS MINDS</span>
      <h2>
        {forgot
          ? "Let’s get you back in."
          : register
            ? "Your next aha starts here."
            : "Welcome back, bright mind."}
      </h2>
      <p className="muted">
        {forgot
          ? "Enter your email to request a secure reset link."
          : register
            ? "A little knowledge. A little friendly competition. All you."
            : "Your next great question is waiting."}
      </p>
      <form onSubmit={submit} className="form-stack">
        {register && !forgot && (
          <>
            <label>
              Display name
              <input
                name="displayName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={60}
                placeholder="What should we call you?"
              />
            </label>
            <label>
              Username
              <input
                name="username"
                required
                pattern="[a-z0-9_]{3,24}"
                title="3–24 lowercase letters, numbers, or underscores"
                placeholder="your_curious_self"
                autoComplete="username"
              />
            </label>
          </>
        )}
        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        {!forgot && (
          <label>
            Password
            <div className="password-field">
              <input
                name="password"
                type={show ? "text" : "password"}
                required
                minLength={register ? 12 : 1}
                maxLength={128}
                placeholder={
                  register ? "At least 12 characters" : "Enter your password"
                }
                autoComplete={register ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                <Icon name={show ? "EyeOff" : "Eye"} size={18} />
              </button>
            </div>
          </label>
        )}
        {register && !forgot && (
          <>
            <label className="check-label">
              <input name="adult" type="checkbox" required />
              I’m 18 or older and agree to the Terms & Privacy Policy.
            </label>
            <label className="check-label">
              <input name="organizer" type="checkbox" />
              I’d also like to create quizzes and host competitions.
            </label>
          </>
        )}
        {!register && !forgot && (
          <button
            type="button"
            className="text-btn forgot"
            onClick={() => {
              setForgot(true);
              setError("");
            }}
          >
            Forgot password?
          </button>
        )}
        {error && (
          <div className={sent ? "success-note" : "error-note"} role="alert">
            {error}
          </div>
        )}
        <button className="btn primary full" disabled={busy}>
          {busy ? (
            <Spinner small />
          ) : forgot ? (
            "Send reset link"
          ) : register ? (
            "Create free account"
          ) : (
            "Let’s play"
          )}
          {!busy && <Icon name="ArrowRight" size={18} />}
        </button>
      </form>
      <p className="auth-switch">
        {forgot ? (
          <button
            className="text-btn"
            onClick={() => {
              setForgot(false);
              setError("");
            }}
          >
            Back to sign in
          </button>
        ) : (
          <>
            {register ? "Already part of the club?" : "New around here?"}{" "}
            <button
              className="text-btn"
              onClick={() => {
                setMode(register ? "login" : "register");
                setError("");
              }}
            >
              {register ? "Sign in" : "Join for free"}
            </button>
          </>
        )}
      </p>
      <p className="auth-safe">
        <Icon name="Lock" size={12} /> Your curiosity is safe with us.
      </p>
    </Modal>
  );
}
function JoinModal({ close }: { close: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  if (quote)
    return (
      <SpendConfirmation
        title={quote.title}
        coinPrice={quote.pricing.coinPrice}
        version={quote.pricing.version}
        requestKey={participationKey(`room:${quote.id}`)}
        event
        close={close}
        confirm={async (consent) => {
          const room = await api("/competitions/join", "POST", {
            code: quote.code,
            ...consent,
          });
          clearParticipationKey(`room:${quote.id}`);
          close();
          window.location.assign(`/live/${room.id}`);
        }}
      />
    );
  return (
    <Modal title="Join a competition" close={close}>
      <div className="modal-symbol">
        <Icon name="Radio" size={28} />
      </div>
      <span className="eyebrow">BETTER TOGETHER</span>
      <h2>
        You’ve got a code.
        <br />
        We’ve got the questions.
      </h2>
      <p className="muted">Enter the 6-character code shared by your host.</p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const f = new FormData(e.currentTarget);
            const quote = await api(
              `/competitions/by-code/${String(f.get("code")).toUpperCase()}`,
            );
            if (quote.pricing.coinPrice && !quote.joined) {
              if (!quote.paidEntriesEnabled)
                throw new Error(
                  "Coin-entry events are not open yet. No coins have been charged.",
                );
              setQuote(quote);
              return;
            }
            const room = await api("/competitions/join", "POST", {
              code: f.get("code"),
            });
            close();
            window.location.assign(`/live/${room.id}`);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Room code
          <input
            className="code-input"
            name="code"
            required
            minLength={6}
            maxLength={6}
            pattern="[a-zA-Z0-9]{6}"
            placeholder="ABC123"
            autoComplete="off"
          />
        </label>
        {error && <ErrorNote message={error} />}
        <button className="btn primary full" disabled={busy}>
          {busy ? <Spinner small /> : "Join the room"}
          <Icon name="ArrowRight" size={18} />
        </button>
      </form>
      <p className="auth-safe">
        <Icon name="Users" size={14} /> Good company. Great competition.
      </p>
    </Modal>
  );
}
export const Spinner = ({ small = false }: { small?: boolean }) => (
  <span
    className={small ? "spinner small" : "spinner"}
    role="status"
    aria-label="Loading"
  >
    <LoaderCircle size={small ? 18 : 28} />
  </span>
);
export const ErrorNote = ({ message }: { message: string }) => (
  <div className="error-note" role="alert">
    <Icon name="AlertCircle" size={17} />
    {message}
  </div>
);
export function Empty({
  icon = "Sparkles",
  title,
  description,
  children,
}: {
  icon?: keyof typeof icons;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function useTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Quizora`;
  }, [title]);
}
export const categoryIcons: Record<string, keyof typeof icons> = {
  "General Knowledge": "Sparkles",
  Technology: "Monitor",
  Science: "Atom",
  "Movies & TV": "Clapperboard",
  Music: "Music",
  Sports: "Dribbble",
  Geography: "Globe",
  History: "Landmark",
  Business: "Briefcase",
  "Pop Culture": "Zap",
  Lifestyle: "Heart",
  "Mathematics & Logic": "Target",
  "Brain Teasers": "Sparkles",
};
export const date = (d: string) =>
  new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
export const duration = (ms: number) =>
  `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
export async function copy(text: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error(
    "Clipboard is unavailable. Copy the link from your address bar.",
  );
}
