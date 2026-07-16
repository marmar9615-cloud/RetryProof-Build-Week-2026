import { useEffect } from "react";

type MetaInputs = {
  title?: string | null;
  description?: string | null;
  /** Absolute URL the page should canonicalize to. */
  canonicalUrl?: string | null;
  /** Absolute URL of the social-share image. */
  ogImage?: string | null;
  /** Optional extra `og:image:alt` text. */
  ogImageAlt?: string | null;
};

function setOrCreateMeta(selector: string, attr: "name" | "property", value: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLinkHref(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Update document.title plus OpenGraph + Twitter meta tags so that when a
 * shared page (e.g. /r/<slug>) is unfurled in Slack / Twitter / Discord /
 * LinkedIn the preview shows verdict-specific copy and image.
 *
 * Tag updates are idempotent — if a tag is already present we mutate its
 * `content`, otherwise we create one. On unmount we restore the previous
 * values so navigation between routes doesn't leak stale meta.
 */
export function useMetaTags({ title, description, canonicalUrl, ogImage, ogImageAlt }: MetaInputs) {
  useEffect(() => {
    const previousTitle = document.title;
    const tagSnapshot: Array<{ selector: string; previous: string | null }> = [];

    const apply = (selector: string, attr: "name" | "property", value: string, content: string) => {
      const before = document.head.querySelector<HTMLMetaElement>(selector);
      tagSnapshot.push({ selector, previous: before?.getAttribute("content") ?? null });
      setOrCreateMeta(selector, attr, value, content);
    };

    const linkSnapshot: Array<{ rel: string; previous: string | null }> = [];
    const applyLink = (rel: string, href: string) => {
      const before = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      linkSnapshot.push({ rel, previous: before?.getAttribute("href") ?? null });
      setLinkHref(rel, href);
    };

    if (title) {
      document.title = title;
      apply("meta[property='og:title']", "property", "og:title", title);
      apply("meta[name='twitter:title']", "name", "twitter:title", title);
    }
    if (description) {
      apply("meta[name='description']", "name", "description", description);
      apply("meta[property='og:description']", "property", "og:description", description);
      apply("meta[name='twitter:description']", "name", "twitter:description", description);
    }
    if (canonicalUrl) {
      apply("meta[property='og:url']", "property", "og:url", canonicalUrl);
      applyLink("canonical", canonicalUrl);
    }
    if (ogImage) {
      apply("meta[property='og:image']", "property", "og:image", ogImage);
      apply("meta[name='twitter:image']", "name", "twitter:image", ogImage);
      apply("meta[name='twitter:card']", "name", "twitter:card", "summary_large_image");
    }
    if (ogImageAlt) {
      apply("meta[property='og:image:alt']", "property", "og:image:alt", ogImageAlt);
    }

    // Always pin og:locale so social platforms can resolve language and
    // regional formatting without guessing.
    apply("meta[property='og:locale']", "property", "og:locale", "en_US");

    // Always pin the X handle so unfurls credit MarMar Labs even on pages
    // that didn't pass an explicit value. Both `site` (publishing org) and
    // `creator` (post author) use the same handle since the company is
    // currently one person.
    apply("meta[name='twitter:site']", "name", "twitter:site", "@MarMarLabs");
    apply("meta[name='twitter:creator']", "name", "twitter:creator", "@MarMarLabs");

    return () => {
      document.title = previousTitle;
      for (const { selector, previous } of tagSnapshot) {
        const el = document.head.querySelector<HTMLMetaElement>(selector);
        if (el && previous !== null) el.setAttribute("content", previous);
      }
      for (const { rel, previous } of linkSnapshot) {
        const el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (el && previous !== null) el.setAttribute("href", previous);
      }
    };
  }, [title, description, canonicalUrl, ogImage, ogImageAlt]);
}
