import type { BarcodeFormat, BarcodeSettings, ExportFormat, TextAlign } from "../shared/types";

export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat, string> = {
  CODE128: "Code 128",
  CODE39: "Code 39",
  EAN13: "EAN-13",
  EAN8: "EAN-8",
  UPCA: "UPC-A",
  UPCE: "UPC-E",
  ITF14: "ITF-14",
  codabar: "Codabar",
};

export const BARCODE_FORMATS = Object.keys(BARCODE_FORMAT_LABELS) as BarcodeFormat[];
export const BARCODE_DOWNLOAD_FORMATS: ExportFormat[] = ["png", "jpeg", "svg"];
export const BARCODE_TEXT_ALIGNMENTS: TextAlign[] = ["left", "center", "right"];

export const TEXT_ALIGN_LABELS: Record<TextAlign, string> = {
  left: "Слева",
  center: "По центру",
  right: "Справа",
};

export const DEFAULT_BARCODE_SETTINGS: BarcodeSettings = {
  format: "CODE128",
  value: "1234567890",
  width: 2,
  height: 110,
  lineColor: "#111827",
  backgroundColor: "#ffffff",
  transparentBackground: false,
  margin: 16,
  displayValue: true,
  fontSize: 18,
  fontBold: false,
  textMargin: 8,
  textAlign: "center",
  downloadFormat: "png",
  exportScale: 1,
  jpegQuality: 0.92,
  fileName: "",
};

export function getJsBarcodeFormat(format: BarcodeFormat): string {
  if (format === "UPCA") return "UPC";
  return format;
}
