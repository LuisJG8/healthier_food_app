import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import { classifyProduct, getAlternatives } from "./alternatives";

describe("structured alternative taxonomy", () => {
  it("classifies Kodiak-style pancake mix as pancake mix", () => {
    const product = testProduct({
      name: "Kodiak Power Cakes Flapjack & Waffle Mix",
      brand: "Kodiak",
      categoriesText: "Pancake mixes, Waffle mixes, Breakfast mixes",
      ingredientsText: "Whole grain wheat flour, whole grain oat flour, wheat protein isolate, brown sugar, leavening",
    });

    expect(classifyProduct(product)).toEqual({ type: "pancake_mix", confidence: "high" });
  });

  it("recommends same-format pancake mixes instead of generic fruit", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Kodiak Power Cakes Protein Pancake Mix",
        categoriesText: "Breakfast foods, Pancake mix",
      }),
    );

    expect(alternatives[0]).toMatchObject({
      category: "Pancake mix",
      name: expect.stringMatching(/pancake|waffle/i),
    });
    expect(alternatives.map((alternative) => alternative.name)).not.toContain("Fresh fruit");
  });

  it("keeps protein bars in the bar format", () => {
    const alternatives = getAlternatives(
      testProduct({
        name: "Chocolate Peanut Butter Protein Bar",
        categoriesText: "Protein bars, Snacks",
      }),
    );

    expect(alternatives[0].category).toBe("Protein bar");
    expect(alternatives[0].name).toMatch(/protein/i);
  });
});

function testProduct(overrides: Partial<Product>): Product {
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
