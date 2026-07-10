import qrcode from "qrcode-generator";

export function configureQrUtf8Encoding(): void {
  const utf8Encoder = qrcode.stringToBytesFuncs["UTF-8"];
  if (utf8Encoder) {
    qrcode.stringToBytes = utf8Encoder;
  }
}

export function encodeQrDataForStyling(data: string): string {
  if (typeof TextEncoder === "undefined") {
    return data;
  }

  return Array.from(new TextEncoder().encode(data), (byte) => String.fromCharCode(byte)).join("");
}
