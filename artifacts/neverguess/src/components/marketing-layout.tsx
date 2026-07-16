import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ArrowRight, Linkedin, Github, ChevronDown, ShieldCheck, Terminal, PenLine, FlaskConical } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset-url";
import { useAuth } from "@workspace/replit-auth-web";
import { STUI_RELEASE } from "@/data/stui-release";

const productItems = [
  {
    href: "/retryproof",
    label: "RetryProof",
    description: "Deterministic retry-fault tests for n8n workflows.",
    Icon: FlaskConical,
  },
  {
    href: "/neverguess",
    label: "NeverGuess",
    description: "Live web app for AI change preflights.",
    Icon: ShieldCheck,
  },
  {
    href: "/stui",
    label: "stui",
    description: "Stable v2 core, now at " + STUI_RELEASE.tag + ".",
    Icon: Terminal,
  },
  {
    href: "/signai",
    label: "SignAI",
    description: "App Store iOS app for agreement workflows.",
    Icon: PenLine,
  },
];

const companyNavItems = [
  { href: "/pricing", label: "Pricing", testId: "nav-pricing" },
  { href: "/status", label: "Status", testId: "nav-status" },
  { href: "/security-research", label: "Security", testId: "nav-security" },
  { href: "/about", label: "About", testId: "nav-about" },
  { href: "/contact", label: "Contact", testId: "nav-contact" },
];

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src={asset("brand/logo-mark.webp")}
      alt="MarMar Labs logo"
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      className="rounded-md ring-1 ring-card-border"
      style={{ width: size, height: size }}
    />
  );
}

function Wordmark() {
  return (
    <span className="font-display text-[0.98rem] md:text-base font-semibold tracking-tight text-foreground">
      MarMar <span className="text-primary">Labs</span>
    </span>
  );
}

function NeverGuessDesktopActions() {
  const { isAuthenticated } = useAuth();
  const auditCta = isAuthenticated ? "Start new audit" : "Try free preflight";

  return (
    <>
      {!isAuthenticated && (
        <Link
          href="/login"
          className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          data-testid="link-sign-in"
        >
          Sign in
        </Link>
      )}
      <Button asChild size="sm" data-testid="button-open-app">
        <Link href="/audits/new">
          {auditCta} <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Link>
      </Button>
    </>
  );
}

function NeverGuessMobileAuditCta({ onNavigate }: { onNavigate: () => void }) {
  const { isAuthenticated } = useAuth();
  const auditCta = isAuthenticated ? "Start new audit" : "Try free preflight";

  return (
    <div className="mt-2 space-y-2">
      {!isAuthenticated && (
        <Link
          href="/login"
          onClick={onNavigate}
          className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          data-testid="link-mobile-sign-in"
        >
          Sign in
        </Link>
      )}
      <Button asChild size="sm" className="w-full">
        <Link href="/audits/new" onClick={onNavigate}>{auditCta}</Link>
      </Button>
    </div>
  );
}

export function MarketingLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const productsButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const productsActive = productItems.some((item) => item.href === location);
  const showNeverGuessCta = location === "/neverguess";
  const navItems = companyNavItems;
  // On SignAI pages, the footer legal links should resolve to the
  // SignAI-specific policy pages (the App Store listing points there), not the
  // generic MarMar Labs policies.
  const isSignAI = location.startsWith("/signai");
  const privacyHref = isSignAI ? "/signai/privacy" : "/privacy";
  const termsHref = isSignAI ? "/signai/terms" : "/terms";

  // Footer link columns. Built inside the component because Privacy/Terms
  // must follow the SignAI-context href switch above.
  const footerNav = [
    {
      heading: "Products",
      links: [
        { href: "/retryproof", label: "RetryProof", testId: "footer-link-retryproof" },
        { href: "/neverguess", label: "NeverGuess", testId: "footer-link-neverguess" },
        { href: "/stui", label: "stui", testId: "footer-link-stui" },
        { href: "/signai", label: "SignAI", testId: "footer-link-signai" },
        { href: "/reports", label: "Reports", testId: "footer-link-reports" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About", testId: "footer-link-about" },
        { href: "/security-research", label: "Security research", testId: "footer-link-security-research" },
        { href: "/contact", label: "Contact", testId: "footer-link-contact" },
        { href: "/changelog", label: "Changelog", testId: "footer-link-changelog" },
      ],
    },
    {
      heading: "Legal & Ops",
      links: [
        { href: "/pricing", label: "Pricing", testId: "footer-link-pricing" },
        { href: "/status", label: "Status", testId: "footer-link-status" },
        { href: privacyHref, label: "Privacy", testId: "footer-link-privacy" },
        { href: termsHref, label: "Terms", testId: "footer-link-terms" },
      ],
    },
  ];

  useEffect(() => {
    if (!productsOpen && !open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (productsOpen) {
          setProductsOpen(false);
          productsButtonRef.current?.focus();
        }
        if (open) {
          setOpen(false);
          mobileMenuButtonRef.current?.focus();
        }
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, productsOpen]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground relative">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--background)/0.8)] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="flex items-center gap-2.5 group md:justify-self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-home-brand">
            <BrandMark />
            <Wordmark />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <div
              className="relative group"
              onPointerEnter={() => setProductsOpen(true)}
              onPointerLeave={() => setProductsOpen(false)}
              onFocus={() => setProductsOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setProductsOpen(false);
                }
              }}
            >
              <button
                ref={productsButtonRef}
                id="products-menu-trigger"
                type="button"
                aria-haspopup="true"
                aria-expanded={productsOpen}
                aria-controls="products-menu"
                data-testid="nav-products"
                onClick={() => setProductsOpen((value) => !value)}
                className={cn(
                  "inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  productsActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                Products
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", productsOpen && "rotate-180")} />
              </button>
              <div
                id="products-menu"
                className={cn(
                  "absolute left-1/2 top-full z-50 w-[340px] -translate-x-1/2 pt-3 transition-all duration-150",
                  productsOpen
                    ? "opacity-100 visible pointer-events-auto"
                    : "opacity-0 invisible pointer-events-none",
                )}
              >
                <div className="rounded-xl border border-card-border bg-popover p-2 shadow-lg">
                  <div className="px-3 py-2 eyebrow">Products</div>
                  <div className="space-y-1">
                    {productItems.map(({ href, label, description, Icon }) => {
                      const active = location === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setProductsOpen(false)}
                          data-testid={`nav-product-${label.toLowerCase()}`}
                          className={cn(
                            "flex items-start gap-3 rounded-lg px-3 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                          )}
                        >
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-card-border bg-secondary text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold tracking-tight text-foreground">
                              {label}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {navItems.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2 md:justify-self-end">
            {showNeverGuessCta && <NeverGuessDesktopActions />}
          </div>

          <button
            ref={mobileMenuButtonRef}
            type="button"
            className="md:hidden inline-flex min-h-11 items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            data-testid="button-nav-toggle"
          >
            <span>Menu</span>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <nav id="mobile-navigation" className="md:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-border bg-background px-4 py-3 space-y-1">
            <div className="px-3 pt-1 pb-1 eyebrow">Products</div>
            {productItems.map((item) => {
              const active = location === item.href;
              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-start gap-3 rounded-lg px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block">{item.label}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
            <div className="my-2 h-px bg-border" />
            {navItems.map((item) => {
              const active = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex min-h-11 items-center px-3 py-2 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
            {showNeverGuessCta && <NeverGuessMobileAuditCta onNavigate={() => setOpen(false)} />}
          </nav>
        )}
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <div className="space-y-4 sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <BrandMark size={32} />
              <Wordmark />
            </div>
            <p className="text-muted-foreground max-w-md leading-relaxed">
              Four public products plus practical security research — built in public from Minnesota.
            </p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>Founder: Marcel Jiron</div>
              <a href="mailto:founder@marmarlabs.com" className="inline-block hover:text-foreground transition-colors">
                founder@marmarlabs.com
              </a>
              <span className="mx-2 text-muted-foreground/50">/</span>
              <a href="mailto:support@marmarlabs.com" className="inline-block hover:text-foreground transition-colors">
                support@marmarlabs.com
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1" data-testid="footer-social">
              <a
                href="https://x.com/MarMarLabs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MarMar Labs on X"
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-card-border bg-background px-3 text-muted-foreground hover:text-foreground hover:border-[color:var(--brand-line)] transition-colors"
                data-testid="footer-social-x"
              >
                <FaXTwitter className="w-4 h-4" />
                <span className="text-xs font-medium">X</span>
              </a>
              <a
                href="https://www.linkedin.com/in/marcel-jiron-525092408/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Marcel Jiron on LinkedIn"
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-card-border bg-background px-3 text-muted-foreground hover:text-foreground hover:border-[color:var(--brand-line)] transition-colors"
                data-testid="footer-social-linkedin"
              >
                <Linkedin className="w-4 h-4" />
                <span className="text-xs font-medium">LinkedIn</span>
              </a>
              <a
                href="https://github.com/marmar9615-cloud"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MarMar Labs on GitHub"
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-card-border bg-background px-3 text-muted-foreground hover:text-foreground hover:border-[color:var(--brand-line)] transition-colors"
                data-testid="footer-social-github"
              >
                <Github className="w-4 h-4" />
                <span className="text-xs font-medium">GitHub</span>
              </a>
              <a
                href="https://hackerone.com/realmarmarlabs?type=user"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MarMar Labs on HackerOne"
                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-card-border bg-background px-3 text-muted-foreground hover:text-foreground hover:border-[color:var(--brand-line)] transition-colors"
                data-testid="footer-social-hackerone"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-medium">HackerOne</span>
              </a>
            </div>
          </div>
          {footerNav.map((column) => (
            <div key={column.heading} className="space-y-2.5">
              <div className="eyebrow text-primary">{column.heading}</div>
              <ul className="space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      data-testid={link.testId}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-2">
            <div>© 2026 MarMar Labs. All rights reserved.</div>
            <div>Minnesota, United States</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function MarketingHero({
  title,
  titleAriaLabel,
  subtitle,
  eyebrow,
  bgImage,
  imageAlt,
  variant = "split",
  children,
}: {
  title: ReactNode;
  titleAriaLabel?: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  bgImage?: string;
  imageAlt?: string;
  variant?: "split" | "cinematic" | "minimal";
  children?: ReactNode;
}) {
  const showCinematic = variant === "cinematic" && bgImage;
  const showSplit = variant === "split" && bgImage;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
      <div className="absolute -z-10 top-0 left-1/2 -translate-x-1/2 h-px w-full max-w-7xl bg-gradient-to-r from-transparent via-[color:var(--brand-border)] to-transparent" />
      {showCinematic && (
        <div className="absolute inset-0 -z-10">
          <img
            src={bgImage}
            alt={imageAlt ?? ""}
            aria-hidden={imageAlt ? undefined : true}
            className="w-full h-full object-cover opacity-15"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}
      <div className="absolute -z-10 top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[680px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40 pointer-events-none" />

      <div className={cn(
        "relative max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-28",
        showSplit && "grid lg:grid-cols-2 gap-12 items-center"
      )}>
        <div className="animate-fade-up">
          {eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-card-border bg-card shadow-xs eyebrow mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {eyebrow}
            </div>
          )}
          <h1 className={cn(
            "font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance",
            showSplit
              ? "text-4xl md:text-5xl lg:text-6xl"
              : "text-4xl md:text-6xl lg:text-7xl max-w-4xl"
          )} aria-label={titleAriaLabel}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">{subtitle}</p>
          )}
          {children && <div className="mt-10">{children}</div>}
        </div>

        {showSplit && (
          <div className="relative hidden lg:block animate-fade-up [animation-delay:120ms]">
            <div className="absolute -inset-8 bg-[radial-gradient(circle,var(--brand-glow),transparent_68%)] opacity-50 blur-2xl" />
            <div className="relative rounded-xl overflow-hidden border border-card-border shadow-xl">
              <img
                src={bgImage}
                alt={imageAlt ?? ""}
                aria-hidden={imageAlt ? undefined : true}
                className="w-full h-auto object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
