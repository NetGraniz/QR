const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);
const SAFE_OPEN_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function isSafeUrl(input: string): boolean {
  try {
    const url = new URL(normalizeUrl(input));
    return SAFE_URL_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function isSafeOpenUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return SAFE_OPEN_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeSvg(svg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  doc.querySelectorAll("script, iframe, object, embed, link").forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:") || value.startsWith("data:text/html")) {
        node.removeAttribute(attribute.name);
      }
      if ((name === "href" || name === "xlink:href") && /^(https?:)?\/\//.test(value)) {
        node.removeAttribute(attribute.name);
      }
    }
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}
