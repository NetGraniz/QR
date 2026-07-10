import type { StyleTemplate } from "../shared/types";
import { sanitizeTemplateImport } from "./templateValidation";

const TEMPLATE_KEY = "qr-code-studio-style-templates-v1";

export function listTemplates(): StyleTemplate[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TEMPLATE_KEY) || "[]") as StyleTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTemplate(template: StyleTemplate): void {
  const templates = listTemplates().filter((item) => item.id !== template.id);
  templates.unshift(template);
  window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates.slice(0, 30)));
}

export function deleteTemplate(id: string): void {
  window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(listTemplates().filter((template) => template.id !== id)));
}

export function renameTemplate(id: string, name: string): void {
  window.localStorage.setItem(
    TEMPLATE_KEY,
    JSON.stringify(listTemplates().map((template) => (template.id === id ? { ...template, name } : template))),
  );
}

export function importTemplate(rawJson: string): StyleTemplate {
  const parsed = sanitizeTemplateImport(JSON.parse(rawJson));
  const template: StyleTemplate = {
    id: crypto.randomUUID(),
    name: String(parsed.name || "Импортированный шаблон"),
    createdAt: new Date().toISOString(),
    settings: parsed,
  };
  saveTemplate(template);
  return template;
}

export function exportTemplate(template: StyleTemplate): Blob {
  return new Blob([JSON.stringify({ name: template.name, ...template.settings }, null, 2)], { type: "application/json;charset=utf-8" });
}
