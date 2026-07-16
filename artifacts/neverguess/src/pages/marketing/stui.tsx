import { useState } from "react";
import { MarketingLayout } from "@/components/marketing-layout";
import { Reveal } from "@/components/motion";
import { useMetaTags } from "@/lib/use-meta-tags";
import { useJsonLd } from "@/lib/use-json-ld";
import { asset } from "@/lib/asset-url";
import {
  STUI_DESCRIPTION,
  STUI_JSON_LD,
  STUI_RELEASE,
} from "@/data/stui-release";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Github,
  ServerOff,
  Terminal,
} from "lucide-react";

const quickstart = [
  "import stui as st",
  "",
  "@st.cache_data(max_entries=32)",
  "def compile_prompt(text: str) -> str:",
  "    return text.strip()",
  "",
  'st.title("Prompt Workbench")',
  "prompt = st.text_area(",
  '    "Instructions",',
  "    height=7,",
  "    max_chars=2000,",
  ")",
  "",
  'if st.button("Prepare prompt"):',
  "    st.code(compile_prompt(prompt))",
].join("\n");

const firstRunCommand = [
  "stui check app.py --strict",
  "stui run app.py --watch",
].join("\n");

const useCases = [
  "SSH sessions and remote machines",
  "Local model and data debug panels",
  "Internal tools that should not open a port",
  "Headless and locked-down environments",
];

const releaseHighlights = [
  {
    label: "Stable core",
    title: "The v2 contract stays intact",
    body: "The documented stable surface from v2.0 remains unchanged: text, displays, inputs, forms, layout, state, flow control, and the core CLI.",
  },
  {
    label: "Experimental",
    title: "Cache expensive rerun work",
    body: "st.cache_data returns isolated values and st.cache_resource reuses one process-local object. Both support TTL, LRU limits, and explicit clearing without disk or network caching.",
  },
  {
    label: "Opt-in",
    title: "Watch the whole local project",
    body: "stui run app.py --watch now reloads imported local helpers, preserves session state, clears affected caches, and recovers after temporary syntax or import errors.",
  },
  {
    label: "Experimental",
    title: "Author multiline input in the terminal",
    body: "st.text_area adds multiline editing, form support, callbacks, character limits, and terminal-control escaping. Enter adds a line; Ctrl+Enter commits and reruns.",
  },
];

const boundaries = [
  "No browser renderer or local server",
  "No websockets or port-forwarding flow",
  "No Streamlit dependency or compatibility layer",
  "Process-local cache only",
  "Watch mode stays opt-in",
  "Designed for terminal and SSH workflows",
];

type CopyState = "idle" | "copied" | "error";

function CopyBlock({
  value,
  label,
  id,
  wrap = false,
}: {
  value: string;
  label: string;
  id?: string;
  wrap?: boolean;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  const visibleLabel =
    copyState === "copied"
      ? "Copied"
      : copyState === "error"
        ? "Try again"
        : "Copy";
  const statusMessage =
    copyState === "copied"
      ? label + " copied to clipboard."
      : copyState === "error"
        ? label + " could not be copied."
        : "";

  return (
    <div
      id={id}
      className="ink min-w-0 max-w-full overflow-hidden rounded-xl border border-card-border bg-card shadow-sm scroll-mt-24"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="eyebrow">{label}</span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={"Copy " + label}
        >
          {copyState === "copied" ? (
            <CheckCircle2
              className="h-3.5 w-3.5 text-emerald-400"
              aria-hidden="true"
            />
          ) : (
            <Copy className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          )}
          {visibleLabel}
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {statusMessage}
        </span>
      </div>
      <pre
        tabIndex={0}
        className={`p-4 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto"}`}
      >
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function MarketingStui() {
  useMetaTags({
    title: `stui ${STUI_RELEASE.version} - Caching, watch mode, and multiline terminal apps | MarMar Labs`,
    description: STUI_DESCRIPTION,
    canonicalUrl: "https://marmarlabs.com/stui",
    ogImage: "https://marmarlabs.com/products/stui/stui-og.webp",
    ogImageAlt: "stui terminal UI model demo screenshot",
  });
  useJsonLd(STUI_JSON_LD);

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 paper-grid opacity-50" />

        <div className="relative mx-auto grid w-full min-w-0 max-w-7xl gap-9 px-4 py-12 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div className="min-w-0 animate-fade-up">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 shadow-xs eyebrow">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {STUI_RELEASE.tag} · released {STUI_RELEASE.releaseDate}
            </div>
            <h1 className="text-balance font-display text-4xl font-semibold leading-[1.04] tracking-[-0.03em] md:text-5xl lg:text-6xl">
              stui turns Python scripts into apps that run{" "}
              <span className="text-primary">inside your terminal.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Write normal top-to-bottom Python with stateful reruns and
              interactive controls. Version 2.2 adds process-local caching,
              multiline input, and a multi-file watch loop without a browser or
              local server.
            </p>

            <div className="mt-7 max-w-xl">
              <CopyBlock
                id="stui-install"
                label="Install stui-terminal"
                value={STUI_RELEASE.installCommand}
                wrap
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
              <a
                href={STUI_RELEASE.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Release notes <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={STUI_RELEASE.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                GitHub <Github className="h-4 w-4" />
              </a>
              <a
                href={STUI_RELEASE.pypiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                PyPI <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <ul
              className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
              aria-label="stui release facts"
            >
              <li className="font-medium text-foreground">Stable v2 core</li>
              <li>Python 3.11+</li>
              <li>Textual + Rich</li>
              <li>MIT licensed</li>
            </ul>
          </div>

          <div className="min-w-0 animate-fade-up [animation-delay:120ms]">
            <div className="rounded-xl border border-card-border bg-card p-2 shadow-lg">
              <div className="flex items-center gap-2 px-2 pb-2 pt-1.5">
                <span className="font-mono text-xs text-primary">$</span>
                <span className="font-mono text-xs text-muted-foreground">
                  stui demo model_demo
                </span>
              </div>
              <a
                href={asset("products/stui/stui-model-demo.png")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open the full-size stui terminal capture"
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <img
                  src={asset("products/stui/stui-model-demo.webp")}
                  alt="stui terminal model demo with prompt, sampling controls, and run output"
                  className="w-full rounded-lg border border-border"
                  width={2304}
                  height={1664}
                  loading="eager"
                  decoding="async"
                  data-testid="image-stui-terminal-preview"
                />
              </a>
              <div className="px-2 pb-1 pt-2.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Real terminal capture · model_demo
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20"
        data-testid="section-stui-quickstart"
      >
        <div className="grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-start">
          <Reveal className="grid min-w-0 gap-3">
            <CopyBlock label="app.py" value={quickstart} />
            <CopyBlock label="Check and run" value={firstRunCommand} />
          </Reveal>

          <Reveal delay={0.08} className="lg:pl-5">
            <div className="eyebrow mb-3 text-primary">
              60-second quickstart
            </div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Build a terminal app from one Python file.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              The example uses the new experimental cache and multiline input
              APIs. Run it with watch mode while editing local helpers; stui
              keeps session state alive and surfaces temporary source errors in
              the app.
            </p>
            <ul className="mt-6 grid gap-3">
              {useCases.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section
        className="border-y border-border bg-card"
        data-testid="section-stui-features"
      >
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
          <Reveal className="max-w-2xl">
            <div className="eyebrow mb-3 text-primary">What shipped in 2.2</div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Faster reruns and richer authoring, without widening the stable
              core.
            </h2>
          </Reveal>

          <div className="mt-9 divide-y divide-border border-y border-border">
            {releaseHighlights.map((highlight, index) => (
              <Reveal key={highlight.title} delay={index * 0.05}>
                <article className="grid gap-3 py-6 md:grid-cols-[4rem_13rem_minmax(0,1fr)] md:items-start md:gap-6">
                  <div className="font-mono text-xs text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="font-mono text-xs uppercase tracking-wider text-emerald-700">
                      {highlight.label}
                    </div>
                    <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">
                      {highlight.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                    {highlight.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20"
        data-testid="section-stui-boundaries"
      >
        <Reveal>
          <div className="grid gap-9 border-y border-border py-9 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:py-12">
            <div>
              <ServerOff
                className="mb-5 h-6 w-6 text-primary"
                aria-hidden="true"
              />
              <div className="eyebrow mb-3 text-primary">The boundary</div>
              <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
                Terminal-first, with the limits stated plainly.
              </h2>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                stui is independent and Streamlit-inspired, not affiliated with
                Streamlit and not a compatibility layer. Version 2.2 keeps its
                new cache and multiline APIs experimental while real terminal
                use shapes their contracts.
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-xl border border-card-border bg-border sm:grid-cols-2">
              {boundaries.map((boundary) => (
                <li
                  key={boundary}
                  className="flex min-h-12 items-center gap-2.5 bg-card px-4 py-3 text-sm text-foreground"
                >
                  <Terminal
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {boundary}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
