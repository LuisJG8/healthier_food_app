export type BrowserDetectedBarcode = {
  rawValue?: string;
};

export type BrowserBarcodeDetector = {
  detect: (source: ImageBitmapSource) => Promise<BrowserDetectedBarcode[]>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

const BROWSER_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;

function barcodeDetectorConstructor(): BrowserBarcodeDetectorConstructor | null {
  const detector = (globalThis as typeof globalThis & {
    BarcodeDetector?: BrowserBarcodeDetectorConstructor;
  }).BarcodeDetector;

  return detector ?? null;
}

export function createBrowserBarcodeDetector(): BrowserBarcodeDetector | null {
  const Detector = barcodeDetectorConstructor();

  if (!Detector) {
    return null;
  }

  return new Detector({ formats: [...BROWSER_BARCODE_FORMATS] });
}

export function isBrowserCameraPreviewSupported(): boolean {
  return Boolean(globalThis.navigator?.mediaDevices?.getUserMedia);
}

export function isBrowserCameraScanSupported(): boolean {
  return isBrowserCameraPreviewSupported() && Boolean(barcodeDetectorConstructor());
}
