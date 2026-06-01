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

## Demo Barcodes

If you do not have a real barcode handy, use one of these built-in demo barcodes:

- `000000000101` - Neon Cola
- `000000000303` - Blazing Cheese Puffs
- `000000000505` - Chewy Chocolate Chip Granola Bar
- `000000000808` - Honey Greek Yogurt
- `000000001010` - Organic Apple Slices

Real product lookups use Open Food Facts, so internet access is needed for non-demo barcodes.

## Troubleshooting

If `pnpm` is not found, run:

```sh
corepack enable
corepack prepare pnpm@11.0.6 --activate
```

If `pnpm tauri dev` fails because Rust is missing, install Rust from https://rustup.rs/ and restart your terminal.

If the desktop app opens but product lookup fails, try the browser version with `pnpm dev` and make sure your internet connection allows requests to Open Food Facts.
