import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useDocumentTitle } from "@/lib/use-document-title";
import { useMetaTags } from "@/lib/use-meta-tags";

export default function MarketingPrivacy() {
  useDocumentTitle("Privacy Policy | MarMar Labs");
  useMetaTags({
    title: "Privacy Policy | MarMar Labs",
    description:
      "What MarMar Labs collects when you use NeverGuess, why we collect it, and how to reach us about it.",
    canonicalUrl: "https://marmarlabs.com/privacy",
  });

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[900px] h-[520px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 md:px-8 py-20 md:py-24 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Legal · Privacy
          </div>
          <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl">
            Privacy <span className="text-primary">Policy</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            What we collect, why we collect it, and how to reach us. Plain English first, legal mode second.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <Reveal>
        <article className="legal-copy max-w-none text-sm md:text-base leading-relaxed">
          <p className="eyebrow !text-muted-foreground">
            Last updated: May 2026 · Effective immediately on any new account
          </p>

          <p>
            MarMar Labs ("we", "us") operates the NeverGuess web application and the marmarlabs.com
            properties (the "Service"). This is the early-stage Privacy Policy; we'll update it as
            the Service grows. The principles below reflect how the Service is built today.
          </p>

          <h2>Information we collect</h2>
          <ul>
            <li>
              <strong>Account info</strong> — when you sign in via our authentication provider,
              we receive your email, display name, and profile image.
            </li>
            <li>
              <strong>Audit inputs</strong> — the GitHub repository URLs, live URLs, and
              change descriptions you submit to NeverGuess.
            </li>
            <li>
              <strong>Generated reports</strong> — the analysis output we produce from those inputs,
              stored against your account.
            </li>
            <li>
              <strong>Billing info</strong> — if you subscribe to NeverGuess Pro, payments are
              processed by Stripe. We never see or store your card; we receive only a Stripe
              customer id, subscription id, status, and renewal date.
            </li>
            <li>
              <strong>Server logs</strong> — IP address, user agent, request timestamps and paths,
              kept for security and debugging. These are rotated on a short schedule.
            </li>
          </ul>

          <h2>How we use information</h2>
          <ul>
            <li>To run the analyses you request and display the resulting reports.</li>
            <li>To operate, secure, and improve the Service.</li>
            <li>To bill you (if you're on a paid plan) and to email you about your subscription.</li>
            <li>To respond when you contact us.</li>
          </ul>

          <h2>What we do NOT do</h2>
          <ul>
            <li>We do not sell personal information.</li>
            <li>We do not embed third-party advertising or analytics tracking pixels.</li>
            <li>We do not persist your repository source code. We fetch it, build an in-memory map, run the analysis, and discard the source.</li>
            <li>We do not store any GitHub personal access token you provide. It is held only in memory for the single audit, then released.</li>
          </ul>

          <h2>Subprocessors</h2>
          <p>
            We rely on a small set of trusted infrastructure providers to deliver the Service:
            Replit (hosting + authentication), Stripe (payments), OpenRouter and the underlying
            model providers (AI inference for the audit reports). Each handles the data described
            above under their own privacy practices.
          </p>

          <h2>Public reports</h2>
          <p>
            When you create a public share link for a NeverGuess report, the contents of that
            report become accessible to anyone with the link. Don't include private information
            in inputs you intend to share publicly. You can revoke a share link at any time from
            inside the report.
          </p>

          <h2>Your rights</h2>
          <p>
            You can request a copy of the data we have about you, ask us to delete it, or close
            your account at any time. Email <a href="mailto:contact@marmarlabs.com">contact@marmarlabs.com</a> with the request and we'll handle it within a reasonable timeframe.
          </p>

          <h2>Children</h2>
          <p>
            The Service is not directed at children under 13. If we learn we've collected
            personal information from a child under 13, we'll delete it.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy questions, email{" "}
            <a href="mailto:contact@marmarlabs.com">contact@marmarlabs.com</a>.
          </p>

          <p className="text-xs">
            <strong>Note for users:</strong> this is an indie-stage policy written by the company,
            not a law firm. We'll formalize it with counsel before MarMar Labs takes any
            enterprise contract or processes regulated data.
          </p>
        </article>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
