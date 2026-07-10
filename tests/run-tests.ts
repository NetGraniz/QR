import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateEan13CheckDigit, hasValidEan13CheckDigit } from "../src/barcode/checkDigits";
import { validateBarcode, validateEan8, validateItf14, validateUpcA } from "../src/barcode/barcodeValidation";
import { buildEmailPayload, buildSmsPayload, buildVCardPayload, buildWifiPayload } from "../src/qr/qrPayloads";
import { getSafeOpenUrl } from "../src/scanner/scanner";
import { isSafeUrl } from "../src/shared/security";
import { sanitizeFileName } from "../src/shared/fileNames";
import { loadSettingsFromStorage } from "../src/storage";
import { sanitizeTemplateImport } from "../src/templates/templateValidation";

describe("QR payload generation", () => {
  it("generates escaped Wi-Fi payload", () => {
    assert.equal(
      buildWifiPayload({ ssid: "Office;Net", password: "p:a,s\\s", security: "WPA", hidden: false, savePassword: false }),
      "WIFI:T:WPA;S:Office\\;Net;P:p\\:a\\,s\\\\s;H:false;;",
    );
  });

  it("generates vCard payload", () => {
    const payload = buildVCardPayload({
      firstName: "Ivan",
      lastName: "Petrov",
      organization: "ACME",
      title: "CTO",
      phone: "+79990000000",
      email: "ivan@example.com",
      website: "https://example.com",
      address: "Moscow",
      note: "Line 1\nLine 2",
    });
    assert.match(payload, /BEGIN:VCARD/);
    assert.match(payload, /FN:Ivan Petrov/);
    assert.match(payload, /NOTE:Line 1\\nLine 2/);
  });

  it("generates email and SMS payloads", () => {
    assert.equal(buildEmailPayload({ to: "a@example.com", subject: "Hello world", body: "Text" }), "mailto:a@example.com?subject=Hello+world&body=Text");
    assert.equal(buildSmsPayload({ phone: "+79990000000", message: "Hello world" }), "sms:+79990000000?body=Hello+world");
  });
});

describe("Barcode validation", () => {
  it("calculates and validates EAN-13 check digit", () => {
    assert.equal(calculateEan13CheckDigit("400638133393"), "1");
    assert.equal(hasValidEan13CheckDigit("4006381333931"), true);
  });

  it("validates EAN-8, UPC-A, and ITF-14", () => {
    assert.equal(validateEan8("9638507").value, "96385074");
    assert.equal(validateUpcA("03600029145").value, "036000291452");
    assert.equal(validateItf14("1001234500001").valid, true);
  });

  it("validates user-facing barcode formats", () => {
    assert.equal(validateBarcode("CODE128", "Hello-128").valid, true);
    assert.equal(validateBarcode("CODE39", "abc-39").value, "ABC-39");
    assert.equal(validateBarcode("CODE39", "кириллица").valid, false);
    assert.equal(validateBarcode("EAN13", "400638133393").value, "4006381333931");
    assert.equal(validateBarcode("UPCA", "03600029145").value, "036000291452");
    assert.equal(validateBarcode("UPCE", "123456").valid, true);
    assert.equal(validateBarcode("codabar", "A12345B").valid, true);
  });
});

describe("Safety helpers", () => {
  it("rejects unsafe URLs", () => {
    assert.equal(isSafeUrl("javascript:alert(1)"), false);
    assert.equal(isSafeUrl("example.com"), true);
    assert.equal(getSafeOpenUrl("javascript:alert(1)"), null);
    assert.equal(getSafeOpenUrl("plain text"), null);
    assert.equal(getSafeOpenUrl("example.com"), "https://example.com");
  });

  it("sanitizes file names", () => {
    assert.equal(sanitizeFileName("qr wifi: office/name"), "qr-wifi-office-name");
  });

  it("loads settings from localStorage safely", () => {
    const storage = { getItem: () => JSON.stringify({ qr: { width: 99999, dotsColor: "#000000" }, barcode: { height: 999, lineColor: "#111111" } }) };
    const loaded = loadSettingsFromStorage(storage);
    assert.equal(loaded.qr.width, 900);
    assert.equal(loaded.qr.dotsColor, "#000000");
    assert.equal(loaded.barcode.height, 260);
    assert.equal(loaded.barcode.lineColor, "#111111");
  });

  it("sanitizes imported templates", () => {
    const template = sanitizeTemplateImport({ name: "Brand", dotsColor: "#000000", dangerous: "<script>" });
    assert.deepEqual(template, { name: "Brand", dotsColor: "#000000" });
  });
});
