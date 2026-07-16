import { useEffect, useState } from "react";
import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  GitBranch,
  PlayCircle,
  FileText,
  CopyCheck,
  X,
} from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

type GalleryReport = {
  slug: string;
  verdict: "safe" | "caution" | "block";
  riskScore: number;
  requestedChange: string;
  githubRepo: string | null;
  createdAt: string;
};

function useGallery() {
  const [reports, setReports] = useState<GalleryReport[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/r/gallery", { credentials: "include" })
      .then(async (r) => (r.ok ? r.json() : { reports: [] }))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.reports) ? (data.reports as GalleryReport[]) : [];
        // Drop demo fixtures — this section claims "real reports, real repos",
        // so seeded demo/* repos must never appear in it.
        const real = list.filter((r) => !(r.githubRepo ?? "").startsWith("demo/"));
        // De-dupe by repo so the gallery doesn't show 3 next.js reports in a row.
        const seen = new Set<string>();
        const uniq = real.filter((r) => {
          const key = r.githubRepo ?? r.slug;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setReports(uniq);
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return reports;
}

function VerdictPill({ verdict, riskScore }: { verdict: GalleryReport["verdict"]; riskScore: number }) {
  if (verdict === "block") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-red-50 text-red-600 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
        <ShieldAlert className="w-3 h-3" />
        Block · {riskScore}
      </span>
    );
  }
  if (verdict === "caution") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 text-amber-600 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
        <AlertTriangle className="w-3 h-3" />
        Caution · {riskScore}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
      <ShieldCheck className="w-3 h-3" />
      Safe · {riskScore}
    </span>
  );
}

const features = [
  {
    eyebrow: "01",
    title: "Change Preflight",
    desc: "Check the repo before another agent touches it. Get risks, tests, and a safer prompt instead of guessing.",
  },
  {
    eyebrow: "02",
    title: "Architecture Awareness",
    desc: "NeverGuess maps the real shape of your app — entry points, modules, data flow, and external dependencies — so suggested changes respect what already exists.",
  },
  {
    eyebrow: "03",
    title: "Risk Detection",
    desc: "Surfaces fragile spots: implicit contracts, missing error handling, mutable shared state, and assumptions that quietly break under change.",
  },
  {
    eyebrow: "04",
    title: "Test Readiness",
    desc: "Inspects what is and isn't covered, where tests are missing, and which paths a change is most likely to silently break.",
  },
  {
    eyebrow: "05",
    title: "Deployment Confidence",
    desc: "Pre-deployment checks across config, environment variables, build output, and known production risks — so launches depend less on post-change cleanup.",
  },
  {
    eyebrow: "06",
    title: "Your Choice of Model",
    desc: "Run the preflight on the frontier model you trust — Claude Fable 5, the GPT-5.6 family, Gemini, Grok, and more — with live pricing from the OpenRouter catalog and a receipt on every report naming the exact model that produced it.",
  },
];

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "risk"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${styles}`}>
      {children}
    </span>
  );
}

function HeroReportMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 bg-[radial-gradient(circle,var(--brand-glow),transparent_68%)] opacity-50 blur-2xl pointer-events-none" />
      <div
        className="relative overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl"
        data-testid="hero-product-mockup"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="eyebrow text-muted-foreground">Preflight report</div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-secondary px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            /r/next-isr
          </span>
        </div>
        <div className="p-5 md:p-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2 border border-amber-200 bg-amber-100/70">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="eyebrow text-amber-700/80">Verdict</div>
                  <div className="mt-1 font-display font-semibold text-base text-amber-800 tracking-tight">
                    Proceed with caution
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="eyebrow text-muted-foreground">Risk score</div>
                <div className="mt-1 font-display font-bold text-4xl tabular-nums text-foreground leading-none">
                  48<span className="text-base text-muted-foreground font-normal">/100</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm text-amber-900/80">
              <span className="font-medium text-foreground">Top risk:</span> Preview mode bypasses ISR cache
            </div>
          </div>
          <div className="rounded-xl border border-border bg-secondary/50 p-4">
            <div className="eyebrow text-muted-foreground mb-3">Architecture</div>
            <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
              <span className="px-2 py-1 rounded-md border border-card-border bg-card text-foreground">Visitor</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="px-2 py-1 rounded-md border border-card-border bg-card text-foreground">Vercel Edge</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="px-2 py-1 rounded-md border border-[color:var(--brand-border)] bg-accent text-primary">Next.js Pages</span>
              <span className="text-muted-foreground/50">→</span>
              <span className="px-2 py-1 rounded-md border border-card-border bg-card text-foreground">Postgres</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductReel() {
  const steps = [
    { icon: GitBranch, title: "Paste a repo", detail: "Use any public GitHub URL." },
    { icon: PlayCircle, title: "Watch live phases", detail: "Ingesting, mapping, analyzing." },
    { icon: FileText, title: "Read the verdict", detail: "Risks, tests, rollout notes." },
    { icon: CopyCheck, title: "Copy a safer prompt", detail: "Replit, Codex, Claude Code, Cursor, Copilot." },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24" data-testid="section-see-it-work" id="how-it-works">
      <Reveal>
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] items-stretch">
          <div className="flex flex-col justify-center rounded-2xl border border-card-border bg-card p-6 shadow-sm md:p-8">
            <div className="eyebrow text-primary mb-3">How it works</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              One minute from repo to{" "}
              <span className="text-primary">safer prompt.</span>
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Paste a repo, describe the change, watch progress, and use the report. No login required for your first run.
            </p>
            <Button asChild size="lg" variant="outline" className="mt-6 self-start" data-testid="button-reel-sample-report">
              <Link href="/r/next-isr">
                Open sample report <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card p-4 shadow-lg md:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map(({ icon: Icon, title, detail }, index) => (
                <div
                  key={title}
                  className="animate-reel-pulse rounded-xl border border-border bg-secondary/50 p-4"
                  style={{ animationDelay: `${index * 1.4}s` }}
                  data-testid={`card-reel-step-${index + 1}`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-border bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="font-semibold">{title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Quiet text-only strip (no logos — no license risk). Names come
            from PROMPT_TOOLS in lib/db: every report ships a prompt pack
            for exactly these five targets. */}
        <div
          className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center"
          data-testid="strip-prompt-packs"
        >
          <span className="eyebrow text-muted-foreground">Prompt packs tailored for</span>
          <span className="font-mono text-[11px] uppercase tracking-widest text-foreground/70">
            Replit · Cursor · Copilot · Claude Code · Codex
          </span>
        </div>
      </Reveal>
    </section>
  );
}

function ComparisonTable() {
  // Category-level comparison only — no named competitors in cells. Every
  // checkmark has to stay literally true of the whole category, so mark
  // conservatively (a compound claim gets ✓ only if the category delivers
  // the full combination).
  const rows: Array<{ label: string; ng: boolean; prBots: boolean; specIde: boolean; raw: boolean }> = [
    { label: "Runs before any code is written", ng: true, prBots: false, specIde: true, raw: false },
    { label: "No GitHub App or repo access to grant", ng: true, prBots: false, specIde: true, raw: true },
    { label: "Rewrites your agent prompt (Replit, Codex, Claude Code, Cursor, Copilot)", ng: true, prBots: false, specIde: false, raw: false },
    { label: "You choose the model, receipt on every report", ng: true, prBots: false, specIde: false, raw: false },
    { label: "Shareable public report + badge", ng: true, prBots: false, specIde: false, raw: false },
    { label: "Free run without setup", ng: true, prBots: false, specIde: false, raw: true },
  ];
  const Mark = ({ on }: { on: boolean }) =>
    on ? (
      <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" aria-label="yes" />
    ) : (
      <X className="w-4 h-4 text-muted-foreground/50 mx-auto" aria-label="no" />
    );
  return (
    <section className="border-y border-border bg-card" data-testid="section-comparison">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <div className="text-center mb-10">
            <div className="eyebrow text-primary mb-3">Why NeverGuess</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Not another code reviewer.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              AI code reviewers check the diff after your agent wrote it. NeverGuess checks the repo before the prompt is sent.
            </p>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mb-2 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:hidden">
            Swipe to compare →
          </p>
          <div className="overflow-x-auto rounded-2xl border border-card-border bg-background shadow-sm">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="text-left px-4 py-3.5 font-semibold">Capability</th>
                  <th className="text-center px-4 py-3.5 font-semibold text-primary">NeverGuess</th>
                  <th className="text-center px-4 py-3.5 font-medium text-muted-foreground">AI code review (PR bots)</th>
                  <th className="text-center px-4 py-3.5 font-medium text-muted-foreground">Spec-driven IDE tools</th>
                  <th className="text-center px-4 py-3.5 font-medium text-muted-foreground">Raw prompting</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.label}
                    className="border-b border-border last:border-0"
                    data-testid={`row-comparison-${i}`}
                  >
                    <td className="px-4 py-3.5 text-foreground">{row.label}</td>
                    <td className="px-4 py-3.5 bg-accent/40"><Mark on={row.ng} /></td>
                    <td className="px-4 py-3.5"><Mark on={row.prBots} /></td>
                    <td className="px-4 py-3.5"><Mark on={row.specIde} /></td>
                    <td className="px-4 py-3.5"><Mark on={row.raw} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function MarketingNeverGuess() {
  useMetaTags({
    title: "NeverGuess · 60-second AI change preflight",
    description:
      "Drop in a repo. Tell us the change. We'll flag the 3 things that'll break — and rewrite your agent prompt to avoid them.",
    canonicalUrl: "https://marmarlabs.com/neverguess",
    ogImage: "https://marmarlabs.com/brand/og-neverguess.webp",
  });
  const { isAuthenticated } = useAuth();
  const ctaLabel = isAuthenticated ? "Start new audit" : "Run a free preflight";

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1100px] h-[640px] bg-[radial-gradient(circle,var(--brand-glow),transparent_60%)] opacity-40 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              Code change preflight
            </div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl">
              60 seconds to know what your agent will{" "}
              <span className="text-primary">break.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Drop in a repo. Tell us the change. We'll flag what'll break — and rewrite your agent prompt to avoid it.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" data-testid="button-open-neverguess-app">
                <Link href="/audits/new">
                  {ctaLabel} <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/r/next-isr">
                  View sample report
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                No GitHub App to install
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span>No repo access to grant</span>
              <span className="text-muted-foreground/40">·</span>
              <span>Read-only, public repos</span>
              <span className="text-muted-foreground/40">·</span>
              <span>~60 seconds</span>
              <span className="text-muted-foreground/40">·</span>
              <Link href="/pricing" className="underline-offset-4 hover:text-foreground hover:underline">
                Pricing
              </Link>
            </div>
          </div>

          <div className="relative animate-fade-up [animation-delay:120ms]">
            <HeroReportMockup />
          </div>
        </div>
      </section>

      <ProductReel />

      {/* Sample report grid — a clean light card. */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-16 md:pb-24 relative">
        <Reveal>
          <div className="overflow-hidden rounded-2xl border border-card-border bg-card p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="eyebrow text-muted-foreground">Preflight report · sample</div>
              <span className="font-mono text-[11px] text-primary">v0.1</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: "Architecture", lines: ["Entry: src/main.tsx", "Modules: 24", "External APIs: 3"], pill: <StatusPill tone="ok"><CheckCircle2 className="w-3 h-3" /> mapped</StatusPill> },
                { title: "Risk", lines: ["Implicit auth assumption", "Unhandled fetch error", "Shared mutable cache"], pill: <StatusPill tone="warn"><AlertTriangle className="w-3 h-3" /> 3 findings</StatusPill> },
                { title: "Tests", lines: ["Test files found: 12", "Critical paths: 2 of 5", "Missing: payment flow"], pill: <StatusPill tone="risk"><Circle className="w-3 h-3" /> gaps</StatusPill> },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs uppercase tracking-widest text-primary">{card.title}</div>
                    {card.pill}
                  </div>
                  <ul className="space-y-1.5 font-mono text-[12px] text-muted-foreground">
                    {card.lines.map((l) => (
                      <li key={l} className="flex items-center gap-2">
                        <Terminal className="w-3 h-3 text-primary/70 shrink-0" />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <ComparisonTable />

      <BeforeAfterExplainer />

      {/* Report example gallery. Only renders
          if the API returns at least 3, otherwise stays hidden so we don't
          show an empty/awkward "social proof" strip. */}
      <PublicGallery />

      {/* Features (icon-less, with inline mockups). Each card pairs the
          numeral + description with a tiny "what this looks like" widget
          so the page stops reading as a wireframe. Mockups are pure HTML
          — no real screenshots — so they stay sharp at any zoom. */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal className="max-w-2xl mb-10">
          <div className="eyebrow text-primary mb-3">What you get</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Six reads on the repo, before the change lands.
          </h2>
        </Reveal>
        <div className="space-y-4">
          {features.map(({ eyebrow, title, desc }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div
                className="group overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
                data-testid={`card-feature-${i}`}
              >
                <div className="p-6 md:p-8 grid gap-6 md:grid-cols-2 items-center">
                  <div className="grid gap-4 md:grid-cols-[64px_1fr] items-baseline">
                    <div className="font-mono text-3xl md:text-4xl font-semibold text-primary/30 tabular-nums leading-none">
                      {eyebrow}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{title}</h3>
                      <p className="text-muted-foreground leading-relaxed max-w-prose">{desc}</p>
                    </div>
                  </div>
                  <FeatureMockup index={i} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pb-16 md:pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-card-border bg-accent p-8 md:p-12 text-center shadow-sm">
            <div className="absolute inset-0 -z-10 dot-grid opacity-60" />
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-primary-border bg-primary/10 text-primary">
              <Shield className="w-6 h-6" />
            </span>
            <h2 className="mt-5 text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Ship changes with{" "}
              <span className="text-primary">intent.</span>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Spend two minutes checking your repo before letting an agent change it. Catch the
              risks worth catching and hand the agent a safer prompt.
            </p>
            <Button asChild size="lg" className="mt-7" data-testid="button-cta-open-app">
              <Link href="/audits/new">
                {ctaLabel} <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}


/**
 * Category explainer — preflight and code review are different steps, and
 * this section says so without knocking review tools. Bullets stay at
 * category level and every preflight bullet must remain literally true of
 * the product (see github-ingest.ts for the "nothing to grant" claim).
 */
function BeforeAfterExplainer() {
  const preflight = [
    "Maps the repo's architecture and fragile spots before anything changes",
    "Rewrites your agent prompt to route around the risks it found",
    "Runs from a pasted URL — nothing to install, nothing to grant",
  ];
  const review = [
    "Reviews the diff once the code already exists",
    "Catches bugs and style issues the agent introduced",
    "Typically installed as a GitHub App with repo permissions",
  ];
  return (
    <section
      className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24"
      data-testid="section-before-after"
    >
      <Reveal className="max-w-2xl mb-10">
        <div className="eyebrow text-primary mb-3">Before vs after</div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          Preflight and code review do{" "}
          <span className="text-primary">different jobs.</span>
        </h2>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-2xl border border-[color:var(--brand-border)] bg-accent p-6 md:p-8">
            <div className="eyebrow text-primary mb-4">Preflight (before the agent runs)</div>
            <ul className="space-y-3">
              {preflight.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="h-full rounded-2xl border border-card-border bg-card p-6 md:p-8">
            <div className="eyebrow text-muted-foreground mb-4">Code review (after the agent runs)</div>
            <ul className="space-y-3">
              {review.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Circle className="mt-0.5 w-4 h-4 shrink-0 text-muted-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
      <Reveal delay={0.12}>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Use both. <span className="font-medium text-foreground">NeverGuess is the before.</span>
        </p>
      </Reveal>
    </section>
  );
}

/**
 * "Built with NeverGuess" gallery — pulls from /api/r/gallery (demo examples).
 * Hidden until at least 3 reports are returned so
 * we never render an awkward 1-card strip that screams "no users yet".
 */
function PublicGallery() {
  const reports = useGallery();
  if (!reports || reports.length < 3) return null;
  return (
    <section
      className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24"
      data-testid="section-public-gallery"
    >
      <Reveal className="mb-10 max-w-2xl">
        <div className="eyebrow text-primary mb-3">Built with NeverGuess</div>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          Example reports, real workflow.
        </h2>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          A sample of NeverGuess preflight audits. Click any card to read the verdict, the
          architecture map, and the safer-prompt pack.
        </p>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Trim to a multiple of 3 so the lg grid never strands one orphan card. */}
        {reports.slice(0, reports.length >= 6 ? 6 : 3).map((r, i) => (
          <Reveal key={r.slug} delay={i * 0.06}>
            <a
              href={`/r/${r.slug}`}
              data-testid={`gallery-report-${r.slug}`}
              className="group flex h-full flex-col rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <VerdictPill verdict={r.verdict} riskScore={r.riskScore} />
                {r.githubRepo && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground truncate max-w-[60%]">
                    <GitBranch className="w-3 h-3 shrink-0" />
                    <span className="truncate">{r.githubRepo}</span>
                  </span>
                )}
              </div>
              <p className="flex-1 text-sm font-medium leading-snug line-clamp-3 text-foreground">
                {r.requestedChange}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                Open report
                <ArrowRight className="w-3 h-3 text-primary transition-transform group-hover:translate-x-0.5" />
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/**
 * Per-feature inline mockup. Pure CSS/HTML so it scales cleanly without
 * needing real screenshot files. Each variant is intentionally simple and
 * single-purpose — the "look at the actual product" CTA is one card up.
 */
function FeatureMockup({ index }: { index: number }) {
  switch (index) {
    case 0: // Change Preflight — the before→after safer prompt, the report's headline artifact
      return (
        <div className="rounded-xl border border-card-border bg-card p-4 shadow-md space-y-3">
          <div>
            <div className="eyebrow mb-1.5">Your prompt</div>
            <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
              "Enable ISR on the product listing page"
            </p>
          </div>
          <div>
            <div className="eyebrow mb-1.5 text-primary">Safer prompt</div>
            <p className="rounded-lg border border-[color:var(--brand-border)] bg-accent px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
              "Enable ISR with revalidate=60. Keep preview mode on SSR — it bypasses the
              ISR cache. Don't touch getServerSideProps routes."
            </p>
          </div>
        </div>
      );
    case 1: // Architecture Awareness — flow chips (distinct from the hero's Next.js chain)
      return (
        <div className="rounded-xl border border-card-border bg-card p-4 shadow-md">
          <div className="eyebrow mb-3">Architecture map</div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-1 rounded-md border border-border bg-secondary text-foreground">CLI</span>
            <span className="text-muted-foreground/60">→</span>
            <span className="px-2 py-1 rounded-md border border-border bg-secondary text-foreground">Express API</span>
            <span className="text-muted-foreground/60">→</span>
            <span className="px-2 py-1 rounded-md border border-primary-border bg-primary/15 text-primary">Job queue</span>
            <span className="text-muted-foreground/60">→</span>
            <span className="px-2 py-1 rounded-md border border-border bg-secondary text-foreground">Redis</span>
          </div>
        </div>
      );
    case 2: // Risk Detection — list of findings
      return (
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Findings</div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> 3
            </span>
          </div>
          {[
            { sev: "high", text: "Preview mode bypasses ISR cache" },
            { sev: "med", text: "Unhandled fetch error on /api/posts" },
            { sev: "low", text: "Mutable shared state in providers/" },
          ].map((r) => (
            <div key={r.text} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full ${
                  r.sev === "high"
                    ? "bg-red-500"
                    : r.sev === "med"
                      ? "bg-amber-500"
                      : "bg-muted-foreground/50"
                }`}
              />
              <span className="text-muted-foreground">{r.text}</span>
            </div>
          ))}
        </div>
      );
    case 3: // Test Readiness — critical-path coverage + missing chips
      return (
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-3 shadow-md">
          <div className="eyebrow">Test readiness</div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-2xl font-bold tabular-nums text-foreground">2 of 5</span>
              <span className="text-[10px] font-mono text-muted-foreground">critical paths covered</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: "40%" }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["payment flow", "auth retry", "error boundary"].map((m) => (
              <span
                key={m}
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700"
              >
                missing: {m}
              </span>
            ))}
          </div>
        </div>
      );
    case 4: // Deployment Confidence — checklist
      return (
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-2 shadow-md">
          <div className="eyebrow mb-1">Deploy checklist</div>
          {[
            { ok: true, text: "DATABASE_URL referenced + documented" },
            { ok: true, text: "Build script present" },
            { ok: false, text: "NEXTAUTH_URL referenced, not in env docs" },
            { ok: true, text: "Health endpoint found" },
          ].map((c) => (
            <div key={c.text} className="flex items-center gap-2 text-xs">
              {c.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-600" />
              )}
              <span className={c.ok ? "text-muted-foreground" : "text-foreground font-medium"}>
                {c.text}
              </span>
            </div>
          ))}
        </div>
      );
    case 5: // Your Choice of Model — mirrors the real selector's grouped rows
    default:
      return (
        <div className="rounded-xl border border-card-border bg-card p-4 space-y-2 shadow-md">
          <div className="eyebrow mb-1">Analysis model</div>
          {[
            { name: "Claude Sonnet 5", id: "anthropic/claude-sonnet-5", locked: false },
            { name: "GPT-5.6 Terra", id: "openai/gpt-5.6-terra", locked: false },
            { name: "Grok 4.5", id: "x-ai/grok-4.5", locked: false },
            { name: "Claude Fable 5", id: "anthropic/claude-fable-5", locked: true },
          ].map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
              <div className={m.locked ? "text-muted-foreground" : "text-foreground font-medium"}>
                {m.name}
                <span className="ml-2 font-mono text-[10px] text-muted-foreground">{m.id}</span>
              </div>
              {m.locked && (
                <span className="rounded-full border border-card-border bg-secondary px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Pro
                </span>
              )}
            </div>
          ))}
          <div className="pt-1 text-[10px] text-muted-foreground">
            Live context + pricing from the OpenRouter catalog.
          </div>
        </div>
      );
  }
}
