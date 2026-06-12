import { afterEach, describe, expect, it, vi } from "vitest";
import { buildOpenFoodFactsUrl, fetchProductInBrowser, normalizeOpenFoodFactsResponse } from "./openFoodFacts";

describe("Open Food Facts normalization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes a found product response", () => {
    const product = normalizeOpenFoodFactsResponse(
      {
        code: "3017620422003",
        status: 1,
        product: {
          product_name: "Nutella",
          brands: "Ferrero",
          categories: "Spreads",
          categories_tags: ["en:breakfasts", "en:sweet-spreads"],
          ingredients_text: "Sugar, palm oil, hazelnuts, skimmed milk powder, cocoa",
          additives_tags: ["en:e322"],
          labels_tags: ["en:no-gluten"],
          nova_group: "4",
          image_front_url: "https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.1.400.jpg",
          nutriments: {
            sugars_100g: 56.3,
          },
        },
      },
      "3017620422003",
    );

    expect(product.name).toBe("Nutella");
    expect(product.brand).toBe("Ferrero");
    expect(product.categories).toEqual(["breakfasts", "sweet spreads"]);
    expect(product.novaGroup).toBe(4);
    expect(product.imageUrl).toBe("https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.1.400.jpg");
  });

  it("drops untrusted product image URLs", () => {
    const product = normalizeOpenFoodFactsResponse(
      {
        code: "12345678",
        status: 1,
        product: {
          product_name: "Suspicious image product",
          image_front_url: "https://images.openfoodfacts.org.evil.test/front.jpg",
          image_url: "javascript:alert(1)",
        },
      },
      "12345678",
    );

    expect(product.imageUrl).toBeUndefined();
  });

  it("throws for missing products", () => {
    expect(() =>
      normalizeOpenFoodFactsResponse(
        {
          code: "00000000",
          status: 0,
        },
        "00000000",
      ),
    ).toThrow("Product was not found");
  });

  it("handles incomplete ingredient data", () => {
    const product = normalizeOpenFoodFactsResponse(
      {
        code: "12345678",
        status: 1,
        product: {
          product_name: "Mystery snack",
        },
      },
      "12345678",
    );

    expect(product.ingredientsText).toBeUndefined();
    expect(product.ingredientsTags).toEqual([]);
    expect(product.nutriments).toEqual({});
  });

  it("normalizes malformed optional fields without throwing", () => {
    const product = normalizeOpenFoodFactsResponse(
      {
        code: "12345678",
        status: 1,
        product: {
          product_name: "Malformed product",
          categories_tags: "en:snacks",
          ingredients_tags: [42, "en:apple"],
          additives_tags: null,
          labels_tags: ["en:organic", false],
          nutriments: ["not", "a", "record"],
        } as never,
      },
      "12345678",
    );

    expect(product.categories).toEqual([]);
    expect(product.ingredientsTags).toEqual(["apple"]);
    expect(product.additivesTags).toEqual([]);
    expect(product.labelsTags).toEqual(["organic"]);
    expect(product.nutriments).toEqual({});
  });

  it("caps oversized remote product fields before downstream processing", () => {
    const product = normalizeOpenFoodFactsResponse(
      {
        code: "12345678",
        status: 1,
        product: {
          product_name: "A".repeat(300),
          brands: "B".repeat(300),
          categories: "C".repeat(5_000),
          ingredients_text: "I".repeat(5_000),
          categories_tags: Array.from({ length: 120 }, (_, index) => `en:category-${index}-${"x".repeat(120)}`),
          ingredients_tags: Array.from({ length: 120 }, (_, index) => `en:ingredient-${index}`),
          nutriments: Object.fromEntries([
            ...Array.from({ length: 160 }, (_, index) => [`nutriment_${index}`, index]),
            ["nested", { value: "ignored" }],
            ["long_text", "T".repeat(500)],
          ]),
        },
      },
      "12345678",
    );

    expect(product.name).toHaveLength(160);
    expect(product.brand).toHaveLength(160);
    expect(product.categoriesText).toHaveLength(4_000);
    expect(product.ingredientsText).toHaveLength(4_000);
    expect(product.categories).toHaveLength(80);
    expect(product.categories.every((tag) => tag.length <= 80)).toBe(true);
    expect(product.ingredientsTags).toHaveLength(80);
    expect(Object.keys(product.nutriments)).toHaveLength(120);
    expect(product.nutriments.nested).toBeUndefined();
    expect(String(product.nutriments.long_text ?? "")).toHaveLength(0);
  });

  it("rejects oversized product responses before parsing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("x".repeat(300_000), {
        status: 200,
        headers: { "content-length": "300000" },
      }),
    );

    await expect(fetchProductInBrowser("12345678")).rejects.toThrow("response was too large");
  });

  it("rejects oversized product response streams without consuming the full body", async () => {
    const chunks = [new Uint8Array(256 * 1024), new Uint8Array(1), new Uint8Array(1)];
    let pulls = 0;
    let canceled = false;

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[pulls];
        pulls += 1;

        if (chunk) {
          controller.enqueue(chunk);
        } else {
          controller.close();
        }
      },
      cancel() {
        canceled = true;
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        status: 200,
      }),
    );

    await expect(fetchProductInBrowser("12345678")).rejects.toThrow("response was too large");
    expect(canceled).toBe(true);
  });

  it("builds the expected product URL", () => {
    expect(buildOpenFoodFactsUrl("12345678")).toContain("/api/v2/product/12345678.json");
    expect(buildOpenFoodFactsUrl("12345678")).toContain("fields=");
  });
});
