# Better Bite

Better Bite is a React + Tauri app for scanning or entering food barcodes, scoring ingredient quality, and suggesting a healthier alternative that still matches the original craving.

## Requirements

- Node.js 20 or newer
- pnpm 11.0.6
- Rust, if you want to run the Tauri desktop app

If pnpm is not installed, enable it through Corepack:

```sh
corepack enable
corepack prepare pnpm@11.0.6 --activate
```

For the desktop app, install Rust from https://rustup.rs/. On macOS, also install Apple command line tools:

```sh
xcode-select --install
```

## Run in the Browser

This is the quickest way to try the app.

```sh
pnpm install
pnpm dev
```

Then open:

```text
http://127.0.0.1:1420
```

## Run as a Desktop App

Install dependencies first:

```sh
pnpm install
```

Then start the Tauri app:

```sh
pnpm tauri dev
```

The first run can take a few minutes because Rust dependencies need to compile.

## Useful Commands

```sh
pnpm dev
```

Start the Vite browser dev server.

```sh
pnpm tauri dev
```

Start the Tauri desktop app.

```sh
pnpm test
```

Run the unit tests.

```sh
pnpm build
```

Type-check and build the web app into `dist/`.

## Trying a Product Lookup

Product lookup uses Open Food Facts, so use a real packaged-food barcode when trying the app. Internet access is required for barcode lookups.

If a barcode is not available in Open Food Facts, the app will show a product-not-found message.

## Troubleshooting

If `pnpm` is not found, run:

```sh
corepack enable
corepack prepare pnpm@11.0.6 --activate
```

If `pnpm tauri dev` fails because Rust is missing, install Rust from https://rustup.rs/ and restart your terminal.

If the desktop app opens but product lookup fails, try the browser version with `pnpm dev` and make sure your internet connection allows requests to Open Food Facts.
