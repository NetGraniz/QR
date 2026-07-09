# QR Code Studio

QR Code Studio is a static frontend generator for beautiful QR codes. It works fully in the browser: no backend, database, authentication, or file uploads to a server.

## Features

- Live QR preview while editing text or a link.
- Custom width, height, and margin with safe limits.
- Dot, background, corner square, and corner dot colors.
- Dot shapes: `square`, `dots`, `rounded`, `extra-rounded`, `classy`, `classy-rounded`.
- Corner square and corner dot shape controls.
- Local logo upload for PNG, JPG, JPEG, and SVG files.
- Logo size, logo margin, and hide-dots-behind-logo settings.
- High QR error correction level for better logo reliability.
- PNG, JPEG, and SVG download formats.
- Style presets: Classic, Blue Brand, Dark, Soft Rounded, Contrast.
- Scanability warnings for low contrast, large logos, and small QR sizes.
- Settings persistence in `localStorage`.

## Commands

```bash
npm install
npm run dev
npm run build
```

Use `npm run preview` to preview the production build locally.

## GitHub Pages

The Vite config uses `base: "./"`, so the built files work under a repository path such as `https://netgraniz.github.io/QR/`.

This repository includes `.github/workflows/pages.yml`. Push the project to the `main` branch, then enable GitHub Pages with **GitHub Actions** as the source in the repository settings.

For manual publishing:

1. Run `npm run build`.
2. Publish the contents of `dist` with GitHub Pages.
3. In GitHub repository settings, select the branch or deployment workflow that serves the generated static files.

## Project Structure

```text
src/
  main.ts            App entry point and UI event wiring.
  qrConfig.ts        QR defaults, presets, and option builders.
  storage.ts         localStorage load/save helpers.
  validation.ts      Input, logo file, contrast, and scanability checks.
  styles.css         Responsive app styling.
.github/workflows/
  pages.yml          GitHub Pages deployment workflow.
```
