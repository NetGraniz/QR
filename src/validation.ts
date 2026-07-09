import type { CornerDotType, CornerSquareType, DotType } from "qr-code-styling";
import { CORNER_DOT_TYPES, CORNER_SQUARE_TYPES, DOT_TYPES, DOWNLOAD_FORMATS, DownloadFormat } from "./qrConfig";

export type ScanWarning = {
  type: "contrast" | "logo" | "size";
  message: string;
};

const SUPPORTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function isKnownDotType(value: unknown): value is DotType {
  return typeof value === "string" && DOT_TYPES.includes(value as DotType);
}

export function isKnownCornerSquareType(value: unknown): value is CornerSquareType {
  return typeof value === "string" && CORNER_SQUARE_TYPES.includes(value as CornerSquareType);
}

export function isKnownCornerDotType(value: unknown): value is CornerDotType {
  return typeof value === "string" && CORNER_DOT_TYPES.includes(value as CornerDotType);
}

export function isDownloadFormat(value: unknown): value is DownloadFormat {
  return typeof value === "string" && DOWNLOAD_FORMATS.includes(value as DownloadFormat);
}

export function validateLogoFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const hasSupportedExtension = extension ? ["png", "jpg", "jpeg", "svg"].includes(extension) : false;

  if (!SUPPORTED_LOGO_TYPES.includes(file.type) && !hasSupportedExtension) {
    return "Поддерживаются только PNG, JPG, JPEG и SVG.";
  }

  if (file.size > 2 * 1024 * 1024) {
    return "Файл логотипа слишком большой. Выберите изображение до 2 МБ.";
  }

  return null;
}

export function getRelativeLuminance(hexColor: string): number {
  const channels = hexColor
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

  if (!channels || channels.length !== 3) {
    return 0;
  }

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getContrastRatio(firstColor: string, secondColor: string): number {
  const firstLuminance = getRelativeLuminance(firstColor);
  const secondLuminance = getRelativeLuminance(secondColor);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

export function buildScanWarnings(settings: {
  dotsColor: string;
  backgroundColor: string;
  imageSize: number;
  width: number;
  height: number;
  hasLogo?: boolean;
}): ScanWarning[] {
  const warnings: ScanWarning[] = [];
  const contrastRatio = getContrastRatio(settings.dotsColor, settings.backgroundColor);
  const dotLuminance = getRelativeLuminance(settings.dotsColor);
  const backgroundLuminance = getRelativeLuminance(settings.backgroundColor);

  if (contrastRatio < 3.5 || dotLuminance > 0.72 || backgroundLuminance < 0.2) {
    warnings.push({
      type: "contrast",
      message: "QR-код может плохо сканироваться. Увеличьте контраст или уменьшите логотип.",
    });
  }

  if (settings.hasLogo && settings.imageSize > 0.27) {
    warnings.push({
      type: "logo",
      message: "QR-код может плохо сканироваться. Увеличьте контраст или уменьшите логотип.",
    });
  }

  if (settings.width < 220 || settings.height < 220) {
    warnings.push({
      type: "size",
      message: "QR-код может плохо сканироваться. Увеличьте контраст или уменьшите логотип.",
    });
  }

  return warnings;
}
