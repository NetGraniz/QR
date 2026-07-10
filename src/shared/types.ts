import type { CornerDotType, CornerSquareType, DotType, ErrorCorrectionLevel } from "qr-code-styling";

export type AppMode = "qr" | "barcode" | "scanner" | "batch";
export type QRContentType = "url" | "text" | "wifi" | "vcard" | "phone" | "email" | "sms" | "geo" | "event";
export type ExportFormat = "png" | "jpeg" | "svg";
export type GradientMode = "solid" | "linear" | "radial";
export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPCA" | "UPCE" | "ITF14" | "codabar";
export type TextAlign = "left" | "center" | "right";
export type ScanSource = "image" | "camera" | "auto";

export type ScanResult = {
  format: string;
  value: string;
  source: ScanSource;
};

export type ScanOutcome = {
  results: ScanResult[];
  detectorAvailable: boolean;
  fallbackUsed: boolean;
  message: string;
};

export type CodeKind = "qr" | "barcode";

export type HistoryEntry = {
  id: string;
  kind: CodeKind;
  subtype: string;
  value: string;
  title: string;
  createdAt: string;
  settings: QRSettings | BarcodeSettings;
  thumbnail: string;
};

export type StyleTemplate = {
  id: string;
  name: string;
  createdAt: string;
  settings: Partial<QRSettings>;
};

export type WifiSecurity = "WPA" | "WEP" | "nopass";

export type QRPayloadFields = {
  url: { url: string };
  text: { text: string };
  wifi: { ssid: string; password: string; security: WifiSecurity; hidden: boolean; savePassword: boolean };
  vcard: {
    firstName: string;
    lastName: string;
    organization: string;
    title: string;
    phone: string;
    email: string;
    website: string;
    address: string;
    note: string;
  };
  phone: { phone: string };
  email: { to: string; subject: string; body: string };
  sms: { phone: string; message: string };
  geo: { latitude: string; longitude: string };
  event: { title: string; startsAt: string; endsAt: string; location: string; description: string };
};

export type QRFrameSettings = {
  enabled: boolean;
  color: string;
  thickness: number;
  radius: number;
  padding: number;
};

export type QRCaptionSettings = {
  text: string;
  size: number;
  bold: boolean;
  color: string;
  align: "left" | "center" | "right";
};

export type QRSettings = {
  contentType: QRContentType;
  payloads: QRPayloadFields;
  width: number;
  height: number;
  margin: number;
  dotsColor: string;
  backgroundColor: string;
  transparentBackground: boolean;
  gradientMode: GradientMode;
  gradientColor1: string;
  gradientColor2: string;
  gradientRotation: number;
  cornerSquareColor: string;
  cornerDotColor: string;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  errorCorrectionLevel: ErrorCorrectionLevel;
  imageSize: number;
  imageMargin: number;
  hideBackgroundDots: boolean;
  downloadFormat: ExportFormat;
  exportScale: 1 | 2 | 4;
  jpegQuality: number;
  fileName: string;
  frame: QRFrameSettings;
  caption: QRCaptionSettings;
};

export type BarcodeSettings = {
  format: BarcodeFormat;
  value: string;
  width: number;
  height: number;
  lineColor: string;
  backgroundColor: string;
  transparentBackground: boolean;
  margin: number;
  displayValue: boolean;
  fontSize: number;
  fontBold: boolean;
  textMargin: number;
  textAlign: TextAlign;
  downloadFormat: ExportFormat;
  exportScale: 1 | 2 | 4;
  jpegQuality: number;
  fileName: string;
};

export type PersistedAppState = {
  mode: AppMode;
  qr: QRSettings;
  barcode: BarcodeSettings;
};
