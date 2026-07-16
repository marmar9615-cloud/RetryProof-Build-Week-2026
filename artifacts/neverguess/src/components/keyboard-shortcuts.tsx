import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Keyboard } from "lucide-react";

type Shortcut = { keys: string[]; label: string };

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"], label: "Show this help" },
  { keys: ["n"], label: "New audit" },
  { keys: ["g", "a"], label: "Go to dashboard" },
  { keys: ["g", "n"], label: "Go to NeverGuess landing" },
  // j/k are handled by the audit detail page itself (it knows the
  // prev/next ordering); listed here so the help dialog stays complete.
  { keys: ["k"], label: "Newer audit (on an audit page)" },
  { keys: ["j"], label: "Older audit (on an audit page)" },
  { keys: ["esc"], label: "Close dialogs / overlays" },
];

// Exported so page-level shortcuts (j/k on the audit detail page) share the
// exact same "don't fire while typing" guard as the global ones.
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  return target.isContentEditable;
}

const HINT_DISMISSED_KEY = "ng:kbd-hint:dismissed";
// How long the chip stays visible before auto-fading on first visit.
// 6s is long enough to read, short enough not to nag.
const HINT_AUTO_FADE_MS = 6000;

// The hint chip is app-only. Allowlist app routes (instead of listing every
// marketing path) so new marketing pages and trailing-slash URLs like
// "/pricing/" can never leak the chip onto public surfaces again.
const APP_PATH_PREFIXES = ["/app", "/audits"];

function isAppRoute(path: string): boolean {
  const normalized = path.replace(/\/+$/, "") || "/";
  return APP_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function KeyboardShortcuts() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [pendingG, setPendingG] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);

  // Show the chip only if (a) we're inside the product (not marketing),
  // (b) the user hasn't dismissed it this session, and (c) the auto-fade
  // timer hasn't expired.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAppRoute(location)) {
      setHintVisible(false);
      return;
    }
    if (window.sessionStorage.getItem(HINT_DISMISSED_KEY) === "1") return;
    setHintVisible(true);
    const timer = window.setTimeout(() => {
      setHintVisible(false);
      // Persist so the chip doesn't pop back in on the next page nav.
      window.sessionStorage.setItem(HINT_DISMISSED_KEY, "1");
    }, HINT_AUTO_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore typing into form fields, textareas, contenteditable
      if (isTextField(e.target)) return;
      // Ignore when modifier-only chords are pressed (let the OS / app handle them)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        setOpen(true);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(HINT_DISMISSED_KEY, "1");
        }
        setHintVisible(false);
        return;
      }

      // Two-key chord: g then a/n
      if (pendingG) {
        if (key === "a") {
          e.preventDefault();
          setLocation("/app");
        } else if (key === "n") {
          e.preventDefault();
          setLocation("/neverguess");
        }
        setPendingG(false);
        return;
      }
      if (key === "g") {
        setPendingG(true);
        // auto-clear after 1s if no follow-up key
        setTimeout(() => setPendingG(false), 1000);
        return;
      }

      if (key === "n") {
        e.preventDefault();
        setLocation("/audits/new");
        return;
      }

      if (key === "escape") {
        if (open) setOpen(false);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, pendingG, setLocation]);

  function handleHintClick() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(HINT_DISMISSED_KEY, "1");
    }
    setHintVisible(false);
    setOpen(true);
  }

  // Render the chip only inside the product — it's product-only UI.
  const showChip = isAppRoute(location);

  return (
    <>
      {showChip && (
        <button
          type="button"
          onClick={handleHintClick}
          aria-label="Open keyboard shortcuts"
          className={`no-print fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-card-border bg-card/80 backdrop-blur px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[color:var(--brand-border)] hover:bg-card transition-all shadow-lg ${
            hintVisible
              ? "opacity-100"
              : "opacity-0 hover:opacity-100 focus-visible:opacity-100"
          }`}
          data-testid="button-kbd-hint"
        >
          <span className="text-foreground font-semibold">?</span>
          <span>shortcuts</span>
        </button>
      )}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent data-testid="dialog-keyboard-shortcuts">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-primary" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Move around faster. Shortcuts are ignored when you're typing into a field.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2">
          {SHORTCUTS.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-md border border-border/40 bg-card/40 px-3 py-2"
              data-testid={`shortcut-row-${s.keys.join("-")}`}
            >
              <span className="text-sm">{s.label}</span>
              <span className="flex items-center gap-1.5">
                {s.keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1.5">
                    {i > 0 && (
                      <span className="text-[10px] text-muted-foreground">then</span>
                    )}
                    <Kbd>{k.toUpperCase()}</Kbd>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
