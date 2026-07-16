import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { LogOut, Activity, LayoutDashboard, PlusCircle, CreditCard, Sparkles, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@/hooks/use-health-check";
import { useBilling, openCustomerPortal } from "@/lib/use-billing";
import { toast } from "sonner";

function FooterStatus() {
  const health = useHealthCheck();
  const dotColor =
    health === "ok"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
      : health === "down"
        ? "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.7)]"
        : "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.7)]";
  const label = health === "ok" ? "All systems operational" : health === "down" ? "API down" : "Checking…";
  return (
    <div className="flex items-center gap-3" data-testid="footer-health">
      {/* The dot+label is now a link to the public /status page so users
          can drill in if something looks off. */}
      <Link
        href="/status"
        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
        data-testid="footer-health-link"
      >
        <span className={cn("w-2 h-2 rounded-full", dotColor)} data-testid="footer-health-dot" />
        <span className="font-mono text-[11px]">{label}</span>
      </Link>
    </div>
  );
}

const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/app" },
  { href: "/audits/new", label: "New Audit", icon: PlusCircle, match: (p: string) => p === "/audits/new" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <div className="min-h-[100dvh] flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r border-border/40 bg-card/30 backdrop-blur sticky top-0 h-[100dvh]">
        <Link href="/app" className="h-16 flex items-center gap-2 px-5 border-b border-border/40 hover:bg-secondary/30 transition-colors" data-testid="link-product-brand">
          <div className="bg-primary/10 p-1.5 rounded-md text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <span className="font-mono font-bold tracking-tight">NeverGuess</span>
        </Link>

        <nav className="flex-1 p-3 space-y-1">
          <div className="px-2 pt-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            Mission Control
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.match(location);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-3 text-[10px] text-muted-foreground/70 border-t border-border/40">
          <Link href="/" className="hover:text-foreground transition-colors" data-testid="link-marmar-home">
            ← MarMar Labs
          </Link>
        </div>

        <div className="border-t border-border/40 p-3 space-y-2">
          <BillingMenu />
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="h-9 w-9 border border-border/50">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-mono">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight truncate">
                {user.firstName || user.email}
              </div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              title="Logout"
              data-testid="button-logout"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur h-16 items-center justify-end px-8 gap-4">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium leading-none" data-testid="header-user-name">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.firstName || user.email}
            </span>
            {user.email && (
              <span className="text-xs text-muted-foreground mt-1">{user.email}</span>
            )}
          </div>
          <Avatar className="h-9 w-9 border border-border/50" data-testid="header-user-avatar">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-mono">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>

        <header className="md:hidden sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link href="/app" className="flex items-center gap-2">
              <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-mono font-bold tracking-tight text-sm">NeverGuess</span>
            </Link>
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = item.match(location);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    title={item.label}
                    data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium",
                      active ? "text-primary bg-primary/10" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="text-muted-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-8">{children}</main>

        <footer className="no-print border-t border-border/40 px-4 md:px-8 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span>NeverGuess is a <Link href="/" className="text-foreground hover:text-primary">MarMar Labs</Link> product.</span>
            <FooterStatus />
          </div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

/**
 * Compact billing tile that lives above the user avatar in the sidebar.
 * Shows the current tier and either a "Manage subscription" link (Pro) or
 * an "Upgrade" link (Free). Hidden until the billing fetch completes so we
 * don't flash a misleading state on first paint.
 */
function BillingMenu() {
  // Stripe Checkout redirects back with ?upgraded=1 but the subscription
  // webhook may not have landed yet — the tier can still read "free" for a
  // few seconds. Capture the flag once on mount (dashboard.tsx strips it
  // from the URL in an effect, i.e. after this initializer runs) and poll
  // until the tier flips.
  const [sawUpgradedFlag] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("upgraded") === "1",
  );
  const billing = useBilling({ pollForProActivation: sawUpgradedFlag });
  const [opening, setOpening] = useState(false);

  // While waiting on the webhook, show a quiet activating state instead of
  // the misleading "Free plan / Upgrade" tile the stale tier would produce.
  if (billing.tier !== "pro" && billing.activatingPro) {
    return (
      <div
        data-testid="billing-pro-activating"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-card-border bg-secondary text-xs font-medium text-muted-foreground"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        Activating Pro…
      </div>
    );
  }

  if (billing.loading) return null;

  if (billing.tier === "pro") {
    return (
      <button
        type="button"
        onClick={async () => {
          setOpening(true);
          const ok = await openCustomerPortal();
          if (!ok) {
            setOpening(false);
            toast.error("Could not open the billing portal. Please try again.");
          }
        }}
        disabled={opening}
        data-testid="button-manage-subscription"
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Pro · {billing.maxActiveAudits} concurrent audits
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
          <CreditCard className="w-3 h-3" />
          {opening ? "Opening…" : "Manage"}
        </span>
      </button>
    );
  }

  // Free tier — surface the upgrade path. The Pricing page links to the
  // Stripe Payment Link so the same conversion funnel applies in-app.
  // The usage counter only renders once the backend sends both quota fields
  // (older deployments and the static preview omit them).
  const hasQuota =
    typeof billing.monthlyAuditsUsed === "number" &&
    typeof billing.monthlyAuditLimit === "number";
  return (
    <Link
      href="/pricing"
      className="block w-full"
      data-testid="link-upgrade-pro"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-card-border bg-secondary hover:bg-muted transition-colors">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CreditCard className="w-3.5 h-3.5" />
          {hasQuota
            ? `Free · ${billing.monthlyAuditsUsed} of ${billing.monthlyAuditLimit} audits this month`
            : "Free plan"}
        </span>
        <span className="text-[11px] font-medium text-primary">
          Upgrade to Pro
        </span>
      </div>
    </Link>
  );
}

