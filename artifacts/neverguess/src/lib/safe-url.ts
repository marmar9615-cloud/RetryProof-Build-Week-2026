/**
 * Forgiving URL parsing helpers. Audit rows can carry malformed or empty
 * github/live URLs (legacy data, partial saves), and `new URL(bad)` throws —
 * which would crash a render. These return a sensible fallback instead.
 */

/** Hostname for a URL, or the raw value if it isn't a parseable URL. */
export function safeUrlHost(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

/** Path (leading slash stripped) for a URL, or the raw value if unparseable. */
export function safeUrlPath(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return new URL(value).pathname.replace(/^\//, "");
  } catch {
    return value;
  }
}
