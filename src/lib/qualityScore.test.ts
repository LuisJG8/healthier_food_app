import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import { scoreProduct } from "./qualityScore";

describe("scoreProduct", () => {
  it("scores soda with corn syrup and ultra-processing low", () => {
    const result = scoreProduct(
      product({
        name: "Cola",
        categoriesText: "Sodas",
        ingredientsText:
          "Carbonated water, high fructose corn syrup, caramel color, phosphoric acid, natural flavors, caffeine",
        novaGroup: 4,
        additivesTags: ["en:e150d"],
        nutriments: { sugars_100g: 10.6 },
      }),
    );

    expect(result.value).toBeLessThanOrEqual(5);
    expect(result.flags.map((flag) => flag.id)).toContain("corn-syrup");
    expect(result.flags.map((flag) => flag.id)).toContain("sweetened-drink");
    expect(result.flags.map((flag) => flag.id)).toContain("ultra-processed");
  });

  it("scores Doritos-style chips low for seed oils, colors, additives, and ultra-processing", () => {
    const result = scoreProduct(
      product({
        name: "Nacho chips",
        categoriesText: "Chips",
        ingredientsText:
          "Corn, vegetable oil, maltodextrin, salt, cheddar cheese, whey, monosodium glutamate, artificial color red 40, yellow 6, natural flavors, disodium inosinate, disodium guanylate, citric acid, sugar",
        novaGroup: 4,
        additivesTags: ["en:e621", "en:e129", "en:e110", "en:e330", "en:e631"],
      }),
    );

    expect(result.value).toBeLessThanOrEqual(4);
    expect(result.flags.map((flag) => flag.id)).toEqual(
      expect.arrayContaining(["seed-oils", "artificial-colors", "many-additives", "ultra-processed"]),
    );
  });

  it("scores Siete-style chips as a cleaner packaged option", () => {
    const result = scoreProduct(
      product({
        name: "Sea Salt Tortilla Chips",
        brand: "Siete",
        categoriesText: "Tortilla chips",
        ingredientsText: "Cassava flour, avocado oil, coconut flour, chia seed, sea salt",
        novaGroup: 3,
      }),
    );

    expect(result.value).toBeGreaterThanOrEqual(9);
    expect(result.flags.map((flag) => flag.id)).not.toContain("seed-oils");
  });

  it("scores an apple as excellent", () => {
    const result = scoreProduct(
      product({
        name: "Apple",
        categoriesText: "Fresh fruit",
        ingredientsText: "Apple",
        novaGroup: 1,
      }),
    );

    expect(result.value).toBe(10);
    expect(result.label).toBe("Excellent");
  });

  it("covers the score bands used by the swap experience", () => {
    const cases = [
      {
        name: "Low quality",
        product: product({
          name: "Extreme cola",
          categoriesText: "Soda",
          ingredientsText:
            "Carbonated water, high fructose corn syrup, corn syrup, caramel color, red 40, yellow 5, sodium benzoate, potassium sorbate, polysorbate 80, sugar, artificial color",
          novaGroup: 4,
          additivesTags: ["en:e150d", "en:e129", "en:e102", "en:e211", "en:e202", "en:e433"],
          nutriments: { sugars_100g: 40 },
        }),
        expectedLabel: "Low quality",
        maximum: 2,
      },
      {
        name: "Limit",
        product: product({
          name: "Conventional nacho chips",
          categoriesText: "Tortilla chips",
          ingredientsText:
            "Corn, vegetable oil, maltodextrin, salt, cheddar cheese, whey, artificial color red 40, yellow 6, natural flavors, sugar",
          novaGroup: 4,
          additivesTags: ["en:e129", "en:e110", "en:e621", "en:e631"],
        }),
        expectedLabel: "Limit",
        minimum: 3,
        maximum: 4,
      },
      {
        name: "Mixed",
        product: product({
          name: "Packaged sweet crackers",
          categoriesText: "Crackers",
          ingredientsText: "Wheat flour, cane sugar, soybean oil, salt, natural flavor, xanthan gum, citric acid, calcium propionate",
          novaGroup: 3,
          nutriments: { sugars_100g: 12 },
        }),
        expectedLabel: "Mixed",
        minimum: 5,
        maximum: 6,
      },
      {
        name: "Clean pick",
        product: product({
          name: "Granola bar",
          categoriesText: "Snack bar",
          ingredientsText: "Oats, almonds, rice crisps, honey, cane sugar, sea salt, natural flavor, sunflower oil",
          novaGroup: 3,
          nutriments: { sugars_100g: 9 },
        }),
        expectedLabel: "Clean pick",
        minimum: 7,
        maximum: 8,
      },
      {
        name: "Excellent",
        product: product({
          name: "Sea Salt Tortilla Chips",
          brand: "Siete",
          categoriesText: "Tortilla chips",
          ingredientsText: "Cassava flour, avocado oil, coconut flour, chia seed, sea salt",
          novaGroup: 3,
        }),
        expectedLabel: "Excellent",
        minimum: 9,
      },
    ];

    for (const item of cases) {
      const result = scoreProduct(item.product);

      expect(result.label, item.name).toBe(item.expectedLabel);
      if (item.minimum !== undefined) {
        expect(result.value, item.name).toBeGreaterThanOrEqual(item.minimum);
      }
      if (item.maximum !== undefined) {
        expect(result.value, item.name).toBeLessThanOrEqual(item.maximum);
      }
    }
  });

  it("keeps the missing ingredient path neutral and low confidence", () => {
    const result = scoreProduct(
      product({
        name: "Unknown packaged snack",
        ingredientsText: undefined,
        ingredientsTags: [],
      }),
    );

    expect(result.value).toBe(5);
    expect(result.label).toBe("Needs review");
    expect(result.confidence).toBe("low");
  });

  it("scores organic milk as excellent", () => {
    const result = scoreProduct(
      product({
        name: "Organic Whole Milk",
        categoriesText: "Milk",
        ingredientsText: "Organic grade A milk, vitamin D3",
        labelsTags: ["organic"],
        novaGroup: 1,
      }),
    );

    expect(result.value).toBe(10);
    expect(result.positives.map((flag) => flag.id)).toContain("organic");
  });

  it("does not treat no-added-sugar labels as added sugar ingredients", () => {
    const result = scoreProduct(
      product({
        name: "No Added Sugar Almonds",
        categoriesText: "Snacks",
        ingredientsText: "Almonds, sea salt",
        labelsTags: ["en:no-added-sugar"],
        nutriments: { sugars_100g: 1 },
      }),
    );

    expect(result.flags.map((flag) => flag.id)).not.toContain("added-sugar");
    expect(result.flags.map((flag) => flag.id)).not.toContain("high-added-sugar");
  });

  it("uses a neutral score when ingredient data is missing", () => {
    const result = scoreProduct(
      product({
        name: "Unknown product",
        ingredientsText: undefined,
        ingredientsTags: [],
      }),
    );

    expect(result.value).toBe(5);
    expect(result.confidence).toBe("low");
    expect(result.flags.map((flag) => flag.id)).toContain("missing-ingredients");
  });
});

function product(overrides: Partial<Product>): Product {
  return {
    barcode: "123456789012",
    name: "Test product",
    categories: [],
    ingredientsTags: [],
    additivesTags: [],
    allergensTags: [],
    labelsTags: [],
    nutriments: {},
    source: "open-food-facts",
    ...overrides,
  };
}
