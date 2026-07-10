export function sanitizeFileName(input: string, fallback = "qr-code"): string {
  const cleaned = input
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}
