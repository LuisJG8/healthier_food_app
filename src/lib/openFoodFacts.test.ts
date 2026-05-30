import { describe, expect, it } from "vitest";
import { buildOpenFoodFactsUrl, normalizeOpenFoodFactsResponse } from "./openFoodFacts";

describe("Open Food Facts normalization", () => {
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

  it("builds the expected product URL", () => {
    expect(buildOpenFoodFactsUrl("12345678")).toContain("/api/v2/product/12345678.json");
    expect(buildOpenFoodFactsUrl("12345678")).toContain("fields=");
  });
});
