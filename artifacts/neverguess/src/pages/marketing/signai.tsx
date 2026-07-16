import { Link } from "wouter";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { useJsonLd } from "@/lib/use-json-ld";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  Fingerprint,
  Folder,
  Inbox,
  LockKeyhole,
  PenLine,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  SIGN_AI_APP_STORE_URL,
  SIGN_AI_SUPPORT_EMAIL,
  SignAIProductTabs,
  SignAIWordmark,
} from "./signai-shared";

type PreviewScreen = "inbox" | "vault" | "scan" | "profile";

const features = [
  {
    icon: Upload,
    title: "Scan or import",
    body: "Capture paper agreements with the camera or upload PDFs from device and cloud storage.",
  },
  {
    icon: Sparkles,
    title: "Optional AI-assisted review",
    body: "After consent, summaries, clause extraction, key dates, risk notes, and Q&A help users understand documents faster.",
  },
  {
    icon: PenLine,
    title: "Electronic signing",
    body: "Create a saved signature, prepare agreements, send signing requests, and track status from one workspace.",
  },
  {
    icon: CalendarClock,
    title: "Deadline reminders",
    body: "Find renewal dates, payment windows, and other agreement deadlines before they disappear into a PDF.",
  },
  {
    icon: LockKeyhole,
    title: "Secure vault",
    body: "Authenticated storage, app-level safeguards, biometric protection, and searchable agreement history.",
  },
  {
    icon: ShieldCheck,
    title: "Audit trail",
    body: "Agreement events are recorded with timestamps so important document activity stays visible.",
  },
];

const plans = [
  {
    name: "Free",
    detail: "For your first scans and self-signing",
    items: ["3 free scans", "Upload and store agreements", "Self-signing workflow"],
  },
  {
    name: "SignAI Pro",
    detail: "Monthly or annual through Apple In-App Purchase",
    items: ["Unlimited agreements", "Consent-based AI analysis and Q&A", "Multi-party signing", "Deadline reminders"],
  },
];

const appTabs = [
  { label: "Inbox", Icon: Inbox },
  { label: "Agreements", Icon: Folder },
  { label: "Scan", Icon: FileText },
  { label: "Profile", Icon: UserRound },
];

const scanActions: Array<{ title: string; body: string; Icon: LucideIcon; colorClass: string }> = [
  {
    title: "Scan Document",
    body: "Use camera to capture physical contracts",
    Icon: FileText,
    colorClass: "text-[#818CF8]",
  },
  {
    title: "Upload File",
    body: "Import PDF from device or cloud",
    Icon: Upload,
    colorClass: "text-[#F59E0B]",
  },
];

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-semibold text-white">
      <span>5:01</span>
      <div className="h-5 w-20 rounded-full bg-black" />
      <span className="text-[9px] text-white/80">LTE</span>
    </div>
  );
}

function BottomTabs({ active }: { active: string }) {
  return (
    <div className="mt-auto grid grid-cols-4 border-t border-white/[0.07] bg-[#1A1A24] px-2 py-2">
      {appTabs.map(({ label, Icon }) => {
        const selected = active === label;
        return (
          <div key={label} className="flex flex-col items-center gap-1 text-[9px]">
            <Icon className={selected ? "h-4 w-4 text-[#6366F1]" : "h-4 w-4 text-[#6B6B7A]"} />
            <span className={selected ? "text-[#818CF8]" : "text-[#6B6B7A]"}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: "sparkles" | "lock";
  title: string;
  body: string;
  action: string;
}) {
  const Icon = icon === "sparkles" ? Sparkles : LockKeyhole;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#6366F1]/15 text-[#818CF8]">
        <Icon className="h-7 w-7" />
      </div>
      <div className="text-base font-bold tracking-tight text-white">{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-[#A8A8B8]">{body}</p>
      <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#6366F1] px-4 py-2 text-xs font-semibold text-white">
        <Plus className="h-3.5 w-3.5" />
        {action}
      </div>
    </div>
  );
}

function PhonePreview({ screen, className = "" }: { screen: PreviewScreen; className?: string }) {
  return (
    <div
      className={`relative mx-auto flex aspect-[339/758] w-[min(100%,260px)] flex-col overflow-hidden rounded-[2.15rem] border-[6px] border-[#15151d] bg-[#0A0A0F] shadow-xl ring-1 ring-card-border ${className}`}
      data-testid={`signai-phone-${screen}`}
    >
      <StatusBar />
      {screen === "inbox" && (
        <>
          <div className="px-4 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#34D399] text-sm font-bold text-[#0A0A0F]">
                  S
                </div>
                <div>
                  <div className="text-sm font-bold text-white">SignAI</div>
                  <div className="text-[10px] text-[#6B6B7A]">Inbox</div>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A24] text-[#A8A8B8]">
                <Bell className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex h-9 items-center gap-2 rounded-xl border border-[#2D2D3F] bg-[#1A1A24] px-3 text-[10px] text-[#6B6B7A]">
              <Search className="h-3.5 w-3.5" />
              Search agreements...
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-semibold text-white">
              <span>All Agreements</span>
              <span className="text-[#6B6B7A]">0</span>
            </div>
          </div>
          <EmptyState
            icon="sparkles"
            title="Your inbox is ready"
            body="Upload or scan your first agreement, then choose whether to use AI review."
            action="Add Your First Agreement"
          />
          <BottomTabs active="Inbox" />
        </>
      )}

      {screen === "vault" && (
        <>
          <div className="px-4 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#34D399] text-sm font-bold text-[#0A0A0F]">
                  S
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Vault</div>
                  <div className="text-[10px] text-[#6B6B7A]">0 agreements</div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A24] text-[#A8A8B8]">
                  <Search className="h-4 w-4" />
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366F1] text-white">
                  <Plus className="h-4 w-4" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 overflow-hidden">
              {["All", "Pending", "Signed", "Draft"].map((chip, index) => (
                <span
                  key={chip}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                    index === 0 ? "bg-[#6366F1] text-white" : "bg-[#1A1A24] text-[#A8A8B8]"
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <EmptyState
            icon="lock"
            title="Your vault is empty"
            body="Agreements you upload or sign will be securely stored here."
            action="Add Agreement"
          />
          <BottomTabs active="Agreements" />
        </>
      )}

      {screen === "scan" && (
        <>
          <div className="px-4 pt-5">
            <div className="text-2xl font-bold tracking-tight text-white">New Agreement</div>
            <div className="mt-5 rounded-xl border border-[#2D2D3F] bg-[#1A1A24] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">2 of 3 free scans remaining</div>
                  <div className="text-[10px] text-[#A8A8B8]">Upgrade to Pro for unlimited</div>
                </div>
                <span className="rounded-full bg-[#6366F1] px-3 py-1 text-[10px] font-bold text-white">Upgrade</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#2D2D3F]">
                <div className="h-full w-1/3 rounded-full bg-[#6366F1]" />
              </div>
            </div>
            <div className="mt-5 text-sm font-bold text-white">Create or Import</div>
            <div className="mt-3 space-y-3">
              {scanActions.map(({ title, body, Icon, colorClass }) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-[#2D2D3F] bg-[#1A1A24] p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04]">
                    <Icon className={`h-5 w-5 ${colorClass}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{title}</div>
                    <div className="text-[10px] leading-relaxed text-[#A8A8B8]">{body}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#6B6B7A]" />
                </div>
              ))}
            </div>
            <div className="mt-8">
              <div className="text-sm font-bold text-white">Templates</div>
              <div className="mt-2 text-xs text-[#A8A8B8]">Pre-built agreements with review-ready fields</div>
            </div>
          </div>
          <BottomTabs active="Scan" />
        </>
      )}

      {screen === "profile" && (
        <>
          <div className="px-4 pt-5">
            <div className="text-2xl font-bold tracking-tight text-white">Profile</div>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#1A1A24] p-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F59E0B] text-lg font-bold text-white">
                JD
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">John Doe</span>
                  <span className="rounded-full bg-[#F59E0B]/20 px-2 py-0.5 text-[9px] font-bold text-[#FCD34D]">Pro</span>
                </div>
                <div className="text-[10px] text-[#A8A8B8]">Agreement workspace</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[9px] text-[#A8A8B8]">0 agreements</span>
                  <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[9px] text-[#A8A8B8]">Unlimited scans</span>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05]">
                <PenLine className="h-4 w-4 text-[#A8A8B8]" />
              </div>
            </div>
            <PreviewList title="Account" items={["Personal Information", "Security & Biometric", "Deadline Reminders", "Other Notifications"]} />
            <PreviewList title="Documents" items={["Signature Settings", "Identity Verification"]} />
          </div>
          <BottomTabs active="Profile" />
        </>
      )}
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-bold text-[#A8A8B8]">{title}</div>
      <div className="overflow-hidden rounded-xl bg-[#1A1A24]">
        {items.map((item, index) => (
          <div
            key={item}
            className={`flex items-center justify-between px-3 py-3 text-xs font-semibold text-white ${
              index === 0 ? "" : "border-t border-white/[0.06]"
            }`}
          >
            <span>{item}</span>
            <ChevronRight className="h-3.5 w-3.5 text-[#6B6B7A]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MarketingSignAI() {
  useMetaTags({
    title: "SignAI — Scan, understand, and sign agreements on iPhone | MarMar Labs",
    description:
      "Download SignAI on the App Store. Scan paper agreements, import documents, review important terms, manage signers, and prepare documents for signature.",
    canonicalUrl: "https://marmarlabs.com/signai",
    ogImage: "https://marmarlabs.com/products/signai/social-card.png",
    ogImageAlt: "SignAI – AI-assisted agreement platform",
  });
  useJsonLd({
    "@context": "https://schema.org",
    "@type": "MobileApplication",
    "name": "SignAI",
    "applicationCategory": "ProductivityApplication",
    "operatingSystem": "iOS",
    "url": "https://marmarlabs.com/signai",
    "downloadUrl": SIGN_AI_APP_STORE_URL,
    "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    "description": "SignAI is an AI-assisted mobile agreement platform. Scan paper agreements, import documents, review key terms and dates with consent-based AI tools, manage signers, and keep work moving from one organized mobile workspace.",
    "image": "https://marmarlabs.com/products/signai/icon.png",
    // Only the free tier carries a price here — Pro is priced through Apple
    // In-App Purchase, and structured data must not claim a $0 Pro price.
    "offers": [
      { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" }
    ]
  });

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1100px] h-[640px] bg-[radial-gradient(circle,var(--brand-glow),transparent_60%)] opacity-40" />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-20">
          <div className="mb-12 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <SignAIWordmark />
            <SignAIProductTabs className="md:w-auto" />
          </div>

          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow mb-6">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Available on the App Store
              </div>
              <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-5xl lg:text-6xl">
                Know what you're <span className="text-primary">signing.</span>
              </h1>
              <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
                Scan or import any agreement, get consent-gated AI review of key dates,
                obligations, and risks, then sign and send — all from your iPhone.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" data-testid="button-signai-app-store">
                  <a href={SIGN_AI_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                    Download on the App Store <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" data-testid="button-signai-support">
                  <Link href="/signai/support">Contact support</Link>
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-2.5 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  Free to download · 3 free scans
                </span>
                <span className="inline-flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
                  Biometric-protected vault
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                  AI never reads a document without consent
                </span>
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  Published by MarMar Labs / Marcel Jiron
                </span>
              </div>
            </div>

            <div
              className="relative animate-fade-up [animation-delay:120ms]"
              aria-label="SignAI app preview using sample John Doe data"
            >
              <div className="absolute -inset-8 -z-10 bg-[radial-gradient(circle,var(--brand-glow),transparent_68%)] opacity-50 blur-2xl" />
              {/* One full-width phone below sm — two side-by-side 180px phones
                  clip their content on a 390px screen. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                <PhonePreview screen="inbox" />
                <div className="hidden sm:block sm:translate-y-8">
                  <PhonePreview screen="scan" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card" data-testid="section-signai-tabs">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <div className="eyebrow text-primary mb-3">App workflow</div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
                Four tabs for the whole agreement loop.
              </h2>
              <p className="mt-5 text-muted-foreground leading-relaxed">
                Inbox keeps new work visible, Agreements stores the vault, Scan starts new
                documents, and Profile keeps signing, security, and subscription settings in one place.
              </p>
              <dl className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-card-border bg-border sm:grid-cols-2">
                {appTabs.map(({ label, Icon }, i) => (
                  <div key={label} className="flex items-start gap-3 bg-background p-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-card-border bg-secondary text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </dt>
                      <dd className="mt-0.5 font-semibold tracking-tight">{label}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </Reveal>
            <Reveal delay={0.08} className="grid gap-4 sm:grid-cols-2">
              <PhonePreview screen="vault" />
              <PhonePreview screen="profile" />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24" data-testid="section-signai-features">
        <Reveal className="mb-10 max-w-2xl">
          <div className="eyebrow text-primary mb-3">What SignAI does</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            Agreement work without bouncing between five apps.
          </h2>
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <div className="group flex h-full flex-col rounded-2xl border border-card-border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-[color:var(--brand-border)]">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-card-border bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card" data-testid="section-signai-plans">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <Reveal className="mb-10 max-w-2xl">
            <div className="eyebrow text-primary mb-3">Plans</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
              Start free, upgrade through Apple when you need more.
            </h2>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-2">
            {plans.map((plan, i) => {
              const featured = plan.name === "SignAI Pro";
              return (
                <Reveal key={plan.name} delay={i * 0.08}>
                  <div
                    className={`flex h-full flex-col rounded-2xl border p-6 shadow-sm md:p-8 ${
                      featured
                        ? "border-[color:var(--brand-border)] bg-accent ring-1 ring-[color:var(--brand-border)]"
                        : "border-card-border bg-background"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-display text-xl font-semibold tracking-tight">{plan.name}</h3>
                      {featured && (
                        <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary-foreground">
                          Upgrade
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.detail}</p>
                    <ul className="mt-6 space-y-3">
                      {plan.items.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24" data-testid="section-signai-cta">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card p-8 text-center shadow-sm md:p-14">
            <div className="absolute inset-0 -z-10 dot-grid opacity-50" />
            <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-card-border bg-secondary text-primary">
              <Smartphone className="h-5 w-5" />
            </span>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-balance">
              SignAI is <span className="text-primary">live</span> on the App Store.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground leading-relaxed">
              SignAI Pro unlocks unlimited agreements, consent-based AI analysis and Q&A,
              multi-party signing, and deadline reminders.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild size="lg" data-testid="button-signai-cta-app-store">
                <a href={SIGN_AI_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                  Download SignAI <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" data-testid="link-signai-support-email">
                <a href={`mailto:${SIGN_AI_SUPPORT_EMAIL}`} className="font-mono">
                  {SIGN_AI_SUPPORT_EMAIL}
                </a>
              </Button>
            </div>
            <p className="mx-auto mt-6 max-w-xl text-xs text-muted-foreground/80">
              SignAI helps you understand agreements — it does not replace professional
              legal advice.
            </p>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
