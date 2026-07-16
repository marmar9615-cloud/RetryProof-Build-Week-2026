import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-4">
      {/* Paper atmosphere — faint engineering grid + a soft iris bloom up top. */}
      <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
      <div className="pointer-events-none absolute -z-10 top-[-12%] left-1/2 h-[640px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40" />

      <div className="w-full max-w-md animate-fade-up text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-card-border bg-card text-primary shadow-sm">
          <Compass className="h-7 w-7" />
        </div>

        <div className="eyebrow mt-6 text-primary">Error 404</div>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Page not <span className="text-primary">found</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-muted-foreground text-balance">
          The page you are looking for has moved, been renamed, or never existed.
          Let's get you back on a known route.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" data-testid="button-home">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" data-testid="button-contact">
            <Link href="/contact">Contact support</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
