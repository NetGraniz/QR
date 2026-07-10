import QRCodeStyling from "qr-code-styling";
import Papa from "papaparse";
import "./styles.css";
import { configureQrUtf8Encoding } from "./qr/qrEncoding";
import {
  BARCODE_DOWNLOAD_FORMATS,
  BARCODE_FORMAT_LABELS,
  BARCODE_FORMATS,
  DEFAULT_BARCODE_SETTINGS,
  TEXT_ALIGN_LABELS,
  BARCODE_TEXT_ALIGNMENTS,
} from "./barcode/barcodeConfig";
import { downloadBarcode, rasterizeBarcode, renderBarcode, serializeBarcodeSvg } from "./barcode/barcodeGenerator";
import { validateBarcode } from "./barcode/barcodeValidation";
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
import { getSafeOpenUrl, scanImageFile, scanVideoFrame, verifyQrPreview } from "./scanner/scanner";
import { clearHistoryEntries, deleteHistoryEntry, listHistoryEntries, renameHistoryEntry, saveHistoryEntry } from "./history/historyStorage";
import { buildBatchZip, type BatchCodeKind, type BatchExportFormat, type BatchRecord } from "./export/zipExport";
import { deleteTemplate, exportTemplate, importTemplate, listTemplates, renameTemplate, saveTemplate } from "./templates/templateStorage";
import { registerServiceWorker } from "./pwa";
import { sanitizeSvg } from "./shared/security";
import { sanitizeFileName } from "./shared/fileNames";
import type { AppMode, BarcodeSettings, ExportFormat, HistoryEntry, PersistedAppState, QRContentType, QRSettings, ScanOutcome, ScanResult, StyleTemplate } from "./shared/types";
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
  batch: "Пакетная генерация",
};

let state: PersistedAppState = loadSettings();
let historyEntries: HistoryEntry[] = [];
let styleTemplates: StyleTemplate[] = [];
let batchRecords: BatchRecord[] = [];
let batchColumns: string[] = [];
let batchFileName = "";
let batchKind: BatchCodeKind = "qr";
let batchFormat: BatchExportFormat = "svg";
let batchValueColumn = "";
let batchFileNameColumn = "";
let logoDataUrl = "";
let logoFileName = "";
let qrCode: QRCodeStyling | null = null;
let barcodeSvg: SVGSVGElement | null = null;
let scannerPreviewUrl = "";
let scannerResults: ScanResult[] = [];
let scannerMessage = "";
let scannerCameraStream: MediaStream | null = null;
let scannerCameraTimer: number | null = null;
let qrVerificationToken = 0;

const app = getRequiredElement<HTMLDivElement>("#app");

configureQrUtf8Encoding();

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

registerServiceWorker();
render();
bindEvents();
void refreshLocalCollections();

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
    renderBarcodeForm();
  } else if (state.mode === "scanner") {
    renderScannerForm();
  } else if (state.mode === "batch") {
    renderBatchForm();
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

    <details class="settings-section">
      <summary>Рамка и подпись</summary>
      <label class="toggle-field">
        <input type="checkbox" data-setting="frame.enabled" ${qr.frame.enabled ? "checked" : ""} />
        <span>Добавить рамку вокруг QR-кода</span>
      </label>
      <div class="control-grid">
        ${colorField("frame.color", "Цвет рамки", qr.frame.color)}
        ${numberField("frame.thickness", "Толщина рамки, px", qr.frame.thickness, 0, 24, 1)}
        ${numberField("frame.radius", "Скругление, px", qr.frame.radius, 0, 80, 1)}
        ${numberField("frame.padding", "Внутренний отступ, px", qr.frame.padding, 0, 80, 1)}
      </div>
      ${textField("caption.text", "Подпись", qr.caption.text, "Сканируйте меня")}
      <div class="control-grid">
        ${numberField("caption.size", "Размер подписи, px", qr.caption.size, 10, 48, 1)}
        ${colorField("caption.color", "Цвет подписи", qr.caption.color)}
        ${selectField("caption.align", "Выравнивание", qr.caption.align, [["left", "Слева"], ["center", "По центру"], ["right", "Справа"]])}
      </div>
      <label class="toggle-field">
        <input type="checkbox" data-setting="caption.bold" ${qr.caption.bold ? "checked" : ""} />
        <span>Жирная подпись</span>
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
      <div class="download-row">
        <button class="primary-button" id="downloadButton" type="button">Скачать QR-код</button>
        <button class="ghost-button" id="copyQrPngButton" type="button">Копировать PNG</button>
        <button class="ghost-button" id="copyQrSvgButton" type="button">Копировать SVG</button>
        <button class="ghost-button" id="printQrButton" type="button">Печать</button>
      </div>
    </details>

    <details class="settings-section">
      <summary>Шаблоны оформления</summary>
      <div class="download-row">
        <button class="primary-button" id="saveTemplateButton" type="button">Сохранить шаблон</button>
        <label class="file-button" for="templateImportInput">Импорт JSON</label>
        <input id="templateImportInput" class="hidden-file" type="file" accept="application/json,.json" />
      </div>
      <div class="template-list">${renderTemplates()}</div>
    </details>

    <details class="settings-section">
      <summary>История</summary>
      <div class="download-row">
        <button class="ghost-button" id="saveHistoryButton" type="button">Сохранить в историю</button>
        <button class="ghost-button" id="clearHistoryButton" type="button">Очистить историю</button>
      </div>
      <div class="history-list">${renderHistory()}</div>
    </details>
  `;

  const payloadOutput = getRequiredElement<HTMLTextAreaElement>("#payloadOutput");
  payloadOutput.value = currentPayload();
}

function renderBarcodeForm(): void {
  const barcode = state.barcode;
  modeForm.innerHTML = `
    <details class="settings-section" open>
      <summary>Данные</summary>
      <div class="control-grid">
        ${barcodeSelectField("format", "Формат штрихкода", barcode.format, BARCODE_FORMATS.map((value) => [value, BARCODE_FORMAT_LABELS[value]]))}
        ${barcodeTextField("value", "Значение", barcode.value, "1234567890")}
      </div>
      <div class="download-row">
        <button class="ghost-button" id="clearBarcodeButton" type="button">Очистить</button>
        <p class="helper-text">Для EAN, UPC и ITF контрольная цифра рассчитывается автоматически, если введена основная часть значения.</p>
      </div>
    </details>

    <details class="settings-section" open>
      <summary>Оформление</summary>
      <div class="control-grid">
        ${barcodeNumberField("width", "Ширина штриха", barcode.width, 1, 6, 0.1)}
        ${barcodeNumberField("height", "Высота, px", barcode.height, 40, 260, 5)}
        ${barcodeNumberField("margin", "Внешний отступ, px", barcode.margin, 0, 80, 1)}
      </div>
      <div class="control-grid">
        ${barcodeColorField("lineColor", "Цвет штрихов", barcode.lineColor)}
        ${barcodeColorField("backgroundColor", "Цвет фона", barcode.backgroundColor, barcode.transparentBackground)}
      </div>
      <label class="toggle-field">
        <input type="checkbox" data-barcode-setting="transparentBackground" ${barcode.transparentBackground ? "checked" : ""} />
        <span>Прозрачный фон</span>
      </label>
    </details>

    <details class="settings-section" open>
      <summary>Подпись значения</summary>
      <label class="toggle-field">
        <input type="checkbox" data-barcode-setting="displayValue" ${barcode.displayValue ? "checked" : ""} />
        <span>Показывать значение под штрихкодом</span>
      </label>
      <div class="control-grid">
        ${barcodeNumberField("fontSize", "Размер текста, px", barcode.fontSize, 10, 32, 1)}
        ${barcodeNumberField("textMargin", "Отступ текста, px", barcode.textMargin, 0, 30, 1)}
        ${barcodeSelectField("textAlign", "Выравнивание текста", barcode.textAlign, BARCODE_TEXT_ALIGNMENTS.map((value) => [value, TEXT_ALIGN_LABELS[value]]))}
      </div>
      <label class="toggle-field">
        <input type="checkbox" data-barcode-setting="fontBold" ${barcode.fontBold ? "checked" : ""} />
        <span>Жирное начертание</span>
      </label>
    </details>

    <details class="settings-section" open>
      <summary>Экспорт</summary>
      <div class="control-grid">
        ${barcodeSelectField("downloadFormat", "Формат", barcode.downloadFormat, BARCODE_DOWNLOAD_FORMATS.map((value) => [value, value.toUpperCase()]))}
        ${barcodeSelectField("exportScale", "Масштаб PNG", String(barcode.exportScale), [["1", "1×"], ["2", "2×"], ["4", "4×"]])}
        ${barcodeRangeField("jpegQuality", "Качество JPEG", barcode.jpegQuality, 0.6, 1, 0.01, `${Math.round(barcode.jpegQuality * 100)}%`)}
      </div>
      ${barcodeTextField("fileName", "Имя файла", barcode.fileName, defaultBarcodeFileName(barcode))}
      <div class="download-row">
        <button class="primary-button" id="downloadBarcodeButton" type="button">Скачать штрихкод</button>
        <button class="ghost-button" id="copyBarcodePngButton" type="button">Копировать PNG</button>
        <button class="ghost-button" id="copyBarcodeSvgButton" type="button">Копировать SVG</button>
        <button class="ghost-button" id="printBarcodeButton" type="button">Печать</button>
      </div>
    </details>

    <details class="settings-section">
      <summary>История</summary>
      <div class="download-row">
        <button class="ghost-button" id="saveHistoryButton" type="button">Сохранить в историю</button>
        <button class="ghost-button" id="clearHistoryButton" type="button">Очистить историю</button>
      </div>
      <div class="history-list">${renderHistory()}</div>
    </details>
  `;
}

function renderScannerForm(): void {
  modeForm.innerHTML = `
    <details class="settings-section" open>
      <summary>Изображение</summary>
      <div class="scanner-dropzone" id="scannerDropzone">
        <p><strong>Перетащите изображение с кодом сюда</strong></p>
        <p>Также можно выбрать файл или вставить изображение через Ctrl+V.</p>
        <label class="file-button" for="scannerImageInput">Выбрать изображение</label>
        <input id="scannerImageInput" type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp" />
      </div>
      <div class="download-row">
        <button class="ghost-button" id="clearScannerButton" type="button">Очистить изображение</button>
      </div>
    </details>

    <details class="settings-section" open>
      <summary>Камера</summary>
      <div class="download-row">
        <button class="primary-button" id="startCameraButton" type="button">Включить камеру</button>
        <button class="ghost-button" id="stopCameraButton" type="button">Остановить камеру</button>
      </div>
      <p class="helper-text">Камера использует BarcodeDetector. Если браузер его не поддерживает, загрузите изображение: QR-коды будут проверены резервным модулем.</p>
    </details>

    <details class="settings-section" open>
      <summary>Результат</summary>
      <div class="scanner-result" id="scannerResult">${renderScannerResults()}</div>
    </details>
  `;
}

function renderBatchForm(): void {
  const valueColumn = batchValueColumn || batchColumns[0] || "";
  const fileColumn = batchFileNameColumn || batchColumns[1] || valueColumn;
  modeForm.innerHTML = `
    <details class="settings-section" open>
      <summary>CSV-файл</summary>
      <div class="scanner-dropzone" id="batchDropzone">
        <p><strong>Загрузите CSV до 500 строк</strong></p>
        <p>${batchFileName ? `Выбран файл: ${escapeHtml(batchFileName)}` : "Перетащите CSV сюда или выберите файл."}</p>
        <div class="download-row">
          <label class="file-button" for="batchCsvInput">Выбрать CSV</label>
          <a class="ghost-button" href="./examples/batch-example.csv" download="batch-example.csv">Скачать пример CSV</a>
        </div>
        <input id="batchCsvInput" class="hidden-file" type="file" accept=".csv,text/csv" />
      </div>
    </details>

    <details class="settings-section" open>
      <summary>Настройки генерации</summary>
      <div class="control-grid">
        ${batchSelectField("kind", "Тип кода", batchKind, [["qr", "QR-коды"], ["barcode", "Штрихкоды"]])}
        ${batchSelectField("format", "Формат файлов", batchFormat, [["svg", "SVG"], ["png", "PNG"]])}
        ${batchSelectField("valueColumn", "Столбец значения", valueColumn, batchColumns.map((column) => [column, column]))}
        ${batchSelectField("fileNameColumn", "Столбец имени файла", fileColumn, batchColumns.map((column) => [column, column]))}
      </div>
      <button class="primary-button" id="generateBatchButton" type="button" ${batchRecords.length === 0 ? "disabled" : ""}>Создать ZIP</button>
    </details>

    <details class="settings-section" open>
      <summary>Предпросмотр первых строк</summary>
      <div class="batch-preview">${renderBatchPreview()}</div>
    </details>
  `;
}

function renderBatchPreview(): string {
  if (batchRecords.length === 0) {
    return `<p class="helper-text">После загрузки CSV здесь появятся первые пять записей.</p>`;
  }

  return `
    <table class="batch-table">
      <thead><tr>${batchColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>
        ${batchRecords.slice(0, 5).map((record) => `<tr>${batchColumns.map((column) => `<td>${escapeHtml(record[column] ?? "")}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
    <p class="helper-text">Найдено записей: ${Math.min(batchRecords.length, 500)}${batchRecords.length > 500 ? " из CSV будет использовано только 500." : "."}</p>
  `;
}

function renderScannerResults(): string {
  if (scannerResults.length === 0) {
    return `<p class="helper-text">${escapeHtml(scannerMessage || "Загрузите изображение или включите камеру, чтобы распознать QR-код или штрихкод.")}</p>`;
  }

  return scannerResults
    .map((result, index) => {
      const safeUrl = getSafeOpenUrl(result.value);
      return `
        <article class="scan-result-card">
          <p><strong>Тип кода:</strong> ${escapeHtml(formatScanFormat(result.format))}</p>
          <label class="field">
            <span>Распознанное значение</span>
            <textarea readonly rows="4">${escapeHtml(result.value)}</textarea>
          </label>
          <div class="download-row">
            <button class="ghost-button" type="button" data-copy-scan="${index}">Копировать</button>
            ${safeUrl ? `<button class="ghost-button" type="button" data-open-scan="${index}">Открыть ссылку</button>` : ""}
            <button class="primary-button" type="button" data-create-scan="${index}">Создать новый код</button>
          </div>
        </article>
      `;
    })
    .join("");
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

function barcodeTextField(setting: string, label: string, value: string, placeholder = ""): string {
  return `<label class="field"><span>${label}</span><input data-barcode-setting="${setting}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" /></label>`;
}

function barcodeNumberField(setting: string, label: string, value: number, min: number, max: number, step: number): string {
  return `<label class="field"><span>${label}</span><input type="number" data-barcode-setting="${setting}" value="${value}" min="${min}" max="${max}" step="${step}" /></label>`;
}

function barcodeRangeField(setting: string, label: string, value: number, min: number, max: number, step: number, suffix: string): string {
  return `<label class="field"><span>${label} <b>${suffix}</b></span><input type="range" data-barcode-setting="${setting}" value="${value}" min="${min}" max="${max}" step="${step}" /></label>`;
}

function barcodeColorField(setting: string, label: string, value: string, disabled = false): string {
  return `<label class="field color-field"><span>${label}</span><input type="color" data-barcode-setting="${setting}" value="${value}" ${disabled ? "disabled" : ""} /></label>`;
}

function barcodeSelectField(setting: string, label: string, selected: string, options: Array<[string, string]>): string {
  return `
    <label class="field">
      <span>${label}</span>
      <select data-barcode-setting="${setting}">
        ${options.map(([value, optionLabel]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function batchSelectField(setting: string, label: string, selected: string, options: Array<[string, string]>): string {
  return `
    <label class="field">
      <span>${label}</span>
      <select data-batch-setting="${setting}" ${options.length === 0 ? "disabled" : ""}>
        ${options.map(([value, optionLabel]) => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderTemplates(): string {
  if (styleTemplates.length === 0) {
    return `<p class="helper-text">Сохранённых шаблонов пока нет.</p>`;
  }

  return styleTemplates
    .map(
      (template) => `
        <article class="compact-item">
          <strong>${escapeHtml(template.name)}</strong>
          <div class="download-row">
            <button class="ghost-button" type="button" data-apply-template="${template.id}">Применить</button>
            <button class="ghost-button" type="button" data-export-template="${template.id}">Экспорт</button>
            <button class="ghost-button" type="button" data-rename-template="${template.id}">Переименовать</button>
            <button class="ghost-button" type="button" data-delete-template="${template.id}">Удалить</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderHistory(): string {
  if (historyEntries.length === 0) {
    return `<p class="helper-text">История пока пустая.</p>`;
  }

  return historyEntries
    .slice(0, 12)
    .map(
      (entry) => `
        <article class="compact-item">
          <strong>${escapeHtml(entry.title)}</strong>
          <span>${entry.kind === "qr" ? "QR" : "Штрихкод"} · ${escapeHtml(entry.subtype)} · ${new Date(entry.createdAt).toLocaleString("ru-RU")}</span>
          <div class="download-row">
            <button class="ghost-button" type="button" data-open-history="${entry.id}">Открыть</button>
            <button class="ghost-button" type="button" data-duplicate-history="${entry.id}">Дублировать</button>
            <button class="ghost-button" type="button" data-rename-history="${entry.id}">Переименовать</button>
            <button class="ghost-button" type="button" data-delete-history="${entry.id}">Удалить</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function bindEvents(): void {
  modeTabs.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mode]");
    if (!button) return;
    if (state.mode === "scanner" && button.dataset.mode !== "scanner") {
      stopScannerCamera(false);
    }
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
      return;
    }

    if (target.closest("#copyQrPngButton")) {
      await copyQrPng();
      return;
    }

    if (target.closest("#copyQrSvgButton")) {
      await copyQrSvg();
      return;
    }

    if (target.closest("#printQrButton")) {
      await printQr();
      return;
    }

    if (target.closest("#saveHistoryButton")) {
      await saveCurrentHistoryEntry();
      return;
    }

    if (target.closest("#clearHistoryButton")) {
      await clearHistoryEntries();
      await refreshLocalCollections();
      setStatus("История очищена.");
      return;
    }

    if (target.closest("#saveTemplateButton")) {
      saveCurrentTemplate();
      await refreshLocalCollections();
      setStatus("Шаблон сохранён.");
      return;
    }

    if (target.closest("#clearBarcodeButton")) {
      state.barcode.value = "";
      render();
      setStatus("Значение штрихкода очищено.");
      return;
    }

    if (target.closest("#downloadBarcodeButton")) {
      await downloadCurrentBarcode();
      return;
    }

    if (target.closest("#copyBarcodePngButton")) {
      await copyBarcodePng();
      return;
    }

    if (target.closest("#copyBarcodeSvgButton")) {
      await copyBarcodeSvg();
      return;
    }

    if (target.closest("#printBarcodeButton")) {
      await printBarcode();
      return;
    }

    const templateAction = handleTemplateAction(target);
    if (templateAction) return;

    const historyAction = await handleHistoryAction(target);
    if (historyAction) return;

    const copyScanButton = target.closest<HTMLButtonElement>("[data-copy-scan]");
    if (copyScanButton) {
      const result = scannerResults[Number(copyScanButton.dataset.copyScan)];
      if (result) {
        await navigator.clipboard?.writeText(result.value);
        setStatus("Распознанное значение скопировано.");
      }
      return;
    }

    const openScanButton = target.closest<HTMLButtonElement>("[data-open-scan]");
    if (openScanButton) {
      const result = scannerResults[Number(openScanButton.dataset.openScan)];
      const safeUrl = result ? getSafeOpenUrl(result.value) : null;
      if (safeUrl) {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
      } else {
        setStatus("Ссылка не открыта: протокол небезопасен.", true);
      }
      return;
    }

    const createScanButton = target.closest<HTMLButtonElement>("[data-create-scan]");
    if (createScanButton) {
      const result = scannerResults[Number(createScanButton.dataset.createScan)];
      if (result) {
        createCodeFromScan(result);
      }
      return;
    }

    if (target.closest("#clearScannerButton")) {
      clearScanner();
      render();
      return;
    }

    if (target.closest("#startCameraButton")) {
      await startScannerCamera();
      return;
    }

    if (target.closest("#stopCameraButton")) {
      stopScannerCamera();
      setStatus("Камера остановлена.");
      render();
    }

    if (target.closest("#generateBatchButton")) {
      await generateBatchZip();
    }
  });

  settingsForm.addEventListener("change", async (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === "logoInput" && input.files?.[0]) {
      await handleLogoUpload(input.files[0]);
    }
    if (input.id === "scannerImageInput" && input.files?.[0]) {
      await handleScannerFile(input.files[0]);
    }
    if (input.id === "templateImportInput" && input.files?.[0]) {
      await importTemplateFile(input.files[0]);
    }
    if (input.id === "batchCsvInput" && input.files?.[0]) {
      await handleBatchCsv(input.files[0]);
    }
  });

  settingsForm.addEventListener("dragover", (event) => {
    if ((event.target as HTMLElement).closest("#scannerDropzone, #batchDropzone")) {
      event.preventDefault();
      ((event.target as HTMLElement).closest("#scannerDropzone, #batchDropzone") as HTMLElement).classList.add("is-dragging");
    }
  });

  settingsForm.addEventListener("dragleave", (event) => {
    ((event.target as HTMLElement).closest("#scannerDropzone, #batchDropzone") as HTMLElement | null)?.classList.remove("is-dragging");
  });

  settingsForm.addEventListener("drop", async (event) => {
    if (!(event.target as HTMLElement).closest("#scannerDropzone")) return;
    event.preventDefault();
    getRequiredElement<HTMLDivElement>("#scannerDropzone").classList.remove("is-dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleScannerFile(file);
    }
  });

  settingsForm.addEventListener("drop", async (event) => {
    if (!(event.target as HTMLElement).closest("#batchDropzone")) return;
    event.preventDefault();
    ((event.target as HTMLElement).closest("#batchDropzone") as HTMLElement).classList.remove("is-dragging");
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await handleBatchCsv(file);
    }
  });

  window.addEventListener("paste", async (event) => {
    if (state.mode !== "scanner") return;
    const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
    if (file) {
      await handleScannerFile(file);
    }
  });

  resetButton.addEventListener("click", () => {
    if (state.mode === "scanner") {
      clearScanner();
      render();
      return;
    }

    if (state.mode === "barcode") {
      state.barcode = structuredClone(DEFAULT_BARCODE_SETTINGS);
      render();
      return;
    }

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
  const batchSetting = element.dataset.batchSetting;
  if (batchSetting) {
    setBatchSetting(batchSetting, element.value);
    render();
    return;
  }

  const focusSnapshot = captureInputFocus(element);
  const barcodeSetting = element.dataset.barcodeSetting;
  if (barcodeSetting) {
    const value = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : element.value;
    setNestedBarcodeSetting(barcodeSetting, value);
    render();
    restoreInputFocus(focusSnapshot);
    return;
  }

  const setting = element.dataset.setting;
  if (!setting) return;

  const openSections = captureOpenSections();
  const value = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : element.value;
  setNestedSetting(setting, value);
  render();
  restoreOpenSections(openSections);
  restoreInputFocus(focusSnapshot);
}

function captureOpenSections(): string[] {
  return Array.from(settingsForm.querySelectorAll<HTMLDetailsElement>("details.settings-section[open]"))
    .map((details) => details.querySelector("summary")?.textContent?.trim() ?? "")
    .filter(Boolean);
}

function restoreOpenSections(openSections: string[]): void {
  const openSet = new Set(openSections);
  for (const details of settingsForm.querySelectorAll<HTMLDetailsElement>("details.settings-section")) {
    const summary = details.querySelector("summary")?.textContent?.trim() ?? "";
    if (openSet.has(summary)) {
      details.open = true;
    }
  }
}

function setBatchSetting(setting: string, value: string): void {
  if (setting === "kind") batchKind = value as BatchCodeKind;
  else if (setting === "format") batchFormat = value as BatchExportFormat;
  else if (setting === "valueColumn") batchValueColumn = value;
  else if (setting === "fileNameColumn") batchFileNameColumn = value;
}

type InputFocusSnapshot = {
  attribute: "data-setting" | "data-barcode-setting";
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
} | null;

function captureInputFocus(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): InputFocusSnapshot {
  const value = element.dataset.barcodeSetting ?? element.dataset.setting;
  if (!value) return null;

  const attribute = element.dataset.barcodeSetting ? "data-barcode-setting" : "data-setting";
  let selectionStart: number | null = null;
  let selectionEnd: number | null = null;

  try {
    selectionStart = "selectionStart" in element ? element.selectionStart : null;
    selectionEnd = "selectionEnd" in element ? element.selectionEnd : null;
  } catch {
    selectionStart = null;
    selectionEnd = null;
  }

  return { attribute, value, selectionStart, selectionEnd };
}

function restoreInputFocus(snapshot: InputFocusSnapshot): void {
  if (!snapshot) return;

  const selector = `[${snapshot.attribute}="${snapshot.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
  const element = settingsForm.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector);
  if (!element) return;

  element.focus();
  if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null && "setSelectionRange" in element) {
    try {
      element.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {
      // Non-text controls do not support restoring a cursor range.
    }
  }
}

function setNestedBarcodeSetting(path: string, value: string | boolean): void {
  const barcode = state.barcode as unknown as Record<string, unknown>;

  if (path === "width") barcode[path] = clampNumber(value, 1, 6, DEFAULT_BARCODE_SETTINGS.width);
  else if (path === "height") barcode[path] = clampNumber(value, 40, 260, DEFAULT_BARCODE_SETTINGS.height);
  else if (path === "margin") barcode[path] = clampNumber(value, 0, 80, DEFAULT_BARCODE_SETTINGS.margin);
  else if (path === "fontSize") barcode[path] = clampNumber(value, 10, 32, DEFAULT_BARCODE_SETTINGS.fontSize);
  else if (path === "textMargin") barcode[path] = clampNumber(value, 0, 30, DEFAULT_BARCODE_SETTINGS.textMargin);
  else if (path === "jpegQuality") barcode[path] = clampNumber(value, 0.6, 1, DEFAULT_BARCODE_SETTINGS.jpegQuality);
  else if (path === "exportScale") barcode[path] = Number(value) as 1 | 2 | 4;
  else barcode[path] = value;
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
  else if (path === "frame.thickness") target[key] = clampNumber(value, 0, 24, DEFAULT_QR_SETTINGS.frame.thickness);
  else if (path === "frame.radius") target[key] = clampNumber(value, 0, 80, DEFAULT_QR_SETTINGS.frame.radius);
  else if (path === "frame.padding") target[key] = clampNumber(value, 0, 80, DEFAULT_QR_SETTINGS.frame.padding);
  else if (path === "caption.size") target[key] = clampNumber(value, 10, 48, DEFAULT_QR_SETTINGS.caption.size);
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
  if (state.mode === "scanner") {
    renderScannerPreview();
    return;
  }

  if (state.mode === "barcode") {
    renderBarcodePreview();
    return;
  }

  if (state.mode === "batch") {
    qrCode = null;
    barcodeSvg = null;
    resetQrPreviewDecoration();
    qrSizeLabel.textContent = "CSV → ZIP";
    qrStage.classList.remove("is-transparent");
    warningBox.hidden = true;
    warningBox.innerHTML = "";
    qrPreview.innerHTML = `<div class="scanner-preview-empty">Загрузите CSV, выберите столбцы и получите ZIP с кодами.</div>`;
    setStatus(batchRecords.length ? `Готово записей для пакета: ${Math.min(batchRecords.length, 500)}.` : "Загрузите CSV для пакетной генерации.");
    return;
  }

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
    decorateQrPreview();
  } catch (error) {
    console.error(error);
    setStatus("Не удалось сгенерировать QR-код.", true);
  }

  renderWarnings(validation.errors, readability, jpegTransparency);
  queueQrVerification(payload);
}

function decorateQrPreview(): void {
  const frame = state.qr.frame;
  const caption = state.qr.caption;
  qrPreview.classList.add("qr-preview-content");
  qrPreview.classList.toggle("has-qr-frame", frame.enabled);
  qrPreview.style.borderColor = frame.enabled ? frame.color : "transparent";
  qrPreview.style.borderWidth = frame.enabled ? `${frame.thickness}px` : "0";
  qrPreview.style.borderRadius = frame.enabled ? `${frame.radius}px` : "0";
  qrPreview.style.padding = frame.enabled ? `${frame.padding}px` : "";

  qrPreview.querySelector(".qr-caption-preview")?.remove();

  if (caption.text.trim()) {
    const captionElement = document.createElement("div");
    captionElement.className = "qr-caption-preview";
    captionElement.textContent = caption.text;
    captionElement.style.color = caption.color;
    captionElement.style.fontSize = `${caption.size}px`;
    captionElement.style.fontWeight = caption.bold ? "800" : "500";
    captionElement.style.textAlign = caption.align;
    qrPreview.append(captionElement);
  }
}

function resetQrPreviewDecoration(): void {
  qrPreview.classList.remove("has-qr-frame", "qr-preview-content");
  qrPreview.style.borderColor = "";
  qrPreview.style.borderWidth = "";
  qrPreview.style.borderRadius = "";
  qrPreview.style.padding = "";
}

function renderScannerPreview(): void {
  qrCode = null;
  barcodeSvg = null;
  resetQrPreviewDecoration();
  qrSizeLabel.textContent = "Сканер";
  qrStage.classList.remove("is-transparent");
  warningBox.hidden = true;
  warningBox.innerHTML = "";

  if (scannerCameraStream) {
    qrPreview.innerHTML = `<video class="scanner-video" id="scannerVideo" autoplay muted playsinline></video>`;
    attachCameraPreview();
  } else if (scannerPreviewUrl) {
    qrPreview.innerHTML = `<img class="scanner-image" src="${escapeHtml(scannerPreviewUrl)}" alt="Изображение для сканирования" />`;
  } else {
    qrPreview.innerHTML = `<div class="scanner-preview-empty">Здесь появится изображение или поток камеры.</div>`;
  }

  setStatus(scannerMessage || "Готов к сканированию.");
}

function renderBarcodePreview(): void {
  resetQrPreviewDecoration();
  const validation = validateBarcode(state.barcode.format, state.barcode.value);
  qrCode = null;
  qrSizeLabel.textContent = BARCODE_FORMAT_LABELS[state.barcode.format];
  qrStage.classList.toggle("is-transparent", state.barcode.transparentBackground);
  warningBox.hidden = true;
  warningBox.innerHTML = "";
  qrPreview.innerHTML = "";

  if (!validation.valid) {
    barcodeSvg = null;
    setStatus(validation.error ?? "Проверьте значение штрихкода.", true);
    return;
  }

  try {
    barcodeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    barcodeSvg.setAttribute("role", "img");
    barcodeSvg.setAttribute("aria-label", `Штрихкод ${BARCODE_FORMAT_LABELS[state.barcode.format]}`);
    renderBarcode(barcodeSvg, state.barcode, validation.value);
    qrPreview.append(barcodeSvg);

    const jpegTransparency = state.barcode.transparentBackground && state.barcode.downloadFormat === "jpeg";
    if (jpegTransparency) {
      warningBox.hidden = false;
      const paragraph = document.createElement("p");
      paragraph.textContent = "Формат JPEG не поддерживает прозрачность. При скачивании будет использован белый фон";
      warningBox.append(paragraph);
    }

    const autoDigit = validation.value !== state.barcode.value.trim() ? ` Итоговое значение: ${validation.value}.` : "";
    setStatus(`Штрихкод готов.${autoDigit}`);
  } catch (error) {
    console.error(error);
    barcodeSvg = null;
    setStatus("Не удалось сгенерировать штрихкод. Проверьте формат и значение.", true);
  }
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

  const fileName = sanitizeFileName(state.qr.fileName || `qr-${state.qr.contentType}`);

  try {
    const blob = await getQrExportBlob(state.qr.downloadFormat);
    downloadBlob(`${fileName}.${state.qr.downloadFormat}`, blob);
    setStatus("QR-код скачан.");
  } catch (error) {
    console.error(error);
    setStatus("Не удалось скачать QR-код.", true);
  }
}

async function getQrExportBlob(format: ExportFormat): Promise<Blob> {
  const validation = validateQrPayload(state.qr.contentType, state.qr.payloads);
  if (validation.errors.length) {
    throw new Error(validation.errors[0]);
  }

  const scale = format === "png" ? state.qr.exportScale : 1;
  const override = {
    downloadFormat: format,
    ...(scale > 1 ? { width: state.qr.width * scale, height: state.qr.height * scale } : {}),
    ...(format === "jpeg" && state.qr.transparentBackground ? { transparentBackground: false, backgroundColor: "#ffffff" } : {}),
  };
  const exportSettings = { ...state.qr, ...override };
  const exporter = new QRCodeStyling(buildQrOptions(state.qr, currentPayload(), logoDataUrl, override));
  const raw = await exporter.getRawData(format);

  if (!raw) {
    throw new Error("Не удалось подготовить QR-код.");
  }

  let blob: Blob;
  if (raw instanceof Blob) {
    blob = raw;
  } else if (typeof raw === "string") {
    blob = new Blob([raw], { type: format === "svg" ? "image/svg+xml;charset=utf-8" : `image/${format}` });
  } else {
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw as unknown as Uint8Array);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    blob = new Blob([copy], { type: format === "svg" ? "image/svg+xml;charset=utf-8" : `image/${format}` });
  }

  if (!hasQrExportDecoration(exportSettings)) {
    return blob;
  }

  return format === "svg" ? composeQrSvg(blob, exportSettings) : composeQrRaster(blob, exportSettings, format);
}

function hasQrExportDecoration(settings: QRSettings): boolean {
  return settings.frame.enabled || Boolean(settings.caption.text.trim());
}

async function composeQrSvg(qrBlob: Blob, settings: QRSettings): Promise<Blob> {
  const frame = settings.frame;
  const caption = settings.caption;
  const qrSvg = await qrBlob.text();
  const padding = frame.enabled ? frame.padding : 0;
  const thickness = frame.enabled ? frame.thickness : 0;
  const captionText = caption.text.trim();
  const captionGap = captionText ? Math.max(8, Math.round(caption.size * 0.6)) : 0;
  const captionHeight = captionText ? Math.ceil(caption.size * 1.4) : 0;
  const outerWidth = settings.width + (padding + thickness) * 2;
  const outerHeight = settings.height + (padding + thickness) * 2 + captionGap + captionHeight;
  const qrX = padding + thickness;
  const qrY = padding + thickness;
  const textAnchor = caption.align === "left" ? "start" : caption.align === "right" ? "end" : "middle";
  const textX = caption.align === "left" ? qrX : caption.align === "right" ? qrX + settings.width : outerWidth / 2;
  const encodedQr = utf8ToBase64(qrSvg);
  const textElement = captionText
    ? `<text x="${textX}" y="${qrY + settings.height + captionGap + caption.size}" fill="${caption.color}" font-size="${caption.size}" font-family="Arial, sans-serif" font-weight="${caption.bold ? 800 : 500}" text-anchor="${textAnchor}">${escapeXml(captionText)}</text>`
    : "";
  const frameElement = frame.enabled
    ? `<rect x="${thickness / 2}" y="${thickness / 2}" width="${outerWidth - thickness}" height="${settings.height + (padding + thickness) * 2 - thickness}" rx="${frame.radius}" fill="none" stroke="${frame.color}" stroke-width="${frame.thickness}" />`
    : "";

  const svg = `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerWidth}" height="${outerHeight}" viewBox="0 0 ${outerWidth} ${outerHeight}">
  ${frameElement}
  <image href="data:image/svg+xml;base64,${encodedQr}" x="${qrX}" y="${qrY}" width="${settings.width}" height="${settings.height}" />
  ${textElement}
</svg>`;

  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

async function composeQrRaster(qrBlob: Blob, settings: QRSettings, format: Exclude<ExportFormat, "svg">): Promise<Blob> {
  const frame = settings.frame;
  const caption = settings.caption;
  const padding = frame.enabled ? frame.padding : 0;
  const thickness = frame.enabled ? frame.thickness : 0;
  const captionText = caption.text.trim();
  const captionGap = captionText ? Math.max(8, Math.round(caption.size * 0.6)) : 0;
  const captionHeight = captionText ? Math.ceil(caption.size * 1.4) : 0;
  const outerWidth = settings.width + (padding + thickness) * 2;
  const outerHeight = settings.height + (padding + thickness) * 2 + captionGap + captionHeight;
  const canvas = document.createElement("canvas");
  canvas.width = outerWidth;
  canvas.height = outerHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas недоступен.");
  }

  if (format === "jpeg" || !settings.transparentBackground) {
    context.fillStyle = format === "jpeg" ? "#ffffff" : settings.backgroundColor;
    context.fillRect(0, 0, outerWidth, outerHeight);
  }

  if (frame.enabled && frame.thickness > 0) {
    context.strokeStyle = frame.color;
    context.lineWidth = frame.thickness;
    drawRoundedRect(context, thickness / 2, thickness / 2, outerWidth - thickness, settings.height + (padding + thickness) * 2 - thickness, frame.radius);
    context.stroke();
  }

  const image = await loadImageFromBlob(qrBlob);
  context.drawImage(image, padding + thickness, padding + thickness, settings.width, settings.height);

  if (captionText) {
    context.fillStyle = caption.color;
    context.font = `${caption.bold ? 800 : 500} ${caption.size}px Arial, sans-serif`;
    context.textAlign = caption.align;
    context.textBaseline = "alphabetic";
    const textX = caption.align === "left" ? padding + thickness : caption.align === "right" ? padding + thickness + settings.width : outerWidth / 2;
    context.fillText(captionText, textX, padding + thickness + settings.height + captionGap + caption.size);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Не удалось создать изображение."))), format === "jpeg" ? "image/jpeg" : "image/png", settings.jpegQuality);
  });
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.addEventListener("load", () => {
      URL.revokeObjectURL(url);
      resolve(image);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось подготовить изображение."));
    });
    image.src = url;
  });
}

function utf8ToBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

async function copyBlobToClipboard(blob: Blob, type: string): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Буфер обмена для изображений недоступен в этом браузере.");
  }

  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
}

async function copyQrPng(): Promise<void> {
  try {
    const blob = await getQrExportBlob("png");
    await copyBlobToClipboard(blob, "image/png");
    setStatus("PNG QR-кода скопирован в буфер обмена.");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Не удалось скопировать PNG.", true);
  }
}

async function copyQrSvg(): Promise<void> {
  try {
    const blob = await getQrExportBlob("svg");
    await navigator.clipboard?.writeText(await blob.text());
    setStatus("SVG-код QR-кода скопирован.");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Не удалось скопировать SVG.", true);
  }
}

async function printQr(): Promise<void> {
  try {
    const blob = await getQrExportBlob("png");
    await printBlobImage(blob, "QR Code Studio");
    setStatus("Окно печати открыто.");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Не удалось подготовить печать.", true);
  }
}

async function downloadCurrentBarcode(): Promise<void> {
  const validation = validateBarcode(state.barcode.format, state.barcode.value);
  if (!validation.valid) {
    setStatus(validation.error ?? "Проверьте значение штрихкода.", true);
    return;
  }

  if (!barcodeSvg) {
    renderBarcodePreview();
  }

  if (!barcodeSvg) {
    setStatus("Не удалось подготовить штрихкод для скачивания.", true);
    return;
  }

  try {
    await downloadBarcode(barcodeSvg, state.barcode, validation.value);
    setStatus("Штрихкод скачан.");
  } catch (error) {
    console.error(error);
    setStatus("Не удалось скачать штрихкод.", true);
  }
}

function requireBarcodeSvg(): { svg: SVGSVGElement; value: string } {
  const validation = validateBarcode(state.barcode.format, state.barcode.value);
  if (!validation.valid) {
    throw new Error(validation.error ?? "Проверьте значение штрихкода.");
  }

  if (!barcodeSvg) {
    renderBarcodePreview();
  }

  if (!barcodeSvg) {
    throw new Error("Не удалось подготовить штрихкод.");
  }

  return { svg: barcodeSvg, value: validation.value };
}

async function copyBarcodePng(): Promise<void> {
  try {
    const { svg } = requireBarcodeSvg();
    const blob = await rasterizeBarcode(svg, "png", state.barcode.exportScale, state.barcode.jpegQuality, state.barcode.transparentBackground, state.barcode.backgroundColor);
    await copyBlobToClipboard(blob, "image/png");
    setStatus("PNG штрихкода скопирован в буфер обмена.");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Не удалось скопировать PNG.", true);
  }
}

async function copyBarcodeSvg(): Promise<void> {
  try {
    const { svg } = requireBarcodeSvg();
    await navigator.clipboard?.writeText(serializeBarcodeSvg(svg));
    setStatus("SVG-код штрихкода скопирован.");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Не удалось скопировать SVG.", true);
  }
}

async function printBarcode(): Promise<void> {
  try {
    const { svg } = requireBarcodeSvg();
    const blob = await rasterizeBarcode(svg, "png", state.barcode.exportScale, state.barcode.jpegQuality, state.barcode.transparentBackground, state.barcode.backgroundColor);
    await printBlobImage(blob, "QR Code Studio barcode");
    setStatus("Окно печати открыто.");
  } catch (error) {
    console.error(error);
    setStatus(error instanceof Error ? error.message : "Не удалось подготовить печать.", true);
  }
}

function printBlobImage(blob: Blob, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(blob);
    const html = `
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: #fff; }
            img { max-width: 92vw; max-height: 92vh; }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="${escapeHtml(title)}" />
          <script>
            window.addEventListener("load", () => {
              window.setTimeout(() => {
                window.focus();
                window.print();
              }, 100);
            });
            window.addEventListener("afterprint", () => window.close());
          </script>
        </body>
      </html>
    `;
    const htmlUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const printWindow = window.open(htmlUrl, "_blank");
    if (!printWindow) {
      URL.revokeObjectURL(imageUrl);
      URL.revokeObjectURL(htmlUrl);
      reject(new Error("Браузер заблокировал окно печати."));
      return;
    }

    window.setTimeout(() => {
      URL.revokeObjectURL(imageUrl);
      URL.revokeObjectURL(htmlUrl);
    }, 30000);
    resolve();
  });
}

function defaultBarcodeFileName(settings: BarcodeSettings): string {
  const validation = validateBarcode(settings.format, settings.value);
  const value = validation.valid ? validation.value : settings.value || "code";
  return sanitizeFileName(`barcode-${settings.format.toLowerCase()}-${value}`, "barcode");
}

async function handleScannerFile(file: File): Promise<void> {
  stopScannerCamera(false);
  try {
    if (scannerPreviewUrl) {
      URL.revokeObjectURL(scannerPreviewUrl);
    }
    const { outcome, previewUrl } = await scanImageFile(file);
    scannerPreviewUrl = previewUrl;
    setScannerOutcome(outcome);
  } catch (error) {
    scannerResults = [];
    scannerMessage = error instanceof Error ? error.message : "Не удалось просканировать изображение.";
    render();
    setStatus(scannerMessage, true);
  }
}

function setScannerOutcome(outcome: ScanOutcome): void {
  scannerResults = outcome.results;
  scannerMessage = outcome.message;
  render();
  setStatus(outcome.message, outcome.results.length === 0);
}

function clearScanner(): void {
  stopScannerCamera(false);
  if (scannerPreviewUrl) {
    URL.revokeObjectURL(scannerPreviewUrl);
  }
  scannerPreviewUrl = "";
  scannerResults = [];
  scannerMessage = "Данные сканера очищены.";
}

async function startScannerCamera(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Камера недоступна в этом браузере.", true);
    return;
  }

  try {
    stopScannerCamera(false);
    scannerCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    scannerPreviewUrl = "";
    scannerResults = [];
    scannerMessage = "Камера включена. Наведите её на код.";
    render();
    startCameraScanLoop();
  } catch (error) {
    console.error(error);
    setStatus("Не удалось получить доступ к камере.", true);
  }
}

function stopScannerCamera(shouldRender = true): void {
  if (scannerCameraTimer !== null) {
    window.clearInterval(scannerCameraTimer);
    scannerCameraTimer = null;
  }
  scannerCameraStream?.getTracks().forEach((track) => track.stop());
  scannerCameraStream = null;
  if (shouldRender) {
    render();
  }
}

function attachCameraPreview(): void {
  window.setTimeout(async () => {
    const video = document.querySelector<HTMLVideoElement>("#scannerVideo");
    if (!video || !scannerCameraStream) return;
    video.srcObject = scannerCameraStream;
    try {
      await video.play();
    } catch {
      setStatus("Нажмите на страницу, если браузер заблокировал автозапуск камеры.", true);
    }
  }, 0);
}

function startCameraScanLoop(): void {
  if (scannerCameraTimer !== null) {
    window.clearInterval(scannerCameraTimer);
  }

  scannerCameraTimer = window.setInterval(async () => {
    const video = document.querySelector<HTMLVideoElement>("#scannerVideo");
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    try {
      const outcome = await scanVideoFrame(video);
      if (outcome.results.length > 0) {
        scannerResults = outcome.results;
        scannerMessage = outcome.message;
        const resultBox = document.querySelector<HTMLDivElement>("#scannerResult");
        if (resultBox) {
          resultBox.innerHTML = renderScannerResults();
        }
        setStatus(outcome.message);
      } else if (!outcome.detectorAvailable) {
        setStatus(outcome.message, true);
      }
    } catch (error) {
      console.error(error);
      setStatus("Не удалось распознать кадр с камеры.", true);
    }
  }, 900);
}

function createCodeFromScan(result: ScanResult): void {
  stopScannerCamera(false);
  if (result.format === "qr_code") {
    state.mode = "qr";
    state.qr.contentType = "text";
    state.qr.payloads.text.text = result.value;
  } else {
    state.mode = "barcode";
    state.barcode.value = result.value;
  }
  render();
  setStatus("Создан новый код из распознанного значения.");
}

function formatScanFormat(format: string): string {
  const labels: Record<string, string> = {
    qr_code: "QR-код",
    code_128: "Code 128",
    code_39: "Code 39",
    ean_13: "EAN-13",
    ean_8: "EAN-8",
    upc_a: "UPC-A",
    upc_e: "UPC-E",
    itf: "ITF",
    codabar: "Codabar",
  };
  return labels[format] ?? format;
}

function queueQrVerification(expectedPayload: string): void {
  const token = ++qrVerificationToken;
  window.setTimeout(async () => {
    if (token !== qrVerificationToken || state.mode !== "qr") return;
    try {
      const outcome = await verifyQrPreview(qrPreview, expectedPayload);
      if (token !== qrVerificationToken || state.mode !== "qr") return;
      if (outcome.results.length > 0) {
        const matches = outcome.results.some((result) => result.value === expectedPayload);
        setStatus(matches ? "QR-код успешно распознан" : "QR-код распознан, но значение отличается от исходных данных", !matches);
      } else {
        setStatus(outcome.message, true);
      }
    } catch {
      if (token === qrVerificationToken && state.mode === "qr") {
        setStatus("Автоматическая проверка недоступна в этом браузере.", true);
      }
    }
  }, 250);
}

async function refreshLocalCollections(): Promise<void> {
  try {
    historyEntries = await listHistoryEntries();
  } catch {
    historyEntries = [];
  }
  styleTemplates = listTemplates();
  render();
}

async function saveCurrentHistoryEntry(): Promise<void> {
  const kind = state.mode === "barcode" ? "barcode" : "qr";
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    kind,
    subtype: kind === "qr" ? state.qr.contentType : state.barcode.format,
    value: kind === "qr" ? historySafeQrPayload() : state.barcode.value,
    title: kind === "qr" ? defaultQrHistoryTitle() : defaultBarcodeFileName(state.barcode),
    createdAt: new Date().toISOString(),
    settings: structuredClone(kind === "qr" ? state.qr : state.barcode),
    thumbnail: currentPreviewThumbnail(),
  };
  await saveHistoryEntry(entry);
  await refreshLocalCollections();
  setStatus("Код сохранён в историю.");
}

function historySafeQrPayload(): string {
  if (state.qr.contentType !== "wifi" || state.qr.payloads.wifi.savePassword) {
    return currentPayload();
  }
  const payloads = structuredClone(state.qr.payloads);
  payloads.wifi.password = "";
  return buildQrPayload(state.qr.contentType, payloads);
}

function defaultQrHistoryTitle(): string {
  return sanitizeFileName(state.qr.fileName || `qr-${state.qr.contentType}`, `qr-${state.qr.contentType}`);
}

function currentPreviewThumbnail(): string {
  const svg = qrPreview.querySelector("svg");
  if (svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }
  const canvas = qrPreview.querySelector("canvas");
  return canvas ? canvas.toDataURL("image/png") : "";
}

function saveCurrentTemplate(): void {
  const name = window.prompt("Название шаблона", "Мой стиль");
  if (!name) return;
  const { payloads, contentType, width, height, fileName, ...styleSettings } = structuredClone(state.qr);
  void payloads;
  void contentType;
  void width;
  void height;
  void fileName;
  saveTemplate({
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    settings: styleSettings,
  });
}

function handleTemplateAction(target: HTMLElement): boolean {
  const applyButton = target.closest<HTMLButtonElement>("[data-apply-template]");
  const exportButton = target.closest<HTMLButtonElement>("[data-export-template]");
  const renameButton = target.closest<HTMLButtonElement>("[data-rename-template]");
  const deleteButton = target.closest<HTMLButtonElement>("[data-delete-template]");
  const templateId = applyButton?.dataset.applyTemplate ?? exportButton?.dataset.exportTemplate ?? renameButton?.dataset.renameTemplate ?? deleteButton?.dataset.deleteTemplate;
  if (!templateId) return false;

  const template = styleTemplates.find((item) => item.id === templateId);
  if (!template) return true;

  if (applyButton) {
    state.qr = { ...state.qr, ...template.settings };
    render();
    setStatus("Шаблон применён.");
  } else if (exportButton) {
    downloadBlob(`${sanitizeFileName(template.name, "template")}.json`, exportTemplate(template));
  } else if (renameButton) {
    const name = window.prompt("Новое название шаблона", template.name);
    if (name) {
      renameTemplate(template.id, name);
      void refreshLocalCollections();
    }
  } else if (deleteButton) {
    deleteTemplate(template.id);
    void refreshLocalCollections();
  }

  return true;
}

async function importTemplateFile(file: File): Promise<void> {
  try {
    importTemplate(await file.text());
    await refreshLocalCollections();
    setStatus("Шаблон импортирован.");
  } catch {
    setStatus("Не удалось импортировать шаблон.", true);
  }
}

async function handleHistoryAction(target: HTMLElement): Promise<boolean> {
  const openButton = target.closest<HTMLButtonElement>("[data-open-history]");
  const duplicateButton = target.closest<HTMLButtonElement>("[data-duplicate-history]");
  const renameButton = target.closest<HTMLButtonElement>("[data-rename-history]");
  const deleteButton = target.closest<HTMLButtonElement>("[data-delete-history]");
  const id = openButton?.dataset.openHistory ?? duplicateButton?.dataset.duplicateHistory ?? renameButton?.dataset.renameHistory ?? deleteButton?.dataset.deleteHistory;
  if (!id) return false;

  const entry = historyEntries.find((item) => item.id === id);
  if (!entry) return true;

  if (openButton || duplicateButton) {
    applyHistoryEntry(entry, Boolean(duplicateButton));
  } else if (renameButton) {
    const title = window.prompt("Новое название", entry.title);
    if (title) await renameHistoryEntry(entry.id, title);
    await refreshLocalCollections();
  } else if (deleteButton) {
    await deleteHistoryEntry(entry.id);
    await refreshLocalCollections();
  }

  return true;
}

function applyHistoryEntry(entry: HistoryEntry, duplicate: boolean): void {
  if (entry.kind === "qr") {
    state.mode = "qr";
    state.qr = structuredClone(entry.settings as QRSettings);
    if (duplicate) state.qr.fileName = `${entry.title}-copy`;
  } else {
    state.mode = "barcode";
    state.barcode = structuredClone(entry.settings as BarcodeSettings);
    if (duplicate) state.barcode.fileName = `${entry.title}-copy`;
  }
  render();
  setStatus(duplicate ? "Запись истории продублирована." : "Запись истории открыта.");
}

async function handleBatchCsv(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = Papa.parse<BatchRecord>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length || !parsed.data.length) {
      throw new Error("CSV не содержит данных.");
    }
    batchRecords = parsed.data;
    batchColumns = parsed.meta.fields ?? Object.keys(parsed.data[0] ?? {});
    batchValueColumn = batchColumns[0] ?? "";
    batchFileNameColumn = batchColumns[1] ?? batchValueColumn;
    batchFileName = file.name;
    render();
    setStatus("CSV загружен.");
  } catch {
    setStatus("Не удалось прочитать CSV.", true);
  }
}

async function generateBatchZip(): Promise<void> {
  if (!batchRecords.length || !batchValueColumn) {
    setStatus("Загрузите CSV и выберите столбец со значением.", true);
    return;
  }

  try {
    setStatus("Создаю ZIP...");
    const zip = await buildBatchZip({
      records: batchRecords,
      valueColumn: batchValueColumn,
      fileNameColumn: batchFileNameColumn || batchValueColumn,
      kind: batchKind,
      format: batchFormat,
      qrSettings: state.qr,
      barcodeSettings: state.barcode,
      onProgress: (done, total) => setStatus(`Пакетная генерация: ${done} из ${total}`),
    });
    downloadBlob(`qr-code-studio-batch-${Date.now()}.zip`, zip);
    setStatus("ZIP готов.");
  } catch (error) {
    console.error(error);
    setStatus("Не удалось создать ZIP. Проверьте CSV и формат кодов.", true);
  }
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function setStatus(message: string, isError = false): void {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}

function persist(): void {
  saveSettings(state);
}
