import type { AppSettings, ScanHistoryItem } from "../types";
import { getBarcodeError } from "./barcode";
import { safeOpenFoodFactsImageUrl } from "./sanitize";

export const SCAN_HISTORY_KEY = "better_bite.scanHistory.v1";
export const SETTINGS_KEY = "better_bite.settings.v1";

const LEGACY_SCAN_HISTORY_KEY = "betterbite.scanHistory.v1";
const LEGACY_SETTINGS_KEY = "betterbite.settings.v1";

const DEFAULT_SETTINGS: AppSettings = {
  strictSeedOilPenalty: true,
};

export function loadScanHistory(): ScanHistoryItem[] {
  const value = readJsonFromKeys<unknown>([SCAN_HISTORY_KEY, LEGACY_SCAN_HISTORY_KEY], []);

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toScanHistoryItem).filter((item): item is ScanHistoryItem => item !== null).slice(0, 20);
}

export function saveScanHistory(items: ScanHistoryItem[]): void {
  const safeItems = items.map(toScanHistoryItem).filter((item): item is ScanHistoryItem => item !== null).slice(0, 20);
  writeJson(SCAN_HISTORY_KEY, safeItems);
}

export function upsertScanHistory(item: ScanHistoryItem): ScanHistoryItem[] {
  const existing = loadScanHistory().filter((entry) => entry.barcode !== item.barcode);
  const next = [item, ...existing].slice(0, 20);
  saveScanHistory(next);
  return next;
}

export function loadSettings(): AppSettings {
  const value = readJsonFromKeys<unknown>([SETTINGS_KEY, LEGACY_SETTINGS_KEY], {});

  return {
    ...DEFAULT_SETTINGS,
    ...(isRecord(value) && typeof value.strictSeedOilPenalty === "boolean"
      ? { strictSeedOilPenalty: value.strictSeedOilPenalty }
      : {}),
  };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, {
    strictSeedOilPenalty: Boolean(settings.strictSeedOilPenalty),
  });
}

function readJson<T>(key: string, fallback: T): T {
  return readJsonFromKeys([key], fallback);
}

function readJsonFromKeys<T>(keys: string[], fallback: T): T {
  try {
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience cache; failed writes should not break scanning.
  }
}

function toScanHistoryItem(value: unknown): ScanHistoryItem | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.barcode !== "string" || getBarcodeError(value.barcode)) {
    return null;
  }

  const productName = trimText(value.productName, 120);
  const scannedAt = trimText(value.scannedAt, 40);

  if (!productName || !scannedAt || Number.isNaN(Date.parse(scannedAt)) || typeof value.score !== "number" || !Number.isFinite(value.score)) {
    return null;
  }

  const item: ScanHistoryItem = {
    barcode: value.barcode,
    productName,
    score: Math.min(10, Math.max(1, Math.round(value.score))),
    scannedAt,
  };

  const brand = trimText(value.brand, 80);
  if (brand) {
    item.brand = brand;
  }

  const imageUrl = safeOpenFoodFactsImageUrl(value.imageUrl);
  if (imageUrl) {
    item.imageUrl = imageUrl;
  }

  return item;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}
