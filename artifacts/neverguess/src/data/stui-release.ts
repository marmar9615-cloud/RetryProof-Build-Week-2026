export const STUI_RELEASE = {
  version: "2.2.0",
  tag: "v2.2.0",
  releaseDate: "July 11, 2026",
  releaseDateIso: "2026-07-11",
  installCommand: "python -m pip install --upgrade stui-terminal==2.2.0",
  pypiUrl: "https://pypi.org/project/stui-terminal/",
  repositoryUrl: "https://github.com/marmar9615-cloud/stui-terminal",
  releaseUrl:
    "https://github.com/marmar9615-cloud/stui-terminal/releases/tag/v2.2.0",
} as const;

export const STUI_DESCRIPTION =
  "stui turns ordinary Python scripts into terminal-native apps with stateful reruns. Version 2.2 adds process-local caching, multiline input, and a multi-file watch loop without a browser or local server.";

export const STUI_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://marmarlabs.com/stui#software",
  name: "stui",
  applicationCategory: "DeveloperApplication",
  url: "https://marmarlabs.com/stui",
  downloadUrl: STUI_RELEASE.pypiUrl,
  codeRepository: STUI_RELEASE.repositoryUrl,
  publisher: {
    "@type": "Organization",
    name: "MarMar Labs",
    url: "https://marmarlabs.com/",
  },
  description: STUI_DESCRIPTION,
  softwareVersion: STUI_RELEASE.version,
  runtimePlatform: "Python 3.11+",
  programmingLanguage: "Python",
  license: "https://opensource.org/licenses/MIT",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
} satisfies Record<string, unknown>;
