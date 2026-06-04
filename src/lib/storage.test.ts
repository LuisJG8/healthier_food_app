import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVITY_KEY,
  loadActivityDays,
  loadScanHistory,
  loadSettings,
  recordActivity,
  saveActivityDays,
  saveScanHistory,
  saveSettings,
  SCAN_HISTORY_KEY,
  SETTINGS_KEY,
} from "./storage";

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

  it("records multiple activity event types on the same day", () => {
    recordActivity("login", new Date(2026, 4, 31, 9));
    recordActivity("barcode_scan", new Date(2026, 4, 31, 12));
    recordActivity("profile_view", new Date(2026, 4, 31, 18));

    expect(loadActivityDays()).toEqual([
      {
        date: "2026-05-31",
        count: 3,
        events: {
          login: 1,
          barcode_scan: 1,
          profile_view: 1,
        },
      },
    ]);
  });

  it("filters corrupted activity entries and event counts", () => {
    localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify([
        { date: "2026-05-31", count: 2, events: { login: 1, barcode_scan: 1, unknown: 4 } },
        { date: "2026-02-30", count: 1, events: { login: 1 } },
        { date: "2026-06-01", count: -1, events: { login: 1 } },
        { date: "2026-06-02", count: "1", events: { login: 1 } },
        { date: "2026-06-03", count: 1, events: { login: "1", profile_view: Number.NaN } },
      ]),
    );

    expect(loadActivityDays()).toEqual([
      { date: "2026-05-31", count: 2, events: { login: 1, barcode_scan: 1 } },
      { date: "2026-06-03", count: 1, events: {} },
    ]);
  });

  it("retains roughly the last 400 activity days", () => {
    const days = Array.from({ length: 405 }, (_, index) => ({
      date: toDateKey(new Date(2025, 0, 1 + index)),
      count: 1,
      events: { login: 1 },
    }));

    saveActivityDays(days);

    const stored = loadActivityDays();
    expect(stored).toHaveLength(400);
    expect(stored[0]?.date).toBe(toDateKey(new Date(2025, 0, 6)));
    expect(stored.at(-1)?.date).toBe(toDateKey(new Date(2025, 0, 405)));
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
    expect(() => saveActivityDays([{ date: "2026-05-31", count: 1, events: { login: 1 } }])).not.toThrow();
    expect(() => recordActivity("login", new Date(2026, 4, 31))).not.toThrow();
  });
});

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
