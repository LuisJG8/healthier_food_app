import { beforeEach, describe, expect, it } from "vitest";
import { loadScanHistory, loadSettings, saveScanHistory, saveSettings, SCAN_HISTORY_KEY, SETTINGS_KEY } from "./storage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  clear(): void {
    this.values.clear();
  }
}

class ThrowingStorage extends MemoryStorage {
  override setItem(): void {
    throw new Error("storage unavailable");
  }
}

describe("storage helpers", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
  });

  it("filters corrupted scan history instead of returning unsafe shapes", () => {
    localStorage.setItem(
      SCAN_HISTORY_KEY,
      JSON.stringify([
        { barcode: "12345678", productName: "Apple", score: 11.4, scannedAt: "2026-05-29T00:00:00.000Z" },
        { barcode: "87654321", productName: "Bad Image", score: 5, scannedAt: "2026-05-29T00:00:00.000Z", imageUrl: "javascript:alert(1)" },
        { barcode: "bad", productName: "Bad barcode", score: 5, scannedAt: "2026-05-29T00:00:00.000Z" },
        { barcode: "12345678", productName: "Bad date", score: 5, scannedAt: "not-a-date" },
      ]),
    );

    expect(loadScanHistory()).toEqual([
      { barcode: "12345678", productName: "Apple", score: 10, scannedAt: "2026-05-29T00:00:00.000Z" },
      { barcode: "87654321", productName: "Bad Image", score: 5, scannedAt: "2026-05-29T00:00:00.000Z" },
    ]);
  });

  it("persists only safe scan history fields", () => {
    saveScanHistory([
      {
        barcode: "12345678",
        productName: "Apple",
        score: 8,
        scannedAt: "2026-05-29T00:00:00.000Z",
        imageUrl: "https://images.openfoodfacts.org/images/products/123/front.jpg",
      },
    ]);

    expect(loadScanHistory()[0]?.imageUrl).toBe("https://images.openfoodfacts.org/images/products/123/front.jpg");
  });

  it("falls back to default settings when stored settings are invalid", () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ strictSeedOilPenalty: "false" }));

    expect(loadSettings()).toEqual({ strictSeedOilPenalty: true });

    saveSettings({ strictSeedOilPenalty: false });
    expect(loadSettings()).toEqual({ strictSeedOilPenalty: false });
  });

  it("does not throw when localStorage writes fail", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new ThrowingStorage(),
      configurable: true,
    });

    expect(() =>
      saveScanHistory([{ barcode: "12345678", productName: "Apple", score: 9, scannedAt: "2026-05-29T00:00:00.000Z" }]),
    ).not.toThrow();
    expect(() => saveSettings({ strictSeedOilPenalty: false })).not.toThrow();
  });
});
