import QRCodeStyling from "qr-code-styling";
import "./styles.css";
import {
  CORNER_DOT_LABELS,
  CORNER_DOT_TYPES,
  CORNER_SQUARE_LABELS,
  CORNER_SQUARE_TYPES,
  DEFAULT_QR_SETTINGS,
  DOT_TYPE_LABELS,
  DOT_TYPES,
  DOWNLOAD_FORMATS,
  ERROR_CORRECTION_LEVELS,
  PRESETS,
  buildQrOptions,
} from "./qr/qrConfig";
import { buildQrPayload } from "./qr/qrPayloads";
import { buildReadabilityResult, validateQrPayload } from "./qr/qrValidation";
import { sanitizeSvg } from "./shared/security";
import { sanitizeFileName } from "./shared/fileNames";
import type { AppMode, ExportFormat, PersistedAppState, QRContentType, QRSettings } from "./shared/types";
import { loadSettings, saveSettings } from "./storage";
import { clampNumber, validateLogoFile } from "./validation";

const QR_TYPE_LABELS: Record<QRContentType, string> = {
  url: "Ссылка",
  text: "Обычный текст",
  wifi: "Wi-Fi",
  vcard: "Контакт vCard",
  phone: "Телефон",
  email: "Email",
  sms: "SMS",
  geo: "Геолокация",
  event: "Событие календаря",
};

const MODE_LABELS: Record<AppMode, string> = {
  qr: "Создать QR-код",
  barcode: "Создать штрихкод",
  scanner: "Сканировать код",
};

let state: PersistedAppState = loadSettings();
let logoDataUrl = "";
let logoFileName = "";
let qrCode: QRCodeStyling | null = null;

const app = getRequiredElement<HTMLDivElement>("#app");

app.innerHTML = `
  <main class="page-shell">
    <section class="intro">
      <div>
        <p class="eyebrow">Frontend code generator</p>
        <h1>QR Code Studio</h1>
        <p class="lead">Создавайте QR-коды локально в браузере: ссылки, Wi-Fi, контакты, email, SMS, координаты и события.</p>
      </div>
      <div class="intro-badge">GitHub Pages ready</div>
    </section>

    <nav class="mode-tabs" aria-label="Режим приложения"></nav>

    <section class="studio-layout" aria-label="Рабочая область">
      <form class="settings-panel" id="settingsForm">
        <div class="panel-heading">
          <h2 id="settingsTitle">Настройки</h2>
          <button class="ghost-button" id="resetButton" type="button">Сбросить оформление</button>
        </div>
        <div id="modeForm"></div>
      </form>

      <aside class="preview-panel" aria-label="Предпросмотр">
        <div class="preview-card">
          <div class="preview-header">
            <h2>Предпросмотр</h2>
            <span id="qrSizeLabel"></span>
          </div>
          <div class="qr-stage" id="qrStage">
            <div id="qrPreview" aria-live="polite"></div>
          </div>
          <div class="message-stack">
            <p class="status-message" id="statusMessage" role="status" aria-live="polite"></p>
            <div class="warning-box" id="warningBox" hidden aria-live="polite"></div>
          </div>
        </div>
      </aside>
    </section>
  </main>
`;

const modeTabs = getRequiredElement<HTMLElement>(".mode-tabs");
const settingsForm = getRequiredElement<HTMLFormElement>("#settingsForm");
const modeForm = getRequiredElement<HTMLDivElement>("#modeForm");
const qrPreview = getRequiredElement<HTMLDivElement>("#qrPreview");
const qrStage = getRequiredElement<HTMLDivElement>("#qrStage");
const warningBox = getRequiredElement<HTMLDivElement>("#warningBox");
const statusMessage = getRequiredElement<HTMLParagraphElement>("#statusMessage");
const qrSizeLabel = getRequiredElement<HTMLSpanElement>("#qrSizeLabel");
const resetButton = getRequiredElement<HTMLButtonElement>("#resetButton");

render();
bindEvents();

function getRequiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element ${selector} was not found.`);
  }
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

function optionList<T extends string>(values: readonly T[], selected: T, labels?: Record<T, string>): string {
  return values
    .map((value) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(labels?.[value] ?? value)}</option>`)
    .join("");
}

function render(): void {
  renderModeTabs();

  if (state.mode === "qr") {
    renderQrForm();
  } else if (state.mode === "barcode") {
    renderPlaceholder("Генератор штрихкодов", "Этот режим будет реализован на следующем этапе: форматы Code 128, Code 39, EAN/UPC, ITF-14 и Codabar.");
  } else {
    renderPlaceholder("Сканировать код", "Этот режим будет реализован на следующем этапе: загрузка изображения, камера и распознавание через BarcodeDetector.");
  }

  renderPreview();
  persist();
}

function renderModeTabs(): void {
  modeTabs.innerHTML = (Object.keys(MODE_LABELS) as AppMode[])
    .map(
      (mode) => `
        <button class="mode-tab ${state.mode === mode ? "is-active" : ""}" type="button" data-mode="${mode}" aria-pressed="${state.mode === mode}">
          ${MODE_LABELS[mode]}
        </button>
      `,
    )
    .join("");
}

function renderPlaceholder(title: string, text: string): void {
  modeForm.innerHTML = `
    <section class="empty-mode">
      <h3>${title}</h3>
      <p>${text}</p>
    </section>
  `;
  qrPreview.innerHTML = "";
  warningBox.hidden = true;
  statusMessage.textContent = "";
}

function renderQrForm(): void {
  const qr = state.qr;
  modeForm.innerHTML = `
    <details class="settings-section" open>
      <summary>Данные</summary>
      <label class="field" for="contentType">
        <span>Тип QR-кода</span>
        <select id="contentType" data-setting="contentType">${optionList(Object.keys(QR_TYPE_LABELS) as QRContentType[], qr.contentType, QR_TYPE_LABELS)}</select>
      </label>
      <div class="dynamic-fields">${renderPayloadFields(qr)}</div>
      <details class="payload-output" open>
        <summary>Содержимое QR-кода</summary>
        <textarea id="payloadOutput" readonly rows="5"></textarea>
        <button class="ghost-button" id="copyPayloadButton" type="button">Копировать содержимое</button>
      </details>
    </details>

    <details class="settings-section" open>
      <summary>Оформление</summary>
      <div class="preset-grid">${renderPresets()}</div>
      <div class="control-grid">
        ${numberField("width", "Ширина, px", qr.width, 160, 900, 10)}
        ${numberField("height", "Высота, px", qr.height, 160, 900, 10)}
        ${numberField("margin", "Отступ, px", qr.margin, 0, 80, 1)}
      </div>
      <div class="control-grid">
        ${selectField("gradientMode", "Цвет точек", qr.gradientMode, [
          ["solid", "Однотонный цвет"],
          ["linear", "Линейный градиент"],
          ["radial", "Радиальный градиент"],
        ])}
        ${colorField("dotsColor", "Цвет точек", qr.dotsColor, qr.gradientMode !== "solid")}
        ${colorField("backgroundColor", "Цвет фона", qr.backgroundColor, qr.transparentBackground)}
      </div>
      <label class="toggle-field">
        <input type="checkbox" data-setting="transparentBackground" ${qr.transparentBackground ? "checked" : ""} />
        <span>Прозрачный фон</span>
      </label>
      <div class="control-grid ${qr.gradientMode === "solid" ? "is-hidden" : ""}">
        ${colorField("gradientColor1", "Первый цвет", qr.gradientColor1)}
        ${colorField("gradientColor2", "Второй цвет", qr.gradientColor2)}
        ${numberField("gradientRotation", "Угол градиента", qr.gradientRotation, 0, 360, 1)}
      </div>
      <div class="control-grid">
        ${colorField("cornerSquareColor", "Внешние углы", qr.cornerSquareColor)}
        ${colorField("cornerDotColor", "Внутренние точки углов", qr.cornerDotColor)}
      </div>
      <div class="control-grid">
        ${selectField("dotsType", "Форма точек", qr.dotsType, DOT_TYPES.map((value) => [value, DOT_TYPE_LABELS[value]]))}
        ${selectField("cornersSquareType", "Форма внешних углов", qr.cornersSquareType, CORNER_SQUARE_TYPES.map((value) => [value, CORNER_SQUARE_LABELS[value]]))}
        ${selectField("cornersDotType", "Форма внутренних точек", qr.cornersDotType, CORNER_DOT_TYPES.map((value) => [value, CORNER_DOT_LABELS[value] ?? value]))}
      </div>
    </details>

    <details class="settings-section">
      <summary>Логотип</summary>
      <div class="logo-row">
        <label class="file-button" for="logoInput">Загрузить логотип</label>
        <input id="logoInput" type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" />
        <button class="ghost-button" id="removeLogoButton" type="button">Удалить логотип</button>
      </div>
      <p class="logo-name">${logoFileName ? escapeHtml(logoFileName) : "Логотип не выбран"}</p>
      <div class="control-grid">
        ${rangeField("imageSize", "Размер логотипа", qr.imageSize, 0.05, 0.35, 0.01, `${Math.round(qr.imageSize * 100)}%`)}
        ${numberField("imageMargin", "Отступ логотипа, px", qr.imageMargin, 0, 30, 1)}
      </div>
      <label class="toggle-field">
        <input type="checkbox" data-setting="hideBackgroundDots" ${qr.hideBackgroundDots ? "checked" : ""} />
        <span>Скрывать точки под логотипом</span>
      </label>
    </details>

    <details class="settings-section" open>
      <summary>Качество</summary>
      ${selectField("errorCorrectionLevel", "Уровень коррекции ошибок", qr.errorCorrectionLevel, ERROR_CORRECTION_LEVELS.map((level) => [level, level]))}
    </details>

    <details class="settings-section" open>
      <summary>Экспорт</summary>
      <div class="control-grid">
        ${selectField("downloadFormat", "Формат", qr.downloadFormat, DOWNLOAD_FORMATS.map((value) => [value, value.toUpperCase()]))}
        ${selectField("exportScale", "Масштаб PNG", String(qr.exportScale), [["1", "1×"], ["2", "2×"], ["4", "4×"]])}
        ${rangeField("jpegQuality", "Качество JPEG", qr.jpegQuality, 0.6, 1, 0.01, `${Math.round(qr.jpegQuality * 100)}%`)}
      </div>
      ${textField("fileName", "Имя файла", qr.fileName)}
      <button class="primary-button" id="downloadButton" type="button">Скачать QR-код</button>
    </details>
  `;

  const payloadOutput = getRequiredElement<HTMLTextAreaElement>("#payloadOutput");
  payloadOutput.value = currentPayload();
}

function renderPayloadFields(qr: QRSettings): string {
  const fields = qr.payloads;
  switch (qr.contentType) {
    case "url":
      return textField("payloads.url.url", "URL", fields.url.url, "https://example.com");
    case "text":
      return textareaField("payloads.text.text", "Текст", fields.text.text);
    case "wifi":
      return `
        ${textField("payloads.wifi.ssid", "Название сети SSID", fields.wifi.ssid)}
        ${textField("payloads.wifi.password", "Пароль", fields.wifi.password)}
        ${selectField("payloads.wifi.security", "Тип защиты", fields.wifi.security, [["WPA", "WPA/WPA2/WPA3"], ["WEP", "WEP"], ["nopass", "Без пароля"]])}
        <label class="toggle-field"><input type="checkbox" data-setting="payloads.wifi.hidden" ${fields.wifi.hidden ? "checked" : ""} /><span>Скрытая сеть</span></label>
        <label class="toggle-field"><input type="checkbox" data-setting="payloads.wifi.savePassword" ${fields.wifi.savePassword ? "checked" : ""} /><span>Сохранять пароль в истории</span></label>
      `;
    case "vcard":
      return `
        <div class="control-grid">${textField("payloads.vcard.firstName", "Имя", fields.vcard.firstName)}${textField("payloads.vcard.lastName", "Фамилия", fields.vcard.lastName)}</div>
        <div class="control-grid">${textField("payloads.vcard.organization", "Организация", fields.vcard.organization)}${textField("payloads.vcard.title", "Должность", fields.vcard.title)}</div>
        <div class="control-grid">${textField("payloads.vcard.phone", "Телефон", fields.vcard.phone)}${textField("payloads.vcard.email", "Email", fields.vcard.email)}</div>
        ${textField("payloads.vcard.website", "Сайт", fields.vcard.website)}
        ${textField("payloads.vcard.address", "Адрес", fields.vcard.address)}
        ${textareaField("payloads.vcard.note", "Заметка", fields.vcard.note)}
      `;
    case "phone":
      return textField("payloads.phone.phone", "Номер телефона", fields.phone.phone, "+79990000000");
    case "email":
      return `${textField("payloads.email.to", "Email получателя", fields.email.to)}${textField("payloads.email.subject", "Тема", fields.email.subject)}${textareaField("payloads.email.body", "Текст письма", fields.email.body)}`;
    case "sms":
      return `${textField("payloads.sms.phone", "Номер телефона", fields.sms.phone)}${textareaField("payloads.sms.message", "Текст сообщения", fields.sms.message)}`;
    case "geo":
      return `<div class="control-grid">${textField("payloads.geo.latitude", "Широта", fields.geo.latitude)}${textField("payloads.geo.longitude", "Долгота", fields.geo.longitude)}</div>`;
    case "event":
      return `${textField("payloads.event.title", "Название", fields.event.title)}<div class="control-grid">${dateField("payloads.event.startsAt", "Начало", fields.event.startsAt)}${dateField("payloads.event.endsAt", "Окончание", fields.event.endsAt)}</div>${textField("payloads.event.location", "Место", fields.event.location)}${textareaField("payloads.event.description", "Описание", fields.event.description)}`;
  }
}

function renderPresets(): string {
  return PRESETS.map(
    (preset, index) => `
      <button class="preset-button" type="button" data-preset-index="${index}">
        <span class="preset-swatch" style="--dot:${preset.settings.dotsColor}; --bg:${preset.settings.backgroundColor}; --corner:${preset.settings.cornerSquareColor}"></span>
        ${preset.name}
      </button>
    `,
  ).join("");
}

function textField(setting: string, label: string, value: string, placeholder = ""): string {
  return `<label class="field"><span>${label}</span><input data-setting="${setting}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></label>`;
}

function textareaField(setting: string, label: string, value: string): string {
  return `<label class="field"><span>${label}</span><textarea data-setting="${setting}" rows="4">${escapeHtml(value)}</textarea></label>`;
}

function dateField(setting: string, label: string, value: string): string {
  return `<label class="field"><span>${label}</span><input type="datetime-local" data-setting="${setting}" value="${escapeHtml(value)}" /></label>`;
}

function numberField(setting: string, label: string, value: number, min: number, max: number, step: number): string {
  return `<label class="field"><span>${label}</span><input type="number" data-setting="${setting}" value="${value}" min="${min}" max="${max}" step="${step}" /></label>`;
}

function rangeField(setting: string, label: string, value: number, min: number, max: number, step: number, suffix: string): string {
  return `<label class="field"><span>${label} <b>${suffix}</b></span><input type="range" data-setting="${setting}" value="${value}" min="${min}" max="${max}" step="${step}" /></label>`;
}

function colorField(setting: string, label: string, value: string, disabled = false): string {
  return `<label class="field color-field"><span>${label}</span><input type="color" data-setting="${setting}" value="${value}" ${disabled ? "disabled" : ""} /></label>`;
}

function selectField(setting: string, label: string, selected: string, options: Array<[string, string]>): string {
  return `
    <label class="field">
      <span>${label}</span>
      <select data-setting="${setting}">
        ${options.map(([value, optionLabel]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function bindEvents(): void {
  modeTabs.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mode]");
    if (!button) return;
    state.mode = button.dataset.mode as AppMode;
    render();
  });

  settingsForm.addEventListener("input", handleSettingChange);
  settingsForm.addEventListener("change", handleSettingChange);

  settingsForm.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const presetButton = target.closest<HTMLButtonElement>("[data-preset-index]");
    if (presetButton) {
      const preset = PRESETS[Number(presetButton.dataset.presetIndex)];
      state.qr = { ...state.qr, ...preset.settings };
      render();
      return;
    }

    if (target.closest("#copyPayloadButton")) {
      await navigator.clipboard?.writeText(currentPayload());
      setStatus("Содержимое QR-кода скопировано.");
      return;
    }

    if (target.closest("#removeLogoButton")) {
      logoDataUrl = "";
      logoFileName = "";
      render();
      setStatus("Логотип удалён.");
      return;
    }

    if (target.closest("#downloadButton")) {
      await downloadQr();
    }
  });

  settingsForm.addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === "logoInput" && input.files?.[0]) {
      await handleLogoUpload(input.files[0]);
    }
  });

  resetButton.addEventListener("click", () => {
    const payloads = state.qr.payloads;
    const contentType = state.qr.contentType;
    state.qr = { ...structuredClone(DEFAULT_QR_SETTINGS), payloads, contentType };
    logoDataUrl = "";
    logoFileName = "";
    render();
  });
}

function handleSettingChange(event: Event): void {
  const element = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  const setting = element.dataset.setting;
  if (!setting) return;

  const value = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : element.value;
  setNestedSetting(setting, value);
  render();
}

function setNestedSetting(path: string, value: string | boolean): void {
  const parts = path.split(".");
  let target: Record<string, unknown> = state.qr as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    target = target[part] as Record<string, unknown>;
  }
  const key = parts[parts.length - 1];

  if (["width", "height"].includes(path)) target[key] = clampNumber(value, 160, 900, 300);
  else if (path === "margin") target[key] = clampNumber(value, 0, 80, 10);
  else if (path === "imageSize") target[key] = clampNumber(value, 0.05, 0.35, 0.2);
  else if (path === "imageMargin") target[key] = clampNumber(value, 0, 30, 8);
  else if (path === "gradientRotation") target[key] = clampNumber(value, 0, 360, 0);
  else if (path === "jpegQuality") target[key] = clampNumber(value, 0.6, 1, 0.92);
  else if (path === "exportScale") target[key] = Number(value) as 1 | 2 | 4;
  else target[key] = value;
}

async function handleLogoUpload(file: File): Promise<void> {
  const error = validateLogoFile(file);
  if (error) {
    setStatus(error, true);
    return;
  }

  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    const sanitized = sanitizeSvg(await file.text());
    logoDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(sanitized)))}`;
  } else {
    logoDataUrl = await readFileAsDataUrl(file);
  }
  logoFileName = file.name;
  render();
  setStatus("Логотип добавлен.");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать файл.")));
    reader.readAsDataURL(file);
  });
}

function currentPayload(): string {
  return buildQrPayload(state.qr.contentType, state.qr.payloads);
}

function renderPreview(): void {
  if (state.mode !== "qr") return;

  const payload = currentPayload();
  const validation = validateQrPayload(state.qr.contentType, state.qr.payloads);
  const readability = buildReadabilityResult(state.qr, Boolean(logoDataUrl));
  const jpegTransparency = state.qr.transparentBackground && state.qr.downloadFormat === "jpeg";

  qrSizeLabel.textContent = `${state.qr.width} × ${state.qr.height}px`;
  qrStage.classList.toggle("is-transparent", state.qr.transparentBackground);

  try {
    const options = buildQrOptions(state.qr, payload, logoDataUrl, jpegTransparency ? { transparentBackground: false, backgroundColor: "#ffffff" } : undefined);
    if (!qrCode) {
      qrCode = new QRCodeStyling(options);
      qrPreview.innerHTML = "";
      qrCode.append(qrPreview);
    } else {
      qrCode.update(options);
    }
  } catch (error) {
    console.error(error);
    setStatus("Не удалось сгенерировать QR-код.", true);
  }

  renderWarnings(validation.errors, readability, jpegTransparency);
}

function renderWarnings(errors: string[], readability: ReturnType<typeof buildReadabilityResult>, jpegTransparency: boolean): void {
  const messages = [
    ...errors,
    ...readability.warnings.map((warning) => warning.message),
    jpegTransparency ? "Формат JPEG не поддерживает прозрачность. При скачивании будет использован белый фон" : "",
  ].filter(Boolean);

  warningBox.hidden = messages.length === 0;
  warningBox.innerHTML = "";

  if (messages.length > 0) {
    for (const message of messages) {
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      warningBox.append(paragraph);
    }
  }

  const contrast = `Контраст: ${readability.contrastRatio.toFixed(2)}. ${readability.rating}.`;
  setStatus(contrast, errors.length > 0);
}

async function downloadQr(): Promise<void> {
  const validation = validateQrPayload(state.qr.contentType, state.qr.payloads);
  if (validation.errors.length) {
    setStatus(validation.errors[0], true);
    return;
  }

  const scale = state.qr.downloadFormat === "png" ? state.qr.exportScale : 1;
  const fileName = sanitizeFileName(state.qr.fileName || `qr-${state.qr.contentType}`);
  const override = scale > 1 ? { width: state.qr.width * scale, height: state.qr.height * scale } : undefined;

  try {
    if (override) {
      qrCode?.update(buildQrOptions(state.qr, currentPayload(), logoDataUrl, override));
    }

    await qrCode?.download({ name: fileName, extension: state.qr.downloadFormat });
    setStatus("QR-код скачан.");
  } catch (error) {
    console.error(error);
    setStatus("Не удалось скачать QR-код.", true);
  } finally {
    if (override) {
      renderPreview();
    }
  }
}

function setStatus(message: string, isError = false): void {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}

function persist(): void {
  saveSettings(state);
}
