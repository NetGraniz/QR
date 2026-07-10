# QR Code Studio

QR Code Studio is a lightweight static web app for generating QR codes and linear barcodes in the browser. It runs fully on the frontend and is deployable to GitHub Pages.

## Current Features

- QR modes: URL, plain text, Wi-Fi, vCard, phone, email, SMS, geo coordinates, and calendar event.
- Live QR preview with styled dots, corners, logo support, and presets.
- Safe URL validation for URL QR codes.
- Wi-Fi payload escaping.
- vCard, `mailto:`, `sms:`, `geo:`, and iCalendar payload generation.
- Transparent background for PNG/SVG.
- JPEG fallback warning because JPEG does not support transparency.
- Solid color, linear gradient, and radial gradient for QR dots.
- Separate colors for outer corner squares and inner corner dots.
- Error correction level selector: L, M, Q, H.
- Readability warnings with contrast ratio and final readability rating.
- PNG, JPEG, and SVG export.
- Barcode generator for Code 128, Code 39, EAN-13, EAN-8, UPC-A, UPC-E, ITF-14, and Codabar.
- Barcode validation with automatic check digit calculation for EAN-13, EAN-8, UPC-A, and ITF-14 where the format allows it.
- Barcode styling: bar width, height, colors, transparent background, margins, value text, text size, bold text, and alignment.
- Barcode export to PNG, JPEG, and SVG with PNG scale options.
- Unified export actions for generated QR codes and barcodes: download, copy PNG, copy SVG code, and print.
- Optional QR frame and caption that are included in PNG, JPEG, and SVG exports.
- Scanner mode for images, drag-and-drop, clipboard paste, and camera input.
- Browser `BarcodeDetector` support for QR codes and supported linear barcodes, with `jsQR` fallback for QR images.
- Automatic QR preview verification directly in the browser.
- Safe scan actions: copy result, open only safe links, or create a new code from the scanned value.
- Local IndexedDB history with open, duplicate, rename, delete, and clear actions.
- User style templates with save, apply, rename, delete, JSON export, and JSON import.
- CSV batch generation for QR codes or barcodes, with preview, ZIP export, and a sample file at `public/examples/batch-example.csv`.
- PWA manifest and service worker for installability and offline cache of app assets.
- Local settings persistence in `localStorage`.

## Planned Next Stages

- Richer logo masks, logo background controls, and logo opacity settings.

## Privacy

All data is processed locally in the browser and is not sent to a server. The project does not use analytics, ads, trackers, authentication, backend storage, or paid APIs.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run test
npm run build
```

Use `npm run preview` to preview the production build locally.

## GitHub Pages

The Vite config uses `base: "./"`, so the built files work under:

```text
https://netgraniz.github.io/QR/
```

The repository includes `.github/workflows/pages.yml`, which builds the app and publishes `dist`.

## Project Structure

```text
src/
  main.ts
  styles.css
  qr/
    qrConfig.ts
    qrPayloads.ts
    qrValidation.ts
  barcode/
    barcodeConfig.ts
    barcodeGenerator.ts
    barcodeValidation.ts
    checkDigits.ts
  scanner/
    barcodeDetector.ts
    imageInput.ts
    scanner.ts
  history/
    historyStorage.ts
  export/
    zipExport.ts
  shared/
    fileNames.ts
    security.ts
    types.ts
  templates/
    templateStorage.ts
    templateValidation.ts
  pwa.ts
  storage.ts
  validation.ts
public/
  examples/
    batch-example.csv
tests/
  run-tests.ts
scripts/
  run-tests.mjs
.github/workflows/
  pages.yml
```

## Libraries

- Vite
- TypeScript
- `qr-code-styling`
- `jsbarcode`
- `jsQR`
- `Papa Parse`
- `JSZip`
- Node built-in test runner for automated tests
