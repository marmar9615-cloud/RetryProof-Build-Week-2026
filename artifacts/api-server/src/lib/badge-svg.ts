export type BadgeInputs = {
  verdict: "safe" | "caution" | "block" | string | null;
  score: number | null;
};

const VERDICT_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  safe: { bg: "#10b981", fg: "#03150e", label: "SAFE" },
  caution: { bg: "#facc15", fg: "#1f1500", label: "CAUTION" },
  block: { bg: "#ef4444", fg: "#1a0303", label: "BLOCK" },
};

const LEFT_BG = "#08001a";
const LEFT_FG = "#c084fc";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderVerdictBadge({ verdict, score }: BadgeInputs): string {
  const v = (verdict ?? "safe").toLowerCase();
  const colors = VERDICT_COLORS[v] ?? VERDICT_COLORS.safe;
  const right = score === null ? colors.label : `${colors.label} · ${Math.max(0, Math.min(100, score))}`;
  const left = "neverguess";
  const rightLabel = escapeXml(right);
  const leftLabel = escapeXml(left);

  // Approximate text widths for our font stack at 11px.
  const charPx = 6.4;
  const padding = 14;
  const leftWidth = Math.ceil(left.length * charPx + padding);
  const rightWidth = Math.ceil(right.length * charPx + padding);
  const total = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="22" role="img" aria-label="${leftLabel}: ${rightLabel}">
  <title>${leftLabel}: ${rightLabel}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".06"/>
    <stop offset="1" stop-color="#000" stop-opacity=".25"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="22" rx="4" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="22" fill="${LEFT_BG}"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="22" fill="${colors.bg}"/>
    <rect width="${total}" height="22" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="11" font-weight="700">
    <text x="${leftWidth / 2}" y="15" fill="${LEFT_FG}">${leftLabel}</text>
    <text x="${leftWidth + rightWidth / 2}" y="15" fill="${colors.fg}">${rightLabel}</text>
  </g>
</svg>`;
}
