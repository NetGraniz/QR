const ALLOWED_TEMPLATE_KEYS = new Set([
  "name",
  "dotsColor",
  "backgroundColor",
  "transparentBackground",
  "gradientMode",
  "gradientColor1",
  "gradientColor2",
  "gradientRotation",
  "cornerSquareColor",
  "cornerDotColor",
  "dotsType",
  "cornersSquareType",
  "cornersDotType",
  "errorCorrectionLevel",
  "downloadFormat",
  "exportScale",
  "jpegQuality",
  "frame",
  "caption",
]);

export function sanitizeTemplateImport(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Некорректный JSON шаблона.");
  }

  const result: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (ALLOWED_TEMPLATE_KEYS.has(key)) {
      result[key] = fieldValue;
    }
  }

  return result;
}
