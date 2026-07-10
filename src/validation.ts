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
