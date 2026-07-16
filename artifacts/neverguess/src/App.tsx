import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";

const Layout = lazy(() => import("@/components/layout").then((module) => ({ default: module.Layout })));
const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const NewAudit = lazy(() => import("@/pages/new-audit"));
const AuditDetail = lazy(() => import("@/pages/audit-detail"));
const PublicReport = lazy(() => import("@/pages/public-report"));
const NotFound = lazy(() => import("@/pages/not-found"));
const MarketingHome = lazy(() => import("@/pages/marketing/home"));
const MarketingNeverGuess = lazy(() => import("@/pages/marketing/neverguess"));
const MarketingRetryProof = lazy(() => import("@/pages/marketing/retryproof"));
const RetryProofLab = lazy(() => import("@/pages/retryproof-lab"));
const MarketingStui = lazy(() => import("@/pages/marketing/stui"));
const MarketingSignAI = lazy(() => import("@/pages/marketing/signai"));
const MarketingSignAIPrivacy = lazy(() => import("@/pages/marketing/signai-privacy"));
const MarketingSignAITerms = lazy(() => import("@/pages/marketing/signai-terms"));
const MarketingSignAISupport = lazy(() => import("@/pages/marketing/signai-support"));
const MarketingPricing = lazy(() => import("@/pages/marketing/pricing"));
const MarketingAbout = lazy(() => import("@/pages/marketing/about"));
const MarketingSecurityResearch = lazy(() => import("@/pages/marketing/security-research"));
const MarketingContact = lazy(() => import("@/pages/marketing/contact"));
const MarketingPrivacy = lazy(() => import("@/pages/marketing/privacy"));
const MarketingTerms = lazy(() => import("@/pages/marketing/terms"));
const MarketingStatus = lazy(() => import("@/pages/marketing/status"));
const MarketingChangelog = lazy(() => import("@/pages/marketing/changelog"));
const MarketingReports = lazy(() => import("@/pages/marketing/reports"));
const KeyboardShortcuts = lazy(() =>
  import("@/components/keyboard-shortcuts").then((module) => ({
    default: module.KeyboardShortcuts,
  })),
);
const AppRouteShell = lazy(() =>
  import("@/components/app-route-shell").then((module) => ({
    default: module.AppRouteShell,
  })),
);
const LoginRouteShell = lazy(() =>
  import("@/components/app-route-shell").then((module) => ({
    default: module.LoginRouteShell,
  })),
);

const MARKETING_PATHS = new Set([
  "/",
  "/neverguess",
  "/retryproof",
  "/retryproof/lab",
  "/stui",
  "/signai",
  "/signai/privacy",
  "/signai/terms",
  "/signai/support",
  "/pricing",
  "/about",
  "/security-research",
  "/contact",
  "/privacy",
  "/terms",
  "/status",
  "/changelog",
  "/reports",
  "/login",
]);

function isMarketingRoute(path: string): boolean {
  return MARKETING_PATHS.has(path) || path.startsWith("/r/");
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}

function RouteFallback() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center px-4">
      <div className="rounded-xl border border-card-border bg-card shadow-sm px-5 py-4 text-sm text-muted-foreground">
        <div className="eyebrow text-primary">MarMar Labs</div>
        <div className="mt-2">Loading product surface…</div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/r/:slug">
          <AppRouteShell>
            <PublicReport />
          </AppRouteShell>
        </Route>
        <Route path="/login">
          <LoginRouteShell>
            <Login />
          </LoginRouteShell>
        </Route>

        <Route path="/" component={MarketingHome} />
        <Route path="/neverguess" component={MarketingNeverGuess} />
        <Route path="/retryproof" component={MarketingRetryProof} />
        <Route path="/retryproof/lab" component={RetryProofLab} />
        <Route path="/stui" component={MarketingStui} />
        <Route path="/signai" component={MarketingSignAI} />
        <Route path="/signai/privacy" component={MarketingSignAIPrivacy} />
        <Route path="/signai/terms" component={MarketingSignAITerms} />
        <Route path="/signai/support" component={MarketingSignAISupport} />
        <Route path="/pricing" component={MarketingPricing} />
        <Route path="/about" component={MarketingAbout} />
        <Route path="/security-research" component={MarketingSecurityResearch} />
        <Route path="/contact" component={MarketingContact} />
        <Route path="/privacy" component={MarketingPrivacy} />
        <Route path="/terms" component={MarketingTerms} />
        <Route path="/status" component={MarketingStatus} />
        <Route path="/changelog" component={MarketingChangelog} />
        <Route path="/reports" component={MarketingReports} />

        <Route path="/app">
          <AppRouteShell>
            <Layout>
              <Dashboard />
            </Layout>
          </AppRouteShell>
        </Route>

        <Route path="/audits/new">
          <AppRouteShell>
            <Layout>
              <NewAudit />
            </Layout>
          </AppRouteShell>
        </Route>

        <Route path="/audits/:id">
          <AppRouteShell>
            <Layout>
              <AuditDetail />
            </Layout>
          </AppRouteShell>
        </Route>

        {/* Unknown routes are public 404s — render the standalone NotFound
            page directly. No auth gating: an unknown URL must never bounce an
            anonymous visitor to /login. */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function ProductKeyboardShortcuts() {
  const [location] = useLocation();

  if (isMarketingRoute(location)) return null;

  return (
    <Suspense fallback={null}>
      <KeyboardShortcuts />
    </Suspense>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <ScrollToTop />
      <Router />
      <ProductKeyboardShortcuts />
    </WouterRouter>
  );
}

export default App;
