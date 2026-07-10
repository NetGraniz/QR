import type { QRContentType, QRPayloadFields, QRSettings } from "../shared/types";
import { getContrastRatio, getRelativeLuminance } from "../validation";
import { isSafeUrl } from "../shared/security";

export type ValidationResult = {
  errors: string[];
};

export type ReadabilityWarning = {
  message: string;
};

export type ReadabilityResult = {
  contrastRatio: number;
  rating: "Отличная читаемость" | "Допустимая читаемость" | "Высокий риск ошибки сканирования";
  warnings: ReadabilityWarning[];
};

export function validateQrPayload(type: QRContentType, fields: QRPayloadFields): ValidationResult {
  const errors: string[] = [];

  if (type === "url") {
    if (!fields.url.url.trim()) errors.push("Введите URL.");
    else if (!isSafeUrl(fields.url.url)) errors.push("Введите корректный URL с безопасным протоколом http или https.");
  }

  if (type === "wifi" && !fields.wifi.ssid.trim()) {
    errors.push("Введите название сети SSID.");
  }

  if (type === "vcard" && !fields.vcard.firstName.trim() && !fields.vcard.lastName.trim()) {
    errors.push("Введите имя или фамилию контакта.");
  }

  if (type === "phone" && !fields.phone.phone.trim()) {
    errors.push("Введите номер телефона.");
  }

  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.to.trim())) {
    errors.push("Введите корректный email получателя.");
  }

  if (type === "sms" && !fields.sms.phone.trim()) {
    errors.push("Введите номер телефона для SMS.");
  }

  if (type === "geo") {
    const lat = Number(fields.geo.latitude);
    const lon = Number(fields.geo.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push("Широта должна быть числом от -90 до 90.");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) errors.push("Долгота должна быть числом от -180 до 180.");
  }

  if (type === "event") {
    if (!fields.event.title.trim()) errors.push("Введите название события.");
    if (!fields.event.startsAt) errors.push("Введите дату и время начала.");
    if (!fields.event.endsAt) errors.push("Введите дату и время окончания.");
    if (fields.event.startsAt && fields.event.endsAt && new Date(fields.event.endsAt) <= new Date(fields.event.startsAt)) {
      errors.push("Дата окончания должна быть позже даты начала.");
    }
  }

  return { errors };
}

export function buildReadabilityResult(settings: QRSettings, hasLogo: boolean): ReadabilityResult {
  const warnings: ReadabilityWarning[] = [];
  const contrastRatio = settings.transparentBackground
    ? getContrastRatio(settings.dotsColor, "#ffffff")
    : getContrastRatio(settings.dotsColor, settings.backgroundColor);
  const dotLuminance = getRelativeLuminance(settings.dotsColor);
  const backgroundLuminance = settings.transparentBackground ? 1 : getRelativeLuminance(settings.backgroundColor);

  if (contrastRatio < 3.5 || dotLuminance > 0.72 || backgroundLuminance < 0.2) {
    warnings.push({ message: "Недостаточный контраст между точками и фоном" });
  }

  if (hasLogo && settings.imageSize > 0.27) {
    warnings.push({ message: "Логотип занимает слишком большую площадь" });
  }

  if (settings.width < 220 || settings.height < 220) {
    warnings.push({ message: "Размер QR-кода может быть недостаточным" });
  }

  if (settings.transparentBackground) {
    warnings.push({ message: "При прозрачном фоне QR-код необходимо размещать на контрастной однотонной поверхности" });
  }

  if (hasLogo && (settings.errorCorrectionLevel === "L" || settings.errorCorrectionLevel === "M")) {
    warnings.push({ message: "Выбранный уровень коррекции ошибок слишком низкий для QR-кода с логотипом" });
  }

  const rating =
    warnings.length === 0
      ? "Отличная читаемость"
      : warnings.length <= 2 && contrastRatio >= 3
        ? "Допустимая читаемость"
        : "Высокий риск ошибки сканирования";

  return { contrastRatio, rating, warnings };
}
