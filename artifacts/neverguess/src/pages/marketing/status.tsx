import { useEffect, useState } from "react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { ArrowUpRight } from "lucide-react";

type ServiceState = "ok" | "down" | "checking" | "preview" | "linked";

type Service = {
  name: string;
  description: string;
  state: ServiceState;
  detail?: string | null;
};

const stateStyles: Record<ServiceState, { dot: string; label: string; text: string; pill: string }> = {
  ok: { dot: "bg-emerald-500", label: "Operational", text: "text-emerald-600", pill: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  down: { dot: "bg-red-500", label: "Issue", text: "text-red-600", pill: "border-red-200 bg-red-50 text-red-700" },
  checking: { dot: "bg-amber-500", label: "Checking", text: "text-amber-600", pill: "border-amber-200 bg-amber-50 text-amber-700" },
  preview: { dot: "bg-slate-400", label: "Not connected", text: "text-muted-foreground", pill: "border-card-border bg-secondary text-muted-foreground" },
  // Configured upstream services we intentionally don't probe from the
  // browser — neutral slate, not amber, so they don't read as degraded.
  linked: { dot: "bg-slate-400", label: "Linked", text: "text-muted-foreground", pill: "border-card-border bg-secondary text-muted-foreground" },
};

function StatusDot({ state, ping = false }: { state: ServiceState; ping?: boolean }) {
  const dot = stateStyles[state].dot;
  return (
    <span className="relative flex h-2 w-2">
      {ping && state === "ok" && (
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${dot}`} />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
    </span>
  );
}

function useApiStatus(): Service[] {
  const [api, setApi] = useState<ServiceState>("checking");
  const [apiDetail, setApiDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    fetch("/api/healthz", { credentials: "include" })
      .then(async (r) => {
        if (cancelled) return;
        const responseMs = Math.round(performance.now() - start);
        const isJson = r.headers.get("content-type")?.includes("application/json");
        // Frontend-only preview: /api/healthz returns the SPA index shell
        // (HTTP 200, text/html) because no API is mounted. That is "not
        // connected", not an outage — a real outage returns a non-2xx or
        // throws (handled below / in catch).
        if (r.ok && !isJson) {
          setApi("preview");
          setApiDetail("Frontend preview — API not connected");
          return;
        }
        if (!r.ok || !isJson) {
          setApi("down");
          setApiDetail("Invalid health response");
          return;
        }
        const data = (await r.json()) as { status?: string };
        setApi(data.status === "ok" ? "ok" : "down");
        setApiDetail(data.status === "ok" ? `${responseMs}ms response` : "Invalid health response");
      })
      .catch(() => {
        if (cancelled) return;
        setApi("down");
        setApiDetail("Health check failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return [
    {
      name: "NeverGuess API",
      description: "Audit creation, ingestion, analysis, shared report links.",
      state: api,
      detail: apiDetail,
    },
    {
      name: "Marketing site",
      description: "marmarlabs.com — you're reading it now.",
      state: "ok",
      detail: "Page served",
    },
    {
      name: "Stripe checkout",
      description: "NeverGuess Pro checkout. Stripe's own status page is linked below.",
      state: "linked",
      detail: "Provider status linked below",
    },
    {
      name: "Authentication",
      description: "OAuth / OIDC sign-in configuration for NeverGuess.",
      state: "linked",
      detail: "Configured",
    },
  ];
}

const providerLinks = [
  {
    name: "Stripe Status",
    href: "https://www.stripestatus.com/",
    note: "Payments, billing portal, webhooks.",
  },
  {
    name: "OpenRouter Status",
    href: "https://status.openrouter.ai/",
    note: "AI inference for the audit reports.",
  },
];

export default function MarketingStatus() {
  useMetaTags({
    title: "Status | MarMar Labs",
    description: "API health and service notes for NeverGuess and MarMar Labs.",
    canonicalUrl: "https://marmarlabs.com/status",
  });
  const services = useApiStatus();

  const apiState = services[0]?.state ?? "checking";
  const apiChecked = apiState !== "checking";
  const summary = stateStyles[apiState];

  return (
    <MarketingLayout>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="animate-fade-up">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6"
              data-testid="banner-status-summary"
            >
              <StatusDot state={apiState} ping />
              {apiState === "ok"
                ? "API reachable"
                : apiState === "down"
                  ? "API issue detected"
                  : apiState === "preview"
                    ? "Frontend preview · API not connected"
                    : "Checking API"}
            </div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-6xl">
              System <span className="text-primary">status</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              A live API check that runs in your browser, plus direct links to the status pages
              of the providers we depend on.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Service ledger --------------------------------------------- */}
      <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="eyebrow text-muted-foreground">Service status</div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${summary.pill}`}>
                <StatusDot state={apiState} ping />
                {summary.label}
              </span>
            </div>
            <div className="px-5 sm:px-6">
              <div className="divide-y divide-border">
                {services.map((svc) => {
                  const s = stateStyles[svc.state];
                  const verdict =
                    svc.state === "ok"
                      ? svc.name === "NeverGuess API" && apiChecked
                        ? "Reachable"
                        : "Serving"
                      : svc.state === "down"
                        ? "Issue"
                        : svc.state === "preview"
                          ? "Not connected"
                          : svc.state === "linked"
                            ? "Linked"
                            : "Checking";
                  return (
                    <div
                      key={svc.name}
                      className="flex items-center gap-4 py-4"
                      data-testid={`status-row-${svc.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <StatusDot state={svc.state} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">{svc.name}</div>
                        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {svc.description}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-[11px] uppercase tracking-widest ${s.text}`}>
                          {verdict}
                        </div>
                        {svc.detail && (
                          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                            {svc.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---- Upstream providers + SLA note ------------------------------ */}
      <section className="border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <div className="eyebrow text-primary mb-3">Upstream providers</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
              Authoritative status lives with each provider.
            </h2>
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {providerLinks.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-2xl border border-card-border bg-background p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-medium text-foreground">{p.name}</span>
                    <ArrowUpRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.note}</p>
                </a>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.16}>
            <div className="mt-8 rounded-2xl border border-card-border bg-secondary/60 p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                We don't publish a formal SLA yet. If you hit an outage, email{" "}
                <a
                  href="mailto:support@marmarlabs.com"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  support@marmarlabs.com
                </a>
                .
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
