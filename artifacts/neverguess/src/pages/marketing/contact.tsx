import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { Button } from "@/components/ui/button";
import type { ComponentType } from "react";
import { ArrowUpRight, Clock, Github, Linkedin, Mail, MapPin, ShieldCheck } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";

export default function MarketingContact() {
  useMetaTags({
    title: "Contact MarMar Labs",
    description:
      "Three inboxes routed by purpose, plus public HackerOne and social profiles for MarMar Labs.",
    canonicalUrl: "https://marmarlabs.com/contact",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
  });

  // Three inboxes, routed by intent. founder@ owns sales / partnerships,
  // support@ owns billing + account issues, contact@ is the general
  // catch-all. Each tile has the right pre-filled subject so replies
  // land in the right thread.
  const inboxes: Array<{
    label: string;
    description: string;
    address: string;
    subject: string;
    testId: string;
  }> = [
    {
      label: "General questions",
      description: "Press, feedback, security research questions, anything else.",
      address: "contact@marmarlabs.com",
      subject: "Hi MarMar Labs",
      testId: "inbox-contact",
    },
    {
      label: "Billing & support",
      description: "Pro plan issues, account access, refunds.",
      address: "support@marmarlabs.com",
      subject: "MarMar Labs support request",
      testId: "inbox-support",
    },
    {
      label: "Partnerships & investors",
      description: "Founder, product, partnerships, investment, hiring, program invites.",
      address: "founder@marmarlabs.com",
      subject: "MarMar Labs · partnership / investor inquiry",
      testId: "inbox-founder",
    },
  ];

  const socials: Array<{
    href: string;
    label: string;
    Icon: ComponentType<{ className?: string }>;
    testId: string;
  }> = [
    {
      href: "https://x.com/MarMarLabs",
      label: "@MarMarLabs on X",
      Icon: FaXTwitter,
      testId: "link-contact-x",
    },
    {
      href: "https://www.linkedin.com/in/marcel-jiron-525092408/",
      label: "LinkedIn",
      Icon: Linkedin,
      testId: "link-contact-linkedin",
    },
    {
      href: "https://github.com/marmar9615-cloud",
      label: "GitHub",
      Icon: Github,
      testId: "link-contact-github",
    },
    {
      href: "https://hackerone.com/realmarmarlabs?type=user",
      label: "HackerOne",
      Icon: ShieldCheck,
      testId: "link-contact-hackerone",
    },
  ];

  return (
    <MarketingLayout>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-30" />
        <div className="relative max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="animate-fade-up">
            <div className="eyebrow text-primary mb-4">Get in touch</div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl">
              Let's <span className="text-primary">talk.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Three inboxes, routed by purpose. One developer reads every email — usually within a
              business day.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24 space-y-8">
        {/* ---- Inbox tiles ---------------------------------------------- */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="section-inboxes">
          {inboxes.map((inbox, i) => (
            <Reveal key={inbox.address} delay={i * 0.08} className="h-full">
              <a
                href={`mailto:${inbox.address}?subject=${encodeURIComponent(inbox.subject)}`}
                className="group flex h-full flex-col gap-2 rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
                data-testid={inbox.testId}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span className="eyebrow">{inbox.label}</span>
                </div>
                <div className="mt-1 break-words font-mono text-sm font-medium text-foreground">
                  {inbox.address}
                </div>
                <div className="text-xs leading-relaxed text-muted-foreground">
                  {inbox.description}
                </div>
              </a>
            </Reveal>
          ))}
        </div>

        {/* ---- Founder base + office hours ------------------------------ */}
        <Reveal delay={0.04}>
          <div className="rounded-2xl border border-card-border bg-card p-6 shadow-sm md:p-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <div className="eyebrow mb-1.5">Founder / company base</div>
                  <div className="text-sm text-foreground">Marcel Jiron · Minnesota, United States</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <div className="eyebrow mb-1.5">Response time</div>
                  <div className="text-sm text-foreground">Mon–Fri · Central Time · within one business day</div>
                </div>
              </div>
            </div>
            <Button asChild size="lg" className="mt-6" data-testid="button-send-email">
              <a href="mailto:contact@marmarlabs.com">
                <Mail className="w-4 h-4 mr-2" />
                Send a general email
              </a>
            </Button>
          </div>
        </Reveal>

        {/* ---- Social channels ----------------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {socials.map(({ href, label, Icon, testId }, i) => (
            <Reveal key={testId} delay={i * 0.08}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-card-border bg-card px-4 py-3 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]"
                data-testid={testId}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
              </a>
            </Reveal>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
