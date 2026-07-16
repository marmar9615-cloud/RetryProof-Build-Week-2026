export const RETRYPROOF = {
  appUrl: "https://marmarlabs.com/retryproof/lab",
  repositoryUrl: "https://github.com/marmar9615-cloud/Copilot-Checker",
  productUrl: "https://marmarlabs.com/retryproof",
  title: "RetryProof — Workflow flight tests for retry failures",
  labModeLabel: "Synthetic execution",
  repairModeLabel: "Live Codex · deterministic gate",
  description:
    "Import an n8n workflow, approve a concrete invariant, and prove how it behaves under deterministic retry and crash scenarios before shipping it.",
  boundary:
    "RetryProof verifies approved invariants under declared fault models. It does not claim exactly-once execution or production safety.",
} as const;

export const RETRYPROOF_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RetryProof",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: RETRYPROOF.productUrl,
  codeRepository: RETRYPROOF.repositoryUrl,
  description: RETRYPROOF.description,
  publisher: {
    "@type": "Organization",
    name: "MarMar Labs",
    url: "https://marmarlabs.com/",
  },
} as const;
