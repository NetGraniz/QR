import QRCodeStyling from "qr-code-styling";
import "./styles.css";
import {
  CORNER_DOT_TYPES,
  CORNER_SQUARE_TYPES,
  DEFAULT_SETTINGS,
  DOT_TYPES,
  DOWNLOAD_FORMATS,
  PRESETS,
  QRStudioSettings,
  buildQrOptions,
  resetVisualSettings,
} from "./qrConfig";
import { loadSettings, saveSettings } from "./storage";
import { buildScanWarnings, clampNumber, validateLogoFile } from "./validation";

type ControlMap = {
  data: HTMLTextAreaElement;
  width: HTMLInputElement;
  height: HTMLInputElement;
  margin: HTMLInputElement;
  dotsColor: HTMLInputElement;
  backgroundColor: HTMLInputElement;
  cornersColor: HTMLInputElement;
  dotsType: HTMLSelectElement;
  cornersSquareType: HTMLSelectElement;
  cornersDotType: HTMLSelectElement;
  logoInput: HTMLInputElement;
  imageSize: HTMLInputElement;
  imageSizeValue: HTMLElement;
  imageMargin: HTMLInputElement;
  hideBackgroundDots: HTMLInputElement;
  downloadFormat: HTMLSelectElement;
};

let settings: QRStudioSettings = loadSettings();
let logoDataUrl = "";
let qrCode: QRCodeStyling | null = null;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container was not found.");
}

app.innerHTML = `
  <main class="page-shell">
    <section class="intro">
      <div>
        <p class="eyebrow">Frontend QR generator</p>
        <h1>QR Code Studio</h1>
        <p class="lead">Создавайте QR-коды с фирменными цветами, мягкими формами и логотипом прямо в браузере.</p>
      </div>
      <div class="intro-badge">GitHub Pages ready</div>
    </section>

    <section class="studio-layout" aria-label="QR Code Studio workspace">
      <form class="settings-panel" id="settingsForm">
        <div class="panel-heading">
          <h2>Настройки</h2>
          <button class="ghost-button" id="resetButton" type="button">Сбросить настройки</button>
        </div>

        <label class="field full-width" for="data">
          <span>Текст или ссылка</span>
          <textarea id="data" rows="4" placeholder="https://example.com"></textarea>
        </label>

        <fieldset>
          <legend>Пресеты</legend>
          <div class="preset-grid" id="presetGrid"></div>
        </fieldset>

        <fieldset>
          <legend>Размер</legend>
          <div class="control-grid">
            <label class="field" for="width">
              <span>Ширина, px</span>
              <input id="width" type="number" min="160" max="900" step="10" />
            </label>
            <label class="field" for="height">
              <span>Высота, px</span>
              <input id="height" type="number" min="160" max="900" step="10" />
            </label>
            <label class="field" for="margin">
              <span>Отступ, px</span>
              <input id="margin" type="number" min="0" max="80" step="1" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Цвета</legend>
          <div class="control-grid">
            <label class="field color-field" for="dotsColor">
              <span>Точки</span>
              <input id="dotsColor" type="color" />
            </label>
            <label class="field color-field" for="backgroundColor">
              <span>Фон</span>
              <input id="backgroundColor" type="color" />
            </label>
            <label class="field color-field" for="cornersColor">
              <span>Углы</span>
              <input id="cornersColor" type="color" />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Форма</legend>
          <div class="control-grid">
            <label class="field" for="dotsType">
              <span>Точки QR</span>
              <select id="dotsType"></select>
            </label>
            <label class="field" for="cornersSquareType">
              <span>Большие углы</span>
              <select id="cornersSquareType"></select>
            </label>
            <label class="field" for="cornersDotType">
              <span>Точки углов</span>
              <select id="cornersDotType"></select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Логотип</legend>
          <div class="logo-row">
            <label class="file-button" for="logoInput">Загрузить логотип</label>
            <input id="logoInput" type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" />
            <button class="ghost-button" id="removeLogoButton" type="button">Удалить логотип</button>
          </div>
          <p class="logo-name" id="logoName">Логотип не выбран</p>
          <div class="control-grid">
            <label class="field" for="imageSize">
              <span>Размер логотипа <b id="imageSizeValue"></b></span>
              <input id="imageSize" type="range" min="0.05" max="0.35" step="0.01" />
            </label>
            <label class="field" for="imageMargin">
              <span>Отступ логотипа, px</span>
              <input id="imageMargin" type="number" min="0" max="30" step="1" />
            </label>
            <label class="toggle-field" for="hideBackgroundDots">
              <input id="hideBackgroundDots" type="checkbox" />
              <span>Скрывать точки под логотипом</span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Скачивание</legend>
          <div class="download-row">
            <label class="field" for="downloadFormat">
              <span>Формат</span>
              <select id="downloadFormat"></select>
            </label>
            <button class="primary-button" id="downloadButton" type="button">Скачать QR-код</button>
          </div>
        </fieldset>
      </form>

      <aside class="preview-panel" aria-label="Live QR preview">
        <div class="preview-card">
          <div class="preview-header">
            <h2>Предпросмотр</h2>
            <span id="qrSizeLabel"></span>
          </div>
          <div class="qr-stage">
            <div id="qrPreview" aria-live="polite"></div>
          </div>
          <div class="message-stack">
            <p class="status-message" id="statusMessage" role="status"></p>
            <div class="warning-box" id="warningBox" hidden></div>
          </div>
        </div>
      </aside>
    </section>
  </main>
`;

const controls: ControlMap = {
  data: getElement("data", HTMLTextAreaElement),
  width: getElement("width", HTMLInputElement),
  height: getElement("height", HTMLInputElement),
  margin: getElement("margin", HTMLInputElement),
  dotsColor: getElement("dotsColor", HTMLInputElement),
  backgroundColor: getElement("backgroundColor", HTMLInputElement),
  cornersColor: getElement("cornersColor", HTMLInputElement),
  dotsType: getElement("dotsType", HTMLSelectElement),
  cornersSquareType: getElement("cornersSquareType", HTMLSelectElement),
  cornersDotType: getElement("cornersDotType", HTMLSelectElement),
  logoInput: getElement("logoInput", HTMLInputElement),
  imageSize: getElement("imageSize", HTMLInputElement),
  imageSizeValue: getElement("imageSizeValue", HTMLElement),
  imageMargin: getElement("imageMargin", HTMLInputElement),
  hideBackgroundDots: getElement("hideBackgroundDots", HTMLInputElement),
  downloadFormat: getElement("downloadFormat", HTMLSelectElement),
};

const qrPreview = getElement("qrPreview", HTMLDivElement);
const warningBox = getElement("warningBox", HTMLDivElement);
const statusMessage = getElement("statusMessage", HTMLParagraphElement);
const logoName = getElement("logoName", HTMLParagraphElement);
const qrSizeLabel = getElement("qrSizeLabel", HTMLSpanElement);
const presetGrid = getElement("presetGrid", HTMLDivElement);
const downloadButton = getElement("downloadButton", HTMLButtonElement);
const resetButton = getElement("resetButton", HTMLButtonElement);
const removeLogoButton = getElement("removeLogoButton", HTMLButtonElement);

populateSelect(controls.dotsType, DOT_TYPES);
populateSelect(controls.cornersSquareType, CORNER_SQUARE_TYPES);
populateSelect(controls.cornersDotType, CORNER_DOT_TYPES);
populateSelect(controls.downloadFormat, DOWNLOAD_FORMATS);
renderPresets();
syncControls();
renderQr();
bindEvents();

function getElement<T extends HTMLElement>(id: string, constructor: { new (): T }): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Element #${id} was not found or has an invalid type.`);
  }

  return element;
}

function populateSelect(select: HTMLSelectElement, values: string[]): void {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function renderPresets(): void {
  presetGrid.innerHTML = PRESETS.map(
    (preset, index) => `
      <button class="preset-button" type="button" data-preset-index="${index}">
        <span class="preset-swatch" style="--dot:${preset.settings.dotsColor}; --bg:${preset.settings.backgroundColor}; --corner:${preset.settings.cornersColor}"></span>
        ${preset.name}
      </button>
    `,
  ).join("");

  presetGrid.querySelectorAll<HTMLButtonElement>(".preset-button").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = PRESETS[Number(button.dataset.presetIndex)];
      settings = {
        ...settings,
        ...preset.settings,
      };
      setStatus(`Пресет «${preset.name}» применён.`);
      syncControls();
      renderQr();
    });
  });
}

function bindEvents(): void {
  controls.data.addEventListener("input", () => updateSetting("data", controls.data.value));
  controls.width.addEventListener("input", () => updateSetting("width", clampNumber(controls.width.value, 160, 900, DEFAULT_SETTINGS.width)));
  controls.height.addEventListener("input", () => updateSetting("height", clampNumber(controls.height.value, 160, 900, DEFAULT_SETTINGS.height)));
  controls.margin.addEventListener("input", () => updateSetting("margin", clampNumber(controls.margin.value, 0, 80, DEFAULT_SETTINGS.margin)));
  controls.dotsColor.addEventListener("input", () => updateSetting("dotsColor", controls.dotsColor.value));
  controls.backgroundColor.addEventListener("input", () => updateSetting("backgroundColor", controls.backgroundColor.value));
  controls.cornersColor.addEventListener("input", () => updateSetting("cornersColor", controls.cornersColor.value));
  controls.dotsType.addEventListener("change", () => updateSetting("dotsType", controls.dotsType.value as QRStudioSettings["dotsType"]));
  controls.cornersSquareType.addEventListener("change", () =>
    updateSetting("cornersSquareType", controls.cornersSquareType.value as QRStudioSettings["cornersSquareType"]),
  );
  controls.cornersDotType.addEventListener("change", () =>
    updateSetting("cornersDotType", controls.cornersDotType.value as QRStudioSettings["cornersDotType"]),
  );
  controls.imageSize.addEventListener("input", () => updateSetting("imageSize", clampNumber(controls.imageSize.value, 0.05, 0.35, DEFAULT_SETTINGS.imageSize)));
  controls.imageMargin.addEventListener("input", () => updateSetting("imageMargin", clampNumber(controls.imageMargin.value, 0, 30, DEFAULT_SETTINGS.imageMargin)));
  controls.hideBackgroundDots.addEventListener("change", () => updateSetting("hideBackgroundDots", controls.hideBackgroundDots.checked));
  controls.downloadFormat.addEventListener("change", () => updateSetting("downloadFormat", controls.downloadFormat.value as QRStudioSettings["downloadFormat"]));

  controls.logoInput.addEventListener("change", handleLogoUpload);
  removeLogoButton.addEventListener("click", removeLogo);
  resetButton.addEventListener("click", resetSettings);
  downloadButton.addEventListener("click", downloadQr);
}

function updateSetting<K extends keyof QRStudioSettings>(key: K, value: QRStudioSettings[K]): void {
  settings = {
    ...settings,
    [key]: value,
  };

  syncControls();
  renderQr();
}

function syncControls(): void {
  controls.data.value = settings.data;
  controls.width.value = String(settings.width);
  controls.height.value = String(settings.height);
  controls.margin.value = String(settings.margin);
  controls.dotsColor.value = settings.dotsColor;
  controls.backgroundColor.value = settings.backgroundColor;
  controls.cornersColor.value = settings.cornersColor;
  controls.dotsType.value = settings.dotsType;
  controls.cornersSquareType.value = settings.cornersSquareType;
  controls.cornersDotType.value = settings.cornersDotType;
  controls.imageSize.value = String(settings.imageSize);
  controls.imageSizeValue.textContent = `${Math.round(settings.imageSize * 100)}%`;
  controls.imageMargin.value = String(settings.imageMargin);
  controls.hideBackgroundDots.checked = settings.hideBackgroundDots;
  controls.downloadFormat.value = settings.downloadFormat;
  qrSizeLabel.textContent = `${settings.width} × ${settings.height}px`;
}

function renderQr(): void {
  try {
    const options = buildQrOptions(settings, logoDataUrl);

    if (!qrCode) {
      qrCode = new QRCodeStyling(options);
      qrPreview.innerHTML = "";
      qrCode.append(qrPreview);
    } else {
      qrCode.update(options);
    }

    saveSettings(settings);
    renderWarnings();
  } catch (error) {
    setStatus("Не удалось сгенерировать QR-код. Проверьте настройки и попробуйте снова.", true);
    console.error(error);
  }
}

function renderWarnings(): void {
  const warnings = buildScanWarnings({
    ...settings,
    hasLogo: Boolean(logoDataUrl),
  });

  if (!warnings.length) {
    warningBox.hidden = true;
    warningBox.innerHTML = "";
    return;
  }

  const uniqueMessages = [...new Set(warnings.map((warning) => warning.message))];
  warningBox.hidden = false;
  warningBox.innerHTML = uniqueMessages.map((message) => `<p>${message}</p>`).join("");
}

function handleLogoUpload(): void {
  const file = controls.logoInput.files?.[0];
  if (!file) {
    return;
  }

  const error = validateLogoFile(file);
  if (error) {
    setStatus(error, true);
    controls.logoInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    logoDataUrl = typeof reader.result === "string" ? reader.result : "";
    logoName.textContent = file.name;
    setStatus("Логотип добавлен.");
    renderQr();
  });
  reader.addEventListener("error", () => {
    setStatus("Не удалось прочитать файл логотипа.", true);
  });
  reader.readAsDataURL(file);
}

function removeLogo(): void {
  logoDataUrl = "";
  controls.logoInput.value = "";
  logoName.textContent = "Логотип не выбран";
  setStatus("Логотип удалён.");
  renderQr();
}

function resetSettings(): void {
  settings = resetVisualSettings(settings);
  removeLogo();
  syncControls();
  renderQr();
  setStatus("Настройки сброшены, текст сохранён.");
}

async function downloadQr(): Promise<void> {
  if (!settings.data.trim()) {
    setStatus("Введите текст или ссылку перед скачиванием QR-кода.", true);
    return;
  }

  try {
    await qrCode?.download({
      name: "qr-code",
      extension: settings.downloadFormat,
    });
    setStatus("QR-код скачан.");
  } catch (error) {
    setStatus("Не удалось скачать QR-код. Попробуйте другой формат.", true);
    console.error(error);
  }
}

function setStatus(message: string, isError = false): void {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
}
