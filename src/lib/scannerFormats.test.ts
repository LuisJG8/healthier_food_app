import { describe, expect, it } from "vitest";
import { getBarcodeScannerFormats } from "./scannerFormats";

const formats = {
  UPC_A: "UPC_A",
  UPC_E: "UPC_E",
  EAN8: "EAN_8",
  EAN13: "EAN_13",
} as const;

describe("getBarcodeScannerFormats", () => {
  it("includes UPC-A on Android and desktop-like targets", () => {
    expect(
      getBarcodeScannerFormats(formats, {
        userAgent: "Mozilla/5.0 (Linux; Android 16)",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      }),
    ).toEqual(["UPC_A", "UPC_E", "EAN_8", "EAN_13"]);
  });

  it("omits UPC-A on iOS because the scanner plugin does not support that format there", () => {
    expect(
      getBarcodeScannerFormats(formats, {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      }),
    ).toEqual(["UPC_E", "EAN_8", "EAN_13"]);
  });

  it("detects iPadOS desktop-style user agents", () => {
    expect(
      getBarcodeScannerFormats(formats, {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toEqual(["UPC_E", "EAN_8", "EAN_13"]);
  });
});
