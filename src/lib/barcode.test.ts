import { describe, expect, it } from "vitest";
import { getBarcodeError, isValidBarcode, normalizeBarcode } from "./barcode";

describe("barcode helpers", () => {
  it("normalizes formatted barcode input", () => {
    expect(normalizeBarcode(" 5449-0000 00996 ")).toBe("5449000000996");
  });

  it("accepts UPC and EAN lengths", () => {
    expect(isValidBarcode("12345678")).toBe(true);
    expect(isValidBarcode("123456789012")).toBe(true);
    expect(isValidBarcode("1234567890123")).toBe(true);
    expect(isValidBarcode("5449-0000 00996")).toBe(true);
  });

  it("rejects invalid barcode lengths", () => {
    expect(isValidBarcode("123")).toBe(false);
    expect(getBarcodeError("123")).toBe("Use an 8, 12, or 13 digit UPC/EAN barcode.");
  });

  it("rejects non-barcode characters before normalizing", () => {
    expect(isValidBarcode("abc12345678")).toBe(false);
    expect(getBarcodeError("abc12345678")).toBe("Barcode can only contain numbers, spaces, or hyphens.");
  });
});
