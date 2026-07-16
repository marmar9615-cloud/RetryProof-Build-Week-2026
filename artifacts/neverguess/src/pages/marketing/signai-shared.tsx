import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset-url";

export const SIGN_AI_SUPPORT_EMAIL = "support@marmarlabs.com";
export const SIGN_AI_APP_STORE_URL = "https://apps.apple.com/us/app/signai/id6763717626";

const signAiTabs = [
  { href: "/signai", label: "Overview" },
  { href: "/signai/privacy", label: "Privacy" },
  { href: "/signai/terms", label: "Terms" },
  { href: "/signai/support", label: "Support" },
];

export function SignAIProductTabs({ className }: { className?: string }) {
  const [location] = useLocation();

  return (
    <nav
      aria-label="SignAI pages"
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-xl border border-card-border bg-card p-1 shadow-xs",
        className,
      )}
    >
      {signAiTabs.map((tab) => {
        const active = location === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SignAIWordmark() {
  return (
    <div className="inline-flex items-center gap-3">
      <img
        src={asset("products/signai/icon.png")}
        alt="SignAI app icon"
        width={44}
        height={44}
        loading="eager"
        decoding="async"
        className="h-11 w-11 rounded-xl border border-card-border shadow-sm"
      />
      <div>
        <div className="font-display text-sm font-semibold tracking-tight text-foreground">SignAI</div>
        <div className="font-mono text-xs text-muted-foreground">Scan. Review. Sign.</div>
      </div>
    </div>
  );
}

export function SignAIPolicyLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 h-[440px] w-[900px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <div className="animate-fade-up">
            <SignAIWordmark />
            <div className="mt-8">
              <SignAIProductTabs />
            </div>
            <div className="eyebrow text-primary mt-10 mb-3">SignAI · iOS</div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.04] text-balance text-3xl md:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground leading-relaxed text-pretty">
              {description}
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 md:px-8 py-14 md:py-20">
        <Reveal>
          <article className="legal-copy max-w-none text-sm md:text-base leading-relaxed">
            {children}
          </article>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
