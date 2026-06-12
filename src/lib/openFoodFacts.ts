import { invoke } from "@tauri-apps/api/core";
import type { OpenFoodFactsApiResponse, OpenFoodFactsApiProduct, Product } from "../types";
import { getBarcodeError, normalizeBarcode } from "./barcode";
import { safeOpenFoodFactsImageUrl } from "./sanitize";

const OPEN_FOOD_FACTS_TIMEOUT_MS = 10_000;
const OPEN_FOOD_FACTS_MAX_RESPONSE_BYTES = 256 * 1024;
const PRODUCT_TEXT_LIMIT = 4_000;
const PRODUCT_SHORT_TEXT_LIMIT = 160;
const PRODUCT_TAG_LIMIT = 80;
const PRODUCT_TAG_INSPECT_LIMIT = PRODUCT_TAG_LIMIT * 2;
const PRODUCT_TAG_TEXT_LIMIT = 80;
const PRODUCT_NUTRIMENT_LIMIT = 120;
const PRODUCT_NUTRIMENT_INSPECT_LIMIT = PRODUCT_NUTRIMENT_LIMIT * 2;
const PRODUCT_NUTRIMENT_KEY_LIMIT = 80;
const PRODUCT_NUTRIMENT_TEXT_LIMIT = 200;

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
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Open Food Facts request timed out.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Open Food Facts returned ${response.status}`);
  }

  const payload = await readBoundedJsonResponse(response);
  return normalizeOpenFoodFactsResponse(payload, barcode);
}

export function normalizeOpenFoodFactsResponse(payload: OpenFoodFactsApiResponse, barcode: string): Product {
  if (payload.status === 0 || !payload.product) {
    throw new Error("Product was not found in Open Food Facts.");
  }

  return normalizeOpenFoodFactsProduct(payload.product, String(payload.code ?? barcode));
}

export function normalizeOpenFoodFactsProduct(product: OpenFoodFactsApiProduct, fallbackBarcode: string): Product {
  const name = trimText(firstText(product.product_name, product.product_name_en, product.generic_name, "Unknown product"), PRODUCT_SHORT_TEXT_LIMIT);
  const ingredientsText = firstText(product.ingredients_text, product.ingredients_text_en);

  return {
    barcode: trimText(String(product.code ?? fallbackBarcode), PRODUCT_SHORT_TEXT_LIMIT),
    name,
    brand: emptyToUndefined(product.brands, PRODUCT_SHORT_TEXT_LIMIT),
    categories: cleanTags(product.categories_tags),
    categoriesText: emptyToUndefined(product.categories, PRODUCT_TEXT_LIMIT),
    ingredientsText: emptyToUndefined(ingredientsText, PRODUCT_TEXT_LIMIT),
    ingredientsTags: cleanTags(product.ingredients_tags),
    additivesTags: cleanTags(product.additives_tags),
    allergensTags: cleanTags(product.allergens_tags),
    labelsTags: cleanTags(product.labels_tags),
    nutriments: safeNutriments(product.nutriments),
    novaGroup: parseOptionalNumber(product.nova_group),
    nutriscoreGrade: emptyToUndefined(product.nutriscore_grade, PRODUCT_SHORT_TEXT_LIMIT),
    ecoscoreGrade: emptyToUndefined(product.ecoscore_grade, PRODUCT_SHORT_TEXT_LIMIT),
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

async function readBoundedJsonResponse(response: Response): Promise<OpenFoodFactsApiResponse> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > OPEN_FOOD_FACTS_MAX_RESPONSE_BYTES) {
    throw new Error("Open Food Facts response was too large.");
  }

  const body = await readBoundedResponseText(response);
  return JSON.parse(body) as OpenFoodFactsApiResponse;
}

async function readBoundedResponseText(response: Response): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Could not read Open Food Facts response.");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > OPEN_FOOD_FACTS_MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Open Food Facts response was too large.");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new TextDecoder().decode(joinChunks(chunks, totalBytes));
}

function joinChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

function firstText(...values: Array<string | undefined>): string {
  return trimText(values.find((value) => typeof value === "string" && value.trim()) ?? "", PRODUCT_TEXT_LIMIT);
}

function emptyToUndefined(value: unknown, maxLength: number): string | undefined {
  const trimmed = trimText(value, maxLength);
  return trimmed ? trimmed : undefined;
}

function cleanTags(tags?: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags.slice(0, PRODUCT_TAG_INSPECT_LIMIT)) {
    if (cleaned.length >= PRODUCT_TAG_LIMIT) {
      break;
    }

    if (typeof tag !== "string") {
      continue;
    }

    const next = trimText(tag.replace(/^[a-z]{2}:/, "").replace(/-/g, " "), PRODUCT_TAG_TEXT_LIMIT);
    if (next && !seen.has(next)) {
      seen.add(next);
      cleaned.push(next);
    }
  }

  return cleaned;
}

function parseOptionalNumber(value?: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeNutriments(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const safeEntries: Array<[string, unknown]> = [];
  for (const [key, item] of Object.entries(value).slice(0, PRODUCT_NUTRIMENT_INSPECT_LIMIT)) {
    if (safeEntries.length >= PRODUCT_NUTRIMENT_LIMIT) {
      break;
    }

    const safeKey = trimText(key, PRODUCT_NUTRIMENT_KEY_LIMIT);
    const safeValue = safeNutrimentValue(item);
    if (safeKey && safeValue !== undefined) {
      safeEntries.push([safeKey, safeValue]);
    }
  }

  return Object.fromEntries(safeEntries);
}

function safeNutrimentValue(value: unknown): unknown {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    return trimText(value, PRODUCT_NUTRIMENT_TEXT_LIMIT);
  }

  if (typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function trimText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
