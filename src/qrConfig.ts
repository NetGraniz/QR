import type {
  CornerDotType,
  CornerSquareType,
  DotType,
  DrawType,
  FileExtension,
  Options,
} from "qr-code-styling";

export type DownloadFormat = Extract<FileExtension, "png" | "jpeg" | "svg">;

export type QRStudioSettings = {
  data: string;
  width: number;
  height: number;
  margin: number;
  dotsColor: string;
  backgroundColor: string;
  cornersColor: string;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  imageSize: number;
  imageMargin: number;
  hideBackgroundDots: boolean;
  downloadFormat: DownloadFormat;
};

export type StylePreset = {
  name: string;
  settings: Pick<
    QRStudioSettings,
    | "dotsColor"
    | "backgroundColor"
    | "cornersColor"
    | "dotsType"
    | "cornersSquareType"
    | "cornersDotType"
  >;
};

export const DEFAULT_SETTINGS: QRStudioSettings = {
  data: "https://example.com",
  width: 300,
  height: 300,
  margin: 10,
  dotsColor: "#111827",
  backgroundColor: "#ffffff",
  cornersColor: "#111827",
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  imageSize: 0.2,
  imageMargin: 8,
  hideBackgroundDots: true,
  downloadFormat: "png",
};

export const PRESETS: StylePreset[] = [
  {
    name: "Классический",
    settings: {
      dotsColor: "#111827",
      backgroundColor: "#ffffff",
      cornersColor: "#111827",
      dotsType: "square",
      cornersSquareType: "square",
      cornersDotType: "square",
    },
  },
  {
    name: "Синий бренд",
    settings: {
      dotsColor: "#1d4ed8",
      backgroundColor: "#f8fbff",
      cornersColor: "#0f172a",
      dotsType: "classy-rounded",
      cornersSquareType: "extra-rounded",
      cornersDotType: "dot",
    },
  },
  {
    name: "Тёмный",
    settings: {
      dotsColor: "#f8fafc",
      backgroundColor: "#111827",
      cornersColor: "#38bdf8",
      dotsType: "dots",
      cornersSquareType: "extra-rounded",
      cornersDotType: "dot",
    },
  },
  {
    name: "Мягкий округлый",
    settings: {
      dotsColor: "#334155",
      backgroundColor: "#fff7ed",
      cornersColor: "#fb7185",
      dotsType: "rounded",
      cornersSquareType: "extra-rounded",
      cornersDotType: "dot",
    },
  },
  {
    name: "Контрастный",
    settings: {
      dotsColor: "#000000",
      backgroundColor: "#fefce8",
      cornersColor: "#dc2626",
      dotsType: "classy",
      cornersSquareType: "dot",
      cornersDotType: "square",
    },
  },
];

export const DOT_TYPES: DotType[] = [
  "square",
  "dots",
  "rounded",
  "extra-rounded",
  "classy",
  "classy-rounded",
];

export const CORNER_SQUARE_TYPES: CornerSquareType[] = ["square", "dot", "extra-rounded"];
export const CORNER_DOT_TYPES: CornerDotType[] = ["square", "dot"];
export const DOWNLOAD_FORMATS: DownloadFormat[] = ["png", "jpeg", "svg"];

export function buildQrOptions(settings: QRStudioSettings, logo?: string): Partial<Options> {
  return {
    width: settings.width,
    height: settings.height,
    type: "svg" as DrawType,
    data: settings.data || " ",
    margin: settings.margin,
    qrOptions: {
      errorCorrectionLevel: "H",
    },
    image: logo,
    imageOptions: {
      hideBackgroundDots: settings.hideBackgroundDots,
      imageSize: settings.imageSize,
      margin: settings.imageMargin,
      crossOrigin: "anonymous",
    },
    dotsOptions: {
      color: settings.dotsColor,
      type: settings.dotsType,
    },
    backgroundOptions: {
      color: settings.backgroundColor,
    },
    cornersSquareOptions: {
      color: settings.cornersColor,
      type: settings.cornersSquareType,
    },
    cornersDotOptions: {
      color: settings.cornersColor,
      type: settings.cornersDotType,
    },
  };
}

export function resetVisualSettings(current: QRStudioSettings): QRStudioSettings {
  return {
    ...DEFAULT_SETTINGS,
    data: current.data,
  };
}
