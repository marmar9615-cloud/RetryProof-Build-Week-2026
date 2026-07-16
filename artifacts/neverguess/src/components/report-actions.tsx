import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateReportShareLink,
  useRevokeReportShareLink,
  getGetReportQueryKey,
  type Report,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  Link2,
  Loader2,
  Lock,
  Check,
  Terminal,
  Trash2,
  Printer,
} from "lucide-react";
import {
  reportToMarkdown,
  downloadMarkdown,
  type AuditContext,
} from "@/lib/markdown-export";
import {
  AGENT_EXPORT_TOOLS,
  downloadAgentsMd,
  downloadToolInstructionFile,
  type AgentExportTool,
} from "@/lib/agent-file-export";
import { OpenInReplitButton } from "@/components/open-in-replit-button";

function buildShareUrl(slug: string): string {
  if (typeof window === "undefined") return `/r/${slug}`;
  return `${window.location.origin}/r/${slug}`;
}

// data-testid suffixes are kebab-case; prompt-pack keys are camelCase.
function kebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

// Shell snippet against the public report JSON endpoint (GET /api/r/:slug in
// api-server routes/share.ts) which responds with { report: { verdict } }.
function buildCiCheckSnippet(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    "# NeverGuess verdict gate — fails the job when the shared report's verdict is \"block\".",
    `# Report: ${origin}/r/${slug}`,
    "# Requires curl and jq on the runner.",
    `verdict="$(curl -fsS "${origin}/api/r/${slug}" | jq -r '.report.verdict')"`,
    'echo "NeverGuess verdict: ${verdict}"',
    'if [ "${verdict}" = "block" ]; then',
    '  echo "NeverGuess preflight is a blocker — failing this check." >&2',
    "  exit 1",
    "fi",
  ].join("\n");
}

// Standalone so the public report page (/r/<slug>) can offer the same
// agent-instruction downloads — a shared report is exactly where a new
// visitor would want to take AGENTS.md home from.
export function DownloadsMenu({
  report,
  audit,
}: {
  report: Report;
  audit: AuditContext;
}) {
  const { toast } = useToast();

  function handleDownloadAgentsMd() {
    downloadAgentsMd(report, audit);
    toast({
      title: "AGENTS.md downloaded",
      description: "Drop it at your repo root as guardrails for coding agents.",
    });
  }

  function handleDownloadToolFile(tool: AgentExportTool) {
    downloadToolInstructionFile(report, tool);
    toast({
      title: `${tool.downloadName} downloaded`,
      description: `${tool.toolLabel} instructions — save as ${tool.label.replace(" (snippet)", "")} in your repo.`,
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="button-downloads-menu"
        >
          <Download className="w-4 h-4 mr-1.5" />
          Downloads
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="eyebrow">
          Agent instruction files
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={handleDownloadAgentsMd}
          data-testid="button-download-agents-md"
        >
          AGENTS.md
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {AGENT_EXPORT_TOOLS.map((tool) => (
          <DropdownMenuItem
            key={tool.key}
            onClick={() => handleDownloadToolFile(tool)}
            data-testid={`button-download-${kebabCase(tool.key)}`}
          >
            <span className="flex flex-col items-start">
              <span>{tool.toolLabel}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {tool.label}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReportActions({
  report,
  audit,
  canShare = true,
}: {
  report: Report;
  audit: AuditContext;
  canShare?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const initialSlug = report.shareSlug ?? null;
  const [shareUrl, setShareUrl] = useState<string | null>(
    initialSlug ? buildShareUrl(initialSlug) : null,
  );
  const [copied, setCopied] = useState(false);
  const shareMutation = useCreateReportShareLink();
  const revokeMutation = useRevokeReportShareLink();

  async function handleShare() {
    setOpen(true);
    if (shareUrl) return;
    try {
      const result = await shareMutation.mutateAsync({ id: report.id });
      setShareUrl(result.shareUrl);
      await queryClient.invalidateQueries({
        queryKey: getGetReportQueryKey(report.auditId),
      });
    } catch {
      toast({
        title: "Could not create share link",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      setOpen(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  }

  async function handleRevoke() {
    try {
      await revokeMutation.mutateAsync({ id: report.id });
      setShareUrl(null);
      setCopied(false);
      await queryClient.invalidateQueries({
        queryKey: getGetReportQueryKey(report.auditId),
      });
      toast({
        title: "Share link revoked",
        description: "The previous link no longer works.",
      });
    } catch {
      toast({
        title: "Could not revoke link",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  }

  function handleExport() {
    const md = reportToMarkdown(report, audit);
    const stamp = new Date(audit.createdAt).toISOString().slice(0, 10);
    downloadMarkdown(`neverguess-report-${stamp}.md`, md);
    toast({
      title: "Markdown exported",
      description: "Report downloaded as a .md file.",
    });
  }

  async function handleCopyCiCheck() {
    if (!report.shareSlug) return;
    try {
      await navigator.clipboard.writeText(buildCiCheckSnippet(report.shareSlug));
      toast({
        title: "CI check copied",
        description:
          'Paste it into a CI step — it fails the job when this report\'s verdict is "block".',
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  }

  function handlePrintPdf() {
    if (typeof window === "undefined") return;
    // Set document.title before printing — most browsers use this as the
    // default PDF filename, giving us a consistent neverguess-report-<date>.pdf.
    const previousTitle = document.title;
    const date = new Date().toISOString().slice(0, 10);
    document.title = `neverguess-report-${date}`;
    window.print();
    setTimeout(() => {
      document.title = previousTitle;
    }, 1000);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2" data-testid="section-report-actions">
        {!canShare && (
          // Anonymous viewers see Share as visibly locked instead of hidden.
          // Signing in adopts trial audits into the account (adoptTrialAudits
          // in api-server lib/trial-access.ts), which is what unlocks sharing.
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="pointer-events-none"
                  data-testid="button-share-report-locked"
                >
                  <Lock className="w-4 h-4 mr-1.5" />
                  Share
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Sign in to share — this audit moves to your account.
            </TooltipContent>
          </Tooltip>
        )}
        {canShare && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleShare}
                data-testid="button-share-report"
              >
                <Link2 className="w-4 h-4 mr-1.5" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Get a public link</DialogTitle>
                <DialogDescription>
                  Anyone with this link can view the report. They won't see your
                  account or other audits.
                </DialogDescription>
              </DialogHeader>
              {shareMutation.isPending && !shareUrl ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating share link…
                </div>
              ) : shareUrl ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="eyebrow mb-1.5">
                      Share link
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input
                        readOnly
                        value={shareUrl}
                        className="font-mono text-xs"
                        data-testid="input-share-url"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={copyShareUrl}
                        data-testid="button-copy-share-url"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-1.5" />
                            Copied
                          </>
                        ) : (
                          "Copy"
                        )}
                      </Button>
                    </div>
                  </div>

                  {(() => {
                    if (!shareUrl) return null;
                    const badgeUrl = shareUrl.replace(/\/r\//, "/api/r/") + "/badge.svg";
                    const badgeMd = `[![NeverGuess](${badgeUrl})](${shareUrl})`;
                    return (
                      <div>
                        <div className="eyebrow mb-1.5">
                          README badge
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            readOnly
                            value={badgeMd}
                            className="font-mono text-xs"
                            data-testid="input-share-badge"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(badgeMd);
                                toast({
                                  title: "Badge markdown copied",
                                  description: "Paste it into your README to display the verdict.",
                                });
                              } catch {
                                toast({
                                  title: "Copy failed",
                                  description: "Your browser blocked clipboard access.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            data-testid="button-copy-share-badge"
                          >
                            Copy
                          </Button>
                        </div>
                        <img
                          src={badgeUrl}
                          alt="NeverGuess verdict badge preview"
                          className="mt-2 h-[22px]"
                          data-testid="img-badge-preview"
                        />
                      </div>
                    );
                  })()}

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRevoke}
                      disabled={revokeMutation.isPending}
                      data-testid="button-revoke-share-url"
                    >
                      {revokeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          Revoking…
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-1.5" />
                          Revoke link
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        )}

        <OpenInReplitButton
          promptText={report.promptPack?.replit ?? ""}
          githubUrl={audit.githubUrl}
          testId="button-open-in-replit"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handlePrintPdf}
          data-testid="button-print-pdf"
        >
          <Printer className="w-4 h-4 mr-1.5" />
          Export PDF
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          data-testid="button-export-markdown"
        >
          <Download className="w-4 h-4 mr-1.5" />
          Export Markdown
        </Button>

        {/* Agent-native downloads — intentionally outside the canShare gate:
            the report content is already on screen for every viewer. */}
        <DownloadsMenu report={report} audit={audit} />

        {report.shareSlug && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCiCheck}
            data-testid="button-copy-ci-check"
          >
            <Terminal className="w-4 h-4 mr-1.5" />
            Copy CI check
          </Button>
        )}
      </div>
    </>
  );
}
