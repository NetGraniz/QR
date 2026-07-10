import JSZip from "jszip";
import QRCodeStyling from "qr-code-styling";
import JsBarcode from "jsbarcode";
import type { BarcodeSettings, QRSettings } from "../shared/types";
import { sanitizeFileName } from "../shared/fileNames";
import { buildQrOptions } from "../qr/qrConfig";
import { configureQrUtf8Encoding } from "../qr/qrEncoding";
import { getJsBarcodeFormat } from "../barcode/barcodeConfig";
import { validateBarcode } from "../barcode/barcodeValidation";

configureQrUtf8Encoding();

export type BatchCodeKind = "qr" | "barcode";
export type BatchExportFormat = "png" | "svg";
export type BatchRecord = Record<string, string>;

export type BatchExportOptions = {
  records: BatchRecord[];
  valueColumn: string;
  fileNameColumn: string;
  kind: BatchCodeKind;
  format: BatchExportFormat;
  qrSettings: QRSettings;
  barcodeSettings: BarcodeSettings;
  onProgress?: (done: number, total: number) => void;
};

export async function buildBatchZip(options: BatchExportOptions): Promise<Blob> {
  const zip = new JSZip();
  const records = options.records.slice(0, 500);

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const value = String(record[options.valueColumn] ?? "").trim();
    if (!value) continue;

    const baseName = sanitizeFileName(String(record[options.fileNameColumn] || `${options.kind}-${index + 1}`), `${options.kind}-${index + 1}`);
    const blob = options.kind === "qr"
      ? await buildQrBlob(value, options.qrSettings, options.format)
      : await buildBarcodeBlob(value, options.barcodeSettings, options.format);
    zip.file(`${baseName}.${options.format}`, blob);
    options.onProgress?.(index + 1, records.length);
  }

  return zip.generateAsync({ type: "blob" });
}

async function buildQrBlob(value: string, settings: QRSettings, format: BatchExportFormat): Promise<Blob> {
  const qr = new QRCodeStyling(buildQrOptions({ ...settings, downloadFormat: format }, value));
  const raw = await qr.getRawData(format);
  if (!raw) {
    throw new Error("Не удалось создать QR-код.");
  }
  if (raw instanceof Blob) {
    return raw;
  }
  if (typeof raw === "string") {
    return new Blob([raw], { type: format === "svg" ? "image/svg+xml" : "image/png" });
  }
  const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : copyToArrayBuffer(raw);
  return new Blob([bytes], { type: format === "svg" ? "image/svg+xml" : "image/png" });
}

function copyToArrayBuffer(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy;
}

async function buildBarcodeBlob(value: string, settings: BarcodeSettings, format: BatchExportFormat): Promise<Blob> {
  const validation = validateBarcode(settings.format, value);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Некорректный штрихкод.");
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, validation.value, {
    format: getJsBarcodeFormat(settings.format),
    width: settings.width,
    height: settings.height,
    lineColor: settings.lineColor,
    background: settings.transparentBackground ? "transparent" : settings.backgroundColor,
    margin: settings.margin,
    displayValue: settings.displayValue,
    fontSize: settings.fontSize,
    fontOptions: settings.fontBold ? "bold" : "",
    textMargin: settings.textMargin,
    textAlign: settings.textAlign,
  });

  const svgText = new XMLSerializer().serializeToString(svg);
  if (format === "svg") {
    return new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  }

  return svgToPngBlob(svgText, svg);
}

function svgToPngBlob(svgText: string, svg: SVGSVGElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const width = Number(svg.getAttribute("width")) || 420;
    const height = Number(svg.getAttribute("height")) || 180;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Canvas недоступен."));
      return;
    }
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
    image.addEventListener("load", () => {
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Не удалось создать PNG."))), "image/png");
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось отрисовать SVG."));
    });
    image.src = url;
  });
}
