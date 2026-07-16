/**
 * meta-inject-plugin.ts
 *
 * Vite plugin that solves two SEO problems for the NeverGuess SPA:
 *
 * 1. Marketing routes (/neverguess, /pricing, /about, …)
 *    Each route gets its own index.html at build time with:
 *    - Route-specific <title>, description, canonical, og:*, twitter:* tags
 *    - Route-specific static HTML body content (h1, description, key features)
 *      that is visible to all crawlers before JavaScript runs.
 *    This is a build-time static-site-generation (SSG) step: writeBundle
 *    generates dist/public/<route>/index.html and dist/public/<route>.html for
 *    every known marketing route. The .html companion keeps no-trailing-slash
 *    requests on the same route-specific SEO response instead of falling back
 *    to the root SPA shell.
 *
 * 2. Public report pages (/r/:slug)
 *    Metadata depends on DB data so it cannot be prerendered statically.
 *    - configureServer (dev): intercepts /r/:slug, fetches report from the
 *      internal API, injects verdict-specific head tags + body content.
 *    - configurePreviewServer (production): same, for vite preview.
 *      This Replit application is deployed as an autoscale process
 *      (`deploymentTarget = "autoscale"`, `router = "application"`), so
 *      `vite preview` IS the production server — not a CDN/static host.
 *
 * Client-side useMetaTags() / useDocumentTitle() are unchanged — they update
 * the document for in-app navigation AFTER React has hydrated. The plugin
 * ensures the *first* HTTP response already contains the correct tags and
 * meaningful body content so social bots and AI crawlers see real data.
 *
 * The static body element (#seo-static) is hidden by main.tsx before React
 * renders, so users never see a flash of the static fallback.
 */

import type { Plugin, ResolvedConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { Connect } from "vite";
import type { ServerResponse } from "node:http";
import { changelogEntries } from "./src/data/changelog-entries";
import { RETRYPROOF, RETRYPROOF_JSON_LD } from "./src/data/retryproof";
import { STUI_DESCRIPTION, STUI_JSON_LD, STUI_RELEASE } from "./src/data/stui-release";

// ---------------------------------------------------------------------------
// Static body styles — dark theme matching the app
// ---------------------------------------------------------------------------

const BODY_STYLE = [
  "font-family:system-ui,sans-serif",
  "background:#030006",
  "color:#e2e8f0",
  "padding:3rem 1.5rem",
  "max-width:960px",
  "margin:0 auto",
].join(";");

const CARD_STYLE = [
  "padding:1rem 1.25rem",
  "border:1px solid #1e293b",
  "border-radius:0.5rem",
  "margin-bottom:0.75rem",
].join(";");

const LINK_STYLE = "color:#a78bfa;text-decoration:none";

const H1_STYLE = "font-size:2rem;font-weight:700;margin:0 0 1rem;line-height:1.1";
const P_STYLE = "font-size:1rem;color:#94a3b8;margin:0 0 1.5rem;line-height:1.6";
const H2_STYLE = "font-size:1.25rem;font-weight:600;margin:1.5rem 0 0.75rem";
const LI_STYLE = "margin-bottom:0.75rem";

// ---------------------------------------------------------------------------
// Changelog helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  const date = new Date(iso + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const TAG_COLOR: Record<string, string> = {
  new: "#6ee7b7",
  improved: "#67e8f9",
  fixed: "#fde68a",
};

function buildChangelogBodyHtml(): string {
  const entriesHtml = changelogEntries
    .map((e) => {
      const color = TAG_COLOR[e.tag] ?? "#94a3b8";
      const proofLink = e.href
        ? `<p style="font-size:0.85rem;margin:0.55rem 0 0"><a href="${escAttr(e.href)}" style="${LINK_STYLE}">${escAttr(e.hrefLabel ?? "View proof")} →</a></p>`
        : "";
      return `<li style="margin-bottom:2rem;padding-bottom:2rem;border-bottom:1px solid #1e293b">
  <div style="font-size:0.7rem;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:0.4rem">${fmtDate(e.date)}</div>
  <div style="display:inline-block;border:1px solid ${color}33;background:${color}1a;color:${color};font-size:0.65rem;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;padding:0.15rem 0.5rem;border-radius:9999px;margin-bottom:0.5rem">${e.tag}</div>
  <h2 style="font-size:1.1rem;font-weight:700;margin:0 0 0.4rem;line-height:1.3">${e.title}</h2>
  <p style="font-size:0.9rem;color:#94a3b8;margin:0;line-height:1.6">${e.body}</p>
  ${proofLink}
</li>`;
    })
    .join("\n");

  return `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">Changelog</h1>
  <p style="${P_STYLE}">What we shipped, in order. New features, polish, and bug fixes — plain English, no release-train marketing copy.</p>
  <ol style="list-style:none;padding:0;margin:0">
${entriesHtml}
  </ol>
  <p style="${P_STYLE}"><a href="/neverguess" style="${LINK_STYLE}">← Back to NeverGuess</a></p>
</div>`;
}

// ---------------------------------------------------------------------------
// Route metadata type + map
// ---------------------------------------------------------------------------

type RouteMeta = {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogImageAlt?: string;
  /** Static HTML body for crawlers — injected before #root, hidden on mount. */
  bodyHtml: string;
  /**
   * Route-specific JSON-LD structured data object.  When present, the shared
   * NeverGuess SoftwareApplication JSON-LD block from index.html is removed
   * and replaced with this product-specific schema in the generated HTML file.
   */
  jsonLd?: Record<string, unknown>;
};

const ROUTE_METADATA: Record<string, RouteMeta> = {
  "/": {
    title: "MarMar Labs · Practical software products shipped in public",
    description:
      "MarMar Labs builds focused tools for workflow fault testing, AI code review, terminal-native Python workflows, iOS agreement review/signing, and practical security research.",
    canonicalUrl: "https://marmarlabs.com/",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "MarMar Labs",
      "url": "https://marmarlabs.com/",
      "description": "A software lab building four public products: RetryProof, NeverGuess, stui, and SignAI, with practical security research on HackerOne.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">MarMar Labs · Practical software products shipped in public</h1>
  <p style="${P_STYLE}">MarMar Labs builds focused tools for workflow fault testing, AI code review, terminal-native Python workflows, iOS agreement review/signing, and practical security research.</p>
  <h2 style="${H2_STYLE}">Product ledger</h2>
  <div style="${CARD_STYLE}">
    <strong>RetryProof</strong> — Deterministic retry-fault tests for consequential n8n workflows.
    <br /><a href="/retryproof" style="${LINK_STYLE}">Learn more →</a>
  </div>
  <div style="${CARD_STYLE}">
    <strong>NeverGuess</strong> — Live web product for preflight reports on repo risk, missing tests, rollout notes, and safer agent prompts.
    <br /><a href="/neverguess" style="${LINK_STYLE}">Learn more →</a>
  </div>
  <div style="${CARD_STYLE}">
    <strong>stui 2.2.0</strong> — Stable v2 core with process-local caching, multiline input, and a multi-file watch loop.
    <br /><a href="/stui" style="${LINK_STYLE}">Learn more →</a>
  </div>
  <div style="${CARD_STYLE}">
    <strong>SignAI</strong> — App Store iOS app for scanning, reviewing, signing, and tracking agreements.
    <br /><a href="/signai" style="${LINK_STYLE}">Learn more →</a>
  </div>
  <h2 style="${H2_STYLE}">Proof links</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Four public products across web, Python, and iOS.</li>
    <li style="${LI_STYLE}">RetryProof reproduces retry bugs under declared deterministic fault models.</li>
    <li style="${LI_STYLE}">SignAI is available on the App Store.</li>
    <li style="${LI_STYLE}">stui is published at v2.2.0 with its stable v2 core intact.</li>
    <li style="${LI_STYLE}">NeverGuess has report examples, status, and changelog surfaces.</li>
    <li style="${LI_STYLE}">Security research proof is available on the MarMar Labs HackerOne profile.</li>
  </ul>
  <p style="${P_STYLE}"><a href="/status" style="${LINK_STYLE}">Status</a> · <a href="/security-research" style="${LINK_STYLE}">Security research</a> · <a href="/changelog" style="${LINK_STYLE}">Changelog</a> · <a href="/contact" style="${LINK_STYLE}">Contact MarMar Labs</a></p>
</div>`,
  },

  "/retryproof": {
    title: RETRYPROOF.title + " | MarMar Labs",
    description: RETRYPROOF.description,
    canonicalUrl: RETRYPROOF.productUrl,
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    jsonLd: RETRYPROOF_JSON_LD,
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">OpenAI Build Week · Developer tools</p>
  <h1 style="${H1_STYLE}">RetryProof · Workflow flight tests for retry failures</h1>
  <p style="${P_STYLE}">${RETRYPROOF.description}</p>
  <h2 style="${H2_STYLE}">How it works</h2>
  <ol style="padding-left:1.5rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Import and sanitize an n8n workflow without executing it.</li>
    <li style="${LI_STYLE}">Approve a structured invariant proposed by GPT-5.6.</li>
    <li style="${LI_STYLE}">Replay declared retry and crash schedules in a deterministic simulator.</li>
    <li style="${LI_STYLE}">Apply a constrained Codex repair and let the validator own the verdict.</li>
  </ol>
  <p style="${P_STYLE}">${RETRYPROOF.boundary}</p>
  <p style="${P_STYLE}"><a href="${RETRYPROOF.appUrl}" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Open the flight test →</a></p>
  <p style="${P_STYLE}"><a href="${RETRYPROOF.repositoryUrl}" style="${LINK_STYLE}">View the public source repository</a></p>
</div>`,
  },

  "/retryproof/lab": {
    title: "RetryProof Lab | MarMar Labs",
    description:
      "Run a deterministic retry failure flight test, approve its invariant, validate a bounded repair, and export evidence.",
    canonicalUrl: "https://marmarlabs.com/retryproof/lab",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">Workflow flight test · anonymous judge path</p>
  <h1 style="${H1_STYLE}">RetryProof Lab · Reproduce, repair, and prove retry failures</h1>
  <p style="${P_STYLE}">Load the seeded synthetic n8n refund workflow, approve its invariant, reproduce a duplicate side effect under a deterministic timeout, validate a bounded repair, and export the red-to-green evidence receipt.</p>
  <h2 style="${H2_STYLE}">Evidence boundary</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">No uploaded workflow code, SQL, shell command, or network request is executed.</li>
    <li style="${LI_STYLE}">Model-informed templates are labeled as derived in the public judge path and link to canonical live-verification evidence.</li>
    <li style="${LI_STYLE}">The deterministic simulator and validators own every red/green verdict.</li>
    <li style="${LI_STYLE}">A passing declared scenario is not proof of exactly-once execution or production safety.</li>
  </ul>
  <p style="${P_STYLE}"><a href="/retryproof/lab" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Open RetryProof Lab →</a></p>
</div>`,
  },

  "/neverguess": {
    title: "NeverGuess · 60-second AI change preflight",
    description:
      "Drop in a repo. Tell us the change. We'll flag the 3 things that'll break — and rewrite your agent prompt to avoid them.",
    canonicalUrl: "https://marmarlabs.com/neverguess",
    ogImage: "https://marmarlabs.com/brand/og-neverguess.webp",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "NeverGuess",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "Web",
      "url": "https://marmarlabs.com/neverguess",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "description": "NeverGuess is an AI change-preflight tool. It inspects architecture, risk, tests, and deployment readiness before AI-generated code changes.",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">AI Change Preflight</p>
  <h1 style="${H1_STYLE}">NeverGuess · 60-second AI change preflight</h1>
  <p style="${P_STYLE}">Drop in a repo. Tell us the change. We'll flag the 3 things that'll break — and rewrite your agent prompt to avoid them.</p>
  <h2 style="${H2_STYLE}">What NeverGuess checks</h2>
  <ul style="list-style:none;padding:0;margin:0">
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Risk analysis</strong> — Flags architecture risks, blast radius, side effects, and failure modes before the change ships.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Test coverage</strong> — Identifies what's tested and what's missing for the requested change.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Deployment readiness</strong> — Reviews rollout plan, smoke tests, and rollback options.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Prompt rewrite</strong> — Delivers a corrected, safer prompt to drop straight back into your coding tool.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Your choice of model</strong> — Run the preflight on the frontier model you trust — Claude Fable 5, the GPT-5.6 family, Gemini, Grok, and more — with a receipt on every report naming the exact model that produced it.</li>
  </ul>
  <h2 style="${H2_STYLE}">How it works</h2>
  <ol style="padding-left:1.5rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Paste your GitHub repo URL</li>
    <li style="${LI_STYLE}">Describe the change your coding tool is about to make</li>
    <li style="${LI_STYLE}">NeverGuess inspects the codebase and returns a verdict — SAFE, CAUTION, or BLOCKER — with evidence</li>
  </ol>
  <p style="${P_STYLE}"><a href="/audits/new" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Run a free preflight →</a></p>
  <p style="${P_STYLE}"><a href="/pricing" style="${LINK_STYLE}">View pricing</a> · <a href="/reports" style="${LINK_STYLE}">Browse report examples</a> · <a href="/r/next-isr" style="${LINK_STYLE}">See example report</a></p>
</div>`,
  },

  "/reports": {
    title: "NeverGuess report examples — preflight audits",
    description:
      "Browse NeverGuess preflight examples. Each report includes verdict, risk score, architecture summary, risky assumptions, acceptance criteria, safer prompts, and rollout notes.",
    canonicalUrl: "https://marmarlabs.com/reports",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 0.75rem"><a href="/neverguess" style="${LINK_STYLE}">← NeverGuess</a></p>
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">Report Examples</p>
  <h1 style="${H1_STYLE}">NeverGuess report examples</h1>
  <p style="${P_STYLE}">Preflight examples. Each report includes verdict, risk score, architecture summary, risky assumptions, acceptance criteria, safer prompts, and rollout notes.</p>
  <ul style="list-style:none;padding:0;margin:0 0 1.5rem">
    <li style="${LI_STYLE}"><a href="/r/next-isr" style="${LINK_STYLE}"><span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:9999px;font-size:0.75rem;font-weight:700;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;margin-right:0.5rem">CAUTION</span>Enable Next.js ISR on product listing page</a> <span style="color:#64748b;font-size:0.8rem">· next.js</span></li>
  </ul>
  <p style="${P_STYLE}"><a href="/audits/new" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Run a free preflight →</a></p>
</div>`,
  },

  // The audit form is an app route, but it is the product's front door for
  // anonymous visitors (one free trial audit, no account), so it gets the
  // same prerendered SEO treatment as the marketing routes.
  "/audits/new": {
    title: "Run a free AI change preflight — NeverGuess",
    description:
      "Paste a public GitHub repo URL, describe the change your coding tool is about to make, and get a SAFE, CAUTION, or BLOCKER verdict with evidence. First audit free, no account needed.",
    canonicalUrl: "https://marmarlabs.com/audits/new",
    ogImage: "https://marmarlabs.com/brand/og-neverguess.webp",
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">AI Change Preflight</p>
  <h1 style="${H1_STYLE}">Run a free AI change preflight</h1>
  <p style="${P_STYLE}">First audit free, no account needed.</p>
  <h2 style="${H2_STYLE}">Three steps</h2>
  <ol style="padding-left:1.5rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Paste a public GitHub repo URL or a public live URL</li>
    <li style="${LI_STYLE}">Describe the change your coding tool is about to make</li>
    <li style="${LI_STYLE}">Get a SAFE, CAUTION, or BLOCKER verdict with risks, tests, and a safer prompt</li>
  </ol>
  <p style="${P_STYLE}"><a href="/neverguess" style="${LINK_STYLE}">About NeverGuess</a> · <a href="/pricing" style="${LINK_STYLE}">View pricing</a> · <a href="/reports" style="${LINK_STYLE}">Browse report examples</a></p>
</div>`,
  },

  "/pricing": {
    title: "NeverGuess pricing — $0 free, $10/mo Pro",
    description:
      "Free for occasional NeverGuess preflights. $10/mo for builders shipping daily with AI-assisted coding. Cancel anytime; no auto-renew without warning.",
    canonicalUrl: "https://marmarlabs.com/pricing",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">NeverGuess pricing</h1>
  <p style="${P_STYLE}">Simple pricing for solo developers and small teams using AI-assisted coding tools. No surprise charges. Cancel anytime.</p>
  <h2 style="${H2_STYLE}">Free</h2>
  <div style="${CARD_STYLE}">
    <strong>$0 / month</strong>
    <ul style="padding-left:1.25rem;color:#94a3b8;margin:0.5rem 0 0">
      <li style="${LI_STYLE}">1 preflight audit per month</li>
      <li style="${LI_STYLE}">Standard frontier models — Claude Sonnet 5, GPT-5.6, Gemini, Grok &amp; more</li>
      <li style="${LI_STYLE}">Risk analysis, architecture summary, test plan</li>
      <li style="${LI_STYLE}">Public share link + README verdict badge</li>
      <li style="${LI_STYLE}">Re-run audits + revoke share links</li>
    </ul>
  </div>
  <h2 style="${H2_STYLE}">Pro — $10 / month</h2>
  <div style="${CARD_STYLE}">
    <strong>$10 / month</strong> (or $100 / year)
    <ul style="padding-left:1.25rem;color:#94a3b8;margin:0.5rem 0 0">
      <li style="${LI_STYLE}">50 preflight audits per month</li>
      <li style="${LI_STYLE}">Premium models — Claude Fable 5, Claude Opus 4.8 (Fast), GPT-5.5 Pro &amp; the GPT-5.6 Pro line</li>
      <li style="${LI_STYLE}">Bring your own GitHub token for rate-limit headroom</li>
      <li style="${LI_STYLE}">Audit history kept forever</li>
      <li style="${LI_STYLE}">Priority email support</li>
    </ul>
  </div>
  <h2 style="${H2_STYLE}">Team — talk to us</h2>
  <div style="${CARD_STYLE}">
    <strong>Custom</strong>
    <ul style="padding-left:1.25rem;color:#94a3b8;margin:0.5rem 0 0">
      <li style="${LI_STYLE}">Everything in Pro, unlimited audits across the team</li>
      <li style="${LI_STYLE}">Email founder@marmarlabs.com</li>
    </ul>
  </div>
  <p style="${P_STYLE}"><a href="/audits/new" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Get started free →</a></p>
</div>`,
  },

  "/about": {
    title: "About MarMar Labs — One developer, one company, multiple products",
    description:
      "MarMar Labs is a self-funded indie software lab in Minnesota. RetryProof, NeverGuess, stui, SignAI, and practical security research are public proof surfaces.",
    canonicalUrl: "https://marmarlabs.com/about",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "name": "About MarMar Labs",
      "url": "https://marmarlabs.com/about",
      "description": "MarMar Labs is a self-funded indie software lab based in Minnesota, United States, building practical products across web, Python, iOS, and security research.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">About MarMar Labs</h1>
  <p style="${P_STYLE}">MarMar Labs is a self-funded indie software lab based in Minnesota, United States. Founded in March 2026 by Marcel Jiron, MarMar Labs builds practical products across web, Python, and iOS, with practical security research on HackerOne.</p>
  <h2 style="${H2_STYLE}">Products</h2>
  <ul style="list-style:none;padding:0;margin:0">
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>RetryProof</strong> — Deterministic retry-fault testing for consequential n8n workflows. <a href="/retryproof" style="${LINK_STYLE}">Learn more</a></li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>NeverGuess</strong> — AI change preflight that catches what an AI agent may break before it ships. <a href="/neverguess" style="${LINK_STYLE}">Learn more</a></li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>stui 2.2.0</strong> — Terminal-native Python UI framework with a stable v2 core plus new caching, watch, and multiline authoring tools. <a href="/stui" style="${LINK_STYLE}">Learn more</a></li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>SignAI</strong> — iOS app for AI-assisted agreement review, signing, and deadline tracking. <a href="/signai" style="${LINK_STYLE}">Learn more</a></li>
  </ul>
  <h2 style="${H2_STYLE}">Our principles</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}"><strong>Shipped surfaces first</strong> — Public product pages, live links, and release versions before roadmap claims.</li>
    <li style="${LI_STYLE}"><strong>Clear ownership</strong> — One accountable builder close to product, engineering, support, and releases.</li>
    <li style="${LI_STYLE}"><strong>Small and focused</strong> — Targeted tools that do one thing well.</li>
    <li style="${LI_STYLE}"><strong>Security-minded</strong> — Vulnerability research informs how the lab thinks about trust boundaries, permissions, and secret handling.</li>
  </ul>
  <p style="${P_STYLE}"><a href="/security-research" style="${LINK_STYLE}">Security research</a> · <a href="/contact" style="${LINK_STYLE}">Contact MarMar Labs</a></p>
</div>`,
  },

  "/security-research": {
    title: "Security Research by MarMar Labs",
    description:
      "Marcel Jiron researches practical bugs in AI systems, developer tools, APIs, CLIs, GitHub Actions, CI/CD, and token or secret handling.",
    canonicalUrl: "https://marmarlabs.com/security-research",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      "name": "Security Research by MarMar Labs",
      "url": "https://marmarlabs.com/security-research",
      "description": "Security research profile for Marcel Jiron, founder of MarMar Labs.",
      "about": {
        "@type": "Person",
        "name": "Marcel Jiron",
        "sameAs": [
          "https://hackerone.com/realmarmarlabs?type=user",
          "https://github.com/marmar9615-cloud",
          "https://www.linkedin.com/in/marcel-jiron-525092408/"
        ],
        "knowsAbout": [
          "Security research",
          "AI systems",
          "Developer tools",
          "APIs",
          "CLIs",
          "GitHub Actions",
          "CI/CD",
          "Token and secret handling"
        ]
      },
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">HackerOne profile · realmarmarlabs</p>
  <h1 style="${H1_STYLE}">Security Research by MarMar Labs</h1>
  <p style="${P_STYLE}">Marcel Jiron researches practical bugs in AI systems, developer tools, APIs, CLIs, GitHub Actions, CI/CD, and token or secret handling. The public proof stays high-level; private report details stay private.</p>
  <h2 style="${H2_STYLE}">Proof summary</h2>
  <ul style="list-style:none;padding:0;margin:0">
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>$4,050</strong> — HackerOne rewards earned across paid findings and retest awards.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>5 paid findings</strong> — Report details are not published unless disclosed by the program.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>99th percentile signal</strong> — Public HackerOne profile signal.</li>
  </ul>
  <h2 style="${H2_STYLE}">Research focus</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">AI systems and agent tooling.</li>
    <li style="${LI_STYLE}">Developer tools, APIs, and CLIs.</li>
    <li style="${LI_STYLE}">GitHub Actions, CI/CD, permissions, integrations, and trust boundaries.</li>
    <li style="${LI_STYLE}">Token, secret, and configuration handling.</li>
  </ul>
  <p style="${P_STYLE}"><a href="https://hackerone.com/realmarmarlabs?type=user" style="${LINK_STYLE}">View HackerOne profile</a> · <a href="/contact" style="${LINK_STYLE}">Contact MarMar Labs</a></p>
</div>`,
  },

  "/contact": {
    title: "Contact MarMar Labs",
    description:
      "Three inboxes routed by purpose: founder@ for partnerships, support@ for billing, contact@ for general questions.",
    canonicalUrl: "https://marmarlabs.com/contact",
    ogImage: "https://marmarlabs.com/brand/og-image.webp",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      "name": "Contact MarMar Labs",
      "url": "https://marmarlabs.com/contact",
      "description": "Three inboxes routed by purpose: founder@ for partnerships, support@ for billing, contact@ for general questions.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">Contact MarMar Labs</h1>
  <p style="${P_STYLE}">Three inboxes routed by purpose. Use the right one and you'll get a faster reply.</p>
  <div style="${CARD_STYLE}">
    <strong>founder@marmarlabs.com</strong>
    <p style="color:#94a3b8;margin:0.25rem 0 0">Partnerships, integrations, enterprise inquiries, investor questions.</p>
  </div>
  <div style="${CARD_STYLE}">
    <strong>support@marmarlabs.com</strong>
    <p style="color:#94a3b8;margin:0.25rem 0 0">Billing issues, account access, NeverGuess audit problems, refund requests.</p>
  </div>
  <div style="${CARD_STYLE}">
    <strong>contact@marmarlabs.com</strong>
    <p style="color:#94a3b8;margin:0.25rem 0 0">General questions, feedback, media inquiries, everything else.</p>
  </div>
  <p style="${P_STYLE}">We're based in Minnesota, US and typically respond within one business day.</p>
</div>`,
  },

  "/stui": {
    title: "stui " + STUI_RELEASE.version + " - Caching, watch mode, and multiline terminal apps",
    description: STUI_DESCRIPTION,
    canonicalUrl: "https://marmarlabs.com/stui",
    ogImage: "https://marmarlabs.com/products/stui/stui-og.webp",
    ogImageAlt: "stui terminal UI model demo screenshot",
    jsonLd: { ...STUI_JSON_LD },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">Terminal UI Framework</p>
  <h1 style="${H1_STYLE}">stui 2.2.0</h1>
  <p style="${P_STYLE}">Turn ordinary Python scripts into terminal-native apps with stateful reruns. Version 2.2 adds process-local caching, multiline input, and a multi-file watch loop without a browser or local server.</p>
  <h2 style="${H2_STYLE}">What shipped in 2.2</h2>
  <ul style="list-style:none;padding:0;margin:0">
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Stable v2 core</strong> — The documented stable API remains unchanged from v2.0.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Process-local caching</strong> — Experimental cache_data and cache_resource decorators support TTL, LRU limits, and explicit clearing.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Multi-file watch mode</strong> — Opt-in watch mode reloads imported local helpers, preserves session state, and recovers after temporary source errors.</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Multiline authoring</strong> — Experimental text_area supports forms, callbacks, character limits, and terminal-safe text rendering.</li>
  </ul>
  <h2 style="${H2_STYLE}">Terminal-first boundary</h2>
  <p style="${P_STYLE}">stui does not add a browser renderer, local server, websocket, network cache, port-forwarding flow, or Streamlit runtime dependency.</p>
  <p style="${P_STYLE}"><a href="https://github.com/marmar9615-cloud/stui-terminal/releases/tag/v2.2.0" style="${LINK_STYLE}">Read the v2.2.0 release notes</a> · <a href="https://pypi.org/project/stui-terminal/" style="${LINK_STYLE}">View on PyPI</a></p>
</div>`,
  },

  "/signai": {
    title: "SignAI - AI-assisted agreement platform by MarMar Labs",
    description:
      "Download SignAI on the App Store. Scan paper agreements, import documents, review important terms, manage signers, and prepare documents for signature.",
    canonicalUrl: "https://marmarlabs.com/signai",
    ogImage: "https://marmarlabs.com/products/signai/social-card.png",
    ogImageAlt: "SignAI – AI-assisted agreement platform",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "MobileApplication",
      "name": "SignAI",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "iOS",
      "url": "https://marmarlabs.com/signai",
      "downloadUrl": "https://apps.apple.com/us/app/signai/id6763717626",
      "image": "https://marmarlabs.com/products/signai/icon.png",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "description": "SignAI is an AI-assisted mobile agreement platform for iPhone. Scan paper agreements, import documents, review key terms and dates with consent-based AI tools, manage signers, and keep work moving from one organized mobile workspace.",
      "offers": { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">iOS App</p>
  <h1 style="${H1_STYLE}">SignAI</h1>
  <p style="${P_STYLE}">AI-assisted agreement platform for iPhone. Scan paper agreements, import documents, review important terms with consent-based AI tools, manage signers, and prepare documents for signature.</p>
  <h2 style="${H2_STYLE}">Features</h2>
  <ul style="list-style:none;padding:0;margin:0">
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Document scanning</strong> — Scan paper contracts and agreements with your iPhone camera</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Optional AI-assisted review</strong> — After consent, get plain-language summaries of important terms, obligations, and risks</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Deadline tracking</strong> — Never miss a contract renewal or expiration date</li>
    <li style="${CARD_STYLE};${LI_STYLE}"><strong>Electronic signatures</strong> — Prepare and collect signatures on documents</li>
  </ul>
  <p style="${P_STYLE}"><a href="https://apps.apple.com/us/app/signai/id6763717626" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Download on the App Store →</a></p>
  <p style="${P_STYLE}"><a href="/signai/privacy" style="${LINK_STYLE}">Privacy Policy</a> · <a href="/signai/terms" style="${LINK_STYLE}">Terms of Service</a> · <a href="/signai/support" style="${LINK_STYLE}">Support</a></p>
</div>`,
  },

  "/signai/privacy": {
    title: "Privacy Policy | SignAI",
    description:
      "Privacy policy for SignAI document scanning, AI-assisted agreement review, signing, and storage.",
    canonicalUrl: "https://marmarlabs.com/signai/privacy",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Privacy Policy — SignAI",
      "url": "https://marmarlabs.com/signai/privacy",
      "description": "Privacy policy for SignAI document scanning, AI-assisted agreement review, signing, and storage.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 1rem"><a href="/signai" style="${LINK_STYLE}">← SignAI</a></p>
  <h1 style="${H1_STYLE}">Privacy Policy</h1>
  <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:0 0 1rem;font-family:monospace">Last updated: June 4, 2026</p>
  <p style="${P_STYLE}">SignAI helps users scan, understand, manage, and sign agreements. This policy explains what information we collect, how we use it, and the choices available to you.</p>
  <h2 style="${H2_STYLE}">Information we collect</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Account information, such as your name, email address, authentication identifiers, and subscription status.</li>
    <li style="${LI_STYLE}">Documents and agreement data that you upload, scan, analyze, sign, or store in SignAI, including document text, images or PDF content, file names, and basic document metadata.</li>
    <li style="${LI_STYLE}">Signature, audit, and workflow information, including timestamps, signing status, activity history, and related document metadata.</li>
    <li style="${LI_STYLE}">Device and app information used for app functionality and security, such as app version, device type, notification settings, and signing workflow context.</li>
    <li style="${LI_STYLE}">Payment and subscription information handled through payment processors and app-store billing providers.</li>
  </ul>
  <h2 style="${H2_STYLE}">How we collect information</h2>
  <p style="${P_STYLE}">We collect information directly from you when you create an account, upload or scan a document, enter signer details, create or store a signature, ask an AI question, complete a signing workflow, contact support, or manage a subscription. We also collect limited app and device information when the app is used so we can operate, secure, and troubleshoot the service.</p>
  <h2 style="${H2_STYLE}">How we use information</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">To provide document scanning, optional AI-assisted agreement analysis, Ask AI Q&amp;A, electronic signing, storage, and account features.</li>
    <li style="${LI_STYLE}">To process subscriptions, provide support, maintain security, troubleshoot issues, and improve product reliability.</li>
    <li style="${LI_STYLE}">To create audit trails and records needed for agreement workflows.</li>
    <li style="${LI_STYLE}">To comply with legal, security, and fraud-prevention obligations.</li>
  </ul>
  <h2 style="${H2_STYLE}">AI processing and model providers</h2>
  <p style="${P_STYLE}">AI analysis and Ask AI are optional. Accepting the Terms of Service or Privacy Policy is not consent to share a document with third-party AI. Before SignAI sends personal data to a third-party AI service, the app asks for your explicit in-app permission.</p>
  <p style="${P_STYLE}">If you consent, SignAI may send document text, images or PDF content, file name, basic document metadata, an internal account identifier, your AI question, and relevant agreement context to OpenRouter, OpenAI models through OpenRouter, and Mistral OCR or Cloudflare AI through OpenRouter for scanned PDF parsing/OCR when needed. SignAI uses that AI processing only to generate summaries, risk notes, clause extraction, signing-field placement, and answers to your questions. SignAI does not sell agreement content and does not provide legal advice. AI output may be inaccurate, so you should review documents yourself before signing or sending them.</p>
  <p style="${P_STYLE}">Before sending data to third-party AI, SignAI records your AI-processing consent version, timestamp, agreement id, user id, purpose, source, data sent, recipients, Privacy Policy URL, and disclosure snapshot for audit and compliance. You may turn off AI analysis before upload when you only want to upload, store, and sign a document without third-party AI processing.</p>
  <h2 style="${H2_STYLE}">Sharing</h2>
  <p style="${P_STYLE}">We may share information with service providers that help operate SignAI, including cloud hosting, authentication, AI processing, storage, support, and payment services. These providers are required to protect information appropriately, process it only for SignAI service purposes, provide the same or equal protection for shared personal data, and not sell personal information. We do not sell personal information.</p>
  <h2 style="${H2_STYLE}">Retention, deletion, and AI choices</h2>
  <p style="${P_STYLE}">We keep account, document, signature, subscription, and audit information for as long as needed to provide SignAI, maintain agreement records, comply with legal obligations, resolve disputes, and protect the service. You can avoid future third-party AI sharing by turning off AI analysis before upload or by declining the Ask AI consent prompt. SignAI will not send that document or question to third-party AI services unless you consent. You may delete documents in the app or contact support to request account or data deletion, subject to legal and security retention requirements.</p>
  <h2 style="${H2_STYLE}">Security</h2>
  <p style="${P_STYLE}">We use technical and organizational safeguards designed to protect user information. No method of transmission or storage is perfectly secure, so we cannot guarantee absolute security.</p>
  <h2 style="${H2_STYLE}">Your choices</h2>
  <p style="${P_STYLE}">You may update account information, manage subscriptions through the applicable app store or billing provider, delete documents in the app, or contact us for help with privacy requests.</p>
  <h2 style="${H2_STYLE}">Contact</h2>
  <p style="${P_STYLE}">For privacy questions or requests, contact <a href="mailto:support@marmarlabs.com" style="${LINK_STYLE}">support@marmarlabs.com</a>.</p>
</div>`,
  },

  "/signai/terms": {
    title: "Terms of Service | SignAI",
    description:
      "Terms of Service for SignAI agreement review, electronic signatures, subscriptions, and support.",
    canonicalUrl: "https://marmarlabs.com/signai/terms",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Terms of Service — SignAI",
      "url": "https://marmarlabs.com/signai/terms",
      "description": "Terms of Service for SignAI agreement review, electronic signatures, subscriptions, and support.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 1rem"><a href="/signai" style="${LINK_STYLE}">← SignAI</a></p>
  <h1 style="${H1_STYLE}">Terms of Service</h1>
  <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:0 0 1rem;font-family:monospace">Last updated: June 4, 2026</p>
  <p style="${P_STYLE}">These terms govern your use of SignAI. By using SignAI, you agree to these terms.</p>
  <h2 style="${H2_STYLE}">Service</h2>
  <p style="${P_STYLE}">SignAI provides document management, AI-assisted agreement review, electronic signature, deadline tracking, and related productivity features.</p>
  <h2 style="${H2_STYLE}">No legal advice</h2>
  <p style="${P_STYLE}">SignAI may help summarize agreements and identify possible issues, but it does not provide legal advice and does not replace review by a qualified attorney.</p>
  <h2 style="${H2_STYLE}">Optional AI processing</h2>
  <p style="${P_STYLE}">AI analysis and Ask AI are optional. Accepting these Terms is not consent to share a document with third-party AI. If you enable AI analysis or Ask AI, SignAI asks for explicit in-app permission before sending document text, images or PDF content, file name, basic document metadata, an internal account identifier, AI questions, or relevant agreement context to OpenRouter, OpenAI models through OpenRouter, and Mistral OCR or Cloudflare AI through OpenRouter for scanned PDF parsing/OCR when needed. This processing is used for summaries, risk detection, clause extraction, signing-field placement, and Q&amp;A. You can upload, store, and sign documents without third-party AI processing.</p>
  <h2 style="${H2_STYLE}">Inputs and AI outputs</h2>
  <p style="${P_STYLE}">You are responsible for the documents, prompts, questions, signer details, and other information you provide to SignAI. You must have the rights and permissions needed to upload or submit that content. AI-generated summaries, risk notes, extracted clauses, signing-field suggestions, and answers may be incomplete or inaccurate. SignAI is a productivity tool, not a law firm, and AI outputs are not legal advice.</p>
  <h2 style="${H2_STYLE}">Your content</h2>
  <p style="${P_STYLE}">You are responsible for documents and information you upload, scan, share, or sign using SignAI. You must have the rights and permissions needed to use that content with the service.</p>
  <h2 style="${H2_STYLE}">Subscriptions</h2>
  <p style="${P_STYLE}">Paid features may be offered through auto-renewing subscriptions, including SignAI Pro Monthly and SignAI Pro Annual. Subscription billing, renewals, cancellation, and refunds are handled through the applicable app store or billing provider unless stated otherwise. Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period, and you can manage or cancel them in your app-store account settings.</p>
  <h2 style="${H2_STYLE}">Acceptable use</h2>
  <p style="${P_STYLE}">You may not misuse SignAI, interfere with the service, attempt unauthorized access, upload unlawful content, or use the service to violate another person's rights.</p>
  <h2 style="${H2_STYLE}">Limitations</h2>
  <p style="${P_STYLE}">SignAI is provided as a productivity tool. To the maximum extent allowed by law, we are not responsible for indirect, incidental, special, consequential, or punitive damages.</p>
  <h2 style="${H2_STYLE}">Contact</h2>
  <p style="${P_STYLE}">Questions about these terms can be sent to <a href="mailto:support@marmarlabs.com" style="${LINK_STYLE}">support@marmarlabs.com</a>.</p>
</div>`,
  },

  "/signai/support": {
    title: "Support | SignAI",
    description:
      "Support options for SignAI account access, scanning, signing, subscriptions, and privacy requests.",
    canonicalUrl: "https://marmarlabs.com/signai/support",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Support — SignAI",
      "url": "https://marmarlabs.com/signai/support",
      "description": "Support options for SignAI account access, scanning, signing, subscriptions, and privacy requests.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 1rem"><a href="/signai" style="${LINK_STYLE}">← SignAI</a></p>
  <h1 style="${H1_STYLE}">SignAI Support</h1>
  <p style="${P_STYLE}">Need help with SignAI? Email <a href="mailto:support@marmarlabs.com" style="${LINK_STYLE}">support@marmarlabs.com</a>. SignAI is operated by MarMar Labs.</p>
  <h2 style="${H2_STYLE}">Common topics</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Account access and sign-in help.</li>
    <li style="${LI_STYLE}">Document scanning, upload, and AI analysis questions.</li>
    <li style="${LI_STYLE}">Electronic signature workflow support.</li>
    <li style="${LI_STYLE}">Subscription, billing, cancellation, and restore-purchase questions.</li>
    <li style="${LI_STYLE}">Privacy, data deletion, or account deletion requests.</li>
  </ul>
  <h2 style="${H2_STYLE}">Subscriptions and billing</h2>
  <p style="${P_STYLE}">SignAI Pro subscriptions are billed through Apple In-App Purchase on iOS. You can manage or cancel an Apple subscription in your Apple ID subscription settings. If a subscription is not recognized in SignAI, use Restore Purchases in the app or contact support with your Apple purchase date and the email address on your SignAI account.</p>
  <h2 style="${H2_STYLE}">AI processing and privacy</h2>
  <p style="${P_STYLE}">AI analysis is optional. If you enable it, SignAI asks for in-app permission before sending document text, images or PDF content, file name, basic metadata, an internal account identifier, relevant agreement context, or AI questions to OpenRouter and OpenAI via OpenRouter. For scanned PDFs, OpenRouter file parsing/OCR may also use Mistral OCR or Cloudflare AI when needed. You can upload and sign documents without third-party AI processing. For privacy questions, data deletion requests, or AI processing questions, email support and include the email address on your SignAI account.</p>
  <h2 style="${H2_STYLE}">Before you contact us</h2>
  <p style="${P_STYLE}">Please include the email address on your SignAI account, your device model, iOS version, and a short description of what happened.</p>
  <p style="${P_STYLE}">Helpful links: <a href="/signai/privacy" style="${LINK_STYLE}">Privacy Policy</a> and <a href="/signai/terms" style="${LINK_STYLE}">Terms of Service</a>.</p>
</div>`,
  },

  "/changelog": {
    title: "Changelog | MarMar Labs",
    description:
      "What's new, what's improved, and what's fixed in NeverGuess and the MarMar Labs marketing site.",
    canonicalUrl: "https://marmarlabs.com/changelog",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Changelog — MarMar Labs",
      "url": "https://marmarlabs.com/changelog",
      "description": "What's new, what's improved, and what's fixed in NeverGuess and the MarMar Labs marketing site.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: buildChangelogBodyHtml(),
  },

  "/status": {
    title: "Status | MarMar Labs",
    description: "API health and service notes for NeverGuess and MarMar Labs.",
    canonicalUrl: "https://marmarlabs.com/status",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Service Status — MarMar Labs",
      "url": "https://marmarlabs.com/status",
      "description": "API health and service notes for NeverGuess and MarMar Labs.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">Service Status</h1>
  <p style="${P_STYLE}">Client-side API health plus service notes for the MarMar Labs product surfaces. Enable JavaScript to check the NeverGuess API from your session.</p>
  <div style="${CARD_STYLE}"><strong>NeverGuess API</strong> — <span style="color:#fde68a">Checked in browser</span></div>
  <div style="${CARD_STYLE}"><strong>MarMar Labs site</strong> — <span style="color:#4ade80">Static pages served</span></div>
  <p style="${P_STYLE}">Report issues to <a href="mailto:support@marmarlabs.com" style="${LINK_STYLE}">support@marmarlabs.com</a>.</p>
</div>`,
  },

  "/privacy": {
    title: "Privacy Policy | MarMar Labs",
    description:
      "What MarMar Labs collects when you use NeverGuess, why we collect it, and how to reach us about it.",
    canonicalUrl: "https://marmarlabs.com/privacy",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Privacy Policy — MarMar Labs",
      "url": "https://marmarlabs.com/privacy",
      "description": "What MarMar Labs collects when you use NeverGuess, why we collect it, and how to reach us about it.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">Privacy Policy</h1>
  <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:0 0 1rem;font-family:monospace">Last updated: May 2026 · Effective immediately on any new account</p>
  <p style="${P_STYLE}">MarMar Labs ("we", "us") operates the NeverGuess web application and the marmarlabs.com properties (the "Service"). This is the early-stage Privacy Policy; we'll update it as the Service grows. The principles below reflect how the Service is built today.</p>
  <h2 style="${H2_STYLE}">Information we collect</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}"><strong>Account info</strong> — when you sign in via our authentication provider, we receive your email, display name, and profile image.</li>
    <li style="${LI_STYLE}"><strong>Audit inputs</strong> — the GitHub repository URLs, live URLs, and change descriptions you submit to NeverGuess.</li>
    <li style="${LI_STYLE}"><strong>Generated reports</strong> — the analysis output we produce from those inputs, stored against your account.</li>
    <li style="${LI_STYLE}"><strong>Billing info</strong> — if you subscribe to NeverGuess Pro, payments are processed by Stripe. We never see or store your card; we receive only a Stripe customer id, subscription id, status, and renewal date.</li>
    <li style="${LI_STYLE}"><strong>Server logs</strong> — IP address, user agent, request timestamps and paths, kept for security and debugging. These are rotated on a short schedule.</li>
  </ul>
  <h2 style="${H2_STYLE}">How we use information</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">To run the analyses you request and display the resulting reports.</li>
    <li style="${LI_STYLE}">To operate, secure, and improve the Service.</li>
    <li style="${LI_STYLE}">To bill you (if you're on a paid plan) and to email you about your subscription.</li>
    <li style="${LI_STYLE}">To respond when you contact us.</li>
  </ul>
  <h2 style="${H2_STYLE}">What we do NOT do</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">We do not sell personal information.</li>
    <li style="${LI_STYLE}">We do not embed third-party advertising or analytics tracking pixels.</li>
    <li style="${LI_STYLE}">We do not persist your repository source code. We fetch it, build an in-memory map, run the analysis, and discard the source.</li>
    <li style="${LI_STYLE}">We do not store any GitHub personal access token you provide. It is held only in memory for the single audit, then released.</li>
  </ul>
  <h2 style="${H2_STYLE}">Subprocessors</h2>
  <p style="${P_STYLE}">We rely on a small set of trusted infrastructure providers to deliver the Service: Replit (hosting + authentication), Stripe (payments), OpenRouter and the underlying model providers (AI inference for the audit reports). Each handles the data described above under their own privacy practices.</p>
  <h2 style="${H2_STYLE}">Public reports</h2>
  <p style="${P_STYLE}">When you create a public share link for a NeverGuess report, the contents of that report become accessible to anyone with the link. Don't include private information in inputs you intend to share publicly. You can revoke a share link at any time from inside the report.</p>
  <h2 style="${H2_STYLE}">Your rights</h2>
  <p style="${P_STYLE}">You can request a copy of the data we have about you, ask us to delete it, or close your account at any time. Email <a href="mailto:contact@marmarlabs.com" style="${LINK_STYLE}">contact@marmarlabs.com</a> with the request and we'll handle it within a reasonable timeframe.</p>
  <h2 style="${H2_STYLE}">Children</h2>
  <p style="${P_STYLE}">The Service is not directed at children under 13. If we learn we've collected personal information from a child under 13, we'll delete it.</p>
  <h2 style="${H2_STYLE}">Contact</h2>
  <p style="${P_STYLE}">For privacy questions, email <a href="mailto:contact@marmarlabs.com" style="${LINK_STYLE}">contact@marmarlabs.com</a>.</p>
</div>`,
  },

  "/terms": {
    title: "Terms of Service | MarMar Labs",
    description: "The basic rules for using NeverGuess and other MarMar Labs services.",
    canonicalUrl: "https://marmarlabs.com/terms",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Terms of Service — MarMar Labs",
      "url": "https://marmarlabs.com/terms",
      "description": "The basic rules for using NeverGuess and other MarMar Labs services.",
      "publisher": { "@type": "Organization", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
      "isPartOf": { "@type": "WebSite", "name": "MarMar Labs", "url": "https://marmarlabs.com/" },
    },
    bodyHtml: `<div id="seo-static" style="${BODY_STYLE}">
  <h1 style="${H1_STYLE}">Terms of Service</h1>
  <p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:0 0 1rem;font-family:monospace">Last updated: May 2026</p>
  <p style="${P_STYLE}">By accessing or using NeverGuess and the marmarlabs.com properties (the "Service"), you agree to these terms. MarMar Labs operates the Service.</p>
  <h2 style="${H2_STYLE}">Your account</h2>
  <p style="${P_STYLE}">You're responsible for keeping your account credentials safe. If you suspect unauthorized access, email <a href="mailto:support@marmarlabs.com" style="${LINK_STYLE}">support@marmarlabs.com</a> and we'll help you secure it.</p>
  <h2 style="${H2_STYLE}">Acceptable use</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Don't submit code or content you don't have the right to submit.</li>
    <li style="${LI_STYLE}">Don't attempt to disrupt, reverse-engineer, scrape, or abuse the Service.</li>
    <li style="${LI_STYLE}">Don't use the Service for unlawful activity, harassment, or to generate harmful content.</li>
    <li style="${LI_STYLE}">Don't try to bypass billing controls (rate limits, paywalls, free-tier caps).</li>
  </ul>
  <h2 style="${H2_STYLE}">Subscriptions and billing</h2>
  <ul style="padding-left:1.25rem;color:#94a3b8;margin:0 0 1.5rem">
    <li style="${LI_STYLE}">Paid plans are billed in advance through Stripe. Prices and terms are listed on the <a href="/pricing" style="${LINK_STYLE}">Pricing page</a>.</li>
    <li style="${LI_STYLE}">You can cancel at any time from the Customer Portal (the "Manage subscription" link in your dashboard). Cancellation takes effect at the end of the current billing period and we will not auto-renew without warning.</li>
    <li style="${LI_STYLE}">We don't offer pro-rated refunds, but if something feels unfair, email us and we'll make it right within reason.</li>
    <li style="${LI_STYLE}">We may change prices for new subscriptions. Existing subscribers keep their rate through their current term and we'll notify you of any change before the next renewal.</li>
  </ul>
  <h2 style="${H2_STYLE}">No warranty</h2>
  <p style="${P_STYLE}">The Service is provided on an "as is" and "as available" basis. NeverGuess reports are advisory — they're an AI-generated analysis of code, not a guarantee. You are responsible for reviewing outputs before acting on them.</p>
  <h2 style="${H2_STYLE}">Limitation of liability</h2>
  <p style="${P_STYLE}">To the maximum extent permitted by law, MarMar Labs is not liable for any indirect, incidental, special, or consequential damages arising from your use of the Service. Our aggregate liability for any claim is limited to the amount you paid us in the 12 months preceding the claim.</p>
  <h2 style="${H2_STYLE}">Termination</h2>
  <p style="${P_STYLE}">We can suspend or terminate accounts that violate these terms. You can close your account at any time by emailing us; we'll delete your data within a reasonable timeframe (some logs may be retained for legal/security reasons for a short window).</p>
  <h2 style="${H2_STYLE}">Changes</h2>
  <p style="${P_STYLE}">We may update these terms as the Service evolves. Material changes will be announced via email and on this page; continued use after a change constitutes acceptance.</p>
  <h2 style="${H2_STYLE}">Contact</h2>
  <p style="${P_STYLE}">General questions: <a href="mailto:contact@marmarlabs.com" style="${LINK_STYLE}">contact@marmarlabs.com</a>. Billing or account issues: <a href="mailto:support@marmarlabs.com" style="${LINK_STYLE}">support@marmarlabs.com</a>.</p>
</div>`,
  },
};

// ---------------------------------------------------------------------------
// HTML head tag injection helpers
// ---------------------------------------------------------------------------

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function setMeta(html: string, attr: string, attrValue: string, newContent: string): string {
  const escaped = escAttr(newContent);
  const re1 = new RegExp(`(<meta[^>]*\\s${attr}="${attrValue}"[^>]*\\scontent=")[^"]*(")`);
  if (re1.test(html)) return html.replace(re1, (_match, before, after) => `${before}${escaped}${after}`);
  const re2 = new RegExp(`(<meta[^>]*\\scontent=")[^"]*("[^>]*\\s${attr}="${attrValue}")`);
  if (re2.test(html)) return html.replace(re2, (_match, before, after) => `${before}${escaped}${after}`);
  return html;
}

function setLinkHref(html: string, rel: string, newHref: string): string {
  const escaped = escAttr(newHref);
  const re1 = new RegExp(`(<link[^>]*\\srel="${rel}"[^>]*\\shref=")[^"]*(")`);
  if (re1.test(html)) return html.replace(re1, (_match, before, after) => `${before}${escaped}${after}`);
  const re2 = new RegExp(`(<link[^>]*\\shref=")[^"]*("[^>]*\\srel="${rel}")`);
  if (re2.test(html)) return html.replace(re2, (_match, before, after) => `${before}${escaped}${after}`);
  return html;
}

function setTitle(html: string, newTitle: string): string {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(newTitle)}</title>`);
}

function insertBeforeHeadClose(html: string, snippet: string): string {
  return html.replace("</head>", `${snippet}\n  </head>`);
}

function injectMetaTags(html: string, meta: Omit<RouteMeta, "bodyHtml">): string {
  let result = html;

  if (meta.title) {
    result = setTitle(result, meta.title);
    result = setMeta(result, "property", "og:title", meta.title);
    result = setMeta(result, "name", "twitter:title", meta.title);
  }
  if (meta.description) {
    result = setMeta(result, "name", "description", meta.description);
    result = setMeta(result, "property", "og:description", meta.description);
    result = setMeta(result, "name", "twitter:description", meta.description);
  }
  if (meta.canonicalUrl) {
    result = setLinkHref(result, "canonical", meta.canonicalUrl);
    result = setMeta(result, "property", "og:url", meta.canonicalUrl);
  }
  if (meta.ogImage) {
    result = setMeta(result, "property", "og:image", meta.ogImage);
    result = setMeta(result, "name", "twitter:image", meta.ogImage);
  }
  if (meta.ogImageAlt) {
    if (result.includes('property="og:image:alt"')) {
      result = setMeta(result, "property", "og:image:alt", meta.ogImageAlt);
    } else {
      result = insertBeforeHeadClose(
        result,
        `  <meta property="og:image:alt" content="${escAttr(meta.ogImageAlt)}" />`
      );
    }
  }

  // Always ensure og:locale is present — social platforms use it to
  // disambiguate language and regional formatting for link previews.
  if (result.includes('property="og:locale"')) {
    result = setMeta(result, "property", "og:locale", "en_US");
  } else {
    result = insertBeforeHeadClose(
      result,
      `  <meta property="og:locale" content="en_US" />`
    );
  }

  return result;
}

/**
 * Inject the static body HTML before <div id="root">. The #seo-static element
 * is hidden by main.tsx before React renders so users never see it, but it is
 * present in the raw HTTP response for crawlers and bots that do not run JS.
 */
function injectBodyContent(html: string, bodyHtml: string): string {
  return html.replace('<div id="root">', `${bodyHtml}\n  <div id="root">`);
}

/**
 * Replace the shared NeverGuess SoftwareApplication JSON-LD block (inherited
 * from index.html) with a route-specific JSON-LD schema object.
 *
 * The shared index.html contains a <script type="application/ld+json"> block
 * for the NeverGuess product.  For /signai and /stui those product signals are
 * wrong — crawlers would index NeverGuess schema instead of the actual product
 * on the page.  This helper strips that block and inserts the correct schema
 * before </head> so the generated per-route HTML contains accurate structured
 * data in the raw HTTP response, before any JavaScript runs.
 */
function replaceProductJsonLd(html: string, jsonLd: Record<string, unknown>): string {
  // Remove the NeverGuess-specific SoftwareApplication JSON-LD block.
  // The regex matches any application/ld+json script whose payload contains
  // "name": "NeverGuess" (with optional whitespace around the colon/value).
  const stripped = html.replace(
    /[ \t]*<script type="application\/ld\+json">[\s\S]*?"name":\s*"NeverGuess"[\s\S]*?<\/script>\n?/,
    ""
  );
  const formatted = JSON.stringify(jsonLd, null, 4)
    .split("\n")
    .map((line, i) => (i === 0 ? line : `    ${line}`))
    .join("\n");
  const scriptTag = `    <script type="application/ld+json">\n    ${formatted}\n    </script>`;
  return insertBeforeHeadClose(stripped, scriptTag);
}

// ---------------------------------------------------------------------------
// Dynamic report metadata fetching (for /r/:slug requests)
// ---------------------------------------------------------------------------

function internalApiBase(): string {
  const configured = process.env.INTERNAL_API_URL?.trim();
  if (configured) return configured;
  // Default: API server on port 8080 (see .replit [[ports]] configuration).
  return "http://localhost:8080";
}

function verdictLabel(verdict?: string): string {
  if (verdict === "block") return "BLOCKER";
  if (verdict === "caution") return "CAUTION";
  return "SAFE";
}

function verdictColor(verdict?: string): string {
  if (verdict === "block") return "#ef4444";
  if (verdict === "caution") return "#f59e0b";
  return "#22c55e";
}

type ReportApiData = {
  report: {
    verdict?: string;
    riskScore?: number;
    architectureSummary?: string | null;
    shareSlug?: string | null;
    riskyAssumptions?: Array<{ title: string; detail: string; severity: string }> | null;
    acceptanceCriteria?: Array<{ title: string; detail: string }> | null;
    rolloutNotes?: string | null;
    promptPack?: { replit?: string | null } | null;
  };
  audit: { requestedChange: string; githubUrl?: string | null; createdAt?: string };
};

async function fetchReportData(slug: string): Promise<ReportApiData | null> {
  try {
    const res = await fetch(`${internalApiBase()}/api/r/${slug}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as ReportApiData;
  } catch {
    return null;
  }
}

type ReportMeta = {
  title: string;
  description?: string;
  canonicalUrl: string;
  ogImage: string;
  ogImageAlt: string;
  bodyHtml: string;
};

function buildReportMeta(data: ReportApiData, slug: string, origin: string): ReportMeta {
  const { report, audit } = data;
  const label = verdictLabel(report.verdict);
  const color = verdictColor(report.verdict);
  const scoreSuffix =
    typeof report.riskScore === "number" ? ` · risk ${report.riskScore}/100` : "";
  const change = audit.requestedChange;
  const title = `${label}${scoreSuffix} — ${change.length > 80 ? change.slice(0, 80) + "…" : change}`;
  const description = report.architectureSummary?.slice(0, 220) ?? undefined;

  const risks = report.riskyAssumptions ?? [];
  const criteria = report.acceptanceCriteria ?? [];
  const rolloutNotes = report.rolloutNotes ?? null;
  const replitPrompt = report.promptPack?.replit ?? null;

  const risksHtml = risks.length > 0
    ? `<h2 style="${H2_STYLE}">Risky Assumptions</h2>
  <ul style="list-style:none;padding:0;margin:0 0 1.5rem">
    ${risks.map((r) => `<li style="${CARD_STYLE};${LI_STYLE}"><strong>${escAttr(r.severity.toUpperCase())} · ${escAttr(r.title)}</strong><br /><span style="color:#94a3b8;font-size:0.9rem">${escAttr(r.detail)}</span></li>`).join("\n    ")}
  </ul>`
    : "";

  const criteriaHtml = criteria.length > 0
    ? `<h2 style="${H2_STYLE}">Acceptance Criteria</h2>
  <ul style="list-style:none;padding:0;margin:0 0 1.5rem">
    ${criteria.map((c) => `<li style="${CARD_STYLE};${LI_STYLE}"><strong>${escAttr(c.title)}</strong><br /><span style="color:#94a3b8;font-size:0.9rem">${escAttr(c.detail)}</span></li>`).join("\n    ")}
  </ul>`
    : "";

  const rolloutHtml = rolloutNotes
    ? `<h2 style="${H2_STYLE}">Rollout &amp; Rollback Notes</h2>
  <p style="${P_STYLE}">${escAttr(rolloutNotes)}</p>`
    : "";

  const promptHtml = replitPrompt
    ? `<h2 style="${H2_STYLE}">Safer Prompt (Replit)</h2>
  <pre style="background:#0d0015;border:1px solid #1e293b;border-radius:0.5rem;padding:1rem;font-size:0.8rem;color:#c4b5fd;white-space:pre-wrap;overflow-x:auto;margin:0 0 1.5rem">${escAttr(replitPrompt.slice(0, 1200))}${replitPrompt.length > 1200 ? "\n…" : ""}</pre>`
    : "";

  const bodyHtml = `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 0.75rem"><a href="/neverguess" style="${LINK_STYLE}">← NeverGuess</a></p>
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;margin:0 0 0.5rem">Shared NeverGuess Report</p>
  <h1 style="${H1_STYLE}">${escAttr(change)}</h1>
  <p style="display:inline-block;padding:0.375rem 0.875rem;border-radius:9999px;font-weight:700;font-size:1rem;margin:0 0 1rem;background:${color}22;color:${color};border:1px solid ${color}44">${escAttr(label)}${escAttr(scoreSuffix)}</p>
  ${description ? `<p style="${P_STYLE}">${escAttr(description)}</p>` : ""}
  ${risksHtml}
  ${criteriaHtml}
  ${rolloutHtml}
  ${promptHtml}
  <p style="${P_STYLE}">
    <a href="/audits/new" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Run a free preflight →</a>
  </p>
</div>`;

  return {
    title,
    description,
    canonicalUrl: `${origin}/r/${slug}`,
    ogImage: `${origin}/api/r/${slug}/badge.svg`,
    ogImageAlt: `NeverGuess verdict: ${label}${scoreSuffix}`,
    bodyHtml,
  };
}

// ---------------------------------------------------------------------------
// Not-found HTML for missing /r/:slug pages
// ---------------------------------------------------------------------------

function buildNotFoundHtml(baseHtml: string): string {
  const title = "Report not found | NeverGuess";
  const description =
    "This share link was removed, expired, or never existed. Run a free preflight at NeverGuess by MarMar Labs.";
  let html = setTitle(baseHtml, title);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "name", "twitter:description", description);
  html = insertBeforeHeadClose(
    html,
    '  <meta name="robots" content="noindex, nofollow" />'
  );
  const bodyHtml = `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 0.75rem"><a href="/neverguess" style="${LINK_STYLE}">← NeverGuess</a></p>
  <h1 style="${H1_STYLE}">Report not found</h1>
  <p style="${P_STYLE}">This share link was removed, expired, or never existed.</p>
  <p style="${P_STYLE}"><a href="/audits/new" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Run a free preflight →</a></p>
  <p style="${P_STYLE}"><a href="/reports" style="${LINK_STYLE}">Browse report examples →</a></p>
</div>`;
  return injectBodyContent(html, bodyHtml);
}

// ---------------------------------------------------------------------------
// Gallery data fetching and rendering for /reports
// ---------------------------------------------------------------------------

type GalleryReportEntry = {
  slug: string;
  verdict: string;
  riskScore: number;
  requestedChange: string;
  githubRepo: string | null;
  createdAt: string;
};

async function fetchGalleryData(): Promise<GalleryReportEntry[] | null> {
  try {
    const res = await fetch(`${internalApiBase()}/api/r/gallery`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { reports?: GalleryReportEntry[] };
    return Array.isArray(data?.reports) ? data.reports : null;
  } catch {
    return null;
  }
}

function buildGalleryBodyHtml(reports: GalleryReportEntry[] | null): string {
  const items =
    reports && reports.length > 0
      ? reports.slice(0, 12).map((r) => {
          const label = verdictLabel(r.verdict);
          const color = verdictColor(r.verdict);
          const repoSuffix = r.githubRepo
            ? ` <span style="color:#64748b;font-size:0.8rem">· ${escAttr(r.githubRepo.replace(/^https?:\/\/github\.com\//, ""))}</span>`
            : "";
          return `<li style="${LI_STYLE}"><a href="/r/${escAttr(r.slug)}" style="${LINK_STYLE}"><span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:9999px;font-size:0.75rem;font-weight:700;background:${color}22;color:${color};border:1px solid ${color}44;margin-right:0.5rem">${escAttr(label)}</span>${escAttr(r.requestedChange.length > 100 ? r.requestedChange.slice(0, 100) + "…" : r.requestedChange)}</a>${repoSuffix}</li>`;
        })
      : [
          `<li style="${LI_STYLE}"><a href="/r/next-isr" style="${LINK_STYLE}"><span style="display:inline-block;padding:0.15rem 0.5rem;border-radius:9999px;font-size:0.75rem;font-weight:700;background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;margin-right:0.5rem">CAUTION</span>Enable Next.js ISR on product listing page</a> <span style="color:#64748b;font-size:0.8rem">· next.js</span></li>`,
        ];

  return `<div id="seo-static" style="${BODY_STYLE}">
  <p style="margin:0 0 0.75rem"><a href="/neverguess" style="${LINK_STYLE}">← NeverGuess</a></p>
  <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#7c3aed;margin:0 0 0.5rem">Report Examples</p>
  <h1 style="${H1_STYLE}">NeverGuess report examples</h1>
  <p style="${P_STYLE}">Preflight examples. Each report includes verdict, risk score, architecture summary, risky assumptions, acceptance criteria, safer prompts, and rollout notes.</p>
  <ul style="list-style:none;padding:0;margin:0 0 1.5rem">
    ${items.join("\n    ")}
  </ul>
  <p style="${P_STYLE}"><a href="/audits/new" style="display:inline-block;padding:0.625rem 1.25rem;background:#7c3aed;color:#fff;text-decoration:none;border-radius:0.375rem">Run a free preflight →</a></p>
</div>`;
}

async function handleGalleryRequest(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  getBaseHtml: () => string | null,
  transformHtml?: (html: string) => Promise<string>
): Promise<void> {
  const url = req.url ?? "/";
  const pathname = getPathname(url);
  if (pathname !== "/reports") {
    next();
    return;
  }

  const baseHtmlRaw = getBaseHtml();
  if (!baseHtmlRaw) {
    next();
    return;
  }

  const reports = await fetchGalleryData();
  const staticMeta = ROUTE_METADATA["/reports"];
  const baseHtml = transformHtml ? await transformHtml(baseHtmlRaw) : baseHtmlRaw;
  let html = injectMetaTags(baseHtml, staticMeta);
  html = injectBodyContent(html, buildGalleryBodyHtml(reports));

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

// ---------------------------------------------------------------------------
// Shared middleware logic for /r/:slug
// ---------------------------------------------------------------------------

function getPathname(url: string): string {
  const raw = (url.split("?")[0] || "/").split("#")[0] || "/";
  return raw === "/" ? "/" : raw.replace(/\/$/, "");
}

async function handleReportRequest(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  getBaseHtml: () => string | null,
  originHint: string,
  transformHtml?: (html: string) => Promise<string>
): Promise<void> {
  const url = req.url ?? "/";
  const pathname = getPathname(url);
  const reportMatch = pathname.match(/^\/r\/([^/]+)$/);
  if (!reportMatch) {
    next();
    return;
  }
  const slug = reportMatch[1];

  const baseHtmlRaw = getBaseHtml();
  if (!baseHtmlRaw) {
    next();
    return;
  }

  const data = await fetchReportData(slug);
  if (!data) {
    // Report not found or API unavailable — return a proper 404 with noindex
    // so crawlers see "report unavailable" rather than homepage metadata.
    const baseHtml = transformHtml ? await transformHtml(baseHtmlRaw) : baseHtmlRaw;
    const notFoundHtml = buildNotFoundHtml(baseHtml);
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(notFoundHtml);
    return;
  }

  const origin = process.env.PUBLIC_APP_URL?.trim() || originHint;
  const meta = buildReportMeta(data, slug, origin);

  const baseHtml = transformHtml ? await transformHtml(baseHtmlRaw) : baseHtmlRaw;
  let html = injectMetaTags(baseHtml, meta);
  html = injectBodyContent(html, meta.bodyHtml);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------

export function metaInjectPlugin(): Plugin {
  let resolvedOutDir = "";
  let resolvedRoot = "";

  return {
    name: "meta-inject",
    enforce: "pre",

    configResolved(config: ResolvedConfig) {
      resolvedOutDir = config.build.outDir;
      resolvedRoot = config.root;
    },

    // -----------------------------------------------------------------------
    // Dev server: intercept /r/:slug to inject dynamic report metadata.
    // Marketing routes are not intercepted here — in dev mode React hydrates
    // immediately and the SEO impact is in the build output, not dev mode.
    // We use the `return () => {}` pattern so our middleware runs AFTER
    // Vite's internal middleware (including the index.html transform pass).
    // -----------------------------------------------------------------------
    configureServer(server) {
      return () => {
        const sourceIndexPath = path.join(resolvedRoot, "index.html");
        const originHint = `http://localhost:${process.env.PORT ?? "8081"}`;

        server.middlewares.use(async (req, res, next) => {
          await handleGalleryRequest(
            req,
            res,
            next,
            () => {
              if (!fs.existsSync(sourceIndexPath)) return null;
              return fs.readFileSync(sourceIndexPath, "utf-8");
            },
            (html) => server.transformIndexHtml(req.url ?? "/", html)
          );
        });

        server.middlewares.use(async (req, res, next) => {
          await handleReportRequest(
            req,
            res,
            next,
            () => {
              if (!fs.existsSync(sourceIndexPath)) return null;
              return fs.readFileSync(sourceIndexPath, "utf-8");
            },
            originHint,
            (html) => server.transformIndexHtml(req.url ?? "/", html)
          );
        });
      };
    },

    // -----------------------------------------------------------------------
    // Preview server (vite preview — the production runtime for this Replit
    // autoscale application): handles /r/:slug with dynamic metadata fetched
    // from the internal API. Marketing routes are served by sirv directly
    // from the per-route HTML files generated by writeBundle.
    // -----------------------------------------------------------------------
    configurePreviewServer(server) {
      const builtIndexPath = path.join(resolvedOutDir, "index.html");
      const originHint = process.env.PUBLIC_APP_URL?.trim() || "https://marmarlabs.com";

      server.middlewares.use(async (req, res, next) => {
        await handleGalleryRequest(
          req,
          res,
          next,
          () => {
            if (!fs.existsSync(builtIndexPath)) return null;
            return fs.readFileSync(builtIndexPath, "utf-8");
          }
        );
      });

      server.middlewares.use(async (req, res, next) => {
        await handleReportRequest(
          req,
          res,
          next,
          () => {
            if (!fs.existsSync(builtIndexPath)) return null;
            return fs.readFileSync(builtIndexPath, "utf-8");
          },
          originHint
        );
      });
    },

    // -----------------------------------------------------------------------
    // Post-build: generate a per-route index.html for every known marketing
    // route so static-file servers (sirv, nginx, CDN) serve route-specific
    // metadata AND body content without any runtime processing.
    //
    // Each generated file contains:
    //   1. Route-specific <title>, description, canonical, og:*, twitter:*
    //   2. A #seo-static <div> with route-specific h1, description, and
    //      key content — visible to all crawlers before JavaScript runs.
    //      main.tsx hides this element on mount so users never see the flash.
    //
    // Each non-root route is written twice:
    //   - /route/index.html supports directory-style /route/ requests.
    //   - /route.html supports no-trailing-slash /route requests in Vite/sirv,
    //     matching the canonical URLs and sitemap entries.
    // -----------------------------------------------------------------------
    writeBundle() {
      const indexPath = path.join(resolvedOutDir, "index.html");
      if (!fs.existsSync(indexPath)) {
        console.warn("[meta-inject] dist index.html not found; skipping per-route generation");
        return;
      }

      const baseHtml = fs.readFileSync(indexPath, "utf-8");
      let count = 0;

      for (const [route, meta] of Object.entries(ROUTE_METADATA)) {
        let html = injectMetaTags(baseHtml, meta);
        html = injectBodyContent(html, meta.bodyHtml);
        if (meta.jsonLd) {
          html = replaceProductJsonLd(html, meta.jsonLd);
        }

        if (route === "/") {
          // Root: update index.html in place
          fs.writeFileSync(indexPath, html);
          continue;
        }

        // Strip leading slash so path.join produces a sub-directory path,
        // not an absolute system path (path.resolve would be even clearer,
        // but path.join with a relative segment is conventional here).
        const relRoute = route.replace(/^\//, "");
        const routeDir = path.join(resolvedOutDir, relRoute);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.writeFileSync(path.join(routeDir, "index.html"), html);

        const routeFile = path.join(resolvedOutDir, `${relRoute}.html`);
        fs.mkdirSync(path.dirname(routeFile), { recursive: true });
        fs.writeFileSync(routeFile, html);
        count++;
      }

      console.log(`[meta-inject] Generated SEO HTML for ${count} routes in ${resolvedOutDir}`);
    },
  };
}
