import type { ScanResult, ScanSource } from "../shared/types";

type BarcodeDetectorResult = {
  rawValue: string;
  format: string;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor & {
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

export const REQUESTED_DETECTOR_FORMATS = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"];

export function hasBarcodeDetector(): boolean {
  return typeof window !== "undefined" && typeof window.BarcodeDetector === "function";
}

export async function getSupportedDetectorFormats(): Promise<string[]> {
  if (!hasBarcodeDetector()) {
    return [];
  }

  try {
    return window.BarcodeDetector?.getSupportedFormats ? await window.BarcodeDetector.getSupportedFormats() : REQUESTED_DETECTOR_FORMATS;
  } catch {
    return REQUESTED_DETECTOR_FORMATS;
  }
}

export async function detectWithBarcodeDetector(source: CanvasImageSource, scanSource: ScanSource): Promise<ScanResult[]> {
  if (!hasBarcodeDetector()) {
    return [];
  }

  const supported = await getSupportedDetectorFormats();
  const formats = REQUESTED_DETECTOR_FORMATS.filter((format) => supported.length === 0 || supported.includes(format));
  const detector = new window.BarcodeDetector!({ formats: formats.length ? formats : REQUESTED_DETECTOR_FORMATS });
  const detected = await detector.detect(source);

  return detected.map((result) => ({
    format: result.format,
    value: result.rawValue,
    source: scanSource,
  }));
}
