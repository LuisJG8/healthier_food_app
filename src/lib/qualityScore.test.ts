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
