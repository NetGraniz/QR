import { DEFAULT_SETTINGS, QRStudioSettings } from "./qrConfig";
import { clampNumber, isDownloadFormat, isHexColor, isKnownCornerDotType, isKnownCornerSquareType, isKnownDotType } from "./validation";

const STORAGE_KEY = "qr-code-studio-settings";

export function loadSettings(): QRStudioSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<QRStudioSettings>;

    return {
      ...DEFAULT_SETTINGS,
      data: typeof parsed.data === "string" ? parsed.data : DEFAULT_SETTINGS.data,
      width: clampNumber(parsed.width, 160, 900, DEFAULT_SETTINGS.width),
      height: clampNumber(parsed.height, 160, 900, DEFAULT_SETTINGS.height),
      margin: clampNumber(parsed.margin, 0, 80, DEFAULT_SETTINGS.margin),
      dotsColor: isHexColor(parsed.dotsColor) ? parsed.dotsColor : DEFAULT_SETTINGS.dotsColor,
      backgroundColor: isHexColor(parsed.backgroundColor) ? parsed.backgroundColor : DEFAULT_SETTINGS.backgroundColor,
      cornersColor: isHexColor(parsed.cornersColor) ? parsed.cornersColor : DEFAULT_SETTINGS.cornersColor,
      dotsType: isKnownDotType(parsed.dotsType) ? parsed.dotsType : DEFAULT_SETTINGS.dotsType,
      cornersSquareType: isKnownCornerSquareType(parsed.cornersSquareType)
        ? parsed.cornersSquareType
        : DEFAULT_SETTINGS.cornersSquareType,
      cornersDotType: isKnownCornerDotType(parsed.cornersDotType) ? parsed.cornersDotType : DEFAULT_SETTINGS.cornersDotType,
      imageSize: clampNumber(parsed.imageSize, 0.05, 0.35, DEFAULT_SETTINGS.imageSize),
      imageMargin: clampNumber(parsed.imageMargin, 0, 30, DEFAULT_SETTINGS.imageMargin),
      hideBackgroundDots:
        typeof parsed.hideBackgroundDots === "boolean" ? parsed.hideBackgroundDots : DEFAULT_SETTINGS.hideBackgroundDots,
      downloadFormat: isDownloadFormat(parsed.downloadFormat) ? parsed.downloadFormat : DEFAULT_SETTINGS.downloadFormat,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: QRStudioSettings): void {
  const settingsWithoutLogo = { ...settings };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsWithoutLogo));
}
