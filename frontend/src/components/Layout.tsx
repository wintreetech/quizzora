import { useEffect, useState, useRef } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  Link,
} from "react-router-dom";
import { Icon, useApp, api, useTitle } from "../lib";
import type { icons } from "../lib";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet, CoinSymbol, coinNumber } from "../pages/Economy";
const links: {
  to: string;
  label: string;
  icon: keyof typeof icons;
  tag?: string;
}[] = [
  { to: "/dashboard", label: "Overview", icon: "LayoutDashboard" },
  { to: "/", label: "Explore quizzes", icon: "Compass" },
  { to: "/live", label: "Live competitions", icon: "Radio", tag: "LIVE" },
  { to: "/tournaments", label: "Tournaments", icon: "Flag" },
  { to: "/leaderboard", label: "Leaderboard", icon: "Trophy" },
];
export default function Layout() {
  const { user, auth, join, toast } = useApp(),
    client = useQueryClient();
  const { data: wallet } = useWallet();
  const [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("quizora-sidebar") === "collapsed",
    ),
    [mobile, setMobile] = useState(false),
    [bell, setBell] = useState(false);
  const location = useLocation(),
    navigate = useNavigate(),
    drawer = useRef<HTMLElement>(null);
  const [term, setTerm] = useState("");
  const role = user?.role;
  const adminWorkspace =
    location.pathname.startsWith("/admin") && role === "SUPER_ADMIN";
  const creatorWorkspace =
    location.pathname.startsWith("/organizer") &&
    ["SUPER_ADMIN", "ORGANIZER"].includes(role || "");
  const workspaceLinks = adminWorkspace
    ? [
        ["Overview", "Dashboard", "LayoutDashboard"],
        ["Users", "Users", "Users"],
        ["Wallets & Coins", "Wallets & Coins", "Wallet"],
        ["Coin Packages", "Store pricing", "Coins"],
        ["Quizzes", "Quiz Management", "BookOpen"],
        ["Question Bank", "Question Bank", "BookOpen"],
        ["Categories", "Categories", "Compass"],
        ["Quiz Pricing", "Quiz Pricing", "CreditCard"],
        ["Competitions", "Competitions", "Radio"],
        ["Competition Pricing", "Competition Pricing", "CreditCard"],
        ["Tournaments", "Tournaments", "Flag"],
        ["Tournament Pricing", "Tournament Pricing", "CreditCard"],
        ["Organizers", "Organizers", "Briefcase"],
        ["Payments", "Payments", "CreditCard"],
        ["Pending Recovery", "Payment Recovery", "RotateCcw"],
        ["Analytics", "Analytics", "ChartNoAxesCombined"],
        ["Reports", "Reports", "Flag"],
        ["Audit logs", "Audit Logs", "Clock"],
        ["Admin Management", "Admin Management", "Shield"],
        ["Plans", "Hosting Plans", "Briefcase"],
        ["Settings", "Platform Settings", "Settings"],
      ].map(([section, label, icon]) => ({
        to: `/admin?section=${encodeURIComponent(section)}`,
        label,
        icon: icon as keyof typeof icons,
      }))
    : creatorWorkspace
      ? [
          ["Overview", "LayoutDashboard"],
          ["My quizzes", "BookOpen"],
          ["Question bank", "BookOpen"],
          ["Competitions", "Radio"],
          ["Reports", "ChartNoAxesCombined"],
          ["Subscription", "Briefcase"],
        ].map(([label, icon]) => ({
          to: `/organizer?section=${encodeURIComponent(label)}`,
          label,
          icon: icon as keyof typeof icons,
        }))
      : links;
  const title = location.pathname.startsWith("/organizer")
    ? "Creator studio"
    : location.pathname.startsWith("/admin")
      ? "Platform administration"
      : location.pathname === "/hosting"
        ? "Hosting plans"
        : ["/store", "/pricing"].includes(location.pathname)
          ? "Coin store"
          : location.pathname === "/wallet"
            ? "Your wallet"
            : location.pathname.startsWith("/purchase/")
              ? "Purchase status"
              : location.pathname.startsWith("/live")
                ? "Live competitions"
                : location.pathname === "/dashboard"
                  ? "Your overview"
                  : location.pathname === "/library"
                    ? "Your collection"
                    : location.pathname === "/leaderboard"
                      ? "Leaderboard"
                      : location.pathname === "/settings"
                        ? "Account settings"
                        : location.pathname === "/tournaments"
                          ? "Tournaments"
                          : "Discover";
  useTitle(title);
  useEffect(() => {
    setMobile(false);
    setBell(false);
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!mobile) return;
    const old = document.activeElement as HTMLElement;
    drawer.current?.querySelector<HTMLElement>("a,button")?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
      if (e.key === "Tab") {
        const els = Array.from(
          drawer.current?.querySelectorAll<HTMLElement>("a,button") || [],
        );
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      old?.focus();
    };
  }, [mobile]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>("#global-search")?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <div className={`app-shell ${collapsed ? "is-collapsed" : ""}`}>
      {mobile && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        ref={drawer}
        aria-label="Main navigation"
      >
        <div className="brand-row">
          <Link to="/" className="brand" aria-label="Quizora home">
            <span className="brand-mark">
              q<em>✦</em>
            </span>
            <span className="brand-word">
              quizora<span>®</span>
            </span>
          </Link>
          <button
            className="icon-btn sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          >
            <Icon name="X" />
          </button>
        </div>
        <div className="sidebar-scroll">
          <div className="workspace-label">
            <span>PLAY & DISCOVER</span>
            <i />
          </div>
          <nav>
            {workspaceLinks.map((item) => (
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-item ${(adminWorkspace || creatorWorkspace ? location.pathname + location.search === item.to || (!location.search && item === workspaceLinks[0]) : isActive) ? "active" : ""}`
                }
                title={item.label}
                key={item.to}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
                {"tag" in item && typeof item.tag === "string" ? (
                  <b className="live-tag">{item.tag}</b>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="workspace-label second-label">
            <span>YOUR SPACE</span>
          </div>
          <nav>
            <NavLink to="/wallet" className="nav-item" title="Wallet & history">
              <Icon name="Wallet" />
              <span>Wallet & history</span>
            </NavLink>
            <NavLink to="/store" className="nav-item" title="Coin store">
              <Icon name="Coins" />
              <span>Coin store</span>
            </NavLink>
            <NavLink to="/library" className="nav-item" title="Saved quizzes">
              <Icon name="Bookmark" />
              <span>Saved quizzes</span>
            </NavLink>
            <NavLink
              to="/achievements"
              className="nav-item"
              title="Achievements"
            >
              <Icon name="Medal" />
              <span>Achievements</span>
            </NavLink>
            <NavLink
              to="/challenges"
              className="nav-item"
              title="Friend challenges"
            >
              <Icon name="Users" />
              <span>Friend challenges</span>
            </NavLink>
            {(role === "ORGANIZER" || role === "SUPER_ADMIN") && (
              <NavLink
                to="/organizer"
                className="nav-item"
                title="Creator studio"
              >
                <Icon name="Briefcase" />
                <span>Creator studio</span>
                <Icon name="ArrowUpRight" size={14} />
              </NavLink>
            )}
            {role === "SUPER_ADMIN" && (
              <NavLink to="/admin" className="nav-item" title="Administration">
                <Icon name="Shield" />
                <span>Administration</span>
              </NavLink>
            )}
          </nav>
          <div className="host-promo">
            <span className="host-promo-icon">
              <Icon name="Sparkles" size={22} />
            </span>
            <h3>
              Bring your people.
              <br />
              We’ll bring the quiz.
            </h3>
            <p>
              Turn a good get-together
              <br />
              into a great competition.
            </p>
            <button
              onClick={() => (user ? navigate("/organizer") : auth("register"))}
              className="btn host-btn"
            >
              Host a quiz <Icon name="ArrowUpRight" size={16} />
            </button>
          </div>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/hosting" className="nav-item" title="Hosting plans">
            <Icon name="Sparkles" />
            <span>Hosting plans</span>
          </NavLink>
          <NavLink to="/help" className="nav-item" title="Help & FAQs">
            <Icon name="LifeBuoy" />
            <span>Help & FAQs</span>
            <Icon name="ArrowUpRight" size={14} />
          </NavLink>
          <NavLink to="/settings" className="nav-item" title="Settings">
            <Icon name="Settings" />
            <span>Settings</span>
          </NavLink>
          <div className="sidebar-divider" />
          {user ? (
            <div className="account-row">
              <Link to="/settings" className="avatar">
                {user.displayName.slice(0, 2).toUpperCase()}
              </Link>
              <Link to="/settings" className="account-text">
                <b>{user.displayName}</b>
                <span>
                  {role === "PLAYER"
                    ? "Curious mind"
                    : role === "SUPER_ADMIN"
                      ? "Platform owner"
                      : "Quiz creator"}{" "}
                  <i>✦</i>
                </span>
              </Link>
              <button
                className="icon-btn"
                aria-label="Sign out"
                title="Sign out"
                onClick={async () => {
                  await api("/auth/logout", "POST");
                  client.clear();
                  navigate("/");
                  toast("You’ve signed out. See you soon.");
                }}
              >
                <Icon name="LogOut" size={17} />
              </button>
            </div>
          ) : (
            <button
              className="account-row guest-account"
              onClick={() => auth("login")}
            >
              <span className="avatar">
                <Icon name="UserRound" />
              </span>
              <span className="account-text">
                <b>Your curious side</b>
                <span>Sign in to make it yours</span>
              </span>
              <Icon name="ArrowUpRight" size={17} />
            </button>
          )}
        </div>
        <button
          className="collapse-toggle"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => {
            setCollapsed(!collapsed);
            localStorage.setItem(
              "quizora-sidebar",
              collapsed ? "expanded" : "collapsed",
            );
          }}
        >
          <Icon name={collapsed ? "ChevronRight" : "ChevronLeft"} size={14} />
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Icon name="Menu" />
            </button>
            <span className="breadcrumb-home">
              <Icon name="Compass" size={17} />
              <span>/</span>
            </span>
            <b>{title}</b>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/?q=${encodeURIComponent(term)}`);
            }}
          >
            <Icon name="Search" size={17} />
            <input
              id="global-search"
              placeholder="What are you curious about?"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Search quizzes"
            />
            <kbd>⌘ K</kbd>
          </form>
          <div className="topbar-actions">
            <Link to="/store" className="topbar-plan-link">
              <Icon name="Coins" size={18} /> Coin store
            </Link>
            {user && (
              <Link
                className="header-wallet"
                to="/wallet"
                aria-label="Wallet balance"
              >
                <CoinSymbol size={25} />
                <b>{wallet ? coinNumber(wallet.balance) : "—"}</b>
                <span>coins</span>
              </Link>
            )}
            <button className="join-code-btn" onClick={join}>
              <Icon name="Plus" size={17} /> Join with a code
            </button>
            <span className="topbar-separator" />
            <div className="notification-wrap">
              <button
                className="icon-btn"
                onClick={() => setBell(!bell)}
                aria-label="Notifications"
                aria-expanded={bell}
              >
                <Icon name="Bell" size={20} />
              </button>
              {bell && (
                <div className="notification-pop">
                  <b>A little heads-up</b>
                  <p>
                    No new notifications. Join a competition to get your next
                    game going.
                  </p>
                  <button
                    className="text-btn"
                    onClick={() => navigate("/live")}
                  >
                    Explore competitions <Icon name="ArrowRight" size={14} />
                  </button>
                </div>
              )}
            </div>
            {user ? (
              <Link to="/settings" className="avatar small-avatar">
                {user.displayName.slice(0, 2).toUpperCase()}
              </Link>
            ) : (
              <button
                className="btn primary top-signup"
                onClick={() => auth("register")}
              >
                Get started <Icon name="ArrowUpRight" size={15} />
              </button>
            )}
          </div>
        </header>
        <main className="page-content" id="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <Link to="/" className="footer-logo">
            quizora<span>✦</span>
          </Link>
          <span>Knowledge earns the score. Coins unlock access.</span>
          <div>
            <Link to="/store">Coin store</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/help">Help</Link>
            <Link to="/legal/privacy">Privacy</Link>
            <Link to="/legal/terms">Terms</Link>
            <span className="age-badge">18+</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

