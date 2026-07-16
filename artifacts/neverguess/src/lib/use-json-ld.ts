import { useEffect } from "react";

/**
 * Inject a JSON-LD <script> block into <head> for the duration of the
 * component's lifetime.  On unmount the script element is removed so
 * navigating between routes never leaves stale structured data in the DOM.
 *
 * Pass a plain object — it will be serialised with JSON.stringify internally.
 */
export function useJsonLd(data: Record<string, unknown>) {
  const serialized = JSON.stringify(data);

  useEffect(() => {
    const routeData = JSON.parse(serialized) as Record<string, unknown>;
    let hasMatchingStaticJsonLd = false;

    for (const script of Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]',
      ),
    )) {
      if (script.dataset.routeJsonld === "true") continue;
      try {
        const existing = JSON.parse(script.textContent ?? "{}") as Record<
          string,
          unknown
        >;
        const sameRoute =
          existing["@type"] === routeData["@type"] &&
          existing["name"] === routeData["name"] &&
          (!routeData["url"] || existing["url"] === routeData["url"]) &&
          (!routeData["@id"] || existing["@id"] === routeData["@id"]);

        if (!sameRoute) continue;
        if (JSON.stringify(existing) === serialized) {
          hasMatchingStaticJsonLd = true;
          break;
        }

        script.remove();
      } catch {
        continue;
      }
    }

    if (hasMatchingStaticJsonLd) return;

    const script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-route-jsonld", "true");
    script.textContent = serialized;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [serialized]);
}
