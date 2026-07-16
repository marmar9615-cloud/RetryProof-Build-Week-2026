import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";

const profileUrl = "https://hackerone.com/realmarmarlabs?type=user";

const proofStats = [
  { label: "HackerOne rewards earned", value: "$4,050", detail: "paid findings and retest awards" },
  { label: "Paid findings", value: "5", detail: "report details kept private unless disclosed" },
  { label: "Signal", value: "7.00", detail: "99th percentile profile signal" },
  { label: "Impact", value: "17.00", detail: "profile impact score" },
];

const focusAreas = [
  "AI systems and agent tooling",
  "Developer tools, APIs, and CLIs",
  "GitHub Actions and CI/CD boundaries",
  "Token, secret, and configuration handling",
  "Permissions, integrations, and trust boundaries",
];

const method = [
  {
    title: "Scope first",
    body: "Research starts with the program boundary, allowed testing methods, and the safest way to reproduce impact.",
    Icon: Target,
  },
  {
    title: "Controlled proof",
    body: "Reports use owned accounts, local reproduction, and controlled test data whenever possible.",
    Icon: ShieldCheck,
  },
  {
    title: "Private details stay private",
    body: "Non-public report titles, program details, payloads, and reproduction steps do not get published on this site.",
    Icon: Lock,
  },
];

export default function MarketingSecurityResearch() {
  useMetaTags({
    title: "Security Research by MarMar Labs",
    description:
      "Marcel Jiron researches practical security issues in AI systems, developer tools, APIs, CLIs, GitHub Actions, CI/CD, and token or secret handling.",
    canonicalUrl: "https://marmarlabs.com/security-research",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
  });

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 grid gap-12 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              HackerOne profile · realmarmarlabs
            </div>
            <h1
              className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl"
              aria-label="Security research that feeds back into better products."
            >
              Security research that feeds back into{" "}
              <span className="text-primary">better products.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Marcel Jiron researches practical bugs in AI systems, developer tools,
              APIs, CLIs, GitHub Actions, CI/CD, and cloud-integrated workflows. The
              same habit of finding broken trust boundaries shapes how MarMar Labs
              designs and ships software.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" data-testid="button-security-hackerone">
                <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                  View HackerOne profile <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" data-testid="button-security-contact">
                <Link href="/contact">
                  Security or program inquiry <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-xl">
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div className="eyebrow text-muted-foreground">Public proof</div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  <Trophy className="h-3 w-3" />
                  June 2026
                </span>
              </div>
              <div className="grid gap-px bg-border sm:grid-cols-2">
                {proofStats.map((stat) => (
                  <div key={stat.label} className="bg-background p-5">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {stat.label}
                    </div>
                    <div className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">
                      {stat.value}
                    </div>
                    <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {stat.detail}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border px-5 py-4 text-xs leading-relaxed text-muted-foreground">
                High-level proof only. Private report content, program details, payout
                references, payloads, and reproduction steps stay off the public site
                unless the program has disclosed them.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <Reveal>
            <div className="eyebrow text-primary mb-3">Research focus</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Practical bugs in systems builders actually use.
            </h2>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">
              The strongest reports come from reading how real tools move data, secrets,
              permissions, and generated code across boundaries.
            </p>
          </Reveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {focusAreas.map((area, i) => (
              <Reveal key={area} delay={i * 0.06}>
                <div className="flex items-start gap-3 rounded-2xl border border-card-border bg-card p-4 shadow-sm">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="text-sm font-medium leading-relaxed text-foreground">{area}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="max-w-2xl">
            <div className="eyebrow text-primary mb-3">How reports are handled</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Clear impact, careful boundaries, no public oversharing.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {method.map(({ title, body, Icon }, i) => (
              <Reveal key={title} delay={i * 0.08} className="h-full">
                <div className="h-full rounded-2xl border border-card-border bg-background p-6 shadow-sm">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
        <Reveal>
          <div className="eyebrow text-primary mb-3">Work with the same eye for risk</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Security research is part of the lab, not a side note.
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
            If you are evaluating MarMar Labs, this is another proof point: the builder
            behind the products can read unfamiliar systems, find brittle assumptions,
            and explain the risk clearly enough for teams to act.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/about">
                Read about the company <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                HackerOne profile <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
