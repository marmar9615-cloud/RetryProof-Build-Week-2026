import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";
import { ArrowRight, Github, Linkedin, Mail, MapPin, ShieldCheck } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

// Plain-fact table that lives at the bottom of the page. Anything that
// might change (team size, founded date, etc.) goes here so prose stays
// short. Order matters — read top-to-bottom.
const facts: Array<[string, string]> = [
  ["Company", "MarMar Labs"],
  ["Founded", "March 26, 2026"],
  ["Location", "Minneapolis, Minnesota"],
  ["Stage", "Self-funded · Four public products"],
  ["Team size", "1"],
  ["Founder", "Marcel Jiron"],
  ["Public products", "RetryProof, NeverGuess, stui, SignAI"],
  ["Security research", "$4,050 HackerOne rewards · 5 paid findings"],
];

// Contact strip — real channels, no contact form gating.
const channels: Array<{
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  external: boolean;
  testId: string;
}> = [
  {
    href: "mailto:founder@marmarlabs.com",
    label: "founder@marmarlabs.com",
    Icon: Mail,
    external: false,
    testId: "link-contact-email",
  },
  {
    href: "https://x.com/MarMarLabs",
    label: "@MarMarLabs",
    Icon: FaXTwitter,
    external: true,
    testId: "link-contact-x",
  },
  {
    href: "https://www.linkedin.com/in/marcel-jiron-525092408/",
    label: "LinkedIn",
    Icon: Linkedin,
    external: true,
    testId: "link-contact-linkedin",
  },
  {
    href: "https://github.com/marmar9615-cloud",
    label: "GitHub",
    Icon: Github,
    external: true,
    testId: "link-contact-github",
  },
  {
    href: "https://hackerone.com/realmarmarlabs?type=user",
    label: "HackerOne",
    Icon: ShieldCheck,
    external: true,
    testId: "link-contact-hackerone",
  },
];

export default function MarketingAbout() {
  useMetaTags({
    title: "About MarMar Labs — One developer, one company, multiple products",
    description:
      "MarMar Labs is a self-funded software lab in Minnesota run by one developer — shipping RetryProof, NeverGuess, stui, SignAI, and practical security research proof in public.",
    canonicalUrl: "https://marmarlabs.com/about",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
  });

  return (
    <MarketingLayout>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-30" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <MapPin className="w-3 h-3 -ml-0.5" />
              Minneapolis, MN · Founded 2026
            </div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl max-w-3xl">
              One developer building a software lab that ships{" "}
              <span className="text-primary">small, useful tools.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              MarMar Labs is the company behind RetryProof, NeverGuess, stui, and SignAI. The thesis is simple:
              one accountable operator can ship useful software across web, Python, and iOS when the
              products stay narrow and the proof stays public.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Founder narrative — short, first-person, real. ------------- */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-6">
        <Reveal className="space-y-4">
          <div className="eyebrow text-primary">The story</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Why MarMar Labs exists.
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          <p>
            <Link href="/retryproof" className="text-foreground font-medium hover:text-primary underline-offset-4 hover:underline">RetryProof</Link> makes retry bugs reproducible before an n8n workflow reaches production:
            declare an invariant, inject deterministic faults, approve a constrained repair, and let
            the validator—not a model—own the final verdict.
          </p>
          <p>
            I'm Marcel — the entire MarMar Labs team. I started this lab in 2026 to build the kind of
            software I kept wishing existed: small, focused, opinionated tools that respect the
            user's time and don't fall apart on the second click.
          </p>
          <p>
            <Link href="/neverguess" className="text-foreground font-medium hover:text-primary underline-offset-4 hover:underline">NeverGuess</Link> came out of a frustration most builders share: AI-assisted coding tools edit
            code confidently but do not always understand what they are about to break. It sits
            between you and the agent, looks at the actual repo, and tells you what to watch for
            before the change ships.
          </p>
          <p>
            <Link href="/stui" className="text-foreground font-medium hover:text-primary underline-offset-4 hover:underline">stui</Link> is smaller and nerdier on purpose:
            a terminal-native Python UI framework for local tools, SSH sessions, data scripts,
            and model debug panels that do not need a browser.
          </p>
          <p>
            <Link href="/signai" className="text-foreground font-medium hover:text-primary underline-offset-4 hover:underline">SignAI</Link> brings the same practical bent to agreements on iPhone: scan or import a document,
            review important terms, manage deadlines, and prepare signatures from one mobile
            workspace.
          </p>
          <p>
            The same security lens shows up outside the products. I also research bugs on{" "}
            <a
              href="https://hackerone.com/realmarmarlabs?type=user"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground font-medium hover:text-primary underline-offset-4 hover:underline"
            >
              HackerOne
            </a>
            , with paid findings across AI and developer-tool systems. Private report details
            stay private; the public signal is the skill: reading unfamiliar systems, finding
            weak boundaries, and explaining risk clearly.
          </p>
        </Reveal>
      </section>

      {/* ---- Why now — frames the company narrative for investors. ------ */}
      <section className="border-y border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-6">
          <Reveal className="space-y-4">
            <div className="eyebrow text-primary">Why now</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              AI-assisted development needs operational guardrails.
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed">
            <p>
              Vibe-coding tools (Replit Agent, Cursor, Claude Code, Codex, GitHub Copilot) are the
              biggest productivity unlock since the IDE. They're also blunt instruments — they ship
              confident edits without understanding architecture, test coverage, or risk surface.
            </p>
            <p>
              That gap is the wedge for the lab: products that make AI-assisted work easier to
              inspect, safer to act on, and less dependent on trusting a confident demo at face value.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---- Security research proof point. ---------------------------- */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-6">
        <Reveal className="space-y-4">
          <div className="eyebrow text-primary">Security research</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Bug finding is part of the operating system.
          </h2>
        </Reveal>
        <Reveal delay={0.08} className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          <p>
            MarMar Labs is not only product building. Marcel also looks for practical
            vulnerabilities in AI systems, developer tools, APIs, CLIs, GitHub Actions,
            CI/CD, and token or secret handling. That work has produced $4,050 in
            HackerOne rewards across paid findings.
          </p>
          <p>
            The public page keeps the proof high-level: profile, focus areas, rewards,
            and methodology. It does not publish private report titles, program details,
            payloads, payout references, or reproduction steps.
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <Button asChild variant="outline" data-testid="button-about-security">
            <Link href="/security-research">
              View security research <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </Reveal>
      </section>

      {/* ---- Honest stage marker + facts ledger. ----------------------- */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-8">
        <Reveal>
          <div className="eyebrow text-primary mb-3">Where we are today</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance mb-3">
            One developer, four public products.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            No outside capital. No growth-marketing team. No invented traction. If you are an
            investor, partner, or potential first hire interested in a small operator who ships,
            the contact info below goes directly to the founder.
          </p>
        </Reveal>

        {/* Facts card — a clean definition list, no terminal chrome. */}
        <Reveal delay={0.08}>
          <div className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div className="eyebrow text-muted-foreground">Company facts</div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-card-border bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Updated July 2026
              </span>
            </div>
            <dl className="divide-y divide-border px-5 sm:px-6 py-1">
              {facts.map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 py-3.5"
                  data-testid={`fact-${k.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="sm:col-span-2 text-sm text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        {/* Contact strip — four real channels, no contact form gating. */}
        <Reveal delay={0.12}>
          {/* Two columns max — four-up clips the founder email mid-word. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map(({ href, label, Icon, external, testId }) => (
              <a
                key={testId}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-3 rounded-2xl border border-card-border bg-card px-4 py-3 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
                data-testid={testId}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </a>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.16} className="pt-2">
          <Button asChild size="lg" data-testid="button-about-cta">
            <Link href="/neverguess">
              See what we shipped first <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
