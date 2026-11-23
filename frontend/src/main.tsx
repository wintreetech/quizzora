import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider } from "./lib";
import Layout from "./components/Layout";
import Discover from "./pages/Discover";
import { QuizDetail, QuizPlayer, Results } from "./pages/Quiz";
import { Live, LiveRoom } from "./pages/Live";
import {
  Achievements,
  Leaderboard,
  Settings,
  Challenges,
  ChallengePage,
} from "./pages/Player";
const Pricing = React.lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.Pricing })),
);
const Help = React.lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.Help })),
);
const Legal = React.lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.Legal })),
);
const ResetPassword = React.lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.ResetPassword })),
);
const VerifyEmail = React.lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.VerifyEmail })),
);
const NotFound = React.lazy(() =>
  import("./pages/Info").then((m) => ({ default: m.NotFound })),
);
const Organizer = React.lazy(() =>
  import("./pages/Organizer").then((m) => ({ default: m.Organizer })),
);
const Admin = React.lazy(() =>
  import("./pages/Admin").then((m) => ({ default: m.Admin })),
);
import { Tournaments, TournamentDetail } from "./pages/Tournaments";
import { CoinStore, WalletPage, PurchaseStatus } from "./pages/Economy";
import "./styles.css";
import "./responsive.css";
import "./identity.css";
import "./coin-builder.css";
import "./client-polish.css";
import "./premium.css";
import "./player-workspace.css";
import HowQuizoraWorks from "./pages/HowItWorks";
import { PlayerHome, PlayerActivity } from "./pages/PlayerHome";
document.documentElement.dataset.theme =
  localStorage.getItem("quizora-theme") || "light";
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: false },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Provider>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <React.Suspense
            fallback={<div className="page-gate">Loading your workspace…</div>}
          >
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Discover />} />
                <Route path="quiz/:id" element={<QuizDetail />} />
                <Route path="play/:id" element={<QuizPlayer />} />
                <Route path="results/:id" element={<Results />} />
                <Route path="dashboard" element={<PlayerHome />} />
                <Route path="activity" element={<PlayerActivity />} />
                <Route path="library" element={<Discover library />} />
                <Route path="achievements" element={<Achievements />} />
                <Route path="leaderboard" element={<Leaderboard />} />
                <Route path="live" element={<Live />} />
                <Route path="live/:id" element={<LiveRoom />} />
                <Route path="challenges" element={<Challenges />} />
                <Route path="challenge/:code" element={<ChallengePage />} />
                <Route path="tournaments" element={<Tournaments />} />
                <Route path="tournaments/:id" element={<TournamentDetail />} />
                <Route path="organizer/*" element={<Organizer />} />
                <Route path="admin/*" element={<Admin />} />
                <Route path="pricing" element={<CoinStore />} />
                <Route path="hosting" element={<Pricing />} />
                <Route path="store" element={<CoinStore />} />
                <Route path="wallet" element={<WalletPage />} />
                <Route path="purchase/:id" element={<PurchaseStatus />} />
                <Route path="help" element={<Help />} />
                <Route path="how-it-works" element={<HowQuizoraWorks />} />
                <Route path="legal/:type" element={<Legal />} />
                <Route path="settings" element={<Settings />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="verify-email" element={<VerifyEmail />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </React.Suspense>
        </Provider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
