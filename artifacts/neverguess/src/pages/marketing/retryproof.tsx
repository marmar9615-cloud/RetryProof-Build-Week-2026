import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { useJsonLd } from "@/lib/use-json-ld";
import { useMetaTags } from "@/lib/use-meta-tags";
import { RETRYPROOF, RETRYPROOF_JSON_LD } from "@/data/retryproof";
import { Link } from "wouter";

const steps = [
  {
    title: "Import the real workflow",
    body: "RetryProof parses and sanitizes an n8n export without executing workflow code, SQL, shell commands, or network calls.",
    Icon: ShieldCheck,
  },
  {
    title: "Approve the contract",
    body: "GPT-5.6 can propose a structured effect, business key, and invariant for supported custom workflows. Every citation is grounded before a human approves the contract.",
    Icon: CheckCircle2,
  },
  {
    title: "Inject deterministic faults",
    body: "The simulator owns the schedule, crash points, retries, and verdict so the same scenario is reproducible and inspectable.",
    Icon: FlaskConical,
  },
  {
    title: "Repair, then prove it again",
    body: "A bounded Codex-validated repair strategy produces a source-bound patch. The deterministic validator—not the model—decides whether the invariant now passes.",
    Icon: Wrench,
  },
];

export default function MarketingRetryProof() {
  useMetaTags({
    title: RETRYPROOF.title + " | MarMar Labs",
    description: RETRYPROOF.description,
    canonicalUrl: RETRYPROOF.productUrl,
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    ogImageAlt: "RetryProof workflow flight test by MarMar Labs",
  });
  useJsonLd(RETRYPROOF_JSON_LD);

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              OpenAI Build Week · Developer tools
            </div>
            <h1 className="text-balance font-display text-5xl font-semibold leading-[1.02] tracking-[-0.035em] md:text-6xl">
              Make retry failures happen <span className="text-primary">before production.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {RETRYPROOF.description}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" data-testid="button-open-retryproof-app">
                <Link href="/retryproof/lab">
                  Open the flight test <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" data-testid="button-retryproof-source">
                <a href={RETRYPROOF.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  View source <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:120ms] rounded-2xl border border-card-border bg-card p-6 shadow-xl">
            <div className="eyebrow text-primary">The judged moment</div>
            <div className="mt-4 flex items-center gap-3">
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">RED · 2 refunds</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">GREEN · 1 refund</span>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              A duplicate side effect is reproduced under a declared retry schedule, a constrained repair is generated, and the same deterministic scenario is replayed to produce a SHA-256-addressed evidence receipt.
            </p>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-card-border bg-secondary/60 p-4">
              <GitCompareArrows className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">{RETRYPROOF.boundary}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
        <Reveal>
            <div className="eyebrow text-primary">One end-to-end path</div>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Models propose. Humans approve. The simulator decides.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-card-border bg-border md:grid-cols-2">
          {steps.map(({ title, body, Icon }, index) => (
            <Reveal key={title} delay={index * 0.06} className="bg-background p-6">
              <Icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:px-8 md:py-20">
          <Reveal>
            <div className="eyebrow text-primary">Judge-ready by design</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">No account. No production workflow. No hidden verdict.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Start with the seeded proof or bring a supported webhook workflow and synthetic fixture. RetryProof runs analysis, human approval, four deterministic fault scenarios, bounded repair, identical-suite replay, and a downloadable evidence ZIP without calling the workflow's real integrations.
            </p>
            <Button asChild size="lg" className="mt-7">
              <Link href="/retryproof/lab">
                Run RetryProof <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
