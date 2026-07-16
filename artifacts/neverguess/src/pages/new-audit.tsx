import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateAudit,
  useListAudits,
  getListAuditsQueryKey,
  getGetTrialStatusQueryKey,
  useGetTrialStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/motion";
import { ModelSelect } from "@/components/model-select";
import { DEFAULT_MODEL_ID, modelEntryFor } from "@/data/model-catalog";
import { useBilling } from "@/lib/use-billing";
import { GitBranch, Globe, MessageSquareCode, ArrowLeft, KeyRound, ChevronDown, ChevronUp, ShieldCheck, Sparkles, LogIn, Clock, FileText, Cpu, Loader2 } from "lucide-react";

const TRY_THESE = [
  {
    label: "Add ISR with revalidate",
    githubUrl: "https://github.com/vercel/next.js",
    requestedChange:
      "Convert pages/index.tsx from getServerSideProps to ISR with revalidate=60. Keep preview mode honored and the on-demand /api/revalidate route working.",
  },
  {
    label: "Add dark-mode toggle",
    githubUrl: "https://github.com/shadcn-ui/ui",
    requestedChange:
      "Add a fully accessible dark-mode toggle using next-themes, persist user choice, and ensure all shadcn/ui colors meet WCAG AA contrast in both themes.",
  },
  {
    label: "Speed up Vite cold start",
    githubUrl: "https://github.com/vitejs/vite",
    requestedChange:
      "Cut Vite cold-start build by half: enable dependency pre-bundling cache, lazy-load route components, and replace moment.js with date-fns.",
  },
];
import { Link } from "wouter";
import { toast } from "sonner";
import { useDocumentTitle } from "@/lib/use-document-title";

const formSchema = z.object({
  githubUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  liveUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  requestedChange: z.string().min(10, "Please describe the change in more detail (min 10 chars)"),
  githubToken: z.string().optional().or(z.literal("")),
  model: z.string().default(DEFAULT_MODEL_ID),
});

type FormValues = z.infer<typeof formSchema>;

// Duplicate-audit links can carry an arbitrarily long prompt; cap it so a
// crafted URL can't seed a megabyte of text into the textarea.
const PREFILL_CHANGE_MAX_CHARS = 2000;

/**
 * Prefill values from a "Duplicate" link's query string
 * (?repo=…&live=…&change=…&model=…). URLSearchParams handles the URL
 * decoding; unknown model ids (stale links, tampered URLs) fall back to the
 * catalog default, and anonymous visitors never get a model carried over
 * because trials are locked to the server default anyway.
 */
function parsePrefillParams(search: string, allowModel: boolean) {
  const params = new URLSearchParams(search);
  const change = (params.get("change") ?? "").trim();
  const modelParam = (params.get("model") ?? "").trim();
  return {
    githubUrl: (params.get("repo") ?? "").trim(),
    liveUrl: (params.get("live") ?? "").trim(),
    requestedChange: change.slice(0, PREFILL_CHANGE_MAX_CHARS),
    model:
      allowModel && modelEntryFor(modelParam) ? modelParam : null,
  };
}

export default function NewAudit() {
  useDocumentTitle("New Audit | NeverGuess by MarMar Labs");
  const { isAuthenticated, login } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createAudit = useCreateAudit();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { data: trialStatus } = useGetTrialStatus({
    query: {
      queryKey: getGetTrialStatusQueryKey(),
      enabled: !isAuthenticated,
      staleTime: 15_000,
    },
  });
  const trialRemaining = trialStatus?.remaining ?? 1;
  const trialExhausted = !isAuthenticated && trialStatus?.trialEligible === false;

  // Monthly quota for signed-in users. Both fields must be numbers before we
  // render anything — older deployments and the static preview omit them, and
  // a null limit means the account has no monthly cap.
  const billing = useBilling();
  const quotaUsed =
    isAuthenticated && typeof billing.monthlyAuditsUsed === "number"
      ? billing.monthlyAuditsUsed
      : null;
  const quotaLimit =
    isAuthenticated && typeof billing.monthlyAuditLimit === "number"
      ? billing.monthlyAuditLimit
      : null;
  const quotaKnown = quotaUsed !== null && quotaLimit !== null;
  const quotaExhausted = quotaKnown && quotaUsed >= quotaLimit;
  // Trial exhaustion (anonymous) and quota exhaustion (authenticated) lock
  // the form the same way; they can never both be true for one visitor.
  const formLocked = trialExhausted || quotaExhausted;

  // Anonymous visitors see the demo user's audits (read-only). Surface the
  // first finished one as a sample report so they can preview the output
  // before spending their free trial. Hidden when the query errors or comes
  // back empty (e.g. static preview with no API mounted).
  const { data: sampleAudits } = useListAudits({
    query: {
      queryKey: getListAuditsQueryKey(),
      enabled: !isAuthenticated,
      staleTime: 60_000,
    },
  });
  // Array.isArray guard: in static preview the SPA shell answers /api/audits
  // with HTML (a 200 string), which would otherwise crash .find().
  const sampleAuditId =
    !isAuthenticated && Array.isArray(sampleAudits)
      ? sampleAudits.find((a) => a.status === "done")?.id
      : undefined;

  // "Duplicate" links from audit-detail arrive as ?repo=…&change=…&model=….
  // react-hook-form only reads defaultValues on the first render, so seeding
  // them once here (instead of setValue in an effect) avoids fighting the
  // user's subsequent edits. useState's lazy initializer pins the mount-time
  // query string even though useSearch() stays reactive afterwards.
  const search = useSearch();
  const [prefill] = useState(() => parsePrefillParams(search, isAuthenticated));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      githubUrl: prefill.githubUrl,
      liveUrl: prefill.liveUrl,
      requestedChange: prefill.requestedChange,
      githubToken: "",
      model: prefill.model ?? DEFAULT_MODEL_ID,
    },
  });

  function onSubmit(values: FormValues) {
    const token = isAuthenticated ? values.githubToken?.trim() || null : null;
    createAudit.mutate({
      data: {
        githubUrl: values.githubUrl || null,
        liveUrl: values.liveUrl || null,
        requestedChange: values.requestedChange,
        githubToken: token,
        // Anonymous trials omit the field entirely so the server default applies.
        ...(isAuthenticated ? { model: values.model } : {}),
      }
    }, {
      onSuccess: (created) => {
        toast.success("Audit initiated — streaming progress");
        queryClient.invalidateQueries({ queryKey: getListAuditsQueryKey() });
        // Wipe the in-memory token immediately on success.
        form.setValue("githubToken", "");
        // Jump straight into the audit detail so the user immediately sees
        // the live phase stream (SSE) instead of bouncing back to a dashboard.
        const id = (created as { id?: string })?.id;
        setLocation(id ? `/audits/${id}` : "/app");
      },
      onError: (err) => {
        const message = getAuditErrorMessage(err);
        // The server 429s with a machine-readable code when the monthly
        // ledger is full — route that one to the upgrade funnel instead of
        // the generic failure toast.
        const code = (err as { data?: { code?: unknown } | null })?.data?.code;
        if (code === "MONTHLY_AUDIT_LIMIT_REACHED") {
          toast.error("Monthly audit limit reached", {
            description: message,
            action: {
              label: "Upgrade to Pro",
              onClick: () => setLocation("/pricing"),
            },
          });
          return;
        }
        toast.error("Failed to create audit", { description: message });
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-up">
      <Link href={isAuthenticated ? "/app" : "/neverguess"} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back-dashboard">
        <ArrowLeft className="w-4 h-4 mr-1" />
        {isAuthenticated ? "Back to Dashboard" : "Back to NeverGuess"}
      </Link>

      <header className="mt-6 mb-7">
        <div className="eyebrow text-primary mb-3">Preflight</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          Run a <span className="text-primary">preflight</span> before the agent ships.
        </h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-xl">
          Paste a repo. Describe the change. Get a report in ~60 seconds.
        </p>
      </header>

      <Reveal>
      <Card className="border-card-border bg-card shadow-sm">
        <CardContent className="p-6 md:p-8">
          {!isAuthenticated && (
            <div
              className="mb-7 rounded-xl border border-[color:var(--brand-border)] bg-accent p-4"
              data-testid="section-free-trial-status"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="w-4 h-4 text-primary" />
                    First audit is free. No account needed.
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {trialExhausted
                      ? "You used your free audit. Sign in to run more and keep your reports."
                      : `${trialRemaining} free audit${trialRemaining === 1 ? "" : "s"} remaining before sign-in.`}
                  </p>
                </div>
                {trialExhausted && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => login("/audits/new")}
                    data-testid="button-trial-sign-in"
                  >
                    <LogIn className="w-4 h-4 mr-1.5" />
                    Sign in for more
                  </Button>
                )}
              </div>
            </div>
          )}

          {isAuthenticated && quotaKnown && (
            <div
              className="mb-7 rounded-xl border border-[color:var(--brand-border)] bg-accent p-4"
              data-testid="section-monthly-quota-status"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="text-sm font-medium text-foreground">
                    {quotaUsed} of {quotaLimit} audit{quotaLimit === 1 ? "" : "s"} used this month
                  </div>
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-secondary">
                    <div
                      className={
                        quotaExhausted
                          ? "h-full rounded-full bg-red-400"
                          : "h-full rounded-full bg-primary/60"
                      }
                      style={{
                        width: `${quotaLimit > 0 ? Math.min(100, (quotaUsed / quotaLimit) * 100) : 100}%`,
                      }}
                    />
                  </div>
                  {quotaExhausted && (
                    <p className="text-sm text-muted-foreground">
                      {billing.tier === "pro"
                        ? "You've used this month's included audits. Your limit resets at the start of next month."
                        : "You've used this month's included audits. Upgrade to Pro to keep going, or wait for the monthly reset."}
                    </p>
                  )}
                </div>
                {quotaExhausted && billing.tier !== "pro" && (
                  <Button asChild size="sm" data-testid="button-quota-upgrade">
                    <Link href="/pricing">
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Upgrade to Pro
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          )}

          <fieldset
            disabled={formLocked}
            aria-disabled={formLocked}
            className={formLocked ? "opacity-45 grayscale-[0.2]" : undefined}
          >
          <div className="mb-7 flex flex-wrap items-center gap-2" data-testid="section-try-these">
            <span className="eyebrow mr-1">Try</span>
            {TRY_THESE.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  form.setValue("githubUrl", t.githubUrl, { shouldDirty: true });
                  form.setValue("requestedChange", t.requestedChange, { shouldDirty: true });
                }}
                data-testid={`chip-try-${i}`}
                className="text-xs font-mono px-3 py-1.5 rounded-full border border-border bg-secondary text-foreground transition-colors hover:border-[color:var(--brand-border)] hover:bg-accent hover:text-primary"
              >
                {t.label}
              </button>
            ))}
            {sampleAuditId && (
              <Link
                href={`/audits/${sampleAuditId}`}
                className="ml-auto text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                data-testid="link-sample-report"
              >
                See a finished sample report →
              </Link>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="githubUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-primary" />
                        GitHub Repository URL
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://github.com/user/repo" className="bg-background font-mono text-sm" data-testid="input-github-url" {...field} />
                      </FormControl>
                      <FormDescription>Optional. Public repos only.</FormDescription>
                      {/* The demo-fixture swap in ingest-runner applies to ANY
                          empty repo URL, signed in or not — warn everyone. */}
                      {!(field.value ?? "").trim() && (
                        <p
                          className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700"
                          data-testid="note-demo-fixture"
                        >
                          No repo URL — we'll analyze a bundled demo project instead of your code.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="liveUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Live Application URL
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://myapp.replit.app" className="bg-background font-mono text-sm" data-testid="input-live-url" {...field} />
                      </FormControl>
                      <FormDescription>Optional. Used for runtime context.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="requestedChange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MessageSquareCode className="w-4 h-4 text-primary" />
                      Requested Change
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Add a new 'role' column to the users table and update the authentication middleware to check for admin privileges."
                        className="min-h-[120px] resize-y bg-background font-mono text-sm"
                        data-testid="input-requested-change"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Describe exactly what you plan to change in the codebase.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      Analysis model
                    </FormLabel>
                    <FormControl>
                      <ModelSelect
                        value={field.value}
                        onChange={field.onChange}
                        disabled={createAudit.isPending}
                        lockedForTrial={!isAuthenticated}
                      />
                    </FormControl>
                    <FormDescription>Every catalog model produces the same structured report.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Advanced: optional user-supplied GitHub PAT */}
              {isAuthenticated && (
              <div className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium hover:bg-secondary transition-colors"
                  data-testid="button-toggle-advanced"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                    Advanced — use your own GitHub token (optional)
                  </span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {showAdvanced && (
                  <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border bg-card">
                    <FormField
                      control={form.control}
                      name="githubToken"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="eyebrow text-primary">Personal access token</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              autoComplete="off"
                              spellCheck={false}
                              placeholder="ghp_…"
                              className="bg-background font-mono text-sm"
                              data-testid="input-github-token"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {/* Security note as a dark "instrument panel" readout — the
                        signature move for technical, verbatim guarantees. */}
                    <div className="ink flex gap-3 text-xs rounded-lg border border-card-border bg-card p-3.5">
                      <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1.5 leading-relaxed text-muted-foreground">
                        <p>
                          Sent over HTTPS, used <strong className="font-semibold text-foreground">only for this audit</strong>, then discarded.
                          We do <strong className="font-semibold text-foreground">not</strong> store it in the database, do <strong className="font-semibold text-foreground">not</strong> log it,
                          and do <strong className="font-semibold text-foreground">not</strong> share it with anyone — not even the MarMar Labs team.
                        </p>
                        <p>
                          You only need this if you hit GitHub's public rate limit (60 requests / hour per IP)
                          on a busy public repo. A read-only "fine-grained personal access token" with{" "}
                          <span className="font-mono text-foreground">Contents: read</span> access for the repo is enough.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              <div className="flex flex-col gap-4 pt-5 border-t border-border sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Read-only. Nothing in your repo is modified.
                </p>
                <Button
                  type="submit"
                  size="lg"
                  disabled={createAudit.isPending || formLocked}
                  className="w-full sm:w-auto"
                  data-testid="button-submit-audit"
                >
                  {createAudit.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Starting preflight…
                    </>
                  ) : (
                    "Run preflight"
                  )}
                </Button>
              </div>
            </form>
          </Form>
          </fieldset>
        </CardContent>
      </Card>
      </Reveal>

      {/* Reassurance strip — fills the lower void with quiet, on-brand detail. */}
      <Reveal delay={0.08}>
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-card-border bg-border sm:grid-cols-3">
          {[
            { Icon: Clock, title: "~60 seconds", body: "Static analysis plus an agent pass, streamed live as it runs." },
            { Icon: FileText, title: "A shareable report", body: "Risk score, missing tests, rollout notes, and a safer prompt." },
            { Icon: ShieldCheck, title: "Read-only by design", body: "Public repos and runtime context only. Your code is never changed." },
          ].map(({ Icon, title, body }) => (
            <div key={title} className="bg-card p-5">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-3 text-sm font-semibold tracking-tight text-foreground">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

function getAuditErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === "object" && "error" in data) {
      const error = (data as { error?: unknown }).error;
      if (typeof error === "string" && error.length > 0) return error;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return "Please try again.";
}
