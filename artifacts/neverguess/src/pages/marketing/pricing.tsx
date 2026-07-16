import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

type TierCta = {
  label: string;
  href: string;
  variant?: "default" | "outline";
  external?: boolean;
};

type Tier = {
  name: string;
  price: string;
  pricePeriod?: string;
  tagline: string;
  cta: TierCta;
  features: string[];
  highlight?: boolean;
  testId: string;
};

// Stripe Payment Link for the NeverGuess Pro tier ($10/mo, recurring).
//
// Resolved at runtime so we can swap the live link for a Stripe test-mode
// link in dev/preview without a code change. Set VITE_STRIPE_PRO_URL on
// the Replit dev workflow to point at a test-mode buy.stripe.com URL.
//
// Provisioned via Stripe MCP under MarMar INC: price_1TUrroL63c2y5C4UolezfDcp.
const STRIPE_PRO_CHECKOUT_URL =
  (import.meta.env.VITE_STRIPE_PRO_URL as string | undefined) ||
  "https://buy.stripe.com/cNi00kenzaDxe4q00200002";

// Annual price ($100/yr — same effective rate as $10/mo × 10, i.e. ~17% off).
// Provisioned via Stripe MCP under MarMar INC: price_1TUrrpL63c2y5C4URdOr9EaN.
const STRIPE_PRO_ANNUAL_URL =
  (import.meta.env.VITE_STRIPE_PRO_ANNUAL_URL as string | undefined) ||
  "https://buy.stripe.com/6oUaEY3IV4f92lI14600003";

// Hosted email for team-tier sales inquiries — routed to the founder
// inbox since the company is currently one person. Pre-filled subject +
// body keep replies triageable. Switch to a sales@ address once the team
// grows past one person.
const TEAM_MAILTO =
  "mailto:founder@marmarlabs.com?subject=NeverGuess%20Team%20plan&body=Hi%20MarMar%20Labs%20%E2%80%94%0A%0AI%27m%20interested%20in%20the%20NeverGuess%20Team%20tier.%20A%20few%20things%20about%20us%3A%0A%0A%E2%80%A2%20Company%3A%20%0A%E2%80%A2%20Team%20size%3A%20%0A%E2%80%A2%20Repos%20we%27d%20want%20covered%3A%20%0A%E2%80%A2%20Anything%20special%20we%20need%3A%20%0A%0AThanks!";

type Cadence = "monthly" | "annual";

/**
 * Append `?prefilled_email=` and `?client_reference_id=` to a Stripe Payment
 * Link URL. Both params are documented public Payment-Link customizations:
 *   • prefilled_email   — fills the email field at Stripe Checkout, so a
 *     logged-in user paying for Pro can't accidentally type a different
 *     email and break our user↔customer linking.
 *   • client_reference_id — round-trips back via session.client_reference_id
 *     in the checkout.session.completed webhook event. Lets the backend
 *     resolve the NeverGuess user id directly, no email matching.
 *
 * Anonymous users get the bare Payment Link URL (Stripe captures whatever
 * email they type — same behaviour as before, with the email-fallback
 * lookup as the safety net in the webhook handler).
 */
function withCheckoutContext(
  baseUrl: string,
  user: { id: string; email: string | null } | null,
): string {
  if (!user) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("client_reference_id", user.id);
  if (user.email) url.searchParams.set("prefilled_email", user.email);
  return url.toString();
}

function buildTiers(
  cadence: Cadence,
  user: { id: string; email: string | null } | null,
): Tier[] {
  const isAnnual = cadence === "annual";
  const baseProUrl = isAnnual ? STRIPE_PRO_ANNUAL_URL : STRIPE_PRO_CHECKOUT_URL;
  const proHref = withCheckoutContext(baseProUrl, user);
  return [
    {
      name: "Free",
      price: "$0",
      pricePeriod: "forever",
      tagline: "One audit per month. No credit card.",
      cta: {
        label: "Try a preflight",
        href: "/audits/new",
        variant: "outline",
      },
      features: [
        "1 preflight audit / month",
        "Public repos only",
        "Standard frontier models — Claude Sonnet 5, GPT-5.6, Gemini, Grok & more",
        "Shareable public report",
        "Re-run audits + revoke share links",
        "Prompt pack for 5 tools",
        "README verdict badge",
      ],
      testId: "tier-free",
    },
    {
      name: "Pro",
      price: isAnnual ? "$100" : "$10",
      pricePeriod: isAnnual ? "/year" : "/month",
      tagline: isAnnual
        ? "About $8.33/mo, billed annually — save $20 a year."
        : "For builders shipping daily with AI-assisted coding.",
      cta: {
        label: "Start with Pro",
        href: proHref,
        variant: "default",
        external: true,
      },
      features: [
        "50 preflight audits / month",
        // Names must match the tier:"premium" entries in the server model
        // catalog (artifacts/api-server/src/lib/model-catalog.ts) — no
        // invented speed claims.
        "Premium models — Claude Fable 5, Claude Opus 4.8 (Fast), GPT-5.5 Pro & the GPT-5.6 Pro line",
        "Bring your own GitHub token for rate-limit headroom — used once, never stored",
        "Audit history kept forever",
        "Priority email support",
      ],
      highlight: true,
      testId: "tier-pro",
    },
    {
      name: "Team",
      price: "Talk to us",
      tagline: "For teams that need managed rollout help.",
      cta: {
        label: "Email sales",
        href: TEAM_MAILTO,
        variant: "outline",
        external: true,
      },
      features: [
        "Everything in Pro",
        "Unlimited audits across the team",
        "First in line when private-repo support ships",
        "Shared audit history",
        "Team usage review",
        "Custom risk checklist setup",
      ],
      testId: "tier-team",
    },
  ];
}

const faqs: Array<{ q: string; a: string }> = [
  {
    q: "Why is the free tier limited to one audit a month?",
    a: "Each audit runs a real reasoning model — that costs real money. One free run is enough to see if NeverGuess is useful for your repo. Pro lifts the cap to 50 / month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the Manage subscription link in your dashboard sidebar — you keep access through the end of the billing period, and you won't be charged again.",
  },
  {
    q: "Do you store my code?",
    a: "We fetch the repo you point us at, build an in-memory map of its structure, and run the analysis. We do not persist source code. Generated reports are stored against your account.",
  },
  {
    q: "Which models run my audit?",
    a: "You pick the model from a selector on the new-audit form. Signed-in accounts choose among standard frontier models — Claude Sonnet 5, the GPT-5.6 family, Gemini, Grok, and more — and Pro unlocks premium options like Claude Fable 5 and GPT-5.5 Pro. Anonymous trial audits run on the default model. Every finished report carries a receipt naming the exact model that produced it.",
  },
  {
    q: "What about private repos?",
    a: "Not yet — NeverGuess currently audits public GitHub repos and public live URLs only. Private-repo support is on the roadmap. The optional token field on the audit form exists for GitHub rate-limit headroom on public repos; the token is used once and never stored or logged.",
  },
  {
    q: "What happens if I hit the 50-audit cap?",
    a: "New audits are blocked with a clear message until your quota resets with the next billing month. There are no surprise overage charges — ever.",
  },
  {
    q: "Annual vs monthly — what's the difference?",
    a: "Same product, same caps. Annual saves you about two months of fees and locks in your rate.",
  },
];

export default function MarketingPricing() {
  // Static OG meta — link previews on Twitter/LinkedIn unfurl with a real
  // pricing pitch instead of the generic site title.
  useMetaTags({
    title: "NeverGuess pricing — $0 free, $10/mo Pro",
    description:
      "Free for occasional NeverGuess preflights. $10/mo for builders shipping daily with AI-assisted coding. Cancel anytime — you keep access through the end of the billing period.",
    canonicalUrl: "https://marmarlabs.com/pricing",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
  });

  const [cadence, setCadence] = useState<Cadence>("monthly");
  // Pre-fill the Stripe checkout email + stamp the user id onto the session
  // so the webhook can link the payment to the right NeverGuess account
  // even if the customer types a different email. Anonymous visitors fall
  // through to the bare Payment Link.
  const { user, isAuthenticated, login } = useAuth();
  const tiers = buildTiers(
    cadence,
    user ? { id: user.id, email: user.email ?? null } : null,
  );

  return (
    <MarketingLayout>
      {/* ---- Hero --------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Pricing · NeverGuess
          </div>
          <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl">
            Pricing that scales with how often you{" "}
            <span className="text-primary">ship.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Free for occasional NeverGuess preflights. $10/mo if you ship with
            AI-assisted coding every day. Talk to us if your team needs shared
            preflight workflows.
          </p>
          {/* Monthly / Annual toggle. Two segmented buttons, the active one
              filled with ink. Saves 17% messaging lives in the annual price
              tagline so it doesn't fight for attention. */}
          <div
            className="mt-10 inline-flex items-center gap-1 rounded-full border border-card-border bg-card p-1 shadow-xs"
            role="tablist"
            aria-label="Billing cadence"
            data-testid="toggle-pricing-cadence"
          >
            <button
              type="button"
              role="tab"
              aria-selected={cadence === "monthly"}
              onClick={() => setCadence("monthly")}
              data-testid="button-cadence-monthly"
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                cadence === "monthly"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={cadence === "annual"}
              onClick={() => setCadence("annual")}
              data-testid="button-cadence-annual"
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                cadence === "annual"
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span
                className={`text-[10px] font-mono uppercase tracking-widest rounded-full px-1.5 py-0.5 ${
                  cadence === "annual"
                    ? "bg-background/15 text-background"
                    : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                }`}
              >
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ---- Tiers -------------------------------------------------------- */}
      <section
        className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20"
        data-testid="section-pricing-tiers"
      >
        <div className="grid gap-5 md:grid-cols-3 md:items-start">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 0.08} className="h-full">
              <div
                className={
                  tier.highlight
                    ? "relative flex h-full flex-col rounded-2xl border border-[color:var(--brand-border)] bg-card p-6 md:p-8 shadow-sm ring-brand-glow transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 md:-mt-3"
                    : "relative flex h-full flex-col rounded-2xl border border-card-border bg-card p-6 md:p-8 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
                }
                data-testid={tier.testId}
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    {/* h2, not h3 — the page heading order is the hero h1
                        straight into these cards, so h3 would skip a level. */}
                    <h2 className="font-display text-xl font-semibold tracking-tight">
                      {tier.name}
                    </h2>
                    {tier.highlight && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-primary-foreground shadow-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-semibold tracking-tight tabular-nums">
                      {tier.price}
                    </span>
                    {tier.pricePeriod && (
                      <span className="font-mono text-sm text-muted-foreground">
                        {tier.pricePeriod}
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">
                    {tier.tagline}
                  </p>
                </div>
                <div className="mt-6 space-y-2">
                  {/* Anonymous checkouts hit the bare Stripe Payment Link, so
                      the webhook can only link the payment by whatever email
                      the buyer types at Stripe. Routing signed-out visitors
                      through sign-in first guarantees the checkout carries
                      client_reference_id and lands on the right account. */}
                  {tier.highlight && !isAuthenticated ? (
                    <>
                      <Button
                        variant={tier.cta.variant ?? "default"}
                        className="w-full"
                        onClick={() => login("/pricing")}
                        data-testid="button-tier-pro-sign-in"
                      >
                        Sign in first
                        <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        so Pro lands on the right account
                      </p>
                    </>
                  ) : tier.cta.external ? (
                    <Button
                      asChild
                      variant={tier.cta.variant ?? "default"}
                      className="w-full"
                      data-testid={`button-${tier.testId}-cta`}
                    >
                      <a href={tier.cta.href} rel="noopener">
                        {tier.cta.label}
                        <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                      </a>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      variant={tier.cta.variant ?? "default"}
                      className="w-full"
                      data-testid={`button-${tier.testId}-cta`}
                    >
                      <Link href={tier.cta.href}>
                        {tier.cta.label}
                        <ArrowRight className="w-4 h-4 ml-2" aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                  {tier.highlight && isAuthenticated && (
                    <p className="text-center text-xs text-muted-foreground">
                      Secure checkout via Stripe · Cancel anytime
                    </p>
                  )}
                </div>
                <ul className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check
                        className="w-4 h-4 mt-0.5 text-primary shrink-0"
                        aria-hidden="true"
                      />
                      <span className="text-muted-foreground leading-relaxed">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-8 text-center font-mono text-xs text-muted-foreground">
          Cancel anytime · Keep access through your billing period · Source code
          is never stored
        </p>
      </section>

      {/* ---- FAQ ---------------------------------------------------------- */}
      <section
        className="border-t border-border bg-card"
        data-testid="section-pricing-faq"
      >
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <Reveal className="text-center">
            <div className="eyebrow text-primary mb-3">Frequently asked</div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
              Questions before you commit.
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {faqs.map((item, i) => (
              <Reveal key={item.q} delay={i * 0.06}>
                <details
                  className="group rounded-2xl border border-card-border bg-background shadow-sm overflow-hidden transition-colors hover:border-[color:var(--brand-border)]"
                  data-testid={`faq-${i}`}
                >
                  <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">
                      {item.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-muted-foreground group-open:rotate-45 group-open:text-primary transition-transform text-xl leading-none shrink-0"
                    >
                      +
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                    {item.a}
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
