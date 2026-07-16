import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { Button } from "@/components/ui/button";
import { STUI_RELEASE } from "@/data/stui-release";
import { ArrowRight, ArrowUpRight, FlaskConical, PenLine, ShieldCheck, Terminal, Trophy } from "lucide-react";

const ledger = [
  { name: "RetryProof", label: "Workflow flight test · web", href: "/retryproof", Icon: FlaskConical, badge: "Build Week", tone: "border-violet-200 bg-violet-50 text-violet-700" },
  { name: "NeverGuess", label: "AI change preflight · web", href: "/neverguess", Icon: ShieldCheck, badge: "Live", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { name: "stui", label: "Terminal UI framework · PyPI", href: "/stui", Icon: Terminal, badge: "v" + STUI_RELEASE.version, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { name: "SignAI", label: "Agreement workflows · iOS", href: "/signai", Icon: PenLine, badge: "App Store", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

const operatingNotes = [
  {
    title: "Nothing here is a mockup",
    body: "RetryProof and NeverGuess run on the web, stui installs from PyPI, and SignAI is on the App Store. Every product page links to the live artifact.",
  },
  {
    title: "Releases are public record",
    body: "Meaningful product releases land in the changelog with a date and version, and the status page reports service health from your own browser.",
  },
  {
    title: "Support answered by the builder",
    body: "Email goes to the founder, not a ticket queue — typically answered within one business day.",
  },
];

export default function MarketingHome() {
  useMetaTags({
    title: "MarMar Labs — Practical software, shipped in public",
    description:
      "MarMar Labs ships NeverGuess, stui, SignAI, and practical security research proof from a self-funded software lab in Minnesota.",
    canonicalUrl: "https://marmarlabs.com/",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
  });

  return (
    <MarketingLayout>
      {/* ---- Hero --------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1100px] h-[640px] bg-[radial-gradient(circle,var(--brand-glow),transparent_60%)] opacity-40" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>Self-funded software lab<span className="hidden min-[400px]:inline"> · Minnesota</span></span>
            </div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-5xl md:text-6xl lg:text-7xl">
              Practical software,{" "}
              <span className="text-primary">shipped in public.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              MarMar Labs builds focused tools for workflow fault testing, AI change preflight,
              terminal-native Python workflows, and iOS agreement review. Security research
              sharpens the work. The portfolio is live, public, and intentionally narrow.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" data-testid="button-hero-proof">
                <Link href="/r/next-isr">
                  See a live preflight report <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Portfolio index — a light, editorial directory of the products. */}
          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl">
              <div className="border-b border-border px-5 py-4">
                <div className="eyebrow text-muted-foreground">Shipped products</div>
              </div>
              <div className="divide-y divide-border">
                {ledger.map((row, i) => {
                  const RowIcon = row.Icon;
                  return (
                    <Link
                      key={row.name}
                      href={row.href}
                      data-testid={`hero-ledger-${row.name.toLowerCase()}`}
                      className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/60"
                    >
                      <span className="font-mono text-xs tabular-nums text-muted-foreground/60">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary transition-colors group-hover:border-[color:var(--brand-border)]">
                        <RowIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[0.95rem] font-semibold tracking-tight text-foreground">
                          {row.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">{row.label}</span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${row.tone}`}>
                        {row.badge}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Operating notes --------------------------------------------- */}
      <section className="border-y border-border bg-card" data-testid="section-operating-notes">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <div className="eyebrow text-primary mb-3">Operating notes</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Public surfaces, a release trail, and support you can reach.
            </h2>
          </Reveal>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-card-border bg-border md:grid-cols-3">
            {operatingNotes.map((note, i) => (
              <Reveal key={note.title} delay={i * 0.08} className="bg-background p-6">
                <div className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</div>
                <div className="mt-3 font-semibold tracking-tight">{note.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{note.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Security research ------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20" data-testid="section-security-research">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <div className="eyebrow text-primary mb-3">Security research</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              The builder also finds real bugs.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              Marcel researches practical security issues in AI systems, developer tools,
              APIs, CLIs, GitHub Actions, CI/CD, and token or secret handling. The public
              proof lives on HackerOne; private report details stay private.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button asChild data-testid="button-home-security">
                <Link href="/security-research">
                  View security research <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" data-testid="button-home-hackerone">
                <a href="https://hackerone.com/realmarmarlabs?type=user" target="_blank" rel="noopener noreferrer">
                  HackerOne profile <ArrowUpRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div className="eyebrow text-muted-foreground">Research proof</div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  <Trophy className="h-3 w-3" />
                  HackerOne
                </span>
              </div>
              <div className="grid gap-px bg-border sm:grid-cols-3">
                {[
                  ["$4,050", "rewards earned"],
                  ["5", "paid findings"],
                  ["99th", "signal percentile"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-background p-5">
                    <div className="font-display text-3xl font-semibold tracking-tight text-foreground">
                      {value}
                    </div>
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- Founder ------------------------------------------------------ */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24" data-testid="section-founder">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <Reveal>
            <div className="eyebrow text-primary mb-3">Who built this</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-balance">
              Marcel Jiron, building from Minnesota.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="space-y-4 text-base text-muted-foreground leading-relaxed">
            <p>
              MarMar Labs is a self-funded software lab run by one builder. That keeps the company
              close to the work: product decisions, engineering, release notes, support, and site
              copy all route back to the same person.
            </p>
            <p>
              The current focus: fault tests before retry-sensitive workflows ship, preflight
              checks before AI agents touch a codebase, terminal-native Python workflows, and
              agreement review and signing on iPhone.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild variant="outline" data-testid="button-founder-about">
                <Link href="/about">Read the longer story</Link>
              </Button>
              <Button asChild data-testid="button-founder-contact">
                <Link href="/contact">
                  Get in touch <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
