import { invoke } from "@tauri-apps/api/core";
import type { OpenFoodFactsApiResponse, OpenFoodFactsApiProduct, Product } from "../types";
import { getBarcodeError, normalizeBarcode } from "./barcode";
import { safeOpenFoodFactsImageUrl } from "./sanitize";

const OPEN_FOOD_FACTS_TIMEOUT_MS = 10_000;

export const OPEN_FOOD_FACTS_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "categories",
  "categories_tags",
  "ingredients_text",
  "ingredients_text_en",
  "ingredients_tags",
  "additives_tags",
  "allergens_tags",
  "labels_tags",
  "nutriments",
  "nova_group",
  "nutriscore_grade",
  "ecoscore_grade",
  "image_front_url",
  "image_url",
].join(",");

export async function fetchProductByBarcode(input: string): Promise<Product> {
  const validationError = getBarcodeError(input);

  if (validationError) {
    throw new Error(validationError);
  }

  const barcode = normalizeBarcode(input);

  if (isTauriRuntime()) {
    return invoke<Product>("fetch_product_by_barcode", { barcode });
  }

  return fetchProductInBrowser(barcode);
}

export async function fetchProductInBrowser(barcode: string): Promise<Product> {
  const url = buildOpenFoodFactsUrl(barcode);
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), OPEN_FOOD_FACTS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Open Food Facts request timed out.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}`);
  }

  const payload = (await response.json()) as OpenFoodFactsApiResponse;
  return normalizeOpenFoodFactsResponse(payload, barcode);
}

export function normalizeOpenFoodFactsResponse(payload: OpenFoodFactsApiResponse, barcode: string): Product {
  if (payload.status === 0 || !payload.product) {
    throw new Error("Product was not found in Open Food Facts.");
  }

  return normalizeOpenFoodFactsProduct(payload.product, String(payload.code ?? barcode));
}

export function normalizeOpenFoodFactsProduct(product: OpenFoodFactsApiProduct, fallbackBarcode: string): Product {
  const name = firstText(product.product_name, product.product_name_en, product.generic_name, "Unknown product");
  const ingredientsText = firstText(product.ingredients_text, product.ingredients_text_en);

  return {
    barcode: String(product.code ?? fallbackBarcode),
    name,
    brand: emptyToUndefined(product.brands),
    categories: cleanTags(product.categories_tags),
    categoriesText: emptyToUndefined(product.categories),
    ingredientsText: emptyToUndefined(ingredientsText),
    ingredientsTags: cleanTags(product.ingredients_tags),
    additivesTags: cleanTags(product.additives_tags),
    allergensTags: cleanTags(product.allergens_tags),
    labelsTags: cleanTags(product.labels_tags),
    nutriments: recordOrEmpty(product.nutriments),
    novaGroup: parseOptionalNumber(product.nova_group),
    nutriscoreGrade: emptyToUndefined(product.nutriscore_grade),
    ecoscoreGrade: emptyToUndefined(product.ecoscore_grade),
    imageUrl: safeOpenFoodFactsImageUrl(product.image_front_url) ?? safeOpenFoodFactsImageUrl(product.image_url),
    source: "open-food-facts",
  };
}

export function buildOpenFoodFactsUrl(barcode: string): string {
  const encodedBarcode = encodeURIComponent(barcode);
  const encodedFields = encodeURIComponent(OPEN_FOOD_FACTS_FIELDS);
  return `https://world.openfoodfacts.org/api/v2/product/${encodedBarcode}.json?fields=${encodedFields}`;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function firstText(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function emptyToUndefined(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed ? trimmed : undefined;
}

function cleanTags(tags?: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " ").trim())
        .filter(Boolean),
    ),
  );
}

function parseOptionalNumber(value?: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
