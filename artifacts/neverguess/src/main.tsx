import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted variable fonts (no external CDN request). Bricolage Grotesque is
// the editorial display face, Geist the body/UI face, JetBrains Mono the
// data/code face. Importing only the weight axis keeps the payload lean.
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./index.css";

// Hide the static SEO fallback content injected by meta-inject-plugin at
// build time. That element (#seo-static) is included in every per-route
// index.html so crawlers and AI bots see meaningful body content before any
// JavaScript runs. We remove it here, synchronously, before React renders so
// users never see a flash of the unstyled static fallback.
const staticEl = document.getElementById("seo-static");
if (staticEl) staticEl.remove();

createRoot(document.getElementById("root")!).render(<App />);
