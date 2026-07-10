# QR Code Studio

QR Code Studio is a lightweight static web app for generating QR codes in the browser. It runs fully on the frontend and is deployable to GitHub Pages.

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
- Local settings persistence in `localStorage`.

## Planned Next Stages

- Barcode generator with Code 128, Code 39, EAN/UPC, ITF-14, and Codabar.
- Scanner mode using BarcodeDetector with fallback where possible.
- IndexedDB history.
- User style templates.
- CSV batch generation.
- PWA manifest and offline cache.

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
    barcodeValidation.ts
    checkDigits.ts
  shared/
    fileNames.ts
    security.ts
    types.ts
  templates/
    templateValidation.ts
  storage.ts
  validation.ts
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
- Node built-in test runner for automated tests
