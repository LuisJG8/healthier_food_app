const VALID_BARCODE_LENGTHS = new Set([8, 12, 13]);
const BARCODE_INPUT_PATTERN = /^[\d\s-]+$/;

export function normalizeBarcode(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidBarcode(input: string): boolean {
  return getBarcodeError(input) === null;
}

export function getBarcodeError(input: string): string | null {
  if (!input.trim()) {
    return "Enter a UPC or EAN barcode.";
  }

  if (!BARCODE_INPUT_PATTERN.test(input)) {
    return "Barcode can only contain numbers, spaces, or hyphens.";
  }

  const normalized = normalizeBarcode(input);

  if (!VALID_BARCODE_LENGTHS.has(normalized.length)) {
    return "Use an 8, 12, or 13 digit UPC/EAN barcode.";
  }

  return null;
}
