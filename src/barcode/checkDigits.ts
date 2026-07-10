export function calculateEan13CheckDigit(first12Digits: string): string {
  if (!/^\d{12}$/.test(first12Digits)) {
    throw new Error("EAN-13 requires 12 digits to calculate a check digit.");
  }

  const sum = first12Digits
    .split("")
    .map(Number)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);

  return String((10 - (sum % 10)) % 10);
}

export function hasValidEan13CheckDigit(value: string): boolean {
  return /^\d{13}$/.test(value) && calculateEan13CheckDigit(value.slice(0, 12)) === value[12];
}

export function calculateModulo10CheckDigit(digits: string): string {
  if (!/^\d+$/.test(digits)) {
    throw new Error("Only digits are supported.");
  }

  const sum = digits
    .split("")
    .reverse()
    .map(Number)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);

  return String((10 - (sum % 10)) % 10);
}
