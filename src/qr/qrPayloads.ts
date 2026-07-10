import type { QRContentType, QRPayloadFields } from "../shared/types";
import { normalizeUrl } from "../shared/security";

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function compactLines(lines: Array<string | false>): string {
  return lines.filter(Boolean).join("\n");
}

function toUtcCalendarDate(input: string): string {
  if (!input) {
    return "";
  }
  return new Date(input).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildWifiPayload(fields: QRPayloadFields["wifi"]): string {
  const security = fields.security === "nopass" ? "nopass" : fields.security;
  const passwordPart = fields.security === "nopass" ? "" : `P:${escapeWifi(fields.password)};`;
  return `WIFI:T:${security};S:${escapeWifi(fields.ssid)};${passwordPart}H:${fields.hidden ? "true" : "false"};;`;
}

export function buildVCardPayload(fields: QRPayloadFields["vcard"]): string {
  const fullName = [fields.firstName, fields.lastName].filter(Boolean).join(" ");
  return compactLines([
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCard(fields.lastName)};${escapeVCard(fields.firstName)};;;`,
    fullName && `FN:${escapeVCard(fullName)}`,
    fields.organization && `ORG:${escapeVCard(fields.organization)}`,
    fields.title && `TITLE:${escapeVCard(fields.title)}`,
    fields.phone && `TEL:${escapeVCard(fields.phone)}`,
    fields.email && `EMAIL:${escapeVCard(fields.email)}`,
    fields.website && `URL:${escapeVCard(fields.website)}`,
    fields.address && `ADR:;;${escapeVCard(fields.address)};;;;`,
    fields.note && `NOTE:${escapeVCard(fields.note)}`,
    "END:VCARD",
  ]);
}

export function buildEmailPayload(fields: QRPayloadFields["email"]): string {
  const params = new URLSearchParams();
  if (fields.subject) params.set("subject", fields.subject);
  if (fields.body) params.set("body", fields.body);
  const query = params.toString();
  return `mailto:${fields.to.trim()}${query ? `?${query}` : ""}`;
}

export function buildSmsPayload(fields: QRPayloadFields["sms"]): string {
  const params = new URLSearchParams();
  if (fields.message) params.set("body", fields.message);
  const query = params.toString();
  return `sms:${fields.phone.trim()}${query ? `?${query}` : ""}`;
}

export function buildEventPayload(fields: QRPayloadFields["event"]): string {
  return compactLines([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    fields.title && `SUMMARY:${escapeVCard(fields.title)}`,
    fields.startsAt && `DTSTART:${toUtcCalendarDate(fields.startsAt)}`,
    fields.endsAt && `DTEND:${toUtcCalendarDate(fields.endsAt)}`,
    fields.location && `LOCATION:${escapeVCard(fields.location)}`,
    fields.description && `DESCRIPTION:${escapeVCard(fields.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
}

export function buildQrPayload(type: QRContentType, fields: QRPayloadFields): string {
  switch (type) {
    case "url":
      return normalizeUrl(fields.url.url);
    case "text":
      return fields.text.text;
    case "wifi":
      return buildWifiPayload(fields.wifi);
    case "vcard":
      return buildVCardPayload(fields.vcard);
    case "phone":
      return `tel:${fields.phone.phone.trim()}`;
    case "email":
      return buildEmailPayload(fields.email);
    case "sms":
      return buildSmsPayload(fields.sms);
    case "geo":
      return `geo:${fields.geo.latitude.trim()},${fields.geo.longitude.trim()}`;
    case "event":
      return buildEventPayload(fields.event);
  }
}
