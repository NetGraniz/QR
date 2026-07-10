import type { BarcodeFormat } from "../shared/types";
import { calculateEan13CheckDigit, calculateModulo10CheckDigit, hasValidEan13CheckDigit } from "./checkDigits";

export type BarcodeValidation = {
  valid: boolean;
  value: string;
  error?: string;
};

export function validateEan13(value: string): BarcodeValidation {
  if (!/^\d{12,13}$/.test(value)) {
    return { valid: false, value, error: "EAN-13 должен содержать 12 или 13 цифр" };
  }

  if (value.length === 12) {
    return { valid: true, value: `${value}${calculateEan13CheckDigit(value)}` };
  }

  return hasValidEan13CheckDigit(value)
    ? { valid: true, value }
    : { valid: false, value, error: "Контрольная цифра EAN-13 указана неверно" };
}

export function validateEan8(value: string): BarcodeValidation {
  if (!/^\d{7,8}$/.test(value)) {
    return { valid: false, value, error: "EAN-8 должен содержать 7 или 8 цифр" };
  }
  if (value.length === 7) {
    return { valid: true, value: `${value}${calculateModulo10CheckDigit(value)}` };
  }
  return calculateModulo10CheckDigit(value.slice(0, 7)) === value[7]
    ? { valid: true, value }
    : { valid: false, value, error: "Контрольная цифра EAN-8 указана неверно" };
}

export function validateUpcA(value: string): BarcodeValidation {
  if (!/^\d{11,12}$/.test(value)) {
    return { valid: false, value, error: "UPC-A должен содержать 11 или 12 цифр" };
  }
  if (value.length === 11) {
    return { valid: true, value: `${value}${calculateModulo10CheckDigit(value)}` };
  }
  return calculateModulo10CheckDigit(value.slice(0, 11)) === value[11]
    ? { valid: true, value }
    : { valid: false, value, error: "Контрольная цифра UPC-A указана неверно" };
}

export function validateUpcE(value: string): BarcodeValidation {
  if (!/^\d{6,8}$/.test(value)) {
    return { valid: false, value, error: "UPC-E должен содержать 6, 7 или 8 цифр" };
  }
  return { valid: true, value };
}

export function validateItf14(value: string): BarcodeValidation {
  if (!/^\d{13,14}$/.test(value)) {
    return { valid: false, value, error: "ITF-14 должен содержать 13 или 14 цифр" };
  }
  if (value.length === 13) {
    return { valid: true, value: `${value}${calculateModulo10CheckDigit(value)}` };
  }
  return calculateModulo10CheckDigit(value.slice(0, 13)) === value[13]
    ? { valid: true, value }
    : { valid: false, value, error: "Контрольная цифра ITF-14 указана неверно" };
}

export function validateCode39(value: string): BarcodeValidation {
  const normalized = value.toUpperCase();
  return /^[0-9A-Z .$/+%-]+$/.test(normalized)
    ? { valid: true, value: normalized }
    : { valid: false, value, error: "Code 39 содержит неподдерживаемые символы" };
}

export function validateCode128(value: string): BarcodeValidation {
  return value.length > 0
    ? { valid: true, value }
    : { valid: false, value, error: "Введите значение для штрихкода" };
}

export function validateCodabar(value: string): BarcodeValidation {
  const normalized = value.toUpperCase();
  return /^[ABCD][0-9\-$:/.+]+[ABCD]$/.test(normalized)
    ? { valid: true, value: normalized }
    : { valid: false, value, error: "Codabar должен начинаться и заканчиваться буквами A, B, C или D" };
}

export function validateBarcode(format: BarcodeFormat, rawValue: string): BarcodeValidation {
  const value = rawValue.trim();

  switch (format) {
    case "CODE128":
      return validateCode128(value);
    case "CODE39":
      return validateCode39(value);
    case "EAN13":
      return validateEan13(value);
    case "EAN8":
      return validateEan8(value);
    case "UPCA":
      return validateUpcA(value);
    case "UPCE":
      return validateUpcE(value);
    case "ITF14":
      return validateItf14(value);
    case "codabar":
      return validateCodabar(value);
  }
}
