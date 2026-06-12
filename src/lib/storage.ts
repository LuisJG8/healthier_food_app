import type {
  ActivityDay,
  ActivityEventCounts,
  ActivityEventType,
  AppSettings,
  DietPreference,
  FoodAvoidance,
  MainGoal,
  OnboardingProfile,
  ScanHistoryItem,
  SwapStrictness,
} from "../types";
import { getBarcodeError } from "./barcode";
import { safeOpenFoodFactsImageUrl } from "./sanitize";

export const ACTIVITY_KEY = "betterbite.activity.v1";
export const ONBOARDING_KEY = "betterbite.onboarding.v2";
export const SCAN_HISTORY_KEY = "betterbite.scanHistory.v1";
export const SETTINGS_KEY = "betterbite.settings.v1";

const ACTIVITY_RETENTION_DAYS = 400;
const ACTIVITY_EVENT_TYPES = new Set<ActivityEventType>(["barcode_scan", "profile_view", "login"]);
const MAIN_GOALS: MainGoal[] = [
  "eat-healthier",
  "energy-focus",
  "manage-weight",
  "fitness-goals",
  "reduce-inflammation",
  "long-term-health",
];
const DIET_PREFERENCES: DietPreference[] = ["no-preference", "vegetarian", "vegan", "pescatarian", "keto-low-carb", "gluten-free", "dairy-free"];
const FOODS_TO_AVOID: FoodAvoidance[] = [
  "none",
  "seed-oils",
  "added-sugars",
  "artificial-sweeteners",
  "artificial-colors",
  "high-sodium",
  "gluten",
  "dairy",
  "gmos",
];
const SWAP_STRICTNESS: SwapStrictness[] = [
  "closest-match",
  "cleaner-ingredients",
  "lower-sugar-sodium",
  "avoid-seed-oils",
  "same-convenience",
  "strict-clean-label",
];

const DEFAULT_SETTINGS: AppSettings = {
  strictSeedOilPenalty: true,
};

const DEFAULT_ONBOARDING_PROFILE: OnboardingProfile = {
  mainGoals: [],
  dietPreferences: [],
  foodsToAvoid: [],
  swapStrictness: [],
  completed: false,
};

export function loadActivityDays(): ActivityDay[] {
  const value = readJson<unknown>(ACTIVITY_KEY, []);

  if (!Array.isArray(value)) {
    return [];
  }

  return sanitizeActivityDays(value);
}

export function saveActivityDays(days: ActivityDay[]): void {
  writeJson(ACTIVITY_KEY, sanitizeActivityDays(days));
}

export function recordActivity(type: ActivityEventType, date = new Date()): ActivityDay[] {
  const dateKey = toLocalDateKey(date);
  const existing = loadActivityDays();
  const byDate = new Map(existing.map((day) => [day.date, day]));
  const current = byDate.get(dateKey) ?? { date: dateKey, count: 0, events: {} };
  const nextEvents: ActivityEventCounts = {
    ...current.events,
    [type]: (current.events[type] ?? 0) + 1,
  };

  byDate.set(dateKey, {
    date: dateKey,
    count: current.count + 1,
    events: nextEvents,
  });

  const next = sanitizeActivityDays(Array.from(byDate.values()));
  writeJson(ACTIVITY_KEY, next);
  return next;
}

export function loadScanHistory(): ScanHistoryItem[] {
  const value = readJson<unknown>(SCAN_HISTORY_KEY, []);

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

export function loadOnboardingProfile(): OnboardingProfile {
  return toOnboardingProfile(readJson<unknown>(ONBOARDING_KEY, {}));
}

export function saveOnboardingProfile(profile: OnboardingProfile): OnboardingProfile {
  const safeProfile = toOnboardingProfile(profile);
  writeJson(ONBOARDING_KEY, safeProfile);
  return safeProfile;
}

export function loadSettings(): AppSettings {
  const value = readJson<unknown>(SETTINGS_KEY, {});

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
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
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

function toOnboardingProfile(value: unknown): OnboardingProfile {
  if (!isRecord(value)) {
    return DEFAULT_ONBOARDING_PROFILE;
  }

  const mainGoals = sanitizeOptionArray(value.mainGoals, MAIN_GOALS);
  const dietPreferences = sanitizeOptionArray(value.dietPreferences, DIET_PREFERENCES, "no-preference");
  const foodsToAvoid = sanitizeOptionArray(value.foodsToAvoid, FOODS_TO_AVOID, "none");
  const swapStrictness = sanitizeOptionArray(value.swapStrictness, SWAP_STRICTNESS);

  return {
    mainGoals,
    dietPreferences,
    foodsToAvoid,
    swapStrictness,
    completed: Boolean(value.completed && mainGoals.length && dietPreferences.length && foodsToAvoid.length && swapStrictness.length),
  };
}

function sanitizeOptionArray<T extends string>(value: unknown, allowed: T[], exclusiveValue?: T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedValues = new Set(allowed);
  const selected = value.filter((item): item is T => typeof item === "string" && allowedValues.has(item as T));
  const selectedSet = new Set(selected);
  const uniqueSelected = allowed.filter((item) => selectedSet.has(item));

  if (exclusiveValue && uniqueSelected.includes(exclusiveValue)) {
    return [exclusiveValue];
  }

  return uniqueSelected;
}

function sanitizeActivityDays(values: unknown[]): ActivityDay[] {
  return values
    .map(toActivityDay)
    .filter((day): day is ActivityDay => day !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-ACTIVITY_RETENTION_DAYS);
}

function toActivityDay(value: unknown): ActivityDay | null {
  if (!isRecord(value)) {
    return null;
  }

  const date = trimText(value.date, 10);
  if (!isValidDateKey(date) || typeof value.count !== "number" || !Number.isFinite(value.count)) {
    return null;
  }

  const count = Math.round(value.count);
  if (count < 0) {
    return null;
  }

  return {
    date,
    count,
    events: toActivityEventCounts(value.events),
  };
}

function toActivityEventCounts(value: unknown): ActivityEventCounts {
  if (!isRecord(value)) {
    return {};
  }

  const events: ActivityEventCounts = {};
  for (const [type, count] of Object.entries(value)) {
    if (ACTIVITY_EVENT_TYPES.has(type as ActivityEventType) && typeof count === "number" && Number.isFinite(count) && count > 0) {
      const safeCount = Math.round(count);
      if (safeCount > 0) {
        events[type as ActivityEventType] = safeCount;
      }
    }
  }

  return events;
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
