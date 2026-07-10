import JsBarcode from "jsbarcode";
import type { BarcodeSettings, ExportFormat } from "../shared/types";
import { sanitizeFileName } from "../shared/fileNames";
import { getJsBarcodeFormat } from "./barcodeConfig";

export function renderBarcode(svg: SVGSVGElement, settings: BarcodeSettings, value: string): void {
  JsBarcode(svg, value, {
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
    valid: (valid) => {
      if (!valid) {
        throw new Error("Barcode value is not valid for the selected format.");
      }
    },
  });
}

export function buildBarcodeFileName(settings: BarcodeSettings, normalizedValue: string): string {
  const fallback = `barcode-${settings.format.toLowerCase()}-${normalizedValue}`;
  return sanitizeFileName(settings.fileName || fallback, "barcode");
}

export async function downloadBarcode(svg: SVGSVGElement, settings: BarcodeSettings, normalizedValue: string): Promise<void> {
  const fileName = buildBarcodeFileName(settings, normalizedValue);

  if (settings.downloadFormat === "svg") {
    downloadText(`${fileName}.svg`, serializeSvg(svg), "image/svg+xml;charset=utf-8");
    return;
  }

  const blob = await rasterizeBarcode(svg, settings.downloadFormat, settings.exportScale, settings.jpegQuality, settings.transparentBackground, settings.backgroundColor);
  downloadBlob(`${fileName}.${settings.downloadFormat}`, blob);
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function getSvgSize(svg: SVGSVGElement): { width: number; height: number } {
  const width = Number(svg.getAttribute("width")) || Math.ceil(svg.getBoundingClientRect().width) || 320;
  const height = Number(svg.getAttribute("height")) || Math.ceil(svg.getBoundingClientRect().height) || 180;
  return { width, height };
}

async function rasterizeBarcode(
  svg: SVGSVGElement,
  format: Exclude<ExportFormat, "svg">,
  scale: 1 | 2 | 4,
  quality: number,
  transparentBackground: boolean,
  backgroundColor: string,
): Promise<Blob> {
  const { width, height } = getSvgSize(svg);
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available.");
  }

  if (format === "jpeg" || !transparentBackground) {
    context.fillStyle = format === "jpeg" ? "#ffffff" : backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const image = await loadSvgImage(serializeSvg(svg));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not export barcode image."));
      },
      format === "jpeg" ? "image/jpeg" : "image/png",
      quality,
    );
  });
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not render barcode SVG."));
    });
    image.src = url;
  });
}

function downloadText(fileName: string, text: string, type: string): void {
  downloadBlob(fileName, new Blob([text], { type }));
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
