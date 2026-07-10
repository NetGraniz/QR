import jsQR from "jsqr";
import type { ScanOutcome, ScanResult, ScanSource } from "../shared/types";
import { isSafeOpenUrl, normalizeUrl } from "../shared/security";
import { detectWithBarcodeDetector, hasBarcodeDetector } from "./barcodeDetector";
import { imageToImageData, loadImageFile } from "./imageInput";

export async function scanImageFile(file: File): Promise<{ outcome: ScanOutcome; previewUrl: string }> {
  const loaded = await loadImageFile(file);
  const outcome = await scanImageSource(loaded.image, loaded.imageData, "image");
  return { outcome, previewUrl: loaded.objectUrl };
}

export async function scanImageSource(source: CanvasImageSource, imageData: ImageData, scanSource: ScanSource): Promise<ScanOutcome> {
  const detectorAvailable = hasBarcodeDetector();
  let detectorResults: ScanResult[] = [];

  if (detectorAvailable) {
    try {
      detectorResults = await detectWithBarcodeDetector(source, scanSource);
    } catch {
      detectorResults = [];
    }
  }

  if (detectorResults.length > 0) {
    return {
      results: detectorResults,
      detectorAvailable,
      fallbackUsed: false,
      message: "Код успешно распознан",
    };
  }

  const fallbackResult = scanQrFromImageData(imageData, scanSource);
  if (fallbackResult) {
    return {
      results: [fallbackResult],
      detectorAvailable,
      fallbackUsed: true,
      message: "QR-код успешно распознан",
    };
  }

  return {
    results: [],
    detectorAvailable,
    fallbackUsed: !detectorAvailable,
    message: detectorAvailable ? "Код не удалось распознать" : "Автоматическая проверка недоступна в этом браузере для штрихкодов. QR-код не удалось распознать через резервный модуль.",
  };
}

export async function scanVideoFrame(video: HTMLVideoElement): Promise<ScanOutcome> {
  if (!hasBarcodeDetector()) {
    return {
      results: [],
      detectorAvailable: false,
      fallbackUsed: false,
      message: "Сканирование с камеры недоступно: браузер не поддерживает BarcodeDetector.",
    };
  }

  const results = await detectWithBarcodeDetector(video, "camera");
  return {
    results,
    detectorAvailable: true,
    fallbackUsed: false,
    message: results.length > 0 ? "Код успешно распознан" : "Код не удалось распознать",
  };
}

export async function verifyQrPreview(container: HTMLElement, expectedValue: string): Promise<ScanOutcome> {
  const svg = container.querySelector("svg");
  const canvas = container.querySelector("canvas");

  if (canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return unavailableVerificationOutcome();
    }
    return scanImageSource(canvas, context.getImageData(0, 0, canvas.width, canvas.height), "auto");
  }

  if (!svg) {
    return unavailableVerificationOutcome();
  }

  const image = await svgToImage(svg);
  const outcome = await scanImageSource(image, imageToImageData(image), "auto");
  if (outcome.results.length > 0 && outcome.results[0].value !== expectedValue) {
    return { ...outcome, message: "QR-код распознан, но значение отличается от исходных данных" };
  }
  return outcome;
}

export function getSafeOpenUrl(value: string): string | null {
  const trimmed = value.trim();
  const looksLikeUrl = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed);
  if (!looksLikeUrl) {
    return null;
  }
  const normalized = normalizeUrl(value);
  return isSafeOpenUrl(normalized) ? normalized : null;
}

function scanQrFromImageData(imageData: ImageData, source: ScanSource): ScanResult | null {
  const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
  return result ? { format: "qr_code", value: result.data, source } : null;
}

function unavailableVerificationOutcome(): ScanOutcome {
  return {
    results: [],
    detectorAvailable: hasBarcodeDetector(),
    fallbackUsed: false,
    message: "Автоматическая проверка недоступна в этом браузере.",
  };
}

function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const width = Number(svg.getAttribute("width")) || Math.ceil(svg.getBoundingClientRect().width) || 300;
    const height = Number(svg.getAttribute("height")) || Math.ceil(svg.getBoundingClientRect().height) || 300;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось подготовить QR-код для проверки."));
    });
    image.src = url;
  });
}
