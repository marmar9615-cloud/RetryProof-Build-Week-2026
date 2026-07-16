import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { changelogEntries } from "@/data/changelog-entries";
import type { ChangelogEntry } from "@/data/changelog-entries";
import { ArrowRight, ArrowUpRight } from "lucide-react";

const entries: ChangelogEntry[] = changelogEntries;

const tagStyles: Record<ChangelogEntry["tag"], string> = {
  new: "border-emerald-200 bg-emerald-50 text-emerald-700",
  improved: "border-primary/20 bg-accent text-accent-foreground",
  fixed: "border-amber-200 bg-amber-50 text-amber-700",
};

const tagDot: Record<ChangelogEntry["tag"], string> = {
  new: "bg-emerald-500",
  improved: "bg-primary",
  fixed: "bg-amber-500",
};

function fmtDate(iso: string): string {
  const date = new Date(iso + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const tagCounts = entries.reduce(
  (acc, e) => {
    acc[e.tag] += 1;
    return acc;
  },
  { new: 0, improved: 0, fixed: 0 } as Record<ChangelogEntry["tag"], number>,
);

export default function MarketingChangelog() {
  useMetaTags({
    title: "Changelog | MarMar Labs",
    description:
      "Everything MarMar Labs ships, in order — NeverGuess, stui, and SignAI releases in plain English.",
    canonicalUrl: "https://marmarlabs.com/changelog",
  });

  return (
    <MarketingLayout>
      {/* ---- Hero -------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
        <div className="absolute -z-10 top-[-12%] left-1/2 -translate-x-1/2 w-[1000px] h-[560px] bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-30" />
        <div className="relative max-w-4xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="animate-fade-up">
            <div className="eyebrow text-primary mb-4">Release trail</div>
            <h1 className="font-display font-semibold tracking-[-0.03em] leading-[1.02] text-balance text-4xl md:text-6xl">
              Changelog
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              What we shipped, in order. New features, polish, and bug fixes — plain English,
              no release-train marketing copy.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 font-mono text-xs">
              {(Object.keys(tagCounts) as ChangelogEntry["tag"][]).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tagDot[tag]}`} />
                  <span className="text-muted-foreground">{tag}</span>
                  <span className="text-foreground">{tagCounts[tag]}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Timeline --------------------------------------------------- */}
      <section className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <ol className="relative space-y-10 md:space-y-12">
          {/* vertical rail */}
          <span
            className="pointer-events-none absolute left-[5px] top-2 bottom-2 hidden w-px bg-border md:left-[150px] md:block"
            aria-hidden="true"
          />
          {entries.map((e, i) => (
            <Reveal key={`${e.date}-${e.title}`} delay={Math.min(i, 4) * 0.06}>
              <li
                className="relative grid gap-3 md:grid-cols-[140px_1fr] md:gap-8"
                data-testid={`changelog-${e.date}-${e.title
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .slice(0, 40)}`}
              >
                {/* date column */}
                <div className="flex items-center gap-3 md:block md:pt-1">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {fmtDate(e.date)}
                  </span>
                </div>

                {/* node + content */}
                <div className="relative md:pl-8">
                  {/* timeline node */}
                  <span
                    className="absolute left-[-1px] top-1.5 hidden h-3 w-3 -translate-x-1/2 items-center justify-center md:flex"
                    aria-hidden="true"
                  >
                    <span className="absolute h-3 w-3 rounded-full border border-card-border bg-card" />
                    <span className={`relative h-1.5 w-1.5 rounded-full ${tagDot[e.tag]}`} />
                  </span>

                  <div className="rounded-2xl border border-card-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-[color:var(--brand-border)]">
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${tagStyles[e.tag]}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${tagDot[e.tag]}`} />
                        {e.tag}
                      </span>
                    </div>
                    <h2 className="text-lg md:text-xl font-semibold tracking-tight text-balance">
                      {e.title}
                    </h2>
                    <p className="mt-2 text-sm md:text-base leading-relaxed text-muted-foreground">
                      {e.body}
                    </p>
                    {e.href && (
                      <a
                        href={e.href}
                        target={e.href.startsWith("http") ? "_blank" : undefined}
                        rel={e.href.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="group mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                        data-testid={`changelog-proof-${e.title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .slice(0, 40)}`}
                      >
                        {e.hrefLabel ?? "View proof"}
                        {e.href.startsWith("http") ? (
                          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                        )}
                      </a>
                    )}
                  </div>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>
    </MarketingLayout>
  );
}
