import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useMetaTags } from "@/lib/use-meta-tags";

export default function MarketingTerms() {
  useDocumentTitle("Terms of Service | MarMar Labs");
  useMetaTags({
    title: "Terms of Service | MarMar Labs",
    description: "The basic rules for using NeverGuess and other MarMar Labs services.",
    canonicalUrl: "https://marmarlabs.com/terms",
  });

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 md:px-8 py-20 md:py-24 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Legal · Terms
          </div>
          <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl">
            Terms of <span className="text-primary">Service</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            The basic rules for using NeverGuess and other MarMar Labs services. Plain English first, legal mode second.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <Reveal>
        <article className="legal-copy max-w-none text-sm md:text-base leading-relaxed">
          <p className="eyebrow !text-muted-foreground">
            Last updated: May 2026
          </p>

          <p>
            By accessing or using NeverGuess and the marmarlabs.com properties (the "Service"), you
            agree to these terms. MarMar Labs operates the Service.
          </p>

          <h2>Your account</h2>
          <p>
            You're responsible for keeping your account credentials safe. If you suspect unauthorized
            access, email <a href="mailto:support@marmarlabs.com">support@marmarlabs.com</a>{" "}
            and we'll help you secure it.
          </p>

          <h2>Acceptable use</h2>
          <ul>
            <li>Don't submit code or content you don't have the right to submit.</li>
            <li>Don't attempt to disrupt, reverse-engineer, scrape, or abuse the Service.</li>
            <li>Don't use the Service for unlawful activity, harassment, or to generate harmful content.</li>
            <li>Don't try to bypass billing controls (rate limits, paywalls, free-tier caps).</li>
          </ul>

          <h2>Subscriptions and billing</h2>
          <ul>
            <li>
              Paid plans are billed in advance through Stripe. Prices and terms are listed on the
              <a href="/pricing"> Pricing page</a>.
            </li>
            <li>
              You can cancel at any time from the Customer Portal (the "Manage subscription" link in
              your dashboard). Cancellation takes effect at the end of the current billing period
              and we will not auto-renew without warning.
            </li>
            <li>
              We don't offer pro-rated refunds, but if something feels unfair, email us and we'll
              make it right within reason.
            </li>
            <li>
              We may change prices for new subscriptions. Existing subscribers keep their rate
              through their current term and we'll notify you of any change before the next renewal.
            </li>
          </ul>

          <h2>No warranty</h2>
          <p>
            The Service is provided on an "as is" and "as available" basis. NeverGuess reports are
            advisory — they're an AI-generated analysis of code, not a guarantee. You are responsible
            for reviewing outputs before acting on them.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, MarMar Labs is not liable for any indirect,
            incidental, special, or consequential damages arising from your use of the Service.
            Our aggregate liability for any claim is limited to the amount you paid us in the
            12 months preceding the claim.
          </p>

          <h2>Termination</h2>
          <p>
            We can suspend or terminate accounts that violate these terms. You can close your
            account at any time by emailing us; we'll delete your data within a reasonable
            timeframe (some logs may be retained for legal/security reasons for a short window).
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms as the Service evolves. Material changes will be announced
            via email and on this page; continued use after a change constitutes acceptance.
          </p>

          <h2>Contact</h2>
          <p>
            General questions: <a href="mailto:contact@marmarlabs.com">contact@marmarlabs.com</a>.
            Billing or account issues: <a href="mailto:support@marmarlabs.com">support@marmarlabs.com</a>.
          </p>

          <p className="text-xs">
            <strong>Note for users:</strong> this is an indie-stage Terms document written by the
            company, not a law firm. We'll formalize it with counsel before MarMar Labs takes any
            enterprise contract.
          </p>
        </article>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
