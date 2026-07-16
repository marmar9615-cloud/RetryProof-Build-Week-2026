import { useAuth } from "@workspace/replit-auth-web";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, ShieldCheck, Zap, Eye, ArrowRight } from "lucide-react";
import { useDocumentTitle } from "@/lib/use-document-title";

const capabilities = [
  {
    Icon: ShieldCheck,
    title: "Risk analysis",
    body: "Catch regressions before they happen.",
  },
  {
    Icon: Zap,
    title: "Impact radius",
    body: "Know exactly what your change affects.",
  },
];

export default function Login() {
  const { login } = useAuth();
  useDocumentTitle("Sign in | NeverGuess by MarMar Labs");

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background p-4">
      {/* Paper atmosphere — faint engineering grid + a soft iris bloom up top. */}
      <div className="absolute inset-0 -z-10 paper-grid opacity-50" />
      <div className="pointer-events-none absolute -z-10 top-[-12%] left-1/2 h-[640px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(circle,var(--brand-glow),transparent_62%)] opacity-40" />

      <div className="w-full max-w-md animate-fade-up space-y-8">
        <div className="space-y-5 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-card-border bg-card text-primary shadow-sm">
            <Activity className="h-7 w-7" />
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Never<span className="text-primary">Guess</span>
            </h1>
            <p className="mx-auto max-w-sm text-base leading-relaxed text-muted-foreground text-balance">
              Before an AI agent edits your repo, see the risky parts first.
            </p>
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-card-border bg-card p-8 shadow-lg">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-card-border bg-border sm:grid-cols-2">
            {capabilities.map(({ Icon, title, body }) => (
              <div key={title} className="flex flex-col gap-2 bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-border bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-border pt-6">
            <Button
              asChild
              size="lg"
              className="w-full"
              data-testid="button-try-free-preflight"
            >
              <Link href="/audits/new">
                Try one free preflight
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => login("/audits/new")}
              data-testid="button-login"
            >
              Sign in for more audits
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="w-full"
              data-testid="button-view-demo"
            >
              <Link href="/r/next-isr">
                <Eye className="mr-2 h-4 w-4" />
                See a sample report
              </Link>
            </Button>
          </div>
        </div>

        <p className="text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          NeverGuess · by MarMar Labs
        </p>
      </div>
    </div>
  );
}
