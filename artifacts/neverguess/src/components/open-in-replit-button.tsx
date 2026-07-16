import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

type Size = "sm" | "default" | "lg";

export function OpenInReplitButton({
  promptText,
  githubUrl,
  size = "sm",
  variant = "outline",
  className,
  testId,
  fullWidth,
  children,
}: {
  promptText: string;
  githubUrl?: string | null;
  size?: Size;
  variant?: "outline" | "default";
  className?: string;
  testId: string;
  fullWidth?: boolean;
  children?: React.ReactNode;
}) {
  const { toast } = useToast();

  async function handleClick() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(promptText);
      copied = true;
    } catch {
      // continue without clipboard
    }
    let url = "https://replit.com/new";
    if (githubUrl) {
      try {
        const u = new URL(githubUrl);
        if (u.hostname === "github.com") {
          const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
          if (parts.length >= 2) {
            url = `https://replit.com/github/${parts[0]}/${parts[1]}`;
          }
        }
      } catch {
        // fall through to /new
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast({
      title: copied ? "Prompt copied — Replit opened" : "Replit opened",
      description: copied
        ? "Paste your safer prompt into Replit Agent."
        : "Could not copy prompt automatically; open the Prompt Pack tab to copy it manually.",
    });
  }

  // Lean on the iris button variants from the design system. The outline
  // variant gets a faint iris-tinted hover so the accent still reads on the
  // secondary CTA without hardcoded purple values.
  const accentOutline =
    "hover:border-[color:var(--brand-border)] hover:bg-accent hover:text-accent-foreground";

  return (
    <Button
      type="button"
      size={size}
      variant={variant === "default" ? "default" : "outline"}
      onClick={handleClick}
      data-testid={testId}
      className={`${variant === "default" ? "" : accentOutline} ${fullWidth ? "w-full sm:w-auto" : ""} ${className ?? ""}`}
    >
      <Sparkles className="w-4 h-4 mr-1.5" />
      {children ?? "Open in Replit Agent"}
    </Button>
  );
}
