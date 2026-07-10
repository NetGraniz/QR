import type { CornerDotType, CornerSquareType, DotType, ErrorCorrectionLevel, Gradient, Options } from "qr-code-styling";
import type { ExportFormat, QRSettings } from "../shared/types";

export const DOT_TYPE_LABELS: Record<DotType, string> = {
  square: "Квадратные",
  dots: "Точки",
  rounded: "Округлые",
  "extra-rounded": "Сильно округлые",
  classy: "Декоративные",
  "classy-rounded": "Декоративные округлые",
};

export const CORNER_SQUARE_LABELS: Record<CornerSquareType, string> = {
  square: "Квадратные",
  dot: "Круглые",
  "extra-rounded": "Сильно округлые",
  dots: "Точки",
  rounded: "Округлые",
  classy: "Декоративные",
  "classy-rounded": "Декоративные округлые",
};

export const CORNER_DOT_LABELS: Partial<Record<CornerDotType, string>> = {
  square: "Квадратные",
  dot: "Круглые",
};

export const DOT_TYPES = Object.keys(DOT_TYPE_LABELS) as DotType[];
export const CORNER_SQUARE_TYPES = ["square", "dot", "extra-rounded"] as CornerSquareType[];
export const CORNER_DOT_TYPES = ["square", "dot"] as CornerDotType[];
export const DOWNLOAD_FORMATS: ExportFormat[] = ["png", "jpeg", "svg"];
export const ERROR_CORRECTION_LEVELS: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];

export const DEFAULT_QR_SETTINGS: QRSettings = {
  contentType: "url",
  payloads: {
    url: { url: "https://example.com" },
    text: { text: "Пример текста" },
    wifi: { ssid: "", password: "", security: "WPA", hidden: false, savePassword: false },
    vcard: { firstName: "", lastName: "", organization: "", title: "", phone: "", email: "", website: "", address: "", note: "" },
    phone: { phone: "" },
    email: { to: "", subject: "", body: "" },
    sms: { phone: "", message: "" },
    geo: { latitude: "55.7558", longitude: "37.6176" },
    event: { title: "", startsAt: "", endsAt: "", location: "", description: "" },
  },
  width: 300,
  height: 300,
  margin: 10,
  dotsColor: "#111827",
  backgroundColor: "#ffffff",
  transparentBackground: false,
  gradientMode: "solid",
  gradientColor1: "#111827",
  gradientColor2: "#2563eb",
  gradientRotation: 0,
  cornerSquareColor: "#111827",
  cornerDotColor: "#111827",
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  errorCorrectionLevel: "H",
  imageSize: 0.2,
  imageMargin: 8,
  hideBackgroundDots: true,
  downloadFormat: "png",
  exportScale: 1,
  jpegQuality: 0.92,
  fileName: "qr-code",
  frame: { enabled: false, color: "#111827", thickness: 2, radius: 12, padding: 16 },
  caption: { text: "", size: 16, bold: false, color: "#111827", align: "center" },
};

export const PRESETS = [
  {
    name: "Классический",
    settings: { dotsColor: "#111827", backgroundColor: "#ffffff", cornerSquareColor: "#111827", cornerDotColor: "#111827", dotsType: "square" as DotType, cornersSquareType: "square" as CornerSquareType, cornersDotType: "square" as CornerDotType, gradientMode: "solid" as const },
  },
  {
    name: "Синий бренд",
    settings: { dotsColor: "#1d4ed8", backgroundColor: "#f8fbff", cornerSquareColor: "#0f172a", cornerDotColor: "#1d4ed8", dotsType: "classy-rounded" as DotType, cornersSquareType: "extra-rounded" as CornerSquareType, cornersDotType: "dot" as CornerDotType, gradientMode: "linear" as const, gradientColor1: "#1d4ed8", gradientColor2: "#14b8a6" },
  },
  {
    name: "Тёмный",
    settings: { dotsColor: "#f8fafc", backgroundColor: "#111827", cornerSquareColor: "#38bdf8", cornerDotColor: "#f8fafc", dotsType: "dots" as DotType, cornersSquareType: "extra-rounded" as CornerSquareType, cornersDotType: "dot" as CornerDotType, gradientMode: "solid" as const },
  },
  {
    name: "Мягкий округлый",
    settings: { dotsColor: "#334155", backgroundColor: "#fff7ed", cornerSquareColor: "#fb7185", cornerDotColor: "#fb7185", dotsType: "rounded" as DotType, cornersSquareType: "extra-rounded" as CornerSquareType, cornersDotType: "dot" as CornerDotType, gradientMode: "solid" as const },
  },
  {
    name: "Контрастный",
    settings: { dotsColor: "#000000", backgroundColor: "#fefce8", cornerSquareColor: "#dc2626", cornerDotColor: "#000000", dotsType: "classy" as DotType, cornersSquareType: "dot" as CornerSquareType, cornersDotType: "square" as CornerDotType, gradientMode: "solid" as const },
  },
];

function buildGradient(settings: QRSettings): Gradient | undefined {
  if (settings.gradientMode === "solid") {
    return undefined;
  }

  return {
    type: settings.gradientMode,
    rotation: (settings.gradientRotation * Math.PI) / 180,
    colorStops: [
      { offset: 0, color: settings.gradientColor1 },
      { offset: 1, color: settings.gradientColor2 },
    ],
  };
}

export function buildQrOptions(settings: QRSettings, data: string, logo?: string, override?: Partial<QRSettings>): Partial<Options> {
  const merged = { ...settings, ...override };
  const gradient = buildGradient(merged);
  const backgroundColor = merged.transparentBackground && merged.downloadFormat !== "jpeg" ? "transparent" : merged.backgroundColor;

  return {
    width: merged.width,
    height: merged.height,
    type: "svg",
    data: data || " ",
    margin: merged.margin,
    qrOptions: { errorCorrectionLevel: merged.errorCorrectionLevel },
    image: logo,
    imageOptions: {
      hideBackgroundDots: merged.hideBackgroundDots,
      imageSize: merged.imageSize,
      margin: merged.imageMargin,
      crossOrigin: "anonymous",
    },
    dotsOptions: {
      color: gradient ? undefined : merged.dotsColor,
      gradient,
      type: merged.dotsType,
    },
    backgroundOptions: {
      color: backgroundColor,
    },
    cornersSquareOptions: {
      color: merged.cornerSquareColor,
      type: merged.cornersSquareType,
    },
    cornersDotOptions: {
      color: merged.cornerDotColor,
      type: merged.cornersDotType,
    },
  };
}
