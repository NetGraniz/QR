import qrcode from "qrcode-generator";

export function configureQrUtf8Encoding(): void {
  const utf8Encoder = qrcode.stringToBytesFuncs["UTF-8"];
  if (utf8Encoder) {
    qrcode.stringToBytes = utf8Encoder;
  }
}
