import { DEFAULT_QR_SETTINGS } from "./qr/qrConfig";
import type { AppMode, PersistedAppState, QRSettings } from "./shared/types";
import { clampNumber, isHexColor } from "./validation";

const STORAGE_KEY = "qr-code-studio-settings-v2";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeQrSettings(value: unknown): QRSettings {
  if (!isRecord(value)) {
    return structuredClone(DEFAULT_QR_SETTINGS);
  }

  const payloads = isRecord(value.payloads)
    ? {
        ...DEFAULT_QR_SETTINGS.payloads,
        ...value.payloads,
      }
    : DEFAULT_QR_SETTINGS.payloads;

  return {
    ...structuredClone(DEFAULT_QR_SETTINGS),
    ...value,
    payloads,
    width: clampNumber(value.width, 160, 900, DEFAULT_QR_SETTINGS.width),
    height: clampNumber(value.height, 160, 900, DEFAULT_QR_SETTINGS.height),
    margin: clampNumber(value.margin, 0, 80, DEFAULT_QR_SETTINGS.margin),
    imageSize: clampNumber(value.imageSize, 0.05, 0.35, DEFAULT_QR_SETTINGS.imageSize),
    imageMargin: clampNumber(value.imageMargin, 0, 30, DEFAULT_QR_SETTINGS.imageMargin),
    gradientRotation: clampNumber(value.gradientRotation, 0, 360, DEFAULT_QR_SETTINGS.gradientRotation),
    jpegQuality: clampNumber(value.jpegQuality, 0.6, 1, DEFAULT_QR_SETTINGS.jpegQuality),
    dotsColor: isHexColor(value.dotsColor) ? value.dotsColor : DEFAULT_QR_SETTINGS.dotsColor,
    backgroundColor: isHexColor(value.backgroundColor) ? value.backgroundColor : DEFAULT_QR_SETTINGS.backgroundColor,
    cornerSquareColor: isHexColor(value.cornerSquareColor) ? value.cornerSquareColor : DEFAULT_QR_SETTINGS.cornerSquareColor,
    cornerDotColor: isHexColor(value.cornerDotColor) ? value.cornerDotColor : DEFAULT_QR_SETTINGS.cornerDotColor,
    gradientColor1: isHexColor(value.gradientColor1) ? value.gradientColor1 : DEFAULT_QR_SETTINGS.gradientColor1,
    gradientColor2: isHexColor(value.gradientColor2) ? value.gradientColor2 : DEFAULT_QR_SETTINGS.gradientColor2,
  } as QRSettings;
}

export function loadSettings(): PersistedAppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { mode: "qr", qr: structuredClone(DEFAULT_QR_SETTINGS) };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    const mode: AppMode = parsed.mode === "barcode" || parsed.mode === "scanner" ? parsed.mode : "qr";
    return { mode, qr: mergeQrSettings(parsed.qr) };
  } catch {
    return { mode: "qr", qr: structuredClone(DEFAULT_QR_SETTINGS) };
  }
}

export function saveSettings(settings: PersistedAppState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function loadSettingsFromStorage(storage: Pick<Storage, "getItem">): PersistedAppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? { mode: "qr", qr: mergeQrSettings((JSON.parse(raw) as PersistedAppState).qr) } : { mode: "qr", qr: structuredClone(DEFAULT_QR_SETTINGS) };
  } catch {
    return { mode: "qr", qr: structuredClone(DEFAULT_QR_SETTINGS) };
  }
}
